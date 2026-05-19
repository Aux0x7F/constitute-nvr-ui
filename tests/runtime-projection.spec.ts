import { expect, test, type Page } from "@playwright/test";

const BROWSER_PK = "e493dbf1c10d80f3581e4904930b1404cc6c13900ee0758474fa94abe8c4cd13";
const GATEWAY_PK = "c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5";
const NVR_SERVICE_PK = "f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9";

type RuntimeHarnessOptions = {
  linked?: boolean;
  includeProjections?: boolean;
  hostedFacts?: Record<string, unknown>;
  hostedCameraCount?: number;
  authorityPostures?: Array<Record<string, unknown>>;
  earlyStreamAnswer?: boolean | "frameAfterResponse";
  edgeZoneScope?: Record<string, unknown> | null;
  edgeConnected?: boolean;
  includeNvrService?: boolean;
  delayedServiceAfterSnapshotGets?: number;
  localAccountCacheFallback?: boolean;
  localAccountCacheSources?: boolean;
  pendingStreamRoute?: boolean;
  edgeAttachAuthorityWait?: boolean;
  adapterIceFailureAfterAnswer?: boolean;
  mediaTransportProfileUnsupported?: boolean;
};

function projectionRecord(channelId: string, payload: Record<string, unknown>) {
  return {
    channelId,
    service: "nvr",
    servicePk: NVR_SERVICE_PK,
    projectionId: channelId,
    revision: 7,
    retainedAt: Date.now(),
    freshness: { state: "current", updatedAt: Date.now() },
    payload,
  };
}

function runtimeSnapshot({
  linked = true,
  includeProjections = true,
  hostedFacts,
  hostedCameraCount = 2,
  edgeZoneScope = { zoneId: "zone-a", privacy: "rawIds", ttl: 30, maxHops: 2 },
  edgeConnected = true,
  includeNvrService = true,
}: RuntimeHarnessOptions = {}) {
  const hasNvrService = linked && includeNvrService;
  const projections = includeProjections ? {
    "nvr.health": projectionRecord("nvr.health", {
      nodePath: "health",
      health: { ok: true, configuredSources: 2 },
    }),
    "nvr.cameras": projectionRecord("nvr.cameras", {
      nodePath: "cameras",
      cameraDevices: [
        {
          sourceId: "cam-front",
          displayName: "Front Door",
          enabled: true,
          capabilities: { liveView: true, ptz: false },
          observed: { displayName: "Front Door", ptzCapable: false },
        },
        {
          sourceId: "cam-back",
          displayName: "Back Yard",
          enabled: true,
          capabilities: { liveView: true, ptz: false },
          observed: { displayName: "Back Yard", ptzCapable: false },
        },
      ],
    }),
    "nvr.cameraNetwork": projectionRecord("nvr.cameraNetwork", {
      nodePath: "cameraNetwork",
      cameraNetwork: {
        managed: true,
        interface: "camera0",
        subnetCidr: "192.168.250.0/24",
      },
    }),
    "nvr.streams": projectionRecord("nvr.streams", {
      nodePath: "streams",
      sources: ["cam-front", "cam-back"],
      mediaProjectionStatusRecords: [
        {
          sessionId: "stream-front",
          sourceId: "cam-front",
          sourceIds: ["cam-front"],
          status: "ready",
          issuedAt: Date.now(),
          recovery: {
            codec: "h264",
            selectedStream: "sub",
            repairNeeded: false,
            subscriberCount: 1,
          },
        },
        {
          sessionId: "stream-back",
          sourceId: "cam-back",
          sourceIds: ["cam-back"],
          status: "backoff",
          issuedAt: Date.now(),
          recovery: {
            codec: "h265",
            selectedStream: "main",
            repairNeeded: true,
            subscriberCount: 0,
          },
        },
      ],
    }),
  } : {};
  return {
    buildId: "runtime-test",
    updatedAt: Date.now(),
    shell: {
      identity: {
        linked,
        identityId: linked ? "identity-001" : "",
        devicePk: linked ? BROWSER_PK : "",
        handle: linked ? "operator" : "",
      },
      ownedGateway: { state: "connected" },
      zones: {
        activeZoneKey: "zone-a",
        joined: [{ key: "zone-a", name: "Lab" }],
      },
    },
    edge: {
      connected: edgeConnected,
      mode: edgeConnected ? "live" : "pendingAuthority",
      zoneScope: edgeZoneScope,
    },
    managedAppliances: linked ? {
      owned: hasNvrService ? [
        {
          role: "gateway",
          service: "gateway",
          devicePk: GATEWAY_PK,
          label: "Lab Gateway",
          hostedServices: [
            {
              service: "nvr",
              devicePk: NVR_SERVICE_PK,
              serviceVersion: "test",
              status: "online",
              cameraCount: hostedCameraCount,
              facts: hostedFacts || { health: { status: "ready", configuredSources: 2 } },
            },
          ],
        },
      ] : [
        {
          role: "gateway",
          service: "gateway",
          devicePk: GATEWAY_PK,
          label: "Lab Gateway",
          hostedServices: [],
        },
      ],
      granted: [],
      discoverable: [],
    } : { owned: [], granted: [], discoverable: [] },
    serviceCatalog: {
      updatedAt: Date.now(),
      services: hasNvrService ? [
        {
          service: "nvr",
          servicePk: NVR_SERVICE_PK,
          hostGatewayPk: GATEWAY_PK,
          label: "Security Cameras",
          health: { status: "ready", configuredSources: 2 },
        },
      ] : [],
    },
    projections,
    projectionCoverage: {},
    projectionPolicies: {},
  };
}

