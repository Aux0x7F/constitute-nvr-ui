import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

type LaunchContext = {
  launchId: string;
  app: string;
  repo: string;
  identityId: string;
  devicePk: string;
  gatewayPk: string;
  servicePk: string;
  service: string;
  launchToken: string;
  display?: {
    serviceLabel?: string;
    serviceVersion?: string;
    service?: string;
    status?: string;
    cameraCount?: number;
    configuredSources?: number;
    sources?: string[];
    cameras?: Array<{
      sourceId: string;
      name: string;
      viewGranted: boolean;
      controlGranted: boolean;
      ptzCapable: boolean;
    }>;
    grantedScope?: {
      owner?: boolean;
      viewSources?: string[];
      controlSources?: string[];
    };
    iceServers?: {
      stun?: string[];
      turn?: string[];
    };
  };
  createdAt: number;
  expiresAt: number;
};

type RuntimeMockConfig = {
  launchContext: LaunchContext | null;
  diagnostics?: boolean;
  expireOfferPreflight?: boolean;
  ownerInventory?: boolean;
  adminDelayMs?: number;
  applyDelayMs?: number;
  cameraNetwork?: {
    managed?: boolean;
    interface?: string;
    subnetCidr?: string;
    hostIp?: string;
    dhcpEnabled?: boolean;
    dhcpRangeStart?: string;
    dhcpRangeEnd?: string;
    ntpEnabled?: boolean;
    ntpServer?: string;
    timezone?: string;
    dnsServer?: string;
  };
};

function buildLaunchContext(overrides: Partial<LaunchContext> = {}): LaunchContext {
  const now = Date.now();
  return {
    launchId: "launch-test-001",
    app: "Constitute NVR",
    repo: "constitute-nvr-ui",
    identityId: "identity-test-001",
    devicePk: "devicepk0123456789abcdef",
    gatewayPk: "gatewaypk0123456789abcdef",
    servicePk: "servicepk0123456789abcdef",
    service: "nvr",
    launchToken: "launch-token-001",
    display: {
      serviceLabel: "Lab NVR",
      serviceVersion: "0.2.0",
      service: "nvr",
      status: "ready",
      cameraCount: 2,
      configuredSources: 2,
      sources: ["cam-front", "cam-back"],
      cameras: [
        {
          sourceId: "cam-front",
          name: "Front Camera",
          viewGranted: true,
          controlGranted: true,
          ptzCapable: true,
        },
        {
          sourceId: "cam-back",
          name: "Back Camera",
          viewGranted: true,
          controlGranted: false,
          ptzCapable: false,
        },
      ],
      grantedScope: {
        owner: true,
        viewSources: ["cam-front", "cam-back"],
        controlSources: ["cam-front"],
      },
      iceServers: {
        stun: ["stun:stun.example.invalid:3478"],
      },
    },
    createdAt: now,
    expiresAt: now + 60_000,
    ...overrides,
  };
}

