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
const LAUNCH_REQUEST_TIMEOUT_MS = 6_000;
const SIGNAL_REQUEST_TIMEOUT_MS = 30_000;

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
        <a id="backLink" class="backLink" href="/constitute/">Back to Shell</a>
      </div>
    </header>

    <section class="panel summaryPanel">
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

    <section class="panel">
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
const backLinkEl = byId<HTMLAnchorElement>("backLink");
const summaryGatewayEl = byId<HTMLSpanElement>("summaryGateway");
const summaryServiceEl = byId<HTMLSpanElement>("summaryService");
const summaryCamerasEl = byId<HTMLSpanElement>("summaryCameras");
const summaryStateEl = byId<HTMLSpanElement>("summaryState");
const gridHintEl = byId<HTMLParagraphElement>("gridHint");
const cameraGridEl = byId<HTMLDivElement>("cameraGrid");
const btnReconnect = byId<HTMLButtonElement>("btnReconnect");
const logEl = byId<HTMLPreElement>("log");

const pendingLaunchResponses = new Map<string, PendingRequest<LaunchContext | null>>();
const pendingSignalResponses = new Map<string, PendingRequest<GatewaySignalResult>>();
const cameraTiles = new Map<string, CameraTile>();

let channel: BroadcastChannel | null = null;
let launchContext: LaunchContext | null = null;
let peerConnection: RTCPeerConnection | null = null;
let transceiverSourceIds: string[] = [];

btnReconnect.addEventListener("click", () => {
  void reconnect();
});

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element #${id}`);
  return el as T;
}

function appendLog(message: string): void {
  const line = `[${new Date().toLocaleTimeString()}] ${message}`;
  logEl.textContent = logEl.textContent ? `${logEl.textContent}\n${line}` : line;
  logEl.scrollTop = logEl.scrollHeight;
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

function parseLaunchId(): string {
  const raw = String(window.location.hash || "").replace(/^#/, "");
  const params = new URLSearchParams(raw);
  return String(params.get("launch") || raw || "").trim();
}

function shellBaseUrl(): string {
  return new URL("/constitute/", window.location.origin).toString();
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

async function requestGatewaySignal(signalType: string, payload: unknown): Promise<GatewaySignalResult> {
  if (!launchContext) throw new Error("launch context is not loaded");
  const bc = ensureChannel();
  const requestId = randomOpaqueId("nvr-signal");
  const promise = new Promise<GatewaySignalResult>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pendingSignalResponses.delete(requestId);
      reject(new Error(`${signalType} signaling timed out`));
    }, SIGNAL_REQUEST_TIMEOUT_MS);
    pendingSignalResponses.set(requestId, { resolve, reject, timer });
  });
  bc.postMessage({
    type: "gateway.signal.request",
    launchId: launchContext.launchId,
    requestId,
    signalType,
    payload,
  });
  return await promise;
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

function localDescriptionPayload(pc: RTCPeerConnection): { type: string; sdp: string } {
  const desc = pc.localDescription;
  if (!desc?.type || !desc.sdp) throw new Error("local WebRTC offer is missing");
  return {
    type: desc.type,
    sdp: desc.sdp,
  };
}

function extractAnswerDescription(result: GatewaySignalResult): RTCSessionDescriptionInit {
  const root = (result.result || {}) as Record<string, unknown>;
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
  const root = (result.result || {}) as Record<string, unknown>;
  const payload = (root.payload || root.result || root) as Record<string, unknown>;
  const sources = normalizeSourceIds(payload?.sources);
  return sources.length > 0 ? sources : fallback;
}

function refreshSummary(context: LaunchContext): void {
  const display = context.display || {};
  subtitleEl.textContent = display.serviceLabel
    ? `Gateway-managed live preview for ${display.serviceLabel}.`
    : "Gateway-managed live preview for your Security Cameras service.";
  summaryGatewayEl.textContent = pkLabel(context.gatewayPk);
  summaryServiceEl.textContent = pkLabel(context.servicePk);
  summaryCamerasEl.textContent = String(display.cameraCount || display.configuredSources || normalizeSourceIds(display.sources).length || 0);
  backLinkEl.href = shellBaseUrl();
}

