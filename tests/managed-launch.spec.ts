import { expect, test } from "@playwright/test";

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
    iceServers?: {
      stun?: string[];
      turn?: string[];
    };
  };
  createdAt: number;
  expiresAt: number;
};

function buildLaunchContext(overrides: Partial<LaunchContext> = {}): LaunchContext {
  const now = Date.now();
  return {
    launchId: "launch-test-001",
    app: "Security Cameras",
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
      iceServers: {
        stun: ["stun:stun.example.invalid:3478"],
      },
    },
    createdAt: now,
    expiresAt: now + 60_000,
    ...overrides,
  };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ launchId, context, respondFromShell }) => {
    const storageKey = `constitute.launch.${launchId}`;
    const launchContext = context as LaunchContext;

    if (!respondFromShell) {
      window.localStorage.setItem(storageKey, JSON.stringify(launchContext));
    }

    type Listener = (event: { data: unknown }) => void;

    class MockBroadcastChannel {
      static registry = new Map<string, Set<MockBroadcastChannel>>();

      name: string;
      onmessage: Listener | null = null;
      listeners = new Set<Listener>();

      constructor(name: string) {
        this.name = name;
        const bucket = MockBroadcastChannel.registry.get(name) || new Set<MockBroadcastChannel>();
        bucket.add(this);
        MockBroadcastChannel.registry.set(name, bucket);
      }

      postMessage(message: unknown): void {
        window.setTimeout(() => this.respond(message), 0);
      }

      addEventListener(type: string, listener: Listener): void {
        if (type === "message") this.listeners.add(listener);
      }

      removeEventListener(type: string, listener: Listener): void {
        if (type === "message") this.listeners.delete(listener);
      }

      close(): void {
        const bucket = MockBroadcastChannel.registry.get(this.name);
        bucket?.delete(this);
      }

      private emit(message: unknown): void {
        const event = { data: message };
        this.onmessage?.(event);
        for (const listener of this.listeners) listener(event);
      }

      private broadcast(message: unknown): void {
        const bucket = MockBroadcastChannel.registry.get(this.name);
        if (!bucket) return;
        for (const instance of bucket) {
          instance.emit(message);
        }
      }

      private respond(message: unknown): void {
        const payload = (message && typeof message === "object") ? message as Record<string, unknown> : {};
        const type = String(payload.type || "");
        if (type === "launch-context.request") {
          const requestedLaunchId = String(payload.launchId || "");
          if (respondFromShell && requestedLaunchId === launchId) {
            window.localStorage.setItem(storageKey, JSON.stringify(launchContext));
            this.broadcast({
              type: "launch-context.response",
              launchId,
              ok: true,
              context: launchContext,
            });
            return;
          }

          this.broadcast({
            type: "launch-context.response",
            launchId: requestedLaunchId,
            ok: false,
            context: null,
          });
          return;
        }

        if (type === "gateway.signal.request") {
          const requestId = String(payload.requestId || "");
          const signalType = String(payload.signalType || "");
          this.broadcast({
            type: "gateway.signal.response",
            requestId,
            ok: true,
            result: signalType === "offer"
              ? {
                  payload: {
                    answer: {
                      type: "answer",
                      sdp: "v=0\r\ns=constitute-nvr-ui-test\r\n",
                    },
                    sources: launchContext.display?.sources || [],
                  },
                }
              : { ok: true },
          });
        }
      }
    }

    class MockRTCPeerConnection {
      iceGatheringState: RTCIceGatheringState = "new";
      iceConnectionState: RTCIceConnectionState = "new";
      connectionState: RTCPeerConnectionState = "new";
      localDescription: RTCSessionDescriptionInit | null = null;
      remoteDescription: RTCSessionDescriptionInit | null = null;
      private listeners = new Map<string, Set<(event?: unknown) => void>>();
      private transceivers: Array<{ mid: string }> = [];

      addTransceiver(): { mid: string } {
        const transceiver = { mid: String(this.transceivers.length) };
        this.transceivers.push(transceiver);
        return transceiver;
      }

      getTransceivers(): Array<{ mid: string }> {
        return this.transceivers;
      }

      addEventListener(type: string, listener: (event?: unknown) => void): void {
        const bucket = this.listeners.get(type) || new Set<(event?: unknown) => void>();
        bucket.add(listener);
        this.listeners.set(type, bucket);
      }

      removeEventListener(type: string, listener: (event?: unknown) => void): void {
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

      private emit(type: string, event?: unknown): void {
        for (const listener of this.listeners.get(type) || []) {
          listener(event);
        }
      }
    }

    Object.defineProperty(window, "BroadcastChannel", {
      configurable: true,
      writable: true,
      value: MockBroadcastChannel,
    });

    Object.defineProperty(window, "RTCPeerConnection", {
      configurable: true,
      writable: true,
      value: MockRTCPeerConnection,
    });
  }, {
    launchId: "launch-test-001",
    context: buildLaunchContext(),
    respondFromShell: false,
  });
});