async function installRuntimeHarness(page: Page, config: RuntimeMockConfig = {
  launchContext: buildLaunchContext(),
  diagnostics: false,
  expireOfferPreflight: false,
  ownerInventory: false,
}): Promise<void> {
  await page.addInitScript(({ config }) => {
    const runtimeConfig = config as RuntimeMockConfig;

    if (runtimeConfig.diagnostics) {
      window.localStorage.setItem("constitute.nvr.diagnostics", "1");
    }

    const launchId = String(runtimeConfig.launchContext?.launchId || "launch-test-001");
    const initialContext = runtimeConfig.launchContext ? structuredClone(runtimeConfig.launchContext) : null;
    let currentLaunchToken = String(initialContext?.launchToken || "launch-token-001");
    let launchRefreshCount = 0;
    let sessionCloseCount = 0;
    let offerRequestCount = 0;
    let expiredOfferOnce = false;
    let adminRequestCount = 0;
    let failNextAdmin = false;
    const workerPorts = new Set<MockMessagePort>();
    let lastPeerConnection: MockRTCPeerConnection | null = null;

    const mutableCameras = new Map(
      Array.isArray(initialContext?.display?.cameras)
        ? initialContext.display.cameras.map((camera) => [
            String(camera.sourceId || "").trim(),
            {
              ...structuredClone(camera),
              overlayText: String(camera.name || "").trim(),
            },
          ])
        : [],
    );

    type Listener = (event?: unknown) => void;

    class MockRTCPeerConnection {
      iceGatheringState: RTCIceGatheringState = "new";
      iceConnectionState: RTCIceConnectionState = "new";
      connectionState: RTCPeerConnectionState = "new";
      localDescription: RTCSessionDescriptionInit | null = null;
      remoteDescription: RTCSessionDescriptionInit | null = null;
      private listeners = new Map<string, Set<Listener>>();
      private transceivers: Array<{ mid: string }> = [];

      constructor() {
        lastPeerConnection = this;
      }

      addTransceiver(): { mid: string } {
        const transceiver = { mid: String(this.transceivers.length) };
        this.transceivers.push(transceiver);
        return transceiver;
      }

      getTransceivers(): Array<{ mid: string }> {
        return this.transceivers;
      }

      addEventListener(type: string, listener: Listener): void {
        const bucket = this.listeners.get(type) || new Set<Listener>();
        bucket.add(listener);
        this.listeners.set(type, bucket);
      }

      removeEventListener(type: string, listener: Listener): void {
        this.listeners.get(type)?.delete(listener);
      }

      async createOffer(): Promise<RTCSessionDescriptionInit> {
        return {
          type: "offer",
          sdp: "v=0\r\ns=constitute-nvr-ui-offer\r\n",
        };
      }

      async setLocalDescription(description: RTCSessionDescriptionInit): Promise<void> {
        this.localDescription = description;
        this.iceGatheringState = "complete";
        this.emit("icegatheringstatechange");
      }

      async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
        this.remoteDescription = description;
        this.iceConnectionState = "connected";
        this.connectionState = "connected";
        this.emit("iceconnectionstatechange");
        this.emit("connectionstatechange");
        for (const transceiver of this.transceivers) {
          const stream = new MediaStream();
          this.emit("track", {
            transceiver,
            streams: [stream],
            track: { id: `track-${transceiver.mid}` },
          });
        }
      }

      close(): void {
        this.connectionState = "closed";
      }

      forceConnectionState(state: RTCPeerConnectionState): void {
        this.connectionState = state;
        this.emit("connectionstatechange");
      }

      forceIceConnectionState(state: RTCIceConnectionState): void {
        this.iceConnectionState = state;
        this.emit("iceconnectionstatechange");
      }

      private emit(type: string, event?: unknown): void {
        for (const listener of this.listeners.get(type) || []) {
          listener(event);
        }
      }
    }

    const runtimeState = {
      launchContexts: new Map<string, LaunchContext>(),
      services: {} as Record<string, unknown>,
      resourceNames: {} as Record<string, string>,
    };

    if (initialContext) {
      runtimeState.launchContexts.set(initialContext.launchId, structuredClone(initialContext));
      runtimeState.resourceNames[initialContext.gatewayPk] = "Lab Gateway";
      runtimeState.resourceNames[initialContext.servicePk] = String(initialContext.display?.serviceLabel || "Lab NVR");
      runtimeState.resourceNames[initialContext.identityId] = "tester";
    }

    function runtimeSnapshot() {
      return {
        buildId: "runtime-2.8",
        updatedAt: Date.now(),
        shell: null,
        services: runtimeState.services,
        managedAppliances: {
          owned: [],
          granted: [],
          discoverable: [],
        },
        resourceNames: runtimeState.resourceNames,
        managedServiceIssue: null,
        launchContextCount: runtimeState.launchContexts.size,
      };
    }

    function runtimeResponse(requestId: string, result: unknown, kind = "") {
      return {
        type: "runtime.response",
        requestId,
        kind,
        ok: true,
        result,
      };
    }

    function runtimeError(requestId: string, error: string, kind = "") {
      return {
        type: "runtime.response",
        requestId,
        kind,
        ok: false,
        error,
      };
    }

    class MockMessagePort {
      onmessage: ((event: { data: unknown }) => void) | null = null;

      start(): void {}

      close(): void {}

      dispatch(data: unknown): void {
        this.emit(data);
      }

      postMessage(message: unknown): void {
        const payload = (message && typeof message === "object") ? message as Record<string, unknown> : {};
        window.setTimeout(() => this.respond(payload), 0);
      }

      private emit(data: unknown): void {
        this.onmessage?.({ data });
      }

      private respond(message: Record<string, unknown>): void {
        const type = String(message.type || "");
        const requestId = String(message.requestId || "");

        if (type === "runtime.attach") {
          this.emit({
            type: "runtime.attached",
            buildId: "runtime-2.8",
            snapshot: runtimeSnapshot(),
          });
          return;
        }

        if (type === "runtime.status.put") {
          const status = (message.status && typeof message.status === "object") ? message.status : {};
          runtimeState.services.nvr = status;
          this.emit(runtimeResponse(requestId, runtimeSnapshot(), "runtime.status.put"));
          this.emit({
            type: "runtime.snapshot",
            buildId: "runtime-2.8",
            snapshot: runtimeSnapshot(),
          });
          return;
        }

        if (type === "launchContext.get") {
          const requestedLaunchId = String(message.launchId || "");
          this.emit(runtimeResponse(
            requestId,
            runtimeState.launchContexts.get(requestedLaunchId) || null,
            "launchContext.get",
          ));
          return;
        }

        if (type === "launchContext.put") {
          const context = (message.context && typeof message.context === "object") ? message.context as LaunchContext : null;
          if (context?.launchId) {
            runtimeState.launchContexts.set(context.launchId, structuredClone(context));
            currentLaunchToken = context.launchToken;
          }
          this.emit(runtimeResponse(requestId, context, "launchContext.put"));
          this.emit({
            type: "runtime.snapshot",
            buildId: "runtime-2.8",
            snapshot: runtimeSnapshot(),
          });
          return;
        }

        if (type === "gateway.launch.request") {
          launchRefreshCount += 1;
          const context = runtimeState.launchContexts.get(launchId);
          if (!context) {
            this.emit(runtimeError(requestId, "launch context unavailable", "gateway.launch.request"));
            return;
          }
          currentLaunchToken = `launch-token-${launchRefreshCount + 1}`;
          const refreshedContext: LaunchContext = {
            ...context,
            launchToken: currentLaunchToken,
            createdAt: Date.now(),
            expiresAt: Date.now() + 60_000,
          };
          runtimeState.launchContexts.set(launchId, refreshedContext);
          this.emit(runtimeResponse(requestId, {
            requestId,
            gatewayPk: refreshedContext.gatewayPk,
            servicePk: refreshedContext.servicePk,
            service: refreshedContext.service,
            capability: "nvr.view",
            launchToken: refreshedContext.launchToken,
            display: refreshedContext.display,
            expiresAt: refreshedContext.expiresAt,
            ts: Date.now(),
          }, "gateway.launch.request"));
          return;
        }

        if (type === "gateway.grant.request") {
          const cameras = Array.from(mutableCameras.values());
          this.emit(runtimeResponse(requestId, {
            requestId,
            ok: true,
            result: {
              grants: [],
              availableCameras: cameras.map((camera) => ({
                sourceId: camera.sourceId,
                name: camera.name,
                ptzCapable: camera.ptzCapable,
              })),
            },
          }, "gateway.grant.request"));
          return;
        }

        if (type === "gateway.signal.request") {
          const root = (message.payload && typeof message.payload === "object")
            ? message.payload as Record<string, unknown>
            : {};
          const signalType = String(root.signalType || "");
          const signalRequestId = String(root.requestId || requestId || "signal-request");
          const context = runtimeState.launchContexts.get(launchId);
          if (!context) {
            this.emit(runtimeError(requestId, "launch context unavailable", "gateway.signal.request"));
            return;
          }
          if (runtimeConfig.expireOfferPreflight && signalType === "offer" && !expiredOfferOnce) {
            expiredOfferOnce = true;
            this.emit(runtimeError(requestId, "launch token expired", "gateway.signal.request"));
            return;
          }
          if (signalType === "offer") {
            offerRequestCount += 1;
            this.emit(runtimeResponse(requestId, {
              requestId: signalRequestId,
              ok: true,
              result: {
                payload: {
                  answer: {
                    type: "answer",
                    sdp: "v=0\r\ns=constitute-nvr-ui-test\r\n",
                  },
                  sources: context.display?.sources || [],
                },
              },
            }, "gateway.signal.request"));
            return;
          }
          if (signalType === "admin") {
            adminRequestCount += 1;
            const adminRoot = (root.payload && typeof root.payload === "object")
              ? root.payload as Record<string, unknown>
              : {};
            const adminAction = String(adminRoot.action || "").trim().toLowerCase();
            const adminPayload = (adminRoot.payload && typeof adminRoot.payload === "object")
              ? adminRoot.payload as Record<string, unknown>
              : {};
            const cameras = Array.from(mutableCameras.values());
            const respond = () => {
              if (failNextAdmin) {
                failNextAdmin = false;
                this.emit(runtimeError(requestId, "inventory unavailable", "gateway.signal.request"));
                return;
              }
              if (adminAction === "apply_camera_config") {
                const sourceId = String(adminPayload.sourceId || "").trim();
                const desired = (adminPayload.desired && typeof adminPayload.desired === "object")
                  ? adminPayload.desired as Record<string, unknown>
                  : {};
                const camera = mutableCameras.get(sourceId);
                if (camera) {
                  const nextName = String(desired.displayName || camera.name || "").trim() || camera.name;
                  const nextOverlayText = String(desired.overlayText || camera.overlayText || nextName).trim() || nextName;
                  camera.name = nextName;
                  camera.overlayText = nextOverlayText;
                }
                this.emit(runtimeResponse(requestId, {
                  requestId: signalRequestId,
                  ok: true,
                  result: {
                    payload: {
                      action: "apply_camera_config",
                      mounted: camera
                        ? {
                            sourceId: camera.sourceId,
                            displayName: camera.name,
                            capabilities: {
                              liveView: true,
                              ptz: camera.ptzCapable,
                              timeSync: true,
                              timezone: true,
                              overlayText: true,
                              overlayTimestamp: true,
                            },
                            desired: {
                              displayName: camera.name,
                              overlayText: camera.overlayText,
                              overlayTimestamp: true,
                            },
                            observed: {
                              displayName: camera.name,
                              overlayText: camera.overlayText,
                              overlayTimestamp: true,
                              ptzCapable: camera.ptzCapable,
                            },
                            verification: {
                              status: "verified",
                              message: "Camera configuration applied.",
                            },
                            credentialSafety: {
                              status: "verified",
                              pending: false,
                            },
                          }
                        : null,
                    },
                  },
                }, "gateway.signal.request"));
                return;
              }
              this.emit(runtimeResponse(requestId, {
                requestId: signalRequestId,
                ok: true,
                result: {
                  payload: {
                    inventory: runtimeConfig.ownerInventory
                      ? {
                          mounted: cameras.map((camera) => ({
                            sourceId: camera.sourceId,
                            displayName: camera.name,
                            capabilities: {
                              liveView: true,
                              ptz: camera.ptzCapable,
                              timeSync: true,
                              timezone: true,
                              overlayText: true,
                              overlayTimestamp: true,
                            },
                            desired: {
                              displayName: camera.name,
                              overlayText: camera.overlayText,
                              overlayTimestamp: true,
                            },
                            observed: {
                              displayName: camera.name,
                              overlayText: camera.overlayText,
                              overlayTimestamp: true,
                              ptzCapable: camera.ptzCapable,
                            },
                          })),
                          candidates: [],
                          cameraNetwork: runtimeConfig.cameraNetwork || {
                            managed: true,
                            interface: "eth1",
                            subnetCidr: "192.168.250.0/24",
                            hostIp: "192.168.250.1",
                            dhcpEnabled: true,
                            dhcpRangeStart: "192.168.250.50",
                            dhcpRangeEnd: "192.168.250.199",
                            ntpEnabled: true,
                            ntpServer: "192.168.250.1",
                            timezone: "America/Phoenix",
                            dnsServer: "192.168.250.1",
                          },
                        }
                      : {
                          mounted: [],
                          candidates: [],
                          cameraNetwork: {},
                        },
                  },
                },
              }, "gateway.signal.request"));
            };
            const delayMs = adminAction === "apply_camera_config"
              ? Math.max(0, Number(runtimeConfig.applyDelayMs ?? runtimeConfig.adminDelayMs ?? 0))
              : Math.max(0, Number(runtimeConfig.adminDelayMs || 0));
            if (delayMs > 0) {
              window.setTimeout(respond, delayMs);
            } else {
              respond();
            }
            return;
          }
          if (signalType === "session_close") {
            sessionCloseCount += 1;
            return;
          }
          this.emit(runtimeResponse(requestId, {
            requestId: signalRequestId,
            ok: true,
            result: { ok: true },
          }, "gateway.signal.request"));
        }
      }
    }

    class MockSharedWorker {
      port: MockMessagePort;

      constructor() {
        this.port = new MockMessagePort();
        workerPorts.add(this.port);
      }
    }

    Object.defineProperty(window, "SharedWorker", {
      configurable: true,
      writable: true,
      value: MockSharedWorker,
    });

    Object.defineProperty(window, "RTCPeerConnection", {
      configurable: true,
      writable: true,
      value: MockRTCPeerConnection,
    });

    Object.defineProperty(window, "__runtimeProbe", {
      configurable: true,
      value: {
        get launchRefreshCount() {
          return launchRefreshCount;
        },
        get sessionCloseCount() {
          return sessionCloseCount;
        },
        get currentLaunchToken() {
          return currentLaunchToken;
        },
        get adminRequestCount() {
          return adminRequestCount;
        },
        get offerRequestCount() {
          return offerRequestCount;
        },
        failNextAdmin() {
          failNextAdmin = true;
        },
        failPeerConnection(state = "disconnected") {
          lastPeerConnection?.forceConnectionState(state as RTCPeerConnectionState);
        },
        failIceConnection() {
          lastPeerConnection?.forceIceConnectionState("failed");
        },
        emitRuntimeSnapshot() {
          for (const port of workerPorts) {
            port.dispatch({
              type: "runtime.snapshot",
              buildId: "runtime-2.8",
              snapshot: runtimeSnapshot(),
            });
          }
        },
      },
    });
  }, {
    config,
  });
}

