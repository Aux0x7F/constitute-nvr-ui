import "./styles.css";

type IceServerHints = {
  stun?: string[];
  turn?: string[];
};

type LaunchDisplay = {
  serviceLabel?: string;
  serviceVersion?: string;
  service?: string;
  status?: string;
  cameraCount?: number;
  configuredSources?: number;
  sources?: string[];
  iceServers?: IceServerHints;
};

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
  display?: LaunchDisplay;
  createdAt: number;
  expiresAt: number;
};

type LaunchStage =
  | "surface_load"
  | "launch_context"
  | "launch_authorization"
  | "gateway_signal"
  | "webrtc_media";

type PendingRequest<T> = {
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
  timer: number;
};

type GatewaySignalResult = {
  requestId: string;
  ok: boolean;
  result?: unknown;
  error?: string;
};

type CameraTile = {
  id: string;
  card: HTMLDivElement;
  badge: HTMLSpanElement;
  detail: HTMLParagraphElement;
  video: HTMLVideoElement;
};

const APP_CHANNEL_NAME = "constitute.app.launch";
const LAUNCH_STORAGE_PREFIX = "constitute.launch.";
const DIAGNOSTICS_STORAGE_KEY = "constitute.nvr.diagnostics";
const LAUNCH_REQUEST_TIMEOUT_MS = 6_000;
const SIGNAL_REQUEST_TIMEOUT_MS = 30_000;
const RUNTIME_WORKER_BUILD_ID = "2026-04-03-runtime-v1";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("#app not found");
}

app.innerHTML = `
  <main class="shell">
    <header class="hero">
      <div>
        <p class="eyebrow">Constitute Managed App</p>
        <h1>Security Cameras</h1>
        <p id="subtitle" class="subtitle">Waiting for managed launch context…</p>
      </div>
      <div class="heroMeta">
        <span id="connectionBadge" class="badge badge-neutral">idle</span>
        <button id="closeAppButton" type="button" class="backLink" hidden>Close</button>
      </div>
    </header>

    <section id="summaryPanel" class="panel summaryPanel">
      <div class="summaryItem">
        <span class="summaryLabel">Gateway</span>
        <span id="summaryGateway" class="summaryValue mono">—</span>
      </div>
      <div class="summaryItem">
        <span class="summaryLabel">Service</span>
        <span id="summaryService" class="summaryValue mono">—</span>
      </div>
      <div class="summaryItem">
        <span class="summaryLabel">Cameras</span>
        <span id="summaryCameras" class="summaryValue">0</span>
      </div>
      <div class="summaryItem">
        <span class="summaryLabel">State</span>
        <span id="summaryState" class="summaryValue">waiting</span>
      </div>
    </section>

    <section class="panel">
      <div class="panelHeader">
        <div>
          <h2>Live Grid</h2>
          <p id="gridHint" class="panelHint">Launch context not loaded yet.</p>
        </div>
        <button id="btnReconnect" type="button" class="secondary">Reconnect</button>
      </div>
      <div id="cameraGrid" class="cameraGrid">
        <article class="emptyState">
          <strong>No Cameras</strong>
          <p>Launch the app from Constitute after the NVR service is available.</p>
        </article>
      </div>
    </section>

    <section id="logPanel" class="panel">
      <div class="panelHeader">
        <div>
          <h2>Session Log</h2>
          <p class="panelHint">Managed launch and WebRTC negotiation details.</p>
        </div>
      </div>
      <pre id="log" class="log"></pre>
    </section>
  </main>
`;

const subtitleEl = byId<HTMLParagraphElement>("subtitle");
const connectionBadgeEl = byId<HTMLSpanElement>("connectionBadge");
const closeAppButtonEl = byId<HTMLButtonElement>("closeAppButton");
const bootSplashEl = document.getElementById("bootSplash");
const bootSplashTitleEl = document.getElementById("bootSplashTitle");
const bootSplashStatusEl = document.getElementById("bootSplashStatus");
const summaryPanelEl = byId<HTMLElement>("summaryPanel");
const summaryGatewayEl = byId<HTMLSpanElement>("summaryGateway");
const summaryServiceEl = byId<HTMLSpanElement>("summaryService");
const summaryCamerasEl = byId<HTMLSpanElement>("summaryCameras");
const summaryStateEl = byId<HTMLSpanElement>("summaryState");
const gridHintEl = byId<HTMLParagraphElement>("gridHint");
const cameraGridEl = byId<HTMLDivElement>("cameraGrid");
const btnReconnect = byId<HTMLButtonElement>("btnReconnect");
const logPanelEl = byId<HTMLElement>("logPanel");
const logEl = byId<HTMLPreElement>("log");