async function installRuntimeHarness(page: Page, options: RuntimeHarnessOptions = {}) {
  const delayedSnapshot = options.delayedServiceAfterSnapshotGets
    ? runtimeSnapshot({ ...options, includeNvrService: true })
    : null;
  await page.addInitScript(({ snapshot, delayedSnapshot, delayedServiceAfterSnapshotGets, authorityPostures, earlyStreamAnswer, localAccountCacheFallback, localAccountCacheSources, pendingStreamRoute, edgeAttachAuthorityWait, adapterIceFailureAfterAnswer, mediaTransportProfileUnsupported, browserPk, gatewayPk, nvrServicePk }) => {
    if (localAccountCacheFallback) {
      const ts = Date.now();
      const includeSources = localAccountCacheSources !== false;
      window.localStorage.setItem("swarm.identityCache", JSON.stringify({
        ts,
        records: [
          {
            identityId: "identity-001",
            label: "operator",
            devicePks: [browserPk, gatewayPk],
            updatedAt: ts,
            expiresAt: ts + 86_400_000,
          },
        ],
      }));
      window.localStorage.setItem("swarm.deviceCache", JSON.stringify({
        ts,
        records: [
          {
            devicePk: browserPk,
            role: "browser",
            deviceLabel: "Browser",
            updatedAt: ts,
            expiresAt: ts + 86_400_000,
          },
          {
            devicePk: gatewayPk,
            role: "gateway",
            deviceKind: "service",
            deviceLabel: "Lab Gateway",
            relays: ["ws://gateway.local:7447"],
            updatedAt: ts,
            expiresAt: ts + 86_400_000,
          },
          {
            devicePk: nvrServicePk,
            servicePk: nvrServicePk,
            service: "nvr",
            role: "nvr",
            deviceKind: "service",
            deviceLabel: "Security Cameras",
            hostGatewayPk: gatewayPk,
            cameraCount: 2,
            ...(includeSources ? {
              sources: ["cam-front", "cam-back"],
              cameras: [
                { sourceId: "cam-front", displayName: "Front Door", enabled: true },
                { sourceId: "cam-back", displayName: "Back Yard", enabled: true },
              ],
            } : {}),
            updatedAt: ts,
            expiresAt: ts + 86_400_000,
          },
        ],
      }));
      window.localStorage.setItem("constitute.gateway.extraZones", JSON.stringify({
        [gatewayPk]: ["zone-a"],
      }));
    }

    const state = {
      snapshot,
      delayedSnapshot: delayedSnapshot as Record<string, unknown> | null,
      delayedServiceAfterSnapshotGets,
      snapshotGets: 0,
      frames: [] as Array<Record<string, unknown>>,
      intents: [] as Array<Record<string, unknown>>,
      policies: [] as Array<Record<string, unknown>>,
      statuses: [] as Array<Record<string, unknown>>,
      mediaProfileRequests: 0,
      peerConnectionConfigs: [] as RTCConfiguration[],
      remoteDescriptions: 0,
      adapterFailures: 0,
      edgeAttaches: [] as Array<Record<string, unknown>>,
      edgeAttachAuthorityWaitReleased: false,
      authorityPostures: Array.isArray(authorityPostures) ? authorityPostures.slice() : [],
      peerConnections: 0,
      closedPeerConnections: 0,
    };
    (window as Window & { __runtimeProbe?: typeof state }).__runtimeProbe = state;

    if (earlyStreamAnswer || state.authorityPostures.length > 0) {
      class FakeRTCPeerConnection {
        localDescription: RTCSessionDescriptionInit | null = null;
        remoteDescription: RTCSessionDescriptionInit | null = null;
        iceGatheringState: RTCIceGatheringState = "complete";
        iceConnectionState: RTCIceConnectionState = "new";
        connectionState: RTCPeerConnectionState = "new";
        onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null = null;
        ontrack: ((event: RTCTrackEvent) => void) | null = null;
        listeners = new Map<string, Set<EventListener>>();

        constructor(configuration?: RTCConfiguration) {
          state.peerConnections += 1;
          state.peerConnectionConfigs.push(configuration || {});
        }

        addTransceiver() {}

        async createOffer() {
          return { type: "offer" as RTCSdpType, sdp: "fake-offer" };
        }

        async setLocalDescription(description: RTCSessionDescriptionInit) {
          this.localDescription = description;
          window.setTimeout(() => {
            this.onicecandidate?.({ candidate: null } as RTCPeerConnectionIceEvent);
          }, 0);
        }

        async setRemoteDescription(description: RTCSessionDescriptionInit) {
          this.remoteDescription = description;
          state.remoteDescriptions += 1;
          if (adapterIceFailureAfterAnswer) {
            state.adapterFailures += 1;
            this.iceConnectionState = "failed";
            this.connectionState = "failed";
            this.emitEvent("iceconnectionstatechange");
            this.emitEvent("connectionstatechange");
          }
        }

        async addIceCandidate() {}
        addEventListener(type: string, listener: EventListener) {
          const listeners = this.listeners.get(type) || new Set<EventListener>();
          listeners.add(listener);
          this.listeners.set(type, listeners);
        }
        removeEventListener(type: string, listener: EventListener) {
          this.listeners.get(type)?.delete(listener);
        }
        emitEvent(type: string) {
          for (const listener of this.listeners.get(type) || []) {
            listener.call(this, new Event(type));
          }
        }
        close() {
          state.closedPeerConnections += 1;
        }
      }
      (window as Window & { RTCPeerConnection?: typeof FakeRTCPeerConnection }).RTCPeerConnection = FakeRTCPeerConnection;
    }

    class FakePort {
      onmessage: ((event: MessageEvent) => void) | null = null;

      start() {}

      postMessage(message: Record<string, unknown>) {
        const type = String(message.type || "");
        if (type === "runtime.attach") {
          this.emit({ type: "runtime.attached", buildId: "runtime-test", snapshot: state.snapshot });
          return;
        }
        if (type === "runtime.snapshot.get") {
          state.snapshotGets += 1;
          if (
            state.delayedSnapshot
            && state.delayedServiceAfterSnapshotGets
            && state.snapshotGets >= state.delayedServiceAfterSnapshotGets
          ) {
            state.snapshot = state.delayedSnapshot;
            state.delayedSnapshot = null;
            this.emit({ type: "runtime.snapshot", buildId: "runtime-test", snapshot: state.snapshot });
          }
          this.respond(message, state.snapshot);
          return;
        }
        if (type === "projection.get") {
          const channelId = String(message.channelId || "");
          this.respond(message, (state.snapshot.projections as Record<string, unknown>)[channelId] || null);
          return;
        }
        if (type === "runtime.authority.posture.get") {
          const fallback = { state: "ready", ready: true, devicePk: browserPk };
          const posture = state.authorityPostures.length > 1
            ? state.authorityPostures.shift()
            : state.authorityPostures[0] || fallback;
          this.respond(message, posture);
          return;
        }
        if (type === "runtime.media.transport.profile.get") {
          state.mediaProfileRequests += 1;
          if (mediaTransportProfileUnsupported) {
            this.reject(message, "unsupported runtime message: runtime.media.transport.profile.get");
            return;
          }
          this.respond(message, {
            kind: "runtime.mediaTransport.profile",
            profileId: "runtime-test-media-profile",
            transport: "webrtc",
            role: "browserOfferer",
            selectedBy: "runtime",
            iceServers: [{ urls: "stun:runtime-policy" }],
            issuedAt: Date.now(),
            expiresAt: Date.now() + 60_000,
          });
          return;
        }
        if (type === "service.node.policy.put") {
          state.policies.push(message.policy as Record<string, unknown>);
          this.respond(message, { ok: true });
          return;
        }
        if (type === "swarm.edge.attach") {
          state.edgeAttaches.push(message.payload as Record<string, unknown>);
          if (edgeAttachAuthorityWait && !state.edgeAttachAuthorityWaitReleased) {
            state.edgeAttachAuthorityWaitReleased = true;
            this.reject(message, "runtime authority waitingAuthority: missingRuntimeAuthorityMemberRef");
            return;
          }
          this.respond(message, { ok: true });
          return;
        }
        if (type === "runtime.stream.open" || type === "runtime.stream.control" || type === "runtime.stream.close" || type === "runtime.capability.resolve") {
          const payload = message.payload as Record<string, unknown>;
          state.intents.push({ type, payload });
          if (pendingStreamRoute && type === "runtime.stream.open") {
            this.respond(message, {
              ok: true,
              state: "waitingRouteBaseline",
              pendingRoute: true,
              activationId: String(payload.intentId || payload.sessionId || ""),
              routePromiseId: `route:${String(payload.intentId || payload.sessionId || "")}`,
            });
            return;
          }
          const frameId = `frame-${state.frames.length + 1}`;
          const frame = {
            kind: type === "runtime.stream.open" ? "stream.intent" : type === "runtime.stream.close" ? "stream.control" : "service.intent",
            channelId: String(payload?.channelId || ""),
            capability: String(payload?.capability || ""),
            zoneScope: payload?.zoneScope,
            recordRef: { kind: String(payload?.recordKind || ""), id: String(payload?.intentId || payload?.sessionId || `intent-${state.frames.length + 1}`) },
            body: { encoding: "caac", envelope: { opened: false } },
          };
          state.frames.push(frame);
          const emitStreamAnswer = (correlationId: string, includeSessionId: boolean) => {
            const answerRecord: Record<string, unknown> = {
              kind: "stream.session.answer",
              payload: { description: { type: "answer", sdp: "fake-answer" } },
            };
            if (includeSessionId) {
              answerRecord.sessionId = String(payload?.sessionId || "");
            }
            this.emit({
              type: "swarm.edge.frame",
              frame: {
                kind: "stream.status",
                correlationId,
                recordRef: { kind: "stream.session.answer", id: `answer-${frameId}` },
                body: {
                  payload: {
                    recordKind: "stream.session.answer",
                    record: {
                      ...answerRecord,
                    },
                  },
                },
              },
            });
          };
          if (earlyStreamAnswer && earlyStreamAnswer !== "frameAfterResponse" && type === "runtime.stream.open") {
            emitStreamAnswer(frameId, true);
          }
          this.respond(message, { frameId, frame });
          if (earlyStreamAnswer === "frameAfterResponse" && type === "runtime.stream.open") {
            emitStreamAnswer(frameId, false);
          }
          return;
        }
        if (type === "runtime.status.put") {
          state.statuses.push(message.status as Record<string, unknown>);
          this.respond(message, { ok: true });
          return;
        }
        this.respond(message, { ok: true });
      }

      respond(message: Record<string, unknown>, result: unknown) {
        this.emit({
          type: "runtime.response",
          requestId: message.requestId,
          ok: true,
          result,
        });
      }

      reject(message: Record<string, unknown>, error: string) {
        this.emit({
          type: "runtime.response",
          requestId: message.requestId,
          ok: false,
          error,
        });
      }

      emit(data: Record<string, unknown>) {
        window.setTimeout(() => {
          this.onmessage?.({ data } as MessageEvent);
        }, 0);
      }
    }

    const port = new FakePort();
    class FakeSharedWorker {
      port = port;
    }
    (window as Window & { SharedWorker?: typeof FakeSharedWorker }).SharedWorker = FakeSharedWorker;
  }, {
    snapshot: runtimeSnapshot(options),
    delayedSnapshot,
    delayedServiceAfterSnapshotGets: options.delayedServiceAfterSnapshotGets || 0,
    earlyStreamAnswer: options.earlyStreamAnswer === true ? true : options.earlyStreamAnswer === "frameAfterResponse" ? "frameAfterResponse" : false,
    localAccountCacheFallback: options.localAccountCacheFallback === true,
    localAccountCacheSources: options.localAccountCacheSources !== false,
    authorityPostures: options.authorityPostures || [],
    pendingStreamRoute: options.pendingStreamRoute === true,
    edgeAttachAuthorityWait: options.edgeAttachAuthorityWait === true,
    adapterIceFailureAfterAnswer: options.adapterIceFailureAfterAnswer === true,
    mediaTransportProfileUnsupported: options.mediaTransportProfileUnsupported === true,
    browserPk: BROWSER_PK,
    gatewayPk: GATEWAY_PK,
    nvrServicePk: NVR_SERVICE_PK,
  });
}

