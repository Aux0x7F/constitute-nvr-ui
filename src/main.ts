import "./styles.css";
import {
  base64ToBytes,
  createHandshake,
  decryptEnvelope,
  deriveSessionKey,
  encryptCommand,
  parseHelloAck,
} from "./protocol";
import type { CipherEnvelope, ClientCommand, ConnectionConfig } from "./types";

type SessionState = {
  ws: WebSocket;
  sessionKey: Uint8Array;
  sessionId: string;
};

type SegmentAccumulator = {
  name: string;
  chunks: Uint8Array[];
};

type CameraTile = {
  id: string;
  title: string;
  subtitle: string;
  status: "configured" | "discovered";
};

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("#app not found");
}

app.innerHTML = `
  <main class="layout">
    <section class="panel">
      <h1>Constitute NVR UI (MVP)</h1>
      <p class="muted">Identity-bound test client for constitute-nvr websocket session channel.</p>

      <label>Gateway/NVR WS URL</label>
      <input id="url" value="ws://127.0.0.1:8456/session" />

      <label>Identity ID</label>
      <input id="identityId" placeholder="identity id" />

      <label>Device PK</label>
      <input id="devicePk" placeholder="device public key" />

      <label>Identity Secret (hex)</label>
      <input id="identitySecret" placeholder="64-byte hex" />

      <div class="row">
        <button id="connect">Connect</button>
        <button id="disconnect" disabled>Disconnect</button>
      </div>

      <p id="status" class="status">Disconnected</p>
    </section>

    <section class="panel">
      <h2>Security Cameras</h2>
      <p id="cameraSummary" class="muted">No Cameras</p>
      <div id="cameraGrid" class="cameraGrid">
        <article class="cameraEmpty">No Cameras</article>
      </div>

      <h3>Commands</h3>
      <div class="row wrap">
        <button id="listSources" disabled>list_sources</button>
        <button id="listSourceStates" disabled>list_source_states</button>
        <button id="discoverOnvif" disabled>discover_onvif</button>
        <button id="discoverReolink" disabled>discover_reolink</button>
      </div>

      <label>Source ID</label>
      <input id="sourceId" placeholder="cam-reolink-e1" />

      <label>Probe / Setup IP</label>
      <input id="cameraIp" placeholder="192.168.1.188" />

      <div class="row wrap">
        <button id="probeReolink" disabled>probe_reolink</button>
        <button id="readReolinkState" disabled>read_reolink_state</button>
        <button id="setupReolink" disabled>setup_reolink</button>
      </div>

      <label>Camera Username</label>
      <input id="cameraUser" value="admin" />

      <label>Camera Password</label>
      <input id="cameraPass" type="password" placeholder="camera password" />

      <label>Desired Password (optional)</label>
      <input id="cameraDesiredPass" type="password" placeholder="new password" />

      <label>Limit</label>
      <input id="limit" value="30" />

      <div class="row wrap">
        <button id="listSegments" disabled>list_segments</button>
      </div>

      <label>Segment Name</label>
      <input id="segmentName" placeholder="20260227T120100.cnv" />

      <div class="row wrap">
        <button id="getSegment" disabled>get_segment</button>
      </div>

      <h3>Preview</h3>
      <video id="segmentPreview" controls muted playsinline></video>

      <h3>Downloads</h3>
      <ul id="downloads" class="downloads"></ul>
    </section>

    <section class="panel logs">
      <h2>Session Log</h2>
      <pre id="log"></pre>
    </section>
  </main>
`;

const urlInput = byId<HTMLInputElement>("url");
const identityIdInput = byId<HTMLInputElement>("identityId");
const devicePkInput = byId<HTMLInputElement>("devicePk");
const identitySecretInput = byId<HTMLInputElement>("identitySecret");
const sourceIdInput = byId<HTMLInputElement>("sourceId");
const cameraIpInput = byId<HTMLInputElement>("cameraIp");
const cameraUserInput = byId<HTMLInputElement>("cameraUser");
const cameraPassInput = byId<HTMLInputElement>("cameraPass");
const cameraDesiredPassInput = byId<HTMLInputElement>("cameraDesiredPass");
const limitInput = byId<HTMLInputElement>("limit");
const segmentNameInput = byId<HTMLInputElement>("segmentName");
const statusText = byId<HTMLParagraphElement>("status");
const logEl = byId<HTMLPreElement>("log");
const downloadsEl = byId<HTMLUListElement>("downloads");
const cameraSummaryEl = byId<HTMLParagraphElement>("cameraSummary");
const cameraGridEl = byId<HTMLDivElement>("cameraGrid");
const segmentPreview = byId<HTMLVideoElement>("segmentPreview");