test("boots from runtime launch context and renders a live camera grid", async ({ page }) => {
  await installRuntimeHarness(page);
  await page.goto("/#launch=launch-test-001");

  await expect(page.getByRole("heading", { name: "Constitute NVR" })).toBeVisible();
  await expect(page.locator("#liveView .panelHeader h2")).toHaveText("Cameras");
  await expect(page.locator("#subtitle")).toHaveCount(0);
  await expect(page.locator("#summaryPanel")).toHaveCount(0);
  await expect(page.locator("#btnReconnect")).toHaveCount(0);
  await expect(page.locator("#gridHint")).toHaveCount(0);
  await expect(page.locator(".cameraTile")).toHaveCount(2);
  await expect(page.locator(".cameraStatusDot-live")).toHaveCount(2);
  await expect(page.locator("#connectionBadge")).toHaveCount(0);
});

test("boots live preview without waiting for slow camera administration refresh", async ({ page }) => {
  await installRuntimeHarness(page, {
    launchContext: buildLaunchContext(),
    diagnostics: false,
    expireOfferPreflight: false,
    ownerInventory: true,
    adminDelayMs: 15_000,
  });

  await page.goto("/#launch=launch-test-001");

  await expect(page.locator(".cameraTile")).toHaveCount(2);
  await expect(page.locator("#bootSplash")).toHaveCount(0);
});