test("direct entry renders retained stream projections and queues runtime stream activations", async ({ page }) => {
  await installRuntimeHarness(page);

  await page.goto("/");

  await expect(page.locator(".cameraTile")).toHaveCount(2);
  await expect(page.locator(".cameraTitle")).toContainText(["Front Door", "Back Yard"]);
  await expect(page.locator(".streamStatus").first()).toContainText("ready");
  await expect(page.locator(".streamStatus").first()).toContainText("h264");
  await expect(page.locator(".streamStatus").nth(1)).toContainText("repair");
  await expect(page.locator(".streamStatus").nth(1)).toContainText("h265");

  await expect.poll(async () => page.evaluate(() => {
    const probe = (window as Window & { __runtimeProbe?: { intents: Array<Record<string, unknown>> } }).__runtimeProbe;
    return probe?.intents.filter((intent) => intent.type === "runtime.stream.open").length || 0;
  }), { timeout: 12_000 }).toBe(2);

  const activations = await page.evaluate(() => {
    const probe = (window as Window & { __runtimeProbe?: { intents: Array<Record<string, unknown>> } }).__runtimeProbe;
    return probe?.intents
      .filter((intent) => intent.type === "runtime.stream.open")
      .map((intent) => intent.payload) || [];
  });

  expect(activations).toEqual(expect.arrayContaining([
    expect.objectContaining({
      nodeRef: "nvr.streams",
      capabilityRef: "media.stream.preview",
      sourceIds: ["cam-front"],
    }),
    expect.objectContaining({
      nodeRef: "nvr.streams",
      capabilityRef: "media.stream.preview",
      sourceIds: ["cam-back"],
    }),
  ]));
  for (const activation of activations) {
    expect(activation).not.toHaveProperty("channelId");
    expect(activation).not.toHaveProperty("zoneScope");
    expect(activation).not.toHaveProperty("serviceMemberRef");
  }
});