const connectBtn = byId<HTMLButtonElement>("connect");
const disconnectBtn = byId<HTMLButtonElement>("disconnect");
const listSourcesBtn = byId<HTMLButtonElement>("listSources");
const listSourceStatesBtn = byId<HTMLButtonElement>("listSourceStates");
const discoverOnvifBtn = byId<HTMLButtonElement>("discoverOnvif");
const discoverReolinkBtn = byId<HTMLButtonElement>("discoverReolink");
const probeReolinkBtn = byId<HTMLButtonElement>("probeReolink");
const readReolinkStateBtn = byId<HTMLButtonElement>("readReolinkState");
const setupReolinkBtn = byId<HTMLButtonElement>("setupReolink");
const listSegmentsBtn = byId<HTMLButtonElement>("listSegments");
const getSegmentBtn = byId<HTMLButtonElement>("getSegment");

let session: SessionState | null = null;
let pendingSegment: SegmentAccumulator | null = null;
let lastSegmentObjectUrl: string | null = null;
const cameraTiles = new Map<string, CameraTile>();

connectBtn.addEventListener("click", async () => {
  try {
    await connect();
  } catch (error) {
    appendLog(`connect error: ${(error as Error).message}`);
    setStatus("Connection failed", true);
  }
});

disconnectBtn.addEventListener("click", () => {
  closeSession();
});

listSourcesBtn.addEventListener("click", async () => {
  await sendCommand({ cmd: "list_sources" });
});

listSourceStatesBtn.addEventListener("click", async () => {
  await sendCommand({ cmd: "list_source_states" });
});

discoverOnvifBtn.addEventListener("click", async () => {
  await sendCommand({ cmd: "discover_onvif" });
});

discoverReolinkBtn.addEventListener("click", async () => {
  await sendCommand({ cmd: "discover_reolink" });
});

probeReolinkBtn.addEventListener("click", async () => {
  const ip = cameraIpInput.value.trim();
  if (!ip) {
    appendLog("probe_reolink requires camera IP");
    return;
  }
  await sendCommand({ cmd: "probe_reolink", ip });
});

readReolinkStateBtn.addEventListener("click", async () => {
  const req = buildReolinkConnectRequest();
  if (!req) return;
  await sendCommand({ cmd: "read_reolink_state", request: req });
});

setupReolinkBtn.addEventListener("click", async () => {
  const ip = cameraIpInput.value.trim();
  const username = cameraUserInput.value.trim() || "admin";
  const password = cameraPassInput.value;
  if (!ip || !password) {
    appendLog("setup_reolink requires camera IP and current password");
    return;
  }
  await sendCommand({
    cmd: "setup_reolink",
    request: {
      ip,
      username,
      password,
      desiredPassword: cameraDesiredPassInput.value,
      generatePassword: false,
    },
  });
});

listSegmentsBtn.addEventListener("click", async () => {
  await sendCommand({
    cmd: "list_segments",
    sourceId: sourceIdInput.value.trim(),
    limit: Number.parseInt(limitInput.value.trim(), 10) || 30,
  });
});

getSegmentBtn.addEventListener("click", async () => {
  await sendCommand({
    cmd: "get_segment",
    sourceId: sourceIdInput.value.trim(),
    name: segmentNameInput.value.trim(),
  });
});