test("reconnects live preview automatically after the peer connection drops", async ({ page }) => {
  await installRuntimeHarness(page);
  await page.goto("/#launch=launch-test-001");

  await expect(page.locator(".cameraTile")).toHaveCount(2);
  await expect.poll(async () => {
    return await page.evaluate(() => {
      const probe = (window as Window & {
        __runtimeProbe?: { offerRequestCount?: number };
      }).__runtimeProbe;
      return probe?.offerRequestCount ?? 0;
    });
  }).toBe(1);

  await page.evaluate(() => {
    const probe = (window as Window & {
      __runtimeProbe?: { failPeerConnection?: (state?: string) => void };
    }).__runtimeProbe;
    probe?.failPeerConnection?.("disconnected");
  });

  await expect.poll(async () => {
    return await page.evaluate(() => {
      const probe = (window as Window & {
        __runtimeProbe?: { offerRequestCount?: number };
      }).__runtimeProbe;
      return probe?.offerRequestCount ?? 0;
    });
  }).toBe(2);
  await expect(page.locator(".cameraStatusDot-live")).toHaveCount(2);
});

test("hides the close affordance when no shell opener is available", async ({ page }) => {
  await installRuntimeHarness(page);
  await page.goto("/#launch=launch-test-001");

  await expect(page.getByRole("button", { name: "Return To Constitute" })).toHaveCount(0);
});