test("direct entry waits for delayed service directory hydration instead of requiring reload", async ({ page }) => {
  await installRuntimeHarness(page, {
    includeNvrService: false,
    includeProjections: false,
    delayedServiceAfterSnapshotGets: 9,
    hostedFacts: {
      configuredSources: 2,
      sources: ["reolink-ec-71-db-32-0a-8f", "xm-192-168-0-201"],
      cameraDevices: [
        {
          sourceId: "reolink-ec-71-db-32-0a-8f",
          name: "Carport",
          enabled: true,
          ptzCapable: true,
        },
        {
          sourceId: "xm-192-168-0-201",
          name: "Front Door",
          enabled: true,
          ptzCapable: false,
        },
      ],
    },
  });

  await page.goto("/");

  await expect(page.locator(".cameraTile")).toHaveCount(2, { timeout: 12_000 });
  await expect(page.locator(".cameraTitle")).toContainText(["Carport", "Front Door"]);
  await expect(page.locator(".emptyState")).toHaveCount(0);
});

test("direct entry waits for runtime authority before creating stream adapters", async ({ page }) => {
  await installRuntimeHarness(page, {
    earlyStreamAnswer: true,
    authorityPostures: [
      { state: "waitingAuthority", ready: false, blockedAuthorityDomain: "runtime", reason: "runtime device key is hydrating" },
      { state: "waitingAuthority", ready: false, blockedAuthorityDomain: "runtime", reason: "runtime device key is hydrating" },
      { state: "waitingAuthority", ready: false, blockedAuthorityDomain: "runtime", reason: "runtime device key is hydrating" },
      { state: "waitingAuthority", ready: false, blockedAuthorityDomain: "runtime", reason: "runtime device key is hydrating" },
      { state: "ready", ready: true, devicePk: BROWSER_PK },
    ],
  });

  await page.goto("/");

  await expect(page.locator(".cameraTile")).toHaveCount(2);
  await expect.poll(async () => page.evaluate(() => {
    const probe = (window as Window & { __runtimeProbe?: { peerConnections: number } }).__runtimeProbe;
    return probe?.peerConnections || 0;
  })).toBe(0);
  await expect(page.locator("body")).toContainText("Waiting for runtime authority");

  await expect.poll(async () => page.evaluate(() => {
    const probe = (window as Window & { __runtimeProbe?: { intents: Array<Record<string, unknown>> } }).__runtimeProbe;
    return Boolean(probe?.intents.find((intent) => intent.type === "runtime.stream.open"));
  }), { timeout: 8_000 }).toBe(true);

  const peerConnections = await page.evaluate(() => {
    const probe = (window as Window & { __runtimeProbe?: { peerConnections: number } }).__runtimeProbe;
    return probe?.peerConnections || 0;
  });
  expect(peerConnections).toBeGreaterThan(0);
});

