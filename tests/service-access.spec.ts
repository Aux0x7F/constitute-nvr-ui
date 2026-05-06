import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

type ServiceAccessContext = {
  contextId: string;
  app: string;
  repo: string;
  identityId: string;
  devicePk: string;
  gatewayPk: string;
  servicePk: string;
  service: string;
  serviceCapability: string;
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
      driverId?: string;
      vendor?: string;
      model?: string;
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
  serviceAccessContext: ServiceAccessContext | null;
  brokerServiceAccessContext?: ServiceAccessContext | null;
  failDirectServiceAccessMessage?: string;
  directServiceAccessDelayMs?: number;
  managedAppliances?: {
    owned?: Array<Record<string, unknown>>;
    granted?: Array<Record<string, unknown>>;
    discoverable?: Array<Record<string, unknown>>;
  };
  initialShell?: Record<string, unknown> | null;
  bridgeManagedAppliances?: {
    owned?: Array<Record<string, unknown>>;
    granted?: Array<Record<string, unknown>>;
    discoverable?: Array<Record<string, unknown>>;
  };
  bridgeHydrationDelayMs?: number;
  diagnostics?: boolean;
  expireOfferPreflight?: boolean;
  ownerInventory?: boolean;
  adminDelayMs?: number;
  applyDelayMs?: number;
  offerDelayMs?: number;
  failOfferCount?: number;
  sharedTrackStream?: boolean;
  staleMountedDisplayNameAfterApply?: boolean;
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

function buildServiceAccessContext(overrides: Partial<ServiceAccessContext> = {}): ServiceAccessContext {
  const now = Date.now();
  return {
    contextId: "service-access-test-001",
    app: "Constitute NVR",
    repo: "constitute-nvr-ui",
    identityId: "identity-test-001",
    devicePk: "devicepk0123456789abcdef",
    gatewayPk: "gatewaypk0123456789abcdef",
    servicePk: "servicepk0123456789abcdef",
    service: "nvr",
    serviceCapability: "service-capability-001",
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

function buildNvrManagedAppliances(context = buildServiceAccessContext()) {
  const serviceRecord = {
    devicePk: context.servicePk,
    deviceLabel: context.display?.serviceLabel || "Lab NVR",
    deviceKind: "service",
    role: "nvr",
    service: "nvr",
    hostGatewayPk: context.gatewayPk,
    serviceVersion: context.display?.serviceVersion || "0.2.0",
    updatedAt: Date.now(),
  };
  return {
    owned: [
      {
        devicePk: context.gatewayPk,
        deviceLabel: "Lab Gateway",
        role: "gateway",
        service: "gateway",
        updatedAt: Date.now(),
        hostedServices: [serviceRecord],
      },
      serviceRecord,
    ],
    granted: [],
    discoverable: [],
  };
}

async function installRuntimeHarness(page: Page, config: RuntimeMockConfig = {
  serviceAccessContext: buildServiceAccessContext(),
  diagnostics: false,
  expireOfferPreflight: false,
  ownerInventory: false,
}): Promise<void> {
  await page.addInitScript(({ config }) => {
    const runtimeConfig = config as RuntimeMockConfig;

    if (runtimeConfig.diagnostics) {
      window.localStorage.setItem("constitute.nvr.diagnostics", "1");
    }

    const contextId = String(runtimeConfig.serviceAccessContext?.contextId || "service-access-test-001");
    let activeContextId = contextId;
    const initialContext = runtimeConfig.serviceAccessContext ? structuredClone(runtimeConfig.serviceAccessContext) : null;
    let currentServiceCapability = String(initialContext?.serviceCapability || "service-capability-001");
    let serviceAccessRefreshCount = 0;
    let sessionCloseCount = 0;
    let offerRequestCount = 0;
    let expiredOfferOnce = false;
    let remainingOfferFailures = Math.max(0, Number(runtimeConfig.failOfferCount || 0));
    let adminRequestCount = 0;
    let failNextAdmin = false;
    const workerPorts = new Set<MockMessagePort>();
    const sharedWorkerConstructors: Array<{ url: string; type: string; name: string }> = [];
    let lastPeerConnection: MockRTCPeerConnection | null = null;
    let currentManagedAppliances = runtimeConfig.managedAppliances || {
      owned: [],
      granted: [],
      discoverable: [],
    };

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
        if (description?.type === "answer" && typeof description.sdp === "string" && !description.sdp.endsWith("\r\n")) {
          throw new Error("answer SDP lost trailing CRLF");
        }
        this.remoteDescription = description;
        this.iceConnectionState = "connected";
        this.connectionState = "connected";
        this.emit("iceconnectionstatechange");
        this.emit("connectionstatechange");
        const sharedStream = runtimeConfig.sharedTrackStream ? new MediaStream() : null;
        for (const transceiver of this.transceivers) {
          const stream = sharedStream || new MediaStream();
          const canvas = document.createElement("canvas");
          canvas.width = 16;
          canvas.height = 16;
          const ctx = canvas.getContext("2d");
          ctx?.fillRect(0, 0, 16, 16);
          const generated = canvas.captureStream(1).getVideoTracks()[0];
          const track = generated.clone();
          if (sharedStream) sharedStream.addTrack(track);
          this.emit("track", {
            transceiver,
            streams: [stream],
            track,
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
      serviceAccessContexts: new Map<string, ServiceAccessContext>(),
      services: {} as Record<string, unknown>,
      shell: runtimeConfig.initialShell || null as Record<string, unknown> | null,
      resourceNames: {} as Record<string, string>,
    };

    if (initialContext) {
      runtimeState.serviceAccessContexts.set(initialContext.contextId, structuredClone(initialContext));
      runtimeState.resourceNames[initialContext.gatewayPk] = "Lab Gateway";
      runtimeState.resourceNames[initialContext.servicePk] = String(initialContext.display?.serviceLabel || "Lab NVR");
      runtimeState.resourceNames[initialContext.identityId] = "tester";
    }

    function runtimeSnapshot() {
      return {
        buildId: "runtime-2.12",
        updatedAt: Date.now(),
        shell: runtimeState.shell,
        services: runtimeState.services,
        managedAppliances: currentManagedAppliances,
        resourceNames: runtimeState.resourceNames,
        managedServiceIssue: null,
        serviceAccessContextCount: runtimeState.serviceAccessContexts.size,
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
            buildId: "runtime-2.12",
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
            buildId: "runtime-2.12",
            snapshot: runtimeSnapshot(),
          });
          return;
        }

        if (type === "runtime.snapshot.get") {
          this.emit(runtimeResponse(requestId, runtimeSnapshot(), "runtime.snapshot.get"));
          return;
        }

        if (type === "serviceAccessContext.get") {
          const requestedContextId = String(message.contextId || "");
          this.emit(runtimeResponse(
            requestId,
            runtimeState.serviceAccessContexts.get(requestedContextId) || null,
            "serviceAccessContext.get",
          ));
          return;
        }

        if (type === "serviceAccessContext.put") {
          const context = (message.context && typeof message.context === "object") ? message.context as ServiceAccessContext : null;
          if (context?.contextId) {
            runtimeState.serviceAccessContexts.set(context.contextId, structuredClone(context));
            currentServiceCapability = context.serviceCapability;
            activeContextId = context.contextId;
          }
          this.emit(runtimeResponse(requestId, context, "serviceAccessContext.put"));
          this.emit({
            type: "runtime.snapshot",
            buildId: "runtime-2.12",
            snapshot: runtimeSnapshot(),
          });
          return;
        }

        if (type === "gateway.serviceAccess.request") {
          serviceAccessRefreshCount += 1;
          const respond = () => {
            if (runtimeConfig.failDirectServiceAccessMessage) {
              this.emit(runtimeError(requestId, runtimeConfig.failDirectServiceAccessMessage, "gateway.serviceAccess.request"));
              return;
            }
            const context = runtimeState.serviceAccessContexts.get(contextId);
            const directContext = runtimeConfig.brokerServiceAccessContext || null;
            const selectedContext = context || directContext;
            if (!selectedContext) {
              this.emit(runtimeError(requestId, "service access context unavailable", "gateway.serviceAccess.request"));
              return;
            }
            currentServiceCapability = `service-capability-${serviceAccessRefreshCount + 1}`;
            const refreshedContext: ServiceAccessContext = {
              ...selectedContext,
              serviceCapability: currentServiceCapability,
              createdAt: Date.now(),
              expiresAt: Date.now() + 60_000,
            };
            if (context) runtimeState.serviceAccessContexts.set(contextId, refreshedContext);
            this.emit(runtimeResponse(requestId, {
              requestId,
              gatewayPk: refreshedContext.gatewayPk,
              servicePk: refreshedContext.servicePk,
              service: refreshedContext.service,
              capability: "nvr.view",
              serviceCapability: refreshedContext.serviceCapability,
              display: refreshedContext.display,
              expiresAt: refreshedContext.expiresAt,
              ts: Date.now(),
            }, "gateway.serviceAccess.request"));
          };
          window.setTimeout(respond, Math.max(0, Number(runtimeConfig.directServiceAccessDelayMs || 0)));
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

        if (type === "gateway.serviceSignal.request") {
          const root = (message.payload && typeof message.payload === "object")
            ? message.payload as Record<string, unknown>
            : {};
          const signalType = String(root.signalType || "");
          const signalRequestId = String(root.requestId || requestId || "signal-request");
          const context = runtimeState.serviceAccessContexts.get(activeContextId);
          if (!context) {
            this.emit(runtimeError(requestId, "service access context unavailable", "gateway.serviceSignal.request"));
            return;
          }
          if (runtimeConfig.expireOfferPreflight && signalType === "offer" && !expiredOfferOnce) {
            expiredOfferOnce = true;
            this.emit(runtimeError(requestId, "service capability expired", "gateway.serviceSignal.request"));
            return;
          }
          if (signalType === "offer") {
            offerRequestCount += 1;
            const respond = () => {
              if (remainingOfferFailures > 0) {
                remainingOfferFailures -= 1;
                this.emit(runtimeError(requestId, "gateway signaling failed", "gateway.serviceSignal.request"));
                return;
              }
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
              }, "gateway.serviceSignal.request"));
            };
            const delayMs = Math.max(0, Number(runtimeConfig.offerDelayMs || 0));
            if (delayMs > 0) {
              window.setTimeout(respond, delayMs);
            } else {
              respond();
            }
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
                this.emit(runtimeError(requestId, "inventory unavailable", "gateway.serviceSignal.request"));
                return;
              }
              if (adminAction === "apply_camera_device_config") {
                const sourceId = String(adminPayload.sourceId || "").trim();
                const desired = (adminPayload.desired && typeof adminPayload.desired === "object")
                  ? adminPayload.desired as Record<string, unknown>
                  : {};
                const camera = mutableCameras.get(sourceId);
                let responseDisplayName = "";
                let responseDesiredDisplayName = "";
                if (camera) {
                  const previousName = String(camera.name || "").trim() || sourceId;
                  const nextName = String(desired.displayName || camera.name || "").trim() || camera.name;
                  const nextOverlayText = String(desired.overlayText || camera.overlayText || nextName).trim() || nextName;
                  camera.name = nextName;
                  camera.overlayText = nextOverlayText;
                  responseDisplayName = runtimeConfig.staleMountedDisplayNameAfterApply ? previousName : camera.name;
                  responseDesiredDisplayName = runtimeConfig.staleMountedDisplayNameAfterApply ? previousName : camera.name;
                }
                this.emit(runtimeResponse(requestId, {
                  requestId: signalRequestId,
                  ok: true,
                  result: {
                    payload: {
                      action: "apply_camera_device_config",
                      mounted: camera
                        ? {
                            sourceId: camera.sourceId,
                            displayName: responseDisplayName,
                            driverId: camera.driverId || "",
                            vendor: camera.vendor || "",
                            model: camera.model || "",
                            capabilities: {
                              liveView: true,
                              ptz: camera.ptzCapable,
                              timeSync: true,
                              timezone: true,
                              overlayText: true,
                              overlayTimestamp: true,
                            },
                            desired: {
                              displayName: responseDesiredDisplayName,
                              overlayText: camera.overlayText,
                              overlayTimestamp: true,
                            },
                            observed: {
                              displayName: camera.name,
                              driverId: camera.driverId || "",
                              vendor: camera.vendor || "",
                              model: camera.model || "",
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
                }, "gateway.serviceSignal.request"));
                return;
              }
              this.emit(runtimeResponse(requestId, {
                requestId: signalRequestId,
                ok: true,
                result: {
                  payload: {
                    inventory: runtimeConfig.ownerInventory
                      ? {
                          mountedDevices: cameras.map((camera) => ({
                            sourceId: camera.sourceId,
                            displayName: camera.name,
                            driverId: camera.driverId || "",
                            vendor: camera.vendor || "",
                            model: camera.model || "",
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
                              driverId: camera.driverId || "",
                              vendor: camera.vendor || "",
                              model: camera.model || "",
                              overlayText: camera.overlayText,
                              overlayTimestamp: true,
                              ptzCapable: camera.ptzCapable,
                            },
                          })),
                          candidateDevices: [],
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
                          mountedDevices: [],
                          candidateDevices: [],
                          cameraNetwork: {},
                        },
                  },
                },
              }, "gateway.serviceSignal.request"));
            };
            const delayMs = adminAction === "apply_camera_device_config"
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
          }, "gateway.serviceSignal.request"));
        }
      }
    }

    class MockSharedWorker {
      port: MockMessagePort;

      constructor(url?: string | URL, options?: SharedWorkerOptions) {
        sharedWorkerConstructors.push({
          url: String(url || ""),
          type: String(options?.type || ""),
          name: String(options?.name || ""),
        });
        this.port = new MockMessagePort();
        workerPorts.add(this.port);
      }
    }

    const nativeAppendChild = Element.prototype.appendChild;
    Element.prototype.appendChild = function appendChildWithAccountBridgeHydration<T extends Node>(node: T): T {
      const appended = nativeAppendChild.call(this, node) as T;
      if (
        node instanceof HTMLIFrameElement
        && String(node.id || "") === "constituteAccountBridge"
        && runtimeConfig.bridgeManagedAppliances
      ) {
        window.setTimeout(() => {
          currentManagedAppliances = runtimeConfig.bridgeManagedAppliances || currentManagedAppliances;
          runtimeState.shell = {
            identity: {
              linked: true,
              identityId: "identity-test-001",
              label: "tester",
            },
          };
          for (const port of workerPorts) {
            port.dispatch({
              type: "runtime.snapshot",
              buildId: "runtime-2.12",
              snapshot: runtimeSnapshot(),
            });
          }
        }, Math.max(0, Number(runtimeConfig.bridgeHydrationDelayMs || 0)));
      }
      return appended;
    };

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
        get serviceAccessRefreshCount() {
          return serviceAccessRefreshCount;
        },
        get sessionCloseCount() {
          return sessionCloseCount;
        },
        get currentServiceCapability() {
          return currentServiceCapability;
        },
        get adminRequestCount() {
          return adminRequestCount;
        },
        get offerRequestCount() {
          return offerRequestCount;
        },
        get sharedWorkerConstructors() {
          return sharedWorkerConstructors.slice();
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
              buildId: "runtime-2.12",
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

test("boots from runtime service access context and renders a live camera grid", async ({ page }) => {
  await installRuntimeHarness(page);
  await page.goto("/#serviceAccess=service-access-test-001");

  await expect.poll(async () => page.evaluate(() => window.__runtimeProbe.sharedWorkerConstructors.length)).toBeGreaterThan(0);
  const workerConstructors = await page.evaluate(() => window.__runtimeProbe.sharedWorkerConstructors);
  expect(workerConstructors[0]).toMatchObject({
    type: "module",
    name: "constitute-account-runtime-runtime-2.12",
  });
  await expect(page.locator("#appName")).toHaveText("Constitute NVR");
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
    serviceAccessContext: buildServiceAccessContext(),
    diagnostics: false,
    expireOfferPreflight: false,
    ownerInventory: true,
    adminDelayMs: 15_000,
  });

  await page.goto("/#serviceAccess=service-access-test-001");

  await expect(page.locator(".cameraTile")).toHaveCount(2);
  await expect(page.locator("#bootSplash")).toHaveCount(0);
});

test("dismisses the splash after service access context while gateway signaling is still pending", async ({ page }) => {
  await installRuntimeHarness(page, {
    serviceAccessContext: buildServiceAccessContext(),
    diagnostics: false,
    expireOfferPreflight: false,
    ownerInventory: false,
    offerDelayMs: 15_000,
  });

  await page.goto("/#serviceAccess=service-access-test-001");

  await expect(page.locator(".cameraTile")).toHaveCount(2);
  await expect(page.locator("#bootSplash")).toHaveCount(0);
  await expect(page.locator(".cameraStatusDot-connecting")).toHaveCount(2);
  await expect(page.locator(".cameraStatusDot-live")).toHaveCount(0);
});

test("keeps the page open when the first live reconnect attempt fails after service access context", async ({ page }) => {
  await installRuntimeHarness(page, {
    serviceAccessContext: buildServiceAccessContext(),
    diagnostics: false,
    expireOfferPreflight: false,
    ownerInventory: false,
    failOfferCount: 1,
  });

  await page.goto("/#serviceAccess=service-access-test-001");

  await expect(page.locator("#bootSplash")).toHaveCount(0);
  await expect(page.locator(".cameraTile")).toHaveCount(2);
  await expect(page.locator("#liveView .emptyState strong")).toHaveCount(0);
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

test("reconnects live preview automatically after the peer connection drops", async ({ page }) => {
  await installRuntimeHarness(page);
  await page.goto("/#serviceAccess=service-access-test-001");

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

test("binds each preview tile to its own track even when remote tracks share one MediaStream", async ({ page }) => {
  await installRuntimeHarness(page, {
    serviceAccessContext: buildServiceAccessContext(),
    diagnostics: false,
    expireOfferPreflight: false,
    ownerInventory: false,
    sharedTrackStream: true,
  });
  await page.goto("/#serviceAccess=service-access-test-001");

  await expect(page.locator(".cameraStatusDot-live")).toHaveCount(2);
  const trackBinding = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".cameraTile video")).map((video) => {
      const stream = (video as HTMLVideoElement).srcObject as MediaStream | null;
      return {
        trackIds: stream ? stream.getVideoTracks().map((track) => track.id) : [],
      };
    });
  });

  expect(trackBinding).toHaveLength(2);
  expect(trackBinding[0]?.trackIds).toHaveLength(1);
  expect(trackBinding[1]?.trackIds).toHaveLength(1);
  expect(trackBinding[0]?.trackIds[0]).not.toBe(trackBinding[1]?.trackIds[0]);
});

test("does not expose opener-return actions in the shared account center", async ({ page }) => {
  await installRuntimeHarness(page);
  await page.goto("/#serviceAccess=service-access-test-001");

  await page.getByRole("button", { name: "Menu" }).click();
  await page.locator("#accountRailButton").click();
  await expect(page.getByRole("button", { name: "Return To Opener" })).toHaveCount(0);
});

test("refreshes service capability through the shared runtime before offer", async ({ page }) => {
  await installRuntimeHarness(page, {
    serviceAccessContext: buildServiceAccessContext({
      expiresAt: Date.now() - 1_000,
    }),
    diagnostics: true,
    expireOfferPreflight: false,
    ownerInventory: false,
  });

  await page.goto("/#serviceAccess=service-access-test-001");

  await expect(page.locator(".cameraTile")).toHaveCount(2);
  await expect.poll(async () => {
    return await page.evaluate(() => {
      const probe = (window as Window & {
        __runtimeProbe?: { serviceAccessRefreshCount: number; currentServiceCapability: string };
      }).__runtimeProbe;
      return probe ? `${probe.serviceAccessRefreshCount}:${probe.currentServiceCapability}` : "0:";
    });
  }).toBe("1:service-capability-2");
});

test("direct app entry opens an available NVR service from the shared runtime", async ({ page }) => {
  const context = buildServiceAccessContext();
  await installRuntimeHarness(page, {
    serviceAccessContext: null,
    brokerServiceAccessContext: context,
    managedAppliances: buildNvrManagedAppliances(context),
    diagnostics: false,
    expireOfferPreflight: false,
    ownerInventory: false,
  });

  await page.goto("/");

  await expect(page.locator(".cameraTile")).toHaveCount(2);
  await expect(page.locator("#connStateText")).toHaveText("live");
  await expect.poll(async () => {
    return await page.evaluate(() => {
      const probe = (window as Window & {
        __runtimeProbe?: { serviceAccessRefreshCount: number; currentServiceCapability: string };
      }).__runtimeProbe;
      return probe ? `${probe.serviceAccessRefreshCount}:${probe.currentServiceCapability}` : "0:";
    });
  }).toBe("1:service-capability-2");
});

test("direct app entry hydrates account bridge before deciding service availability", async ({ page }) => {
  const context = buildServiceAccessContext();
  await installRuntimeHarness(page, {
    serviceAccessContext: null,
    brokerServiceAccessContext: context,
    bridgeManagedAppliances: buildNvrManagedAppliances(context),
    bridgeHydrationDelayMs: 150,
    diagnostics: false,
    expireOfferPreflight: false,
    ownerInventory: false,
  });

  await page.goto("/");

  await expect(page.locator("#constituteAccountBridge")).toHaveCount(1);
  await expect(page.locator(".cameraTile")).toHaveCount(2);
  await expect(page.locator("#connStateText")).toHaveText("live");
  await expect.poll(async () => {
    return await page.evaluate(() => {
      const probe = (window as Window & {
        __runtimeProbe?: { serviceAccessRefreshCount: number; currentServiceCapability: string };
      }).__runtimeProbe;
      return probe ? `${probe.serviceAccessRefreshCount}:${probe.currentServiceCapability}` : "0:";
    });
  }).toBe("1:service-capability-2");
});

test("direct app entry waits out the account bridge settle window before treating identity as unlinked", async ({ page }) => {
  const context = buildServiceAccessContext();
  await installRuntimeHarness(page, {
    serviceAccessContext: null,
    brokerServiceAccessContext: context,
    initialShell: {
      identity: {
        linked: false,
      },
    },
    bridgeManagedAppliances: buildNvrManagedAppliances(context),
    bridgeHydrationDelayMs: 150,
    diagnostics: false,
    expireOfferPreflight: false,
    ownerInventory: false,
  });

  await page.goto("/");

  await expect(page.locator("#constituteAccountBridge")).toHaveCount(1);
  await expect(page.locator(".cameraTile")).toHaveCount(2);
  await expect(page.locator(".emptyState strong")).toHaveCount(0);
  await expect(page.locator("#connStateText")).toHaveText("live");
});

test("direct app entry waits past the old refresh timeout for first session authorization", async ({ page }) => {
  test.setTimeout(45_000);
  const context = buildServiceAccessContext();
  await installRuntimeHarness(page, {
    serviceAccessContext: null,
    brokerServiceAccessContext: context,
    managedAppliances: buildNvrManagedAppliances(context),
    directServiceAccessDelayMs: 21_000,
    diagnostics: false,
    expireOfferPreflight: false,
    ownerInventory: false,
  });

  await page.goto("/");

  await expect(page.locator(".emptyState strong")).toHaveText("Opening Security Cameras");
  await expect(page.locator("#connStateText")).toHaveText("opening");
  await expect(page.locator(".cameraTile")).toHaveCount(2, { timeout: 30_000 });
  await expect(page.locator("#connStateText")).toHaveText("live");
});

test("direct app entry stays inside the NVR app when no service is available", async ({ page }) => {
  await installRuntimeHarness(page, {
    serviceAccessContext: null,
    bridgeManagedAppliances: {
      owned: [],
      granted: [],
      discoverable: [],
    },
    diagnostics: false,
    expireOfferPreflight: false,
    ownerInventory: false,
  });

  await page.goto("/");

  await expect(page.locator(".emptyState strong")).toHaveText("No Security Cameras Service");
  await expect(page.locator(".emptyState p")).toContainText("this app will open it directly");
  await expect(page.locator(".emptyState p")).not.toContainText("constitute-gateway-ui");
  await expect(page.locator(".emptyState p")).not.toContainText("service access URL");
  await expect(page.locator("#connStateText")).toHaveText("idle");
});

test("direct app entry treats transient gateway service access failure as recoverable app state", async ({ page }) => {
  const context = buildServiceAccessContext();
  await installRuntimeHarness(page, {
    serviceAccessContext: null,
    brokerServiceAccessContext: context,
    managedAppliances: buildNvrManagedAppliances(context),
    failDirectServiceAccessMessage: "transient gateway service access failure",
    diagnostics: false,
    expireOfferPreflight: false,
    ownerInventory: false,
  });

  await page.goto("/");

  await expect(page.locator(".emptyState strong")).toHaveText("Opening Security Cameras");
  await expect(page.locator(".emptyState p")).toContainText("Resolving an account-authorized camera session");
  await expect(page.locator("#connStateText")).toHaveText("opening");
  await expect.poll(async () => {
    return await page.evaluate(() => {
      const probe = (window as Window & {
        __runtimeProbe?: { serviceAccessRefreshCount: number };
      }).__runtimeProbe;
      return probe?.serviceAccessRefreshCount || 0;
    });
  }).toBeGreaterThan(1);
});

test("settings use NVR and Cameras tabs only", async ({ page }) => {
  await installRuntimeHarness(page);
  await page.goto("/#serviceAccess=service-access-test-001&activity=settings");

  await expect(page.getByRole("button", { name: "NVR" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cameras" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Permissions" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Session Log" })).toHaveCount(0);
});

test("camera settings use site time policy and do not expose per-camera time controls", async ({ page }) => {
  await installRuntimeHarness(page, {
    serviceAccessContext: buildServiceAccessContext(),
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

  await page.goto("/#serviceAccess=service-access-test-001&activity=settings&settings=cameras&camera=cam-front");

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

test("xm camera settings show XM driver truth and no PTZ fallback rows", async ({ page }) => {
  const context = buildServiceAccessContext({
    display: {
      serviceLabel: "Lab NVR",
      serviceVersion: "0.2.0",
      service: "nvr",
      status: "ready",
      cameraCount: 1,
      configuredSources: 1,
      sources: ["cam-xm"],
      cameras: [
        {
          sourceId: "cam-xm",
          name: "XM Camera",
          viewGranted: true,
          controlGranted: true,
          ptzCapable: false,
          driverId: "xm_40e",
          vendor: "XM/NetSurveillance",
          model: "40E",
        },
      ],
      grantedScope: {
        owner: true,
        viewSources: ["cam-xm"],
        controlSources: ["cam-xm"],
      },
      iceServers: {
        stun: ["stun:stun.example.invalid:3478"],
      },
    },
  });

  await installRuntimeHarness(page, {
    serviceAccessContext: context,
    ownerInventory: true,
  });

  await page.goto("/#serviceAccess=service-access-test-001&activity=settings&settings=cameras&camera=cam-xm");

  const card = page.locator(".cameraListItem.expanded[data-source-id='cam-xm']");
  await expect(card).toBeVisible();
  await expect(card.locator(".nestedPanel")).toContainText("xm_40e");
  await expect(card.locator(".nestedPanel")).toContainText("XM/NetSurveillance");
  await expect(card.locator(".nestedPanel")).toContainText("40E");
  await expect(card.locator(".nestedPanel")).not.toContainText("E1 Outdoor SE");
  await expect(card.locator(".nestedPanel")).not.toContainText("Pose");
});

test("temporarily hides PTZ controls while PTZ is disabled", async ({ page }) => {
  const context = buildServiceAccessContext({
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
    serviceAccessContext: context,
    diagnostics: true,
    expireOfferPreflight: false,
    ownerInventory: true,
  });

  await page.goto("/#serviceAccess=service-access-test-001");

  await expect(page.locator(".cameraTile")).toHaveCount(1);
  const ptzButton = page.getByRole("button", { name: "PTZ" });
  await expect(ptzButton).toBeHidden();
  await expect(page.locator(".cameraPtzZones")).toBeHidden();
});

test("camera name editing preserves focus and keeps overlay text linked by default", async ({ page }) => {
  const context = buildServiceAccessContext({
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
    serviceAccessContext: context,
    diagnostics: false,
    expireOfferPreflight: false,
    ownerInventory: true,
  });

  await page.goto("/#serviceAccess=service-access-test-001&activity=settings&settings=cameras&camera=cam-front");

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
  const context = buildServiceAccessContext({
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
    serviceAccessContext: context,
    diagnostics: false,
    expireOfferPreflight: false,
    ownerInventory: true,
  });

  await page.goto("/#serviceAccess=service-access-test-001&activity=settings&settings=cameras&camera=cam-front");

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
  const context = buildServiceAccessContext({
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
    serviceAccessContext: context,
    diagnostics: false,
    expireOfferPreflight: false,
    ownerInventory: true,
    adminDelayMs: 15_000,
  });

  await page.goto("/#serviceAccess=service-access-test-001&activity=settings&settings=cameras&camera=cam-front");

  await expect(page.locator(".cameraListItem.expanded[data-source-id='cam-front']")).toBeVisible();
  await expect(page.locator(".cameraSettingsTray")).toBeVisible();
  await expect(page.locator("#cameraRefreshStatus")).toContainText("Refreshing camera state");
  await expect(page.locator(".cameraList > .emptyState")).toHaveCount(0);
});

test("keeps the expanded camera card mounted when inventory refresh fails", async ({ page }) => {
  const context = buildServiceAccessContext({
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
    serviceAccessContext: context,
    diagnostics: false,
    expireOfferPreflight: false,
    ownerInventory: true,
  });

  await page.goto("/#serviceAccess=service-access-test-001&activity=settings&settings=cameras&camera=cam-front");

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
  await page.getByRole("button", { name: "Notifications" }).click();
  await expect(page.locator("#notifList")).toContainText("Camera inventory unavailable");
});

test("apply camera settings stays mounted while the request is pending", async ({ page }) => {
  const context = buildServiceAccessContext({
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
    serviceAccessContext: context,
    diagnostics: false,
    expireOfferPreflight: false,
    ownerInventory: true,
    applyDelayMs: 5_000,
  });

  await page.goto("/#serviceAccess=service-access-test-001&activity=settings&settings=cameras&camera=cam-front");

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

test("camera card title follows observed validated name when mounted displayName is stale", async ({ page }) => {
  const context = buildServiceAccessContext({
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
          name: "Front Door",
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
    serviceAccessContext: context,
    diagnostics: false,
    expireOfferPreflight: false,
    ownerInventory: true,
    staleMountedDisplayNameAfterApply: true,
  });

  await page.goto("/#serviceAccess=service-access-test-001&activity=settings&settings=cameras&camera=cam-front");

  const cameraCard = page.locator(".cameraListItem.expanded[data-source-id='cam-front']");
  const nameInput = cameraCard.locator(".cameraSettingsTray input[data-field='displayName']");
  const applyButton = cameraCard.locator("button[data-action='apply-camera-settings']");

  await expect(cameraCard.locator(".cameraListHeading strong")).toHaveText("Front Door");
  await nameInput.fill("Driveway");
  await applyButton.click();

  await expect(cameraCard.locator(".cameraListHeading strong")).toHaveText("Driveway");
});