test("focuses the shell opener and closes when launched from the shell", async ({ page }) => {
  await installRuntimeHarness(page);
  await page.addInitScript(() => {
    let focused = false;
    let closeRequested = false;
    const opener = {
      closed: false,
      focus() {
        focused = true;
      },
    };

    Object.defineProperty(window, "opener", {
      configurable: true,
      get: () => opener,
    });

    Object.defineProperty(window, "close", {
      configurable: true,
      writable: true,
      value: () => {
        closeRequested = true;
      },
    });

    Object.defineProperty(window, "__closeProbe", {
      configurable: true,
      value: {
        get focused() {
          return focused;
        },
        get closeRequested() {
          return closeRequested;
        },
      },
    });
  });

  await page.goto("/#launch=launch-test-001");

  await page.getByRole("button", { name: "Open navigation" }).click();
  const closeButton = page.getByRole("button", { name: "Return To Constitute" });
  await expect(closeButton).toBeVisible();
  await closeButton.click();

  await expect.poll(async () => {
    return await page.evaluate(() => {
      const probe = (window as Window & {
        __closeProbe?: { focused: boolean; closeRequested: boolean };
      }).__closeProbe;
      return probe ? `${probe.focused}:${probe.closeRequested}` : "false:false";
    });
  }).toBe("true:true");
});