test("direct entry retries runtime-owned edge attach after authority posture resolves", async ({ page }) => {
  await installRuntimeHarness(page, {
    edgeConnected: false,
    edgeAttachAuthorityWait: true,
    localAccountCacheFallback: true,
    authorityPostures: [
      { state: "waitingAuthority", ready: false, blockedAuthorityDomain: "runtime", reason: "runtime device key is hydrating" },
      { state: "ready", ready: true, devicePk: BROWSER_PK },
    ],
  });

  await page.goto("/");

  await expect.poll(async () => page.evaluate(() => {
    const probe = (window as Window & { __runtimeProbe?: {
      edgeAttaches: Array<Record<string, unknown>>;
      intents: Array<Record<string, unknown>>;
    } }).__runtimeProbe;
    return {
      edgeAttachCount: probe?.edgeAttaches.length || 0,
      streamOpenCount: probe?.intents.filter((intent) => intent.type === "runtime.stream.open").length || 0,
      firstMemberRef: (probe?.edgeAttaches[0] as Record<string, unknown> | undefined)?.memberRef,
      secondMemberRef: (probe?.edgeAttaches[1] as Record<string, unknown> | undefined)?.memberRef,
    };
  }), { timeout: 8_000 }).toEqual({
    edgeAttachCount: 2,
    streamOpenCount: 2,
    firstMemberRef: undefined,
    secondMemberRef: undefined,
  });
});