test("boots from stored launch context and renders a live camera grid", async ({ page }) => {
  await page.goto("/#launch=launch-test-001");

  await expect(page.getByRole("heading", { name: "Security Cameras" })).toBeVisible();
  await expect(page.locator("#subtitle")).toContainText("Lab NVR");
  await expect(page.locator("#summaryGateway")).toContainText("gatewaypk0123456…");
  await expect(page.locator("#summaryService")).toContainText("servicepk0123456…");
  await expect(page.locator("#summaryCameras")).toHaveText("2");
  await expect(page.locator("#summaryState")).toHaveText(/connected|live/i);
  await expect(page.locator(".cameraTile")).toHaveCount(2);
  await expect(page.locator(".cameraBadge", { hasText: "live" })).toHaveCount(2);
  await expect(page.locator("#gridHint")).toContainText("Receiving live H.264 preview");
});

test("requests launch context from the shell when local storage is empty", async ({ page }) => {
  await page.addInitScript(({ launchId, context }) => {
    window.localStorage.removeItem(`constitute.launch.${launchId}`);

    const OriginalBroadcastChannel = window.BroadcastChannel as unknown as {
      new (name: string): BroadcastChannel;
    };

    class ResponsiveBroadcastChannel extends OriginalBroadcastChannel {
      postMessage(message: unknown): void {
        const payload = (message && typeof message === "object") ? message as Record<string, unknown> : {};
        if (payload.type === "launch-context.request") {
          window.setTimeout(() => {
            this.onmessage?.({
              data: {
                type: "launch-context.response",
                launchId,
                ok: true,
                context,
              },
            } as MessageEvent);
          }, 0);
        }
        super.postMessage(message);
      }
    }

    Object.defineProperty(window, "BroadcastChannel", {
      configurable: true,
      writable: true,
      value: ResponsiveBroadcastChannel,
    });
  }, {
    launchId: "launch-test-001",
    context: buildLaunchContext({
      display: {
        serviceLabel: "Recovered From Shell",
        sources: ["cam-only"],
        cameraCount: 1,
        configuredSources: 1,
        iceServers: {
          stun: ["stun:stun.example.invalid:3478"],
        },
      },
    }),
  });

  await page.goto("/#launch=launch-test-001");

  await expect(page.locator("#subtitle")).toContainText("Recovered From Shell");
  await expect(page.locator("#summaryCameras")).toHaveText("1");
  await expect(page.locator(".cameraTile")).toHaveCount(1);
  await expect(page.locator("#log")).toContainText("asking shell");
});

test("shows a clear launch failure when context cannot be recovered", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem("constitute.launch.launch-test-001");

    class FailingBroadcastChannel {
      name: string;
      onmessage: ((event: { data: unknown }) => void) | null = null;
      constructor(name: string) {
        this.name = name;
      }
      postMessage(message: unknown): void {
        const payload = (message && typeof message === "object") ? message as Record<string, unknown> : {};
        const launchId = String(payload.launchId || "");
        if (payload.type === "launch-context.request") {
          window.setTimeout(() => {
            this.onmessage?.({
              data: {
                type: "launch-context.response",
                launchId,
                ok: false,
                context: null,
              },
            });
          }, 0);
        }
      }
      addEventListener(): void {}
      removeEventListener(): void {}
      close(): void {}
    }

    Object.defineProperty(window, "BroadcastChannel", {
      configurable: true,
      writable: true,
      value: FailingBroadcastChannel,
    });
  });

  await page.goto("/#launch=launch-test-001");

  await expect(page.locator("#subtitle")).toHaveText("Managed launch failed.");
  await expect(page.locator(".emptyState strong")).toHaveText("Launch Failed");
  await expect(page.locator("#gridHint")).toContainText("launch context is unavailable");
});