async function connect(): Promise<void> {
  closeSession();
  setStatus("Connecting...");

  const config = readConfig();
  const handshake = createHandshake(config);

  const ws = new WebSocket(config.url);

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("websocket open timeout"));
    }, 8_000);

    ws.onopen = () => {
      clearTimeout(timeout);
      ws.send(JSON.stringify(handshake.hello));
      appendLog(`hello sent for device ${config.devicePk}`);
    };

    ws.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("websocket failed to open"));
    };

    ws.onmessage = (event) => {
      try {
        const ack = parseHelloAck(String(event.data));
        const key = deriveSessionKey(
          ack.serverKey,
          ack.sessionId,
          config,
          handshake.privateKey,
        );

        session = {
          ws,
          sessionKey: key,
          sessionId: ack.sessionId,
        };

        ws.onmessage = (innerEvent) => onCipherFrame(String(innerEvent.data));
        ws.onclose = () => {
          appendLog("session closed");
          setStatus("Disconnected", true);
          setCommandEnabled(false);
        };

        setStatus(`Connected: ${ack.sessionId}`);
        setCommandEnabled(true);
        disconnectBtn.disabled = false;
        connectBtn.disabled = true;
        appendLog("session handshake complete");
        void sendCommand({ cmd: "list_sources" });
        void sendCommand({ cmd: "list_source_states" });
        resolve();
      } catch (err) {
        reject(new Error(`handshake failed: ${(err as Error).message}`));
      }
    };
  });
}

function onCipherFrame(raw: string): void {
  if (!session) {
    return;
  }

  let parsed: CipherEnvelope;
  try {
    parsed = JSON.parse(raw) as CipherEnvelope;
  } catch {
    appendLog(`non-json frame: ${raw}`);
    return;
  }

  if (parsed.type !== "cipher") {
    appendLog(`plaintext frame: ${raw}`);
    return;
  }

  try {
    const body = decryptEnvelope(session.sessionKey, parsed) as Record<string, unknown>;
    appendLog(JSON.stringify(body, null, 2));
    handlePayload(body);
  } catch (err) {
    appendLog(`decrypt error: ${(err as Error).message}`);
  }
}

function handlePayload(body: Record<string, unknown>): void {
  const cmd = String(body.cmd ?? "");

  if (cmd === "list_sources") {
    applySources(body);
    return;
  }

  if (cmd === "list_source_states") {
    applySourceStates(body);
    return;
  }

  if (cmd === "discover_onvif") {
    applyOnvifDiscovery(body);
    return;
  }

  if (cmd === "discover_reolink") {
    applyReolinkDiscovery(body);
    return;
  }

  if (cmd === "probe_reolink") {
    appendLog(`probe result: ${JSON.stringify(body.result ?? {}, null, 2)}`);
    return;
  }

  if (cmd === "read_reolink_state") {
    appendLog(`read state: ${JSON.stringify(body.result ?? {}, null, 2)}`);
    return;
  }

  if (cmd === "setup_reolink") {
    appendLog(`setup result: ${JSON.stringify(body.result ?? {}, null, 2)}`);
    return;
  }

  if (cmd === "segment_start") {
    pendingSegment = {
      name: String(body.name ?? "segment.bin"),
      chunks: [],
    };
    return;
  }

  if (cmd === "segment_chunk" && pendingSegment) {
    const dataB64 = String(body.data ?? "");
    pendingSegment.chunks.push(base64ToBytes(dataB64));
    return;
  }

  if (cmd === "segment_end" && pendingSegment) {
    const joined = concatBytes(pendingSegment.chunks);
    const url = URL.createObjectURL(new Blob([joined], { type: "video/mp4" }));
    addDownloadLink(pendingSegment.name, url, joined.length);
    if (lastSegmentObjectUrl) {
      URL.revokeObjectURL(lastSegmentObjectUrl);
    }
    lastSegmentObjectUrl = url;
    segmentPreview.src = url;
    pendingSegment = null;
  }
}

function applySources(body: Record<string, unknown>): void {
  const raw = Array.isArray(body.sources) ? body.sources : [];
  const sources = raw
    .map((value) => String(value ?? "").trim())
    .filter((value) => value.length > 0);

  for (const sourceId of sources) {
    cameraTiles.set(sourceId, {
      id: sourceId,
      title: sourceId,
      subtitle: "Configured source",
      status: "configured",
    });
  }

  if (!sourceIdInput.value.trim() && sources.length > 0) {
    sourceIdInput.value = sources[0];
  }

  renderCameraTiles();
}