test("direct entry materializes gateway-hosted camera facts before projection repair", async ({ page }) => {
  await installRuntimeHarness(page, {
    includeProjections: false,
    hostedCameraCount: 2,
    hostedFacts: {
      configuredSources: 2,
      sources: ["reolink-ec-71-db-32-0a-8f", "xm-192-168-0-201"],
      cameraDevices: [
        {
          sourceId: "reolink-ec-71-db-32-0a-8f",
          name: "Carport",
          enabled: true,
          ptzCapable: true,
        },
        {
          sourceId: "xm-192-168-0-201",
          name: "Front Door",
          enabled: true,
          ptzCapable: false,
        },
      ],
    },
  });

  await page.goto("/");

  await expect(page.locator(".cameraTile")).toHaveCount(2);
  await expect(page.locator(".cameraTitle")).toContainText(["Carport", "Front Door"]);
  await expect(page.locator("#popServices")).toContainText("Security Cameras (2 cameras)");
  await expect(page.locator(".emptyState")).toHaveCount(0);
});

test("direct entry leaves stream route fields to runtime when hosted facts carry identity-local zones", async ({ page }) => {
  await installRuntimeHarness(page, {
    includeProjections: false,
    edgeZoneScope: { zoneId: "zone-a", privacy: "rawIds", ttl: 30, maxHops: 0 },
    hostedFacts: {
      zoneScope: { zoneId: "identity:identity-001", privacy: "rawIds", ttl: 30, maxHops: 2 },
      configuredSources: 2,
      sources: ["reolink-ec-71-db-32-0a-8f", "xm-192-168-0-201"],
      cameraDevices: [
        {
          sourceId: "reolink-ec-71-db-32-0a-8f",
          name: "Carport",
          enabled: true,
          ptzCapable: true,
        },
        {
          sourceId: "xm-192-168-0-201",
          name: "Front Door",
          enabled: true,
          ptzCapable: false,
        },
      ],
    },
  });

  await page.goto("/");

  await expect.poll(async () => page.evaluate(() => {
    const probe = (window as Window & { __runtimeProbe?: { intents: Array<Record<string, unknown>> } }).__runtimeProbe;
    return Boolean(probe?.intents.find((intent) => intent.type === "runtime.stream.open"));
  })).toBe(true);

  const streamActivation = await page.evaluate(() => {
    const probe = (window as Window & { __runtimeProbe?: { intents: Array<Record<string, unknown>> } }).__runtimeProbe;
    return probe?.intents.find((intent) => intent.type === "runtime.stream.open")?.payload || null;
  });

  expect(streamActivation).toEqual(expect.objectContaining({
    nodeRef: "nvr.streams",
    capabilityRef: "media.stream.preview",
    sourceIds: ["reolink-ec-71-db-32-0a-8f"],
  }));
  expect(streamActivation).not.toHaveProperty("zoneScope");
  expect(streamActivation).not.toHaveProperty("channelId");
  expect(streamActivation).not.toHaveProperty("serviceMemberRef");
});

test("direct entry applies stream answers that arrive before enqueue response", async ({ page }) => {
  await installRuntimeHarness(page, { earlyStreamAnswer: true });

  await page.goto("/");

  await expect.poll(async () => page.evaluate(() => {
    const probe = (window as Window & { __runtimeProbe?: { remoteDescriptions: number } }).__runtimeProbe;
    return probe?.remoteDescriptions || 0;
  })).toBeGreaterThan(0);
});

test("direct entry applies stream answers correlated only by frame", async ({ page }) => {
  await installRuntimeHarness(page, { earlyStreamAnswer: "frameAfterResponse" });

  await page.goto("/");

  await expect.poll(async () => page.evaluate(() => {
    const probe = (window as Window & { __runtimeProbe?: { remoteDescriptions: number } }).__runtimeProbe;
    return probe?.remoteDescriptions || 0;
  })).toBeGreaterThan(0);
});

test("direct entry consumes runtime-owned media transport profile", async ({ page }) => {
  await installRuntimeHarness(page, { earlyStreamAnswer: "frameAfterResponse" });

  await page.goto("/");

  await expect.poll(async () => page.evaluate(() => {
    const probe = (window as Window & { __runtimeProbe?: {
      mediaProfileRequests: number;
      peerConnectionConfigs: RTCConfiguration[];
      intents: Array<Record<string, unknown>>;
    } }).__runtimeProbe;
    const streamOpen = probe?.intents.find((intent) => intent.type === "runtime.stream.open");
    const payload = streamOpen?.payload as Record<string, unknown> | undefined;
    const profile = payload?.mediaTransportProfile as Record<string, unknown> | undefined;
    const pcIceServers = probe?.peerConnectionConfigs[0]?.iceServers || [];
    return {
      mediaProfileRequests: probe?.mediaProfileRequests || 0,
      pcIceServerCount: pcIceServers.length,
      intentCarriesIceServerUrls: Boolean(payload?.iceServers),
      profileSelectedBy: profile?.selectedBy || "",
      profileIceServerCount: profile?.iceServerCount || 0,
    };
  })).toEqual(expect.objectContaining({
    mediaProfileRequests: 1,
    pcIceServerCount: 1,
    intentCarriesIceServerUrls: false,
    profileSelectedBy: "runtime",
    profileIceServerCount: 1,
  }));
});