test("refreshes launch token through the shared runtime before offer", async ({ page }) => {
  await installRuntimeHarness(page, {
    launchContext: buildLaunchContext({
      expiresAt: Date.now() - 1_000,
    }),
    diagnostics: true,
    expireOfferPreflight: false,
    ownerInventory: false,
  });

  await page.goto("/#launch=launch-test-001");

  await expect(page.locator(".cameraTile")).toHaveCount(2);
  await expect.poll(async () => {
    return await page.evaluate(() => {
      const probe = (window as Window & {
        __runtimeProbe?: { launchRefreshCount: number; currentLaunchToken: string };
      }).__runtimeProbe;
      return probe ? `${probe.launchRefreshCount}:${probe.currentLaunchToken}` : "0:";
    });
  }).toBe("1:launch-token-2");
});

test("shows a clear launch failure when runtime has no launch context", async ({ page }) => {
  await installRuntimeHarness(page, {
    launchContext: null,
    diagnostics: false,
    expireOfferPreflight: false,
    ownerInventory: false,
  });

  await page.goto("/#launch=launch-test-001");

  await expect(page.locator(".emptyState strong")).toHaveText("Launch Failed");
  await expect(page.locator(".emptyState p")).toContainText("launch context is unavailable");
});

test("settings use NVR and Cameras tabs only", async ({ page }) => {
  await installRuntimeHarness(page);
  await page.goto("/#launch=launch-test-001&activity=settings");

  await expect(page.getByRole("button", { name: "NVR" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cameras" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Permissions" })).toHaveCount(0);
});

test("camera settings use site time policy and do not expose per-camera time controls", async ({ page }) => {
  await installRuntimeHarness(page, {
    launchContext: buildLaunchContext(),
    ownerInventory: true,
    cameraNetwork: {
      managed: true,
      interface: "eth1",
      subnetCidr: "192.168.250.0/24",
      hostIp: "192.168.250.1",
      dhcpEnabled: true,
      dhcpRangeStart: "192.168.250.50",
      dhcpRangeEnd: "192.168.250.199",
      ntpEnabled: true,
      ntpServer: "192.168.250.1",
      timezone: "America/Phoenix",
      dnsServer: "192.168.250.1",
    },
  });

  await page.goto("/#launch=launch-test-001&activity=settings&settings=cameras&camera=cam-front");

  const cameraCard = page.locator(".cameraListItem.expanded[data-source-id='cam-front']");
  await expect(cameraCard).toBeVisible();
  await expect(cameraCard.locator("[data-field='ntpServer']")).toHaveCount(0);
  await expect(cameraCard.locator("[data-field='timezone']")).toHaveCount(0);
  await expect(cameraCard.locator("[data-field='manualTime']")).toHaveCount(0);

  await page.getByRole("button", { name: "NVR" }).click();
  const summary = page.locator("#nvrSettingsSummary");
  await expect(summary).toContainText("NTP");
  await expect(summary).toContainText("192.168.250.1");
  await expect(summary).toContainText("Timezone");
  await expect(summary).toContainText("America/Phoenix");
});

test("temporarily hides PTZ controls while PTZ is disabled", async ({ page }) => {
  const context = buildLaunchContext({
    display: {
      serviceLabel: "Lab NVR",
      serviceVersion: "0.2.0",
      service: "nvr",
      status: "ready",
      cameraCount: 1,
      configuredSources: 1,
      sources: ["cam-front"],
      cameras: [
        {
          sourceId: "cam-front",
          name: "Front Camera",
          viewGranted: true,
          controlGranted: true,
          ptzCapable: true,
        },
      ],
      grantedScope: {
        owner: true,
        viewSources: ["cam-front"],
        controlSources: ["cam-front"],
      },
      iceServers: {
        stun: ["stun:stun.example.invalid:3478"],
      },
    },
  });

  await installRuntimeHarness(page, {
    launchContext: context,
    diagnostics: true,
    expireOfferPreflight: false,
    ownerInventory: true,
  });

  await page.goto("/#launch=launch-test-001");

  await expect(page.locator(".cameraTile")).toHaveCount(1);
  const ptzButton = page.getByRole("button", { name: "PTZ" });
  await expect(ptzButton).toBeHidden();
  await expect(page.locator(".cameraPtzZones")).toBeHidden();
});