function applySourceStates(body: Record<string, unknown>): void {
  const raw = Array.isArray(body.states) ? body.states : [];
  raw.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const rec = entry as Record<string, unknown>;
    const id = String(rec.sourceId ?? "").trim();
    if (!id) return;
    const sourceState = String(rec.state ?? "unknown").trim() || "unknown";
    const subtitle = `State: ${sourceState}`;
    if (!cameraTiles.has(id)) {
      cameraTiles.set(id, {
        id,
        title: id,
        subtitle,
        status: "configured",
      });
      return;
    }
    const existing = cameraTiles.get(id)!;
    cameraTiles.set(id, {
      ...existing,
      subtitle,
    });
  });

  renderCameraTiles();
}

function applyOnvifDiscovery(body: Record<string, unknown>): void {
  const raw = Array.isArray(body.cameras) ? body.cameras : [];

  raw.forEach((camera, index) => {
    if (!camera || typeof camera !== "object") {
      return;
    }

    const rec = camera as Record<string, unknown>;
    const host = String(
      rec.host ?? rec.ip ?? rec.address ?? rec.hostname ?? "",
    ).trim();
    const name = String(rec.name ?? rec.model ?? rec.manufacturer ?? "").trim();
    const fallbackId = host || `camera-${index + 1}`;
    const id = String(
      rec.sourceId ?? rec.source_id ?? rec.id ?? rec.devicePk ?? fallbackId,
    ).trim();

    if (!id) {
      return;
    }

    const title = name || id;
    const subtitle = host ? `ONVIF ${host}` : "ONVIF discovered";

    if (!cameraTiles.has(id)) {
      cameraTiles.set(id, {
        id,
        title,
        subtitle,
        status: "discovered",
      });
      return;
    }

    const existing = cameraTiles.get(id)!;
    cameraTiles.set(id, {
      ...existing,
      title: existing.title || title,
      subtitle: existing.subtitle || subtitle,
    });
  });

  renderCameraTiles();
}


function applyReolinkDiscovery(body: Record<string, unknown>): void {
  const raw = Array.isArray(body.devices) ? body.devices : [];
  raw.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    const rec = entry as Record<string, unknown>;
    const ip = String(rec.ip ?? "").trim();
    const model = String(rec.model ?? "").trim();
    const uid = String(rec.uid ?? "").trim();
    const id = uid || ip || `reolink-${index + 1}`;
    const title = model || id;
    const subtitle = ip ? `Reolink ${ip}` : "Reolink discovered";
    cameraTiles.set(id, {
      id,
      title,
      subtitle,
      status: "discovered",
    });
    if (ip && !cameraIpInput.value.trim()) cameraIpInput.value = ip;
  });
  renderCameraTiles();
}

function buildReolinkConnectRequest():
  | { ip: string; username: string; channel: number; password: string }
  | null {
  const ip = cameraIpInput.value.trim();
  const username = cameraUserInput.value.trim() || "admin";
  const password = cameraPassInput.value;
  if (!ip || !password) {
    appendLog("read_reolink_state requires camera IP and password");
    return null;
  }
  return {
    ip,
    username,
    channel: 0,
    password,
  };
}

function renderCameraTiles(): void {
  cameraGridEl.innerHTML = "";

  if (cameraTiles.size === 0) {
    cameraSummaryEl.textContent = "No Cameras";
    const empty = document.createElement("article");
    empty.className = "cameraEmpty";
    empty.textContent = "No Cameras";
    cameraGridEl.appendChild(empty);
    return;
  }

  const tiles = Array.from(cameraTiles.values()).sort((a, b) =>
    a.title.localeCompare(b.title),
  );

  cameraSummaryEl.textContent = `${tiles.length} camera${tiles.length === 1 ? "" : "s"}`;

  for (const tile of tiles) {
    const article = document.createElement("article");
    article.className = "cameraTile";

    const top = document.createElement("div");
    top.className = "cameraTop";

    const title = document.createElement("strong");
    title.textContent = tile.title;

    const badge = document.createElement("span");
    badge.className = `cameraBadge ${tile.status}`;
    badge.textContent = tile.status;

    top.appendChild(title);
    top.appendChild(badge);

    const subtitle = document.createElement("div");
    subtitle.className = "cameraSub";
    subtitle.textContent = tile.subtitle;

    article.appendChild(top);
    article.appendChild(subtitle);
    cameraGridEl.appendChild(article);
  }
}