test("direct entry blocks stream activation when runtime media transport profile is unsupported", async ({ page }) => {
  await installRuntimeHarness(page, { mediaTransportProfileUnsupported: true });

  await page.goto("/");

  await expect.poll(async () => page.evaluate(() => {
    const probe = (window as Window & { __runtimeProbe?: {
      mediaProfileRequests: number;
      peerConnections: number;
      intents: Array<Record<string, unknown>>;
      statuses: Array<Record<string, unknown>>;
    } }).__runtimeProbe;
    return {
      mediaProfileRequests: probe?.mediaProfileRequests || 0,
      peerConnections: probe?.peerConnections || 0,
      streamOpenCount: probe?.intents.filter((intent) => intent.type === "runtime.stream.open").length || 0,
      blocked: probe?.statuses.some((status) => (
        status.state === "blocked"
        && status.stage === "runtime_intent"
        && String(status.reason || "").includes("runtime.media.transport.profile.get")
      )) || false,
    };
  })).toEqual({
    mediaProfileRequests: 1,
    peerConnections: 0,
    streamOpenCount: 0,
    blocked: true,
  });

  await page.waitForTimeout(1_800);
  await expect.poll(async () => page.evaluate(() => {
    const probe = (window as Window & { __runtimeProbe?: {
      mediaProfileRequests: number;
      intents: Array<Record<string, unknown>>;
    } }).__runtimeProbe;
    return {
      mediaProfileRequests: probe?.mediaProfileRequests || 0,
      streamOpenCount: probe?.intents.filter((intent) => intent.type === "runtime.stream.open").length || 0,
    };
  })).toEqual({
    mediaProfileRequests: 1,
    streamOpenCount: 0,
  });
});

test("direct entry classifies ICE failure as adapter posture after stream answer", async ({ page }) => {
  await installRuntimeHarness(page, {
    earlyStreamAnswer: "frameAfterResponse",
    adapterIceFailureAfterAnswer: true,
  });

  await page.goto("/");

  await expect.poll(async () => page.evaluate(() => {
    const probe = (window as Window & { __runtimeProbe?: {
      adapterFailures: number;
      statuses: Array<Record<string, unknown>>;
    } }).__runtimeProbe;
    return {
      adapterFailed: (probe?.adapterFailures || 0) > 0,
      adapterStatus: probe?.statuses.some((status) => {
        return status.stage === "stream_adapter"
          && String(status.reason || "").includes("WebRTC ICE failed after stream answer.");
      }) || false,
      body: document.body.textContent || "",
    };
  })).toEqual(expect.objectContaining({
    adapterFailed: true,
    adapterStatus: true,
  }));

  await page.waitForTimeout(1_800);
  await expect.poll(async () => page.evaluate(() => {
    const probe = (window as Window & { __runtimeProbe?: {
      intents: Array<Record<string, unknown>>;
    } }).__runtimeProbe;
    return probe?.intents.filter((intent) => intent.type === "runtime.stream.open").length || 0;
  })).toBe(2);
});

test("direct entry holds active stream activation while service answer is pending", async ({ page }) => {
  await installRuntimeHarness(page, {
    authorityPostures: [{ state: "ready", ready: true, devicePk: BROWSER_PK }],
  });

  await page.goto("/");

  await expect.poll(async () => page.evaluate(() => {
    const probe = (window as Window & { __runtimeProbe?: { intents: Array<Record<string, unknown>> } }).__runtimeProbe;
    return probe?.intents.filter((intent) => intent.type === "runtime.stream.open").length || 0;
  })).toBe(2);

  await page.waitForTimeout(10_000);

  const streamOpenCount = await page.evaluate(() => {
    const probe = (window as Window & { __runtimeProbe?: { intents: Array<Record<string, unknown>> } }).__runtimeProbe;
    return probe?.intents.filter((intent) => intent.type === "runtime.stream.open").length || 0;
  });
  expect(streamOpenCount).toBe(2);
});