const pendingLaunchResponses = new Map<string, PendingRequest<LaunchContext | null>>();
const pendingSignalResponses = new Map<string, PendingRequest<GatewaySignalResult>>();
const cameraTiles = new Map<string, CameraTile>();

let channel: BroadcastChannel | null = null;
let runtimePort: MessagePort | null = null;
let runtimeRequestSeq = 1;
const pendingRuntimeResponses = new Map<string, PendingRequest<unknown>>();
let runtimeReadyPromise: Promise<MessagePort | null> | null = null;
let resolveRuntimeReady: ((value: MessagePort | null) => void) | null = null;
let launchContext: LaunchContext | null = null;
let peerConnection: RTCPeerConnection | null = null;
let transceiverSourceIds: string[] = [];
const logLines: string[] = [];
let diagnosticsEnabled = false;
let bootSplashDismissed = false;

btnReconnect.addEventListener("click", () => {
  void reconnect();
});

closeAppButtonEl.addEventListener("click", () => {
  void focusShellAndClose();
});

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element #${id}`);
  return el as T;
}

class ManagedLaunchError extends Error {
  stage: LaunchStage;
  detail: string;

  constructor(stage: LaunchStage, detail: string) {
    super(`${stage}: ${detail}`);
    this.name = "ManagedLaunchError";
    this.stage = stage;
    this.detail = detail;
  }
}

function launchError(stage: LaunchStage, detail: string): ManagedLaunchError {
  return new ManagedLaunchError(stage, String(detail || "Unknown error").trim() || "Unknown error");
}

function asManagedLaunchError(error: unknown, fallbackStage: LaunchStage): ManagedLaunchError {
  if (error instanceof ManagedLaunchError) return error;
  return launchError(fallbackStage, String((error as Error)?.message || error || "Unknown error"));
}

function appendLog(message: string): void {
  const line = `[${new Date().toLocaleTimeString()}] ${message}`;
  logLines.push(line);
  if (diagnosticsEnabled) {
    renderLogBuffer();
    console.info(`[nvr-ui] ${message}`);
  }
}

function setBadge(label: string, tone: "neutral" | "warn" | "good" | "bad"): void {
  connectionBadgeEl.textContent = label;
  connectionBadgeEl.className = `badge badge-${tone}`;
}

function setSummaryState(value: string): void {
  summaryStateEl.textContent = value;
}

function pkLabel(value: string): string {
  const raw = String(value || "").trim();
  if (!raw) return "—";
  return raw.length > 16 ? `${raw.slice(0, 16)}…` : raw;
}