test("camera name editing preserves focus and keeps overlay text linked by default", async ({ page }) => {
  const context = buildLaunchContext({
    display: {
      serviceLabel: "Lab NVR",
      serviceVersion: "0.2.0",
      service: "nvr",
      status: "ready",
      cameraCount: 1,
      configuredSources: 1,
      sources: ["cam-front"],
      cameras: [
        {
          sourceId: "cam-front",
          name: "Front Camera",
          viewGranted: true,
          controlGranted: true,
          ptzCapable: true,
        },
      ],
      grantedScope: {
        owner: true,
        viewSources: ["cam-front"],
        controlSources: ["cam-front"],
      },
      iceServers: {
        stun: ["stun:stun.example.invalid:3478"],
      },
    },
  });

  await installRuntimeHarness(page, {
    launchContext: context,
    diagnostics: false,
    expireOfferPreflight: false,
    ownerInventory: true,
  });

  await page.goto("/#launch=launch-test-001&activity=settings&settings=cameras&camera=cam-front");

  const nameInput = page.locator(".cameraSettingsTray input[data-field='displayName']");
  const overlayInput = page.locator(".cameraSettingsTray input[data-field='overlayText']");

  await expect(nameInput).toBeVisible();
  await expect(overlayInput).toBeVisible();
  await nameInput.click();
  await expect(nameInput).toBeFocused();
  await nameInput.fill("Driveway");
  await expect(nameInput).toBeFocused();
  await expect(nameInput).toHaveValue("Driveway");
  await expect(overlayInput).toHaveValue("Driveway");
  await expect(page.locator(".cameraListItem .cameraListHeading strong")).toHaveText("Front Camera");
});

test("runtime snapshots do not redraw the active camera settings card", async ({ page }) => {
  const context = buildLaunchContext({
    display: {
      serviceLabel: "Lab NVR",
      serviceVersion: "0.2.0",
      service: "nvr",
      status: "ready",
      cameraCount: 1,
      configuredSources: 1,
      sources: ["cam-front"],
      cameras: [
        {
          sourceId: "cam-front",
          name: "Front Camera",
          viewGranted: true,
          controlGranted: true,
          ptzCapable: true,
        },
      ],
      grantedScope: {
        owner: true,
        viewSources: ["cam-front"],
        controlSources: ["cam-front"],
      },
      iceServers: {
        stun: ["stun:stun.example.invalid:3478"],
      },
    },
  });

  await installRuntimeHarness(page, {
    launchContext: context,
    diagnostics: false,
    expireOfferPreflight: false,
    ownerInventory: true,
  });

  await page.goto("/#launch=launch-test-001&activity=settings&settings=cameras&camera=cam-front");

  const cameraCard = page.locator(".cameraListItem.expanded[data-source-id='cam-front']");
  const nameInput = cameraCard.locator(".cameraSettingsTray input[data-field='displayName']");

  await expect(cameraCard).toBeVisible();
  await nameInput.click();
  await nameInput.fill("Driveway");
  await expect(nameInput).toBeFocused();
  await page.evaluate(() => {
    const probe = (window as Window & {
      __runtimeProbe?: { emitRuntimeSnapshot?: () => void };
    }).__runtimeProbe;
    probe?.emitRuntimeSnapshot?.();
  });
  await expect(cameraCard).toBeVisible();
  await expect(nameInput).toBeFocused();
  await expect(nameInput).toHaveValue("Driveway");
});

test("camera settings stay visible while inventory refresh is in flight", async ({ page }) => {
  const context = buildLaunchContext({
    display: {
      serviceLabel: "Lab NVR",
      serviceVersion: "0.2.0",
      service: "nvr",
      status: "ready",
      cameraCount: 1,
      configuredSources: 1,
      sources: ["cam-front"],
      cameras: [
        {
          sourceId: "cam-front",
          name: "Front Camera",
          viewGranted: true,
          controlGranted: true,
          ptzCapable: true,
        },
      ],
      grantedScope: {
        owner: true,
        viewSources: ["cam-front"],
        controlSources: ["cam-front"],
      },
      iceServers: {
        stun: ["stun:stun.example.invalid:3478"],
      },
    },
  });

  await installRuntimeHarness(page, {
    launchContext: context,
    diagnostics: false,
    expireOfferPreflight: false,
    ownerInventory: true,
    adminDelayMs: 15_000,
  });

  await page.goto("/#launch=launch-test-001&activity=settings&settings=cameras&camera=cam-front");

  await expect(page.locator(".cameraListItem.expanded[data-source-id='cam-front']")).toBeVisible();
  await expect(page.locator(".cameraSettingsTray")).toBeVisible();
  await expect(page.locator("#cameraRefreshStatus")).toContainText("Refreshing camera state");
  await expect(page.locator(".cameraList > .emptyState")).toHaveCount(0);
});