test("direct entry waits on runtime route baseline without duplicate stream opens", async ({ page }) => {
  await installRuntimeHarness(page, {
    pendingStreamRoute: true,
    localAccountCacheFallback: true,
    authorityPostures: [{ state: "ready", ready: true, devicePk: BROWSER_PK }],
  });

  await page.goto("/");

  await expect.poll(async () => page.evaluate(() => {
    const probe = (window as Window & { __runtimeProbe?: { intents: Array<Record<string, unknown>> } }).__runtimeProbe;
    return probe?.intents.filter((intent) => intent.type === "runtime.stream.open").length || 0;
  })).toBe(2);

  await page.waitForTimeout(10_000);

  const state = await page.evaluate(() => {
    const probe = (window as Window & { __runtimeProbe?: {
      intents: Array<Record<string, unknown>>;
      edgeAttaches: Array<Record<string, unknown>>;
      statuses: Array<Record<string, unknown>>;
    } }).__runtimeProbe;
    return {
      streamOpenCount: probe?.intents.filter((intent) => intent.type === "runtime.stream.open").length || 0,
      edgeAttachCount: probe?.edgeAttaches.length || 0,
      statuses: probe?.statuses || [],
      body: document.body.textContent || "",
    };
  });
  expect(state.streamOpenCount).toBe(2);
  expect(state.edgeAttachCount).toBe(1);
  expect(state.statuses).toEqual(expect.arrayContaining([
    expect.objectContaining({
      reason: "Stream activation is waiting for route baseline.",
      stage: "stream_projection",
    }),
  ]));
  expect(state.body.toLowerCase()).toContain("waiting for route baseline");
});

test("direct entry without linked identity stays in prepared account-required state", async ({ page }) => {
  await installRuntimeHarness(page, { linked: false });

  await page.goto("/");

  await expect(page.locator(".emptyState")).toContainText("Account Required");
  await expect(page.locator(".emptyState")).toContainText("Open Account Center");
  const queued = await page.evaluate(() => {
    const probe = (window as Window & { __runtimeProbe?: { frames: Array<Record<string, unknown>> } }).__runtimeProbe;
    return probe?.frames.length || 0;
  });
  expect(queued).toBe(0);
});

test("direct entry uses retained account cache when account worker snapshot is unlinked", async ({ page }) => {
  await installRuntimeHarness(page, { linked: false, localAccountCacheFallback: true });

  await page.goto("/");

  await expect.poll(async () => page.evaluate(() => {
    const probe = (window as Window & { __runtimeProbe?: { intents: Array<Record<string, unknown>> } }).__runtimeProbe;
    return Boolean(probe?.intents.find((intent) => intent.type === "runtime.stream.open"));
  })).toBe(true);

  await expect(page.locator("body")).not.toContainText("Account Required");
  const streamActivation = await page.evaluate(() => {
    const probe = (window as Window & { __runtimeProbe?: { intents: Array<Record<string, unknown>> } }).__runtimeProbe;
    return probe?.intents.find((intent) => intent.type === "runtime.stream.open")?.payload || null;
  });

  expect(streamActivation).toEqual(expect.objectContaining({
    nodeRef: "nvr.streams",
    capabilityRef: "media.stream.preview",
    sourceIds: ["cam-front"],
  }));
  expect((streamActivation as Record<string, unknown>).requesterRef).toBeUndefined();
  const edgeAttach = await page.evaluate(() => {
    const probe = (window as Window & { __runtimeProbe?: { edgeAttaches: Array<Record<string, unknown>> } }).__runtimeProbe;
    return probe?.edgeAttaches[0] || null;
  });
  expect(edgeAttach).toEqual(expect.objectContaining({
    swarmEdgeEndpoint: "ws://gateway.local:7448",
    zoneScope: expect.objectContaining({
      zoneId: "zone-a",
      privacy: "rawIds",
      ttl: 30,
      maxHops: 2,
    }),
  }));
  expect((edgeAttach as Record<string, unknown>).memberRef).toBeUndefined();
});

test("direct entry opens auto preview when retained account cache only has camera count", async ({ page }) => {
  await installRuntimeHarness(page, {
    linked: false,
    includeProjections: false,
    localAccountCacheFallback: true,
    localAccountCacheSources: false,
  });

  await page.goto("/");

  await expect(page.locator(".cameraTile")).toHaveCount(1);
  await expect(page.locator(".cameraTitle")).toContainText("Live Preview");
  await expect.poll(async () => page.evaluate(() => {
    const probe = (window as Window & { __runtimeProbe?: { intents: Array<Record<string, unknown>> } }).__runtimeProbe;
    return Boolean(probe?.intents.find((intent) => intent.type === "runtime.stream.open"));
  })).toBe(true);

  const streamActivation = await page.evaluate(() => {
    const probe = (window as Window & { __runtimeProbe?: { intents: Array<Record<string, unknown>> } }).__runtimeProbe;
    return probe?.intents.find((intent) => intent.type === "runtime.stream.open")?.payload || null;
  });

  expect(streamActivation).toEqual(expect.objectContaining({
    nodeRef: "nvr.streams",
    capabilityRef: "media.stream.preview",
    sourceIds: [],
    identityId: "identity-001",
    gatewayPk: GATEWAY_PK,
    servicePk: NVR_SERVICE_PK,
    service: "nvr",
  }));
  expect((streamActivation as Record<string, unknown>).requesterRef).toBeUndefined();
  expect((streamActivation as Record<string, unknown>).offer).toEqual(expect.objectContaining({
    sourceIds: [],
  }));
});