async function sendCommand(command: ClientCommand): Promise<void> {
  if (!session) {
    appendLog("not connected");
    return;
  }

  const frame = encryptCommand(session.sessionKey, command);
  session.ws.send(JSON.stringify(frame));
  appendLog(`sent ${command.cmd}`);
}

function readConfig(): ConnectionConfig {
  const url = urlInput.value.trim();
  const identityId = identityIdInput.value.trim();
  const devicePk = devicePkInput.value.trim();
  const identitySecretHex = identitySecretInput.value.trim();
  const allowUnsignedHelloMvp = String(identitySecretInput.dataset.allowUnsignedMvp || "").trim() === "1";

  if (!url || !identityId || !devicePk) {
    throw new Error("url, identityId, and devicePk are required");
  }

  if (!identitySecretHex && !allowUnsignedHelloMvp) {
    throw new Error("identitySecret is required unless unsigned MVP mode is enabled");
  }

  return {
    url,
    identityId,
    devicePk,
    identitySecretHex,
    allowUnsignedHelloMvp,
  };
}

function closeSession(): void {
  if (session) {
    session.ws.close();
    session = null;
  }
  setCommandEnabled(false);
  disconnectBtn.disabled = true;
  connectBtn.disabled = false;
  setStatus("Disconnected", true);
}

function setCommandEnabled(enabled: boolean): void {
  listSourcesBtn.disabled = !enabled;
  listSourceStatesBtn.disabled = !enabled;
  discoverOnvifBtn.disabled = !enabled;
  discoverReolinkBtn.disabled = !enabled;
  probeReolinkBtn.disabled = !enabled;
  readReolinkStateBtn.disabled = !enabled;
  setupReolinkBtn.disabled = !enabled;
  listSegmentsBtn.disabled = !enabled;
  getSegmentBtn.disabled = !enabled;
}

function setStatus(message: string, warn = false): void {
  statusText.textContent = message;
  statusText.classList.toggle("warn", warn);
}

function appendLog(line: string): void {
  const ts = new Date().toISOString();
  logEl.textContent += `[${ts}] ${line}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

function addDownloadLink(name: string, href: string, size: number): void {
  const li = document.createElement("li");
  const a = document.createElement("a");
  a.href = href;
  a.download = name.replace(/\.cnv$/i, ".mp4");
  a.textContent = `${a.download} (${(size / 1024).toFixed(1)} KiB)`;
  li.appendChild(a);
  downloadsEl.prepend(li);
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function applyLaunchParams(): void {
  const params = new URLSearchParams(window.location.search);
  const ws = String(params.get("ws") || "").trim();
  const identityId = String(params.get("identityId") || "").trim();
  const devicePk = String(params.get("devicePk") || "").trim();
  const identitySecret = String(params.get("identitySecret") || "").trim();
  const autoConnect = String(params.get("autoconnect") || "").trim() === "1";
  const insecure = String(params.get("insecure") || "").trim() === "1";

  if (ws) urlInput.value = ws;
  if (identityId && !identityIdInput.value.trim()) identityIdInput.value = identityId;
  if (devicePk && !devicePkInput.value.trim()) devicePkInput.value = devicePk;
  if (identitySecret && !identitySecretInput.value.trim()) identitySecretInput.value = identitySecret;
  if (insecure) {
    identitySecretInput.dataset.allowUnsignedMvp = "1";
    if (!identitySecretInput.value.trim()) {
      identitySecretInput.placeholder = "optional in unsigned MVP mode";
    }
  }

  if (autoConnect) {
    setTimeout(() => {
      if (!session) {
        void connect().catch((error) => {
          appendLog(`autoconnect failed: ${(error as Error).message}`);
        });
      }
    }, 200);
  }
}

applyLaunchParams();

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id) as T | null;
  if (!element) {
    throw new Error(`missing element: ${id}`);
  }
  return element;
}