test("keeps the expanded camera card mounted when inventory refresh fails", async ({ page }) => {
  const context = buildLaunchContext({
    display: {
      serviceLabel: "Lab NVR",
      serviceVersion: "0.2.0",
      service: "nvr",
      status: "ready",
      cameraCount: 1,
      configuredSources: 1,
      sources: ["cam-front"],
      cameras: [
        {
          sourceId: "cam-front",
          name: "Front Camera",
          viewGranted: true,
          controlGranted: true,
          ptzCapable: true,
        },
      ],
      grantedScope: {
        owner: true,
        viewSources: ["cam-front"],
        controlSources: ["cam-front"],
      },
      iceServers: {
        stun: ["stun:stun.example.invalid:3478"],
      },
    },
  });

  await installRuntimeHarness(page, {
    launchContext: context,
    diagnostics: false,
    expireOfferPreflight: false,
    ownerInventory: true,
  });

  await page.goto("/#launch=launch-test-001&activity=settings&settings=cameras&camera=cam-front");

  const cameraCard = page.locator(".cameraListItem.expanded[data-source-id='cam-front']");
  const tray = cameraCard.locator(".cameraSettingsTray");

  await expect(cameraCard).toBeVisible();
  await expect(tray).toBeVisible();
  await page.evaluate(() => {
    const probe = (window as Window & {
      __runtimeProbe?: { failNextAdmin?: () => void };
    }).__runtimeProbe;
    probe?.failNextAdmin?.();
  });
  await page.getByRole("button", { name: "Refresh Cameras" }).click();
  await expect(cameraCard).toBeVisible();
  await expect(tray).toBeVisible();
  await expect(page.locator(".cameraList > .emptyState")).toHaveCount(0);
  await expect(page.locator(".menuList")).toContainText("Camera inventory unavailable");
});

test("apply camera settings stays mounted while the request is pending", async ({ page }) => {
  const context = buildLaunchContext({
    display: {
      serviceLabel: "Lab NVR",
      serviceVersion: "0.2.0",
      service: "nvr",
      status: "ready",
      cameraCount: 1,
      configuredSources: 1,
      sources: ["cam-front"],
      cameras: [
        {
          sourceId: "cam-front",
          name: "Front Camera",
          viewGranted: true,
          controlGranted: true,
          ptzCapable: true,
        },
      ],
      grantedScope: {
        owner: true,
        viewSources: ["cam-front"],
        controlSources: ["cam-front"],
      },
      iceServers: {
        stun: ["stun:stun.example.invalid:3478"],
      },
    },
  });

  await installRuntimeHarness(page, {
    launchContext: context,
    diagnostics: false,
    expireOfferPreflight: false,
    ownerInventory: true,
    applyDelayMs: 5_000,
  });

  await page.goto("/#launch=launch-test-001&activity=settings&settings=cameras&camera=cam-front");

  const cameraCard = page.locator(".cameraListItem.expanded[data-source-id='cam-front']");
  const nameInput = cameraCard.locator(".cameraSettingsTray input[data-field='displayName']");
  const overlayInput = cameraCard.locator(".cameraSettingsTray input[data-field='overlayText']");
  const applyButton = cameraCard.locator("button[data-action='apply-camera-settings']");
  const applyStatus = cameraCard.locator("[data-role='apply-status']");

  await expect(overlayInput).toBeVisible();
  await nameInput.fill("Driveway");
  await applyButton.click();
  await expect(cameraCard).toBeVisible();
  await expect(applyButton).toBeDisabled();
  await expect(applyButton).toContainText("Applying Camera Settings");
  await expect(applyStatus).toContainText("Applying camera settings");
  await expect(page.locator(".cameraList > .emptyState")).toHaveCount(0);

  await expect(applyButton).toBeEnabled({ timeout: 12_000 });
  await expect(applyStatus).toBeHidden({ timeout: 12_000 });
  await expect(cameraCard).toBeVisible();
  await expect(nameInput).toHaveValue("Driveway");
  await expect(page.locator(".cameraListItem .cameraListHeading strong")).toHaveText("Driveway");
});