function randomOpaqueId(prefix: string): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}-${token}`;
}

function hashParams(): URLSearchParams {
  return new URLSearchParams(String(window.location.hash || "").replace(/^#/, ""));
}

function parseLaunchId(): string {
  const raw = String(window.location.hash || "").replace(/^#/, "");
  const params = hashParams();
  return String(params.get("launch") || raw || "").trim();
}

function readDiagnosticsPreference(): boolean {
  const params = hashParams();
  const requested = String(
    params.get("diagnostics") ||
    params.get("diag") ||
    params.get("debug") ||
    "",
  ).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(requested)) return true;
  try {
    return window.localStorage.getItem(DIAGNOSTICS_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function persistDiagnosticsPreference(enabled: boolean): void {
  try {
    if (enabled) {
      window.localStorage.setItem(DIAGNOSTICS_STORAGE_KEY, "1");
    } else {
      window.localStorage.removeItem(DIAGNOSTICS_STORAGE_KEY);
    }
  } catch {}
}

function renderLogBuffer(): void {
  logEl.textContent = logLines.join("\n");
  logEl.scrollTop = logEl.scrollHeight;
}

function applyDiagnosticsMode(): void {
  diagnosticsEnabled = readDiagnosticsPreference();
  summaryPanelEl.classList.toggle("diagnostics-hidden", !diagnosticsEnabled);
  logPanelEl.classList.toggle("diagnostics-hidden", !diagnosticsEnabled);
  if (diagnosticsEnabled) {
    renderLogBuffer();
  }
}

function installDiagnosticsBridge(): void {
  const api = {
    get enabled(): boolean {
      return diagnosticsEnabled;
    },
    enable(): boolean {
      persistDiagnosticsPreference(true);
      applyDiagnosticsMode();
      console.info("[nvr-ui] diagnostics enabled");
      return diagnosticsEnabled;
    },
    disable(): boolean {
      persistDiagnosticsPreference(false);
      applyDiagnosticsMode();
      console.info("[nvr-ui] diagnostics disabled");
      return diagnosticsEnabled;
    },
  };
  Object.defineProperty(window, "ConstituteNvrUiDiagnostics", {
    value: api,
    configurable: true,
    enumerable: false,
    writable: false,
  });
}

function shellBaseUrl(): string {
  return new URL("/constitute/", window.location.origin).toString();
}

function setBootSplash(title: string, status: string): void {
  if (!bootSplashEl || bootSplashDismissed) return;
  if (bootSplashTitleEl) bootSplashTitleEl.textContent = title;
  if (bootSplashStatusEl) bootSplashStatusEl.textContent = status;
  document.body.classList.add("booting");
}

function dismissBootSplash(): void {
  if (!bootSplashEl || bootSplashDismissed) return;
  bootSplashDismissed = true;
  document.body.classList.remove("booting");
  window.setTimeout(() => {
    try {
      bootSplashEl.remove();
    } catch {}
  }, 220);
}

function hasShellOpener(): boolean {
  try {
    return Boolean(window.opener && !window.opener.closed);
  } catch {
    return false;
  }
}

function updateCloseAppButton(): void {
  closeAppButtonEl.hidden = !hasShellOpener();
}

async function focusShellAndClose(): Promise<void> {
  let openerFocused = false;
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.focus();
      openerFocused = true;
    }
  } catch {}

  try {
    window.close();
  } catch {}

  window.setTimeout(() => {
    if (window.closed) return;
    if (openerFocused) return;
    closeAppButtonEl.hidden = true;
  }, 150);
}

function runtimeWorkerUrl(): string {
  const target = new URL("/constitute/runtime.worker.js", window.location.origin);
  target.searchParams.set("v", RUNTIME_WORKER_BUILD_ID);
  return target.toString();
}

function launchStorageKey(launchId: string): string {
  return `${LAUNCH_STORAGE_PREFIX}${launchId}`;
}

function readStoredLaunchContext(launchId: string): LaunchContext | null {
  const key = launchStorageKey(launchId);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LaunchContext;
    const expiresAt = Number(parsed?.expiresAt || 0);
    if (expiresAt && expiresAt < Date.now()) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function handleRuntimeMessage(message: unknown): void {
  if (!message || typeof message !== "object") return;
  const payload = message as Record<string, unknown>;
  const type = String(payload.type || "").trim();
  if (type === "runtime.attached" || type === "status.snapshot") {
    if (type === "runtime.attached" && resolveRuntimeReady) {
      resolveRuntimeReady(runtimePort);
      resolveRuntimeReady = null;
    }
    appendLog(`runtime ${type === "runtime.attached" ? "attached" : "snapshot"} ${String(payload.buildId || "")}`.trim());
    return;
  }
  if (type === "runtime.ack") {
    appendLog(`runtime ack ${String(payload.kind || "").trim()} ${payload.ok === false ? String(payload.error || "failed") : "ok"}`.trim());
    return;
  }
  if (type !== "runtime.response") return;
  const requestId = String(payload.requestId || "").trim();
  const pending = pendingRuntimeResponses.get(requestId);
  if (!pending) return;
  clearTimeout(pending.timer);
  pendingRuntimeResponses.delete(requestId);
  if (payload.ok === false) {
    pending.reject(new Error(String(payload.error || "runtime request failed")));
    return;
  }
  pending.resolve(payload.result);
}

async function ensureRuntimePort(): Promise<MessagePort | null> {
  if (runtimeReadyPromise) return await runtimeReadyPromise;
  if (typeof SharedWorker === "undefined") return null;
  runtimeReadyPromise = new Promise<MessagePort | null>((resolve) => {
    const timeout = window.setTimeout(() => {
      if (resolveRuntimeReady) {
        resolveRuntimeReady(null);
        resolveRuntimeReady = null;
      }
      runtimeReadyPromise = null;
      runtimePort = null;
      appendLog("runtime attach unavailable; falling back to local launch bootstrap");
    }, 1_200);
    resolveRuntimeReady = (value) => {
      window.clearTimeout(timeout);
      resolve(value);
    };
    try {
      const worker = new SharedWorker(runtimeWorkerUrl());
      runtimePort = worker.port;
      runtimePort.start();
      runtimePort.onmessage = (event) => handleRuntimeMessage(event.data);
      runtimePort.postMessage({
        type: "runtime.attach",
        clientId: randomOpaqueId("runtime-nvr"),
        surface: "constitute-nvr-ui",
        broker: false,
      });
    } catch (error) {
      window.clearTimeout(timeout);
      appendLog(`runtime attach unavailable; falling back (${String((error as Error)?.message || error)})`);
      runtimePort = null;
      runtimeReadyPromise = null;
      resolveRuntimeReady = null;
      resolve(null);
    }
  });
  return await runtimeReadyPromise;
}

async function runtimeCall<T = unknown>(type: string, payload: Record<string, unknown>, timeoutMs: number): Promise<T | null> {
  const port = await ensureRuntimePort();
  if (!port) return null;
  const requestId = randomOpaqueId("runtime");
  const promise = new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pendingRuntimeResponses.delete(requestId);
      reject(new Error(`${type} timed out`));
    }, timeoutMs);
    pendingRuntimeResponses.set(requestId, { resolve, reject, timer });
  });
  port.postMessage({
    type,
    requestId,
    ...payload,
  });
  return await promise;
}

async function reportServiceStatus(state: string, reason: string, stage: LaunchStage | "" = ""): Promise<void> {
  try {
    await runtimeCall("status.update", {
      role: "service",
      service: "nvr",
      status: {
        service: "nvr",
        state,
        reason,
        stage,
        updatedAt: Date.now(),
      },
    }, 5_000);
  } catch {}
}

function ensureChannel(): BroadcastChannel {
  if (channel) return channel;
  if (typeof BroadcastChannel === "undefined") {
    throw new Error("BroadcastChannel is not available in this browser");
  }
  channel = new BroadcastChannel(APP_CHANNEL_NAME);
  channel.onmessage = (event) => handleChannelMessage(event.data);
  return channel;
}

function handleChannelMessage(message: unknown): void {
  if (!message || typeof message !== "object") return;
  const payload = message as Record<string, unknown>;
  const type = String(payload.type || "").trim();
  if (type === "launch-context.response") {
    const launchId = String(payload.launchId || "").trim();
    const pending = pendingLaunchResponses.get(launchId);
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingLaunchResponses.delete(launchId);
    const ok = payload.ok === true;
    if (!ok) {
      pending.resolve(null);
      return;
    }
    pending.resolve((payload.context || null) as LaunchContext | null);
    return;
  }

  if (type === "gateway.signal.response") {
    const requestId = String(payload.requestId || "").trim();
    const pending = pendingSignalResponses.get(requestId);
    if (!pending) return;
    const resultPayload = payload.result && typeof payload.result === "object"
      ? payload.result as Record<string, unknown>
      : null;
    const nestedPayload = resultPayload?.payload && typeof resultPayload.payload === "object"
      ? resultPayload.payload as Record<string, unknown>
      : null;
    appendLog(`channel gateway.signal.response ${requestId} ok=${payload.ok === true} keys=${resultPayload ? Object.keys(resultPayload).join(",") : "(none)"} payloadKeys=${nestedPayload ? Object.keys(nestedPayload).join(",") : "(none)"}`);
    clearTimeout(pending.timer);
    pendingSignalResponses.delete(requestId);
    const ok = payload.ok === true;
    if (!ok) {
      pending.reject(new Error(String(payload.error || "gateway signaling failed")));
      return;
    }
    pending.resolve({
      requestId,
      ok: true,
      result: payload.result,
    });
  }
}

async function requestLaunchContextFromShell(launchId: string): Promise<LaunchContext | null> {
  const bc = ensureChannel();
  const promise = new Promise<LaunchContext | null>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pendingLaunchResponses.delete(launchId);
      reject(new Error("launch context request timed out"));
    }, LAUNCH_REQUEST_TIMEOUT_MS);
    pendingLaunchResponses.set(launchId, { resolve, reject, timer });
  });
  bc.postMessage({ type: "launch-context.request", launchId });
  return await promise;
}

async function requestLaunchContextFromRuntime(launchId: string): Promise<LaunchContext | null> {
  const result = await runtimeCall<LaunchContext | null>("launchContext.get", { launchId }, LAUNCH_REQUEST_TIMEOUT_MS);
  return result || null;
}

function waitForShellSignalResponse(requestId: string, timeoutMs: number): {
  promise: Promise<GatewaySignalResult>;
  cancel: () => void;
} {
  let settled = false;
  const promise = new Promise<GatewaySignalResult>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      pendingSignalResponses.delete(requestId);
      reject(new Error("shell signal response timed out"));
    }, timeoutMs);
    pendingSignalResponses.set(requestId, {
      resolve: (value: GatewaySignalResult) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        pendingSignalResponses.delete(requestId);
        resolve(value);
      },
      reject: (error: Error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        pendingSignalResponses.delete(requestId);
        reject(error);
      },
      timer,
    });
  });
  return {
    promise,
    cancel: () => {
      if (settled) return;
      settled = true;
      const pending = pendingSignalResponses.get(requestId);
      if (pending) {
        window.clearTimeout(pending.timer);
        pendingSignalResponses.delete(requestId);
      }
    },
  };
}

async function requestGatewaySignalViaShellChannel(
  signalType: string,
  payload: unknown,
  requestId: string,
): Promise<GatewaySignalResult> {
  if (!launchContext) throw new Error("launch context is not loaded");
  const bc = ensureChannel();
  const pending = waitForShellSignalResponse(requestId, SIGNAL_REQUEST_TIMEOUT_MS);
  bc.postMessage({
    type: "gateway.signal.request",
    launchId: launchContext.launchId,
    requestId,
    signalType,
    payload,
  });
  return await pending.promise;
}

async function requestGatewaySignal(signalType: string, payload: unknown): Promise<GatewaySignalResult> {
  if (!launchContext) throw new Error("launch context is not loaded");
  const requestId = randomOpaqueId("nvr-signal");
  const runtimePort = await ensureRuntimePort();
  if (!runtimePort) {
    appendLog(`runtime broker unavailable; using shell channel for ${signalType}`);
    return await requestGatewaySignalViaShellChannel(signalType, payload, requestId);
  }
  ensureChannel();
  const mirroredResponse = waitForShellSignalResponse(requestId, SIGNAL_REQUEST_TIMEOUT_MS);
  try {
    const runtimeResult = await runtimeCall<GatewaySignalResult>("gateway.signal.request", {
      payload: {
        requestId,
        gatewayPk: launchContext.gatewayPk,
        servicePk: launchContext.servicePk,
        service: launchContext.service || "nvr",
        launchToken: launchContext.launchToken,
        signalType,
        payload,
      },
    }, Math.min(SIGNAL_REQUEST_TIMEOUT_MS, 8_000));
    if (runtimeResult) {
      mirroredResponse.cancel();
      appendLog(`runtime broker delivered ${signalType} response`);
      return runtimeResult;
    }
  } catch (error) {
    appendLog(`runtime broker ${signalType} failed; waiting for shell mirror (${String((error as Error)?.message || error)})`);
  }
  try {
    const mirrored = await mirroredResponse.promise;
    appendLog(`shell channel delivered ${signalType} response`);
    return mirrored.result;
  } catch (error) {
    appendLog(`shell mirror ${signalType} failed; retrying via shell channel (${String((error as Error)?.message || error)})`);
    return await requestGatewaySignalViaShellChannel(signalType, payload, randomOpaqueId("nvr-signal-bc"));
  }
}

function normalizeSourceIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    const next = String(entry || "").trim();
    if (next && !out.includes(next)) out.push(next);
  }
  return out;
}

function buildRtcIceServers(hints: IceServerHints | undefined): RTCIceServer[] {
  const servers: RTCIceServer[] = [];
  const stun = normalizeSourceIds(hints?.stun || []);
  if (stun.length > 0) servers.push({ urls: stun });
  const turn = normalizeSourceIds(hints?.turn || []);
  if (turn.length > 0) servers.push({ urls: turn });
  return servers;
}

function setGridEmpty(title: string, body: string): void {
  cameraTiles.clear();
  cameraGridEl.innerHTML = `
    <article class="emptyState">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(body)}</p>
    </article>
  `;
}

function ensureCameraTile(sourceId: string): CameraTile {
  const existing = cameraTiles.get(sourceId);
  if (existing) return existing;

  if (cameraTiles.size === 0) {
    cameraGridEl.innerHTML = "";
  }

  const card = document.createElement("article");
  card.className = "cameraTile";

  const header = document.createElement("div");
  header.className = "cameraHeader";

  const title = document.createElement("div");
  title.className = "cameraTitle";
  title.textContent = sourceId;

  const badge = document.createElement("span");
  badge.className = "cameraBadge cameraBadge-neutral";
  badge.textContent = "waiting";

  header.appendChild(title);
  header.appendChild(badge);

  const video = document.createElement("video");
  video.className = "cameraVideo";
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.controls = false;

  const detail = document.createElement("p");
  detail.className = "cameraDetail";
  detail.textContent = "Waiting for media.";

  card.appendChild(header);
  card.appendChild(video);
  card.appendChild(detail);
  cameraGridEl.appendChild(card);

  const tile = { id: sourceId, card, badge, detail, video };
  cameraTiles.set(sourceId, tile);
  return tile;
}

function setTileState(sourceId: string, state: "waiting" | "connecting" | "live" | "unavailable", detail: string): void {
  const tile = ensureCameraTile(sourceId);
  tile.badge.textContent = state;
  tile.badge.className = `cameraBadge cameraBadge-${state}`;
  tile.detail.textContent = detail;
}

function attachTrackToTile(sourceId: string, stream: MediaStream): void {
  const tile = ensureCameraTile(sourceId);
  tile.video.srcObject = stream;
  void tile.video.play().catch(() => {});
  setTileState(sourceId, "live", "Receiving live preview.");
}

function markAllTiles(state: "waiting" | "connecting" | "unavailable", detail: string): void {
  for (const sourceId of cameraTiles.keys()) {
    setTileState(sourceId, state, detail);
  }
}

function hasLiveTiles(): boolean {
  for (const tile of cameraTiles.values()) {
    if (tile.badge.textContent === "live") return true;
  }
  return false;
}

function escapeHtml(value: string): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function waitForIceGatheringComplete(pc: RTCPeerConnection, timeoutMs = 8_000): Promise<void> {
  if (pc.iceGatheringState === "complete") return;
  await new Promise<void>((resolve) => {
    const timeout = window.setTimeout(() => {
      pc.removeEventListener("icegatheringstatechange", onChange);
      resolve();
    }, timeoutMs);
    const onChange = () => {
      if (pc.iceGatheringState !== "complete") return;
      window.clearTimeout(timeout);
      pc.removeEventListener("icegatheringstatechange", onChange);
      resolve();
    };
    pc.addEventListener("icegatheringstatechange", onChange);
  });
}

function sameIceCandidate(left: RTCIceCandidateInit, right: RTCIceCandidateInit): boolean {
  return (
    String(left.candidate || "") === String(right.candidate || "") &&
    String(left.sdpMid || "") === String(right.sdpMid || "") &&
    Number(left.sdpMLineIndex ?? -1) === Number(right.sdpMLineIndex ?? -1) &&
    String(left.usernameFragment || "") === String(right.usernameFragment || "")
  );
}

async function addRemoteIceCandidates(
  pc: RTCPeerConnection,
  candidates: RTCIceCandidateInit[],
): Promise<void> {
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object" || !String(candidate.candidate || "").trim()) continue;
    await pc.addIceCandidate(candidate);
  }
}

function localDescriptionPayload(pc: RTCPeerConnection): { type: string; sdp: string } {
  const desc = pc.localDescription;
  if (!desc?.type || !desc.sdp) throw new Error("local WebRTC offer is missing");
  return {
    type: desc.type,
    sdp: desc.sdp,
  };
}

function extractAnswerDescription(result: GatewaySignalResult): RTCSessionDescriptionInit {
  const outer = (result && typeof result === "object" ? result : {}) as Record<string, unknown>;
  const root = ((outer.result && typeof outer.result === "object") ? outer.result : outer) as Record<string, unknown>;
  const payload = (root.payload || root.result || root) as Record<string, unknown>;

  const direct = payload && typeof payload === "object"
    ? payload
    : {};

  const candidate =
    (direct.answer as Record<string, unknown> | undefined) ||
    (direct.payload as Record<string, unknown> | undefined) ||
    (direct.description as Record<string, unknown> | undefined) ||
    direct;

  const type = String(candidate?.type || "").trim();
  const sdp = String(candidate?.sdp || "").trim();
  if (!type || !sdp) {
    throw new Error("gateway answer payload is missing type/sdp");
  }
  return { type: type as RTCSdpType, sdp };
}

function extractGrantedSources(result: GatewaySignalResult, fallback: string[]): string[] {
  const outer = (result && typeof result === "object" ? result : {}) as Record<string, unknown>;
  const root = ((outer.result && typeof outer.result === "object") ? outer.result : outer) as Record<string, unknown>;
  const payload = (root.payload || root.result || root) as Record<string, unknown>;
  const sources = normalizeSourceIds(payload?.sources);
  return sources.length > 0 ? sources : fallback;
}

function extractRemoteCandidates(result: GatewaySignalResult): RTCIceCandidateInit[] {
  const outer = (result && typeof result === "object" ? result : {}) as Record<string, unknown>;
  const root = ((outer.result && typeof outer.result === "object") ? outer.result : outer) as Record<string, unknown>;
  const payload = (root.payload || root.result || root) as Record<string, unknown>;

  const candidateSets = [
    payload?.candidates,
    (payload?.answer as Record<string, unknown> | undefined)?.candidates,
    (payload?.payload as Record<string, unknown> | undefined)?.candidates,
    (payload?.description as Record<string, unknown> | undefined)?.candidates,
  ];

  const collected: RTCIceCandidateInit[] = [];
  for (const set of candidateSets) {
    if (!Array.isArray(set)) continue;
    for (const entry of set) {
      if (!entry || typeof entry !== "object") continue;
      const candidate = entry as RTCIceCandidateInit;
      if (!String(candidate.candidate || "").trim()) continue;
      if (!collected.some((existing) => sameIceCandidate(existing, candidate))) {
        collected.push(candidate);
      }
    }
  }
  return collected;
}

function refreshSummary(context: LaunchContext): void {
  const display = context.display || {};
  subtitleEl.textContent = display.serviceLabel
    ? `Gateway-managed live preview for ${display.serviceLabel}.`
    : "Gateway-managed live preview for your Security Cameras service.";
  summaryGatewayEl.textContent = pkLabel(context.gatewayPk);
  summaryServiceEl.textContent = pkLabel(context.servicePk);
  summaryCamerasEl.textContent = String(display.cameraCount || display.configuredSources || normalizeSourceIds(display.sources).length || 0);
}

async function loadLaunchContext(): Promise<LaunchContext> {
  const launchId = parseLaunchId();
  if (!launchId) throw launchError("launch_context", "launch id is missing from the URL");

  const fromRuntime = await requestLaunchContextFromRuntime(launchId).catch(() => null);
  if (fromRuntime) return fromRuntime;

  const stored = readStoredLaunchContext(launchId);
  if (stored) return stored;

  appendLog(`launch context ${launchId} not found locally; asking shell`);
  const fromShell = await requestLaunchContextFromShell(launchId).catch((error) => {
    throw launchError("launch_context", String((error as Error)?.message || error || "launch context request failed"));
  });
  if (fromShell) return fromShell;
  throw launchError("launch_context", "launch context is unavailable; reopen this app from Constitute");
}

function sourceIdForTrack(event: RTCTrackEvent): string {
  const pc = peerConnection;
  if (!pc) return "";
  const index = pc.getTransceivers().indexOf(event.transceiver);
  if (index >= 0 && index < transceiverSourceIds.length) {
    return transceiverSourceIds[index];
  }
  return transceiverSourceIds[0] || "";
}

async function connectLiveGrid(context: LaunchContext): Promise<void> {
  const display = context.display || {};
  app.dataset.launchStage = "gateway_signal";
  setBootSplash("Connecting", "Negotiating live preview…");
  const requestedSources = normalizeSourceIds(display.sources);
  if (requestedSources.length === 0) {
    setGridEmpty("No Cameras", "The managed NVR service has not reported any enabled sources yet.");
    setBadge("no cameras", "warn");
    setSummaryState("no cameras");
    gridHintEl.textContent = "No enabled camera sources were advertised by the NVR service.";
    void reportServiceStatus("no cameras", "The managed NVR service did not advertise any enabled sources.", "launch_authorization");
    return;
  }

  cameraGridEl.innerHTML = "";
  cameraTiles.clear();
  for (const sourceId of requestedSources) {
    ensureCameraTile(sourceId);
    setTileState(sourceId, "connecting", "Preparing WebRTC preview…");
  }

  gridHintEl.textContent = "Negotiating live preview through the owned gateway.";
  setBadge("negotiating", "warn");
  setSummaryState("negotiating");
  void reportServiceStatus("negotiating", "Negotiating live preview through the owned gateway.", "gateway_signal");

  const rtcConfig: RTCConfiguration = {
    iceServers: buildRtcIceServers(display.iceServers),
    bundlePolicy: "max-bundle",
  };

  peerConnection?.close();
  peerConnection = new RTCPeerConnection(rtcConfig);
  transceiverSourceIds = [...requestedSources];
  const localCandidates: RTCIceCandidateInit[] = [];

  for (const sourceId of requestedSources) {
    peerConnection.addTransceiver("video", { direction: "recvonly" });
    setTileState(sourceId, "connecting", "Waiting for answer from the gateway.");
  }

  peerConnection.addEventListener("icecandidate", (event) => {
    const json = event.candidate?.toJSON();
    if (!json || !String(json.candidate || "").trim()) return;
    if (!localCandidates.some((existing) => sameIceCandidate(existing, json))) {
      localCandidates.push(json);
    }
  });

  peerConnection.addEventListener("track", (event) => {
    const sourceId = sourceIdForTrack(event);
    const stream = event.streams[0] || new MediaStream([event.track]);
    attachTrackToTile(sourceId || event.track.id, stream);
    setBadge("live", "good");
    setSummaryState("live");
    gridHintEl.textContent = "Receiving live H.264 preview.";
    void reportServiceStatus("live", "Receiving live H.264 preview.", "webrtc_media");
  });

  peerConnection.addEventListener("connectionstatechange", () => {
    const state = peerConnection?.connectionState || "unknown";
    appendLog(`peer connection state -> ${state}`);
    if (state === "failed" || state === "disconnected") {
      setBadge(state, "bad");
      setSummaryState(state);
      markAllTiles("unavailable", "Peer connection dropped.");
      void reportServiceStatus("degraded", `Peer connection ${state}.`, "webrtc_media");
    }
  });

  peerConnection.addEventListener("iceconnectionstatechange", () => {
    const state = peerConnection?.iceConnectionState || "unknown";
    appendLog(`ice connection state -> ${state}`);
    if (state === "checking") {
      setBadge("checking", "warn");
      setSummaryState("checking");
    } else if (state === "connected" || state === "completed") {
      setBadge("connected", "good");
      setSummaryState("connected");
      void reportServiceStatus("connected", "WebRTC peer connection established.", "webrtc_media");
    } else if (state === "failed") {
      setBadge("failed", "bad");
      setSummaryState("failed");
      markAllTiles("unavailable", "ICE connectivity failed.");
      void reportServiceStatus("failed", "ICE connectivity failed.", "webrtc_media");
    }
  });

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  await waitForIceGatheringComplete(peerConnection);

  appendLog(`sending offer for ${requestedSources.length} source(s)`);
  const result = await requestGatewaySignal("offer", {
    description: localDescriptionPayload(peerConnection),
    candidates: localCandidates,
    sourceIds: requestedSources,
  }).catch((error) => {
    throw launchError("gateway_signal", String((error as Error)?.message || error || "gateway signaling failed"));
  });

  const grantedSources = extractGrantedSources(result, requestedSources);
  for (const sourceId of requestedSources) {
    if (!grantedSources.includes(sourceId)) {
      setTileState(sourceId, "unavailable", "Source was not granted by the NVR service.");
    }
  }

  const answer = extractAnswerDescription(result);
  const remoteCandidates = extractRemoteCandidates(result);
  app.dataset.launchStage = "webrtc_media";
  await peerConnection.setRemoteDescription(answer).catch((error) => {
    throw launchError("webrtc_media", String((error as Error)?.message || error || "remote description failed"));
  });
  await addRemoteIceCandidates(peerConnection, remoteCandidates).catch((error) => {
    throw launchError("webrtc_media", String((error as Error)?.message || error || "remote ICE candidate failed"));
  });
  appendLog("remote answer applied");
  if (!hasLiveTiles()) {
    setBadge("connecting", "warn");
    setSummaryState("connecting");
  }
}

async function reconnect(): Promise<void> {
  setBootSplash("Connecting", launchContext ? "Reconnecting live preview…" : "Restoring launch context…");
  if (!launchContext) {
    launchContext = await loadLaunchContext();
  }
  refreshSummary(launchContext);
  await connectLiveGrid(launchContext);
}

function closePeerConnection(): void {
  if (peerConnection) {
    try {
      peerConnection.close();
    } catch {}
    peerConnection = null;
  }
}

function fireAndForgetSessionClose(): void {
  if (!launchContext || !channel) return;
  try {
    channel.postMessage({
      type: "gateway.signal.request",
      launchId: launchContext.launchId,
      requestId: randomOpaqueId("nvr-close"),
      signalType: "session_close",
      payload: { reason: "page_unload" },
    });
  } catch {}
}

window.addEventListener("beforeunload", () => {
  void reportServiceStatus("idle", "Security Cameras window closed.", "gateway_signal");
  fireAndForgetSessionClose();
  closePeerConnection();
});

installDiagnosticsBridge();
applyDiagnosticsMode();
updateCloseAppButton();

async function bootstrap(): Promise<void> {
  setBootSplash("Connecting", "Preparing your Security Cameras view.");
  setBadge("loading", "neutral");
  setSummaryState("loading");
  app.dataset.launchStage = "launch_context";
  appendLog("bootstrapping managed NVR app surface");
  void reportServiceStatus("loading", "Bootstrapping managed NVR app surface.", "launch_context");

  launchContext = await loadLaunchContext();
  setBootSplash("Connecting", "Launch context restored. Negotiating live preview…");
  appendLog(`launch context loaded for service ${pkLabel(launchContext.servicePk)}`);
  refreshSummary(launchContext);
  await reconnect();
  dismissBootSplash();
}

void bootstrap().catch((error) => {
  const launchFailure = asManagedLaunchError(error, "launch_context");
  console.error(launchFailure);
  closePeerConnection();
  dismissBootSplash();
  setBadge("error", "bad");
  setSummaryState("error");
  app.dataset.launchStage = launchFailure.stage;
  const message = launchFailure.detail;
  subtitleEl.textContent = "Managed launch failed.";
  gridHintEl.textContent = message;
  setGridEmpty("Launch Failed", `${launchFailure.stage}: ${message}`);
  appendLog(`fatal [${launchFailure.stage}] ${message}`);
  void reportServiceStatus("error", message, launchFailure.stage);
});