async function loadLaunchContext(): Promise<LaunchContext> {
  const launchId = parseLaunchId();
  if (!launchId) throw new Error("launch id is missing from the URL");

  const stored = readStoredLaunchContext(launchId);
  if (stored) return stored;

  appendLog(`launch context ${launchId} not found locally; asking shell`);
  const fromShell = await requestLaunchContextFromShell(launchId);
  if (fromShell) return fromShell;
  throw new Error("launch context is unavailable; reopen this app from Constitute");
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
  const requestedSources = normalizeSourceIds(display.sources);
  if (requestedSources.length === 0) {
    setGridEmpty("No Cameras", "The managed NVR service has not reported any enabled sources yet.");
    setBadge("no cameras", "warn");
    setSummaryState("no cameras");
    gridHintEl.textContent = "No enabled camera sources were advertised by the NVR service.";
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

  const rtcConfig: RTCConfiguration = {
    iceServers: buildRtcIceServers(display.iceServers),
    bundlePolicy: "max-bundle",
  };

  peerConnection?.close();
  peerConnection = new RTCPeerConnection(rtcConfig);
  transceiverSourceIds = [...requestedSources];

  for (const sourceId of requestedSources) {
    peerConnection.addTransceiver("video", { direction: "recvonly" });
    setTileState(sourceId, "connecting", "Waiting for answer from the gateway.");
  }

  peerConnection.addEventListener("track", (event) => {
    const sourceId = sourceIdForTrack(event);
    const stream = event.streams[0] || new MediaStream([event.track]);
    attachTrackToTile(sourceId || event.track.id, stream);
    setBadge("live", "good");
    setSummaryState("live");
    gridHintEl.textContent = "Receiving live H.264 preview.";
  });

  peerConnection.addEventListener("connectionstatechange", () => {
    const state = peerConnection?.connectionState || "unknown";
    appendLog(`peer connection state -> ${state}`);
    if (state === "failed" || state === "disconnected") {
      setBadge(state, "bad");
      setSummaryState(state);
      markAllTiles("unavailable", "Peer connection dropped.");
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
    } else if (state === "failed") {
      setBadge("failed", "bad");
      setSummaryState("failed");
      markAllTiles("unavailable", "ICE connectivity failed.");
    }
  });

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  await waitForIceGatheringComplete(peerConnection);

  appendLog(`sending offer for ${requestedSources.length} source(s)`);
  const result = await requestGatewaySignal("offer", {
    description: localDescriptionPayload(peerConnection),
    sourceIds: requestedSources,
  });

  const grantedSources = extractGrantedSources(result, requestedSources);
  for (const sourceId of requestedSources) {
    if (!grantedSources.includes(sourceId)) {
      setTileState(sourceId, "unavailable", "Source was not granted by the NVR service.");
    }
  }

  const answer = extractAnswerDescription(result);
  await peerConnection.setRemoteDescription(answer);
  appendLog("remote answer applied");
  setBadge("connecting", "warn");
  setSummaryState("connecting");
}

async function reconnect(): Promise<void> {
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
  fireAndForgetSessionClose();
  closePeerConnection();
});

async function bootstrap(): Promise<void> {
  setBadge("loading", "neutral");
  setSummaryState("loading");
  appendLog("bootstrapping managed NVR app surface");

  launchContext = await loadLaunchContext();
  appendLog(`launch context loaded for service ${pkLabel(launchContext.servicePk)}`);
  refreshSummary(launchContext);
  await reconnect();
}

void bootstrap().catch((error) => {
  console.error(error);
  closePeerConnection();
  setBadge("error", "bad");
  setSummaryState("error");
  const message = String((error as Error)?.message || error || "Unknown error");
  subtitleEl.textContent = "Managed launch failed.";
  gridHintEl.textContent = message;
  setGridEmpty("Launch Failed", message);
  appendLog(`fatal: ${message}`);
});
