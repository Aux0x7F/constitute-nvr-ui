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
        <button id="discoverOnvif" disabled>discover_onvif</button>
      </div>

      <label>Source ID</label>
      <input id="sourceId" placeholder="cam-reolink-e1" />

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
const limitInput = byId<HTMLInputElement>("limit");
const segmentNameInput = byId<HTMLInputElement>("segmentName");
const statusText = byId<HTMLParagraphElement>("status");
const logEl = byId<HTMLPreElement>("log");
const downloadsEl = byId<HTMLUListElement>("downloads");
const cameraSummaryEl = byId<HTMLParagraphElement>("cameraSummary");
const cameraGridEl = byId<HTMLDivElement>("cameraGrid");

const connectBtn = byId<HTMLButtonElement>("connect");
const disconnectBtn = byId<HTMLButtonElement>("disconnect");
const listSourcesBtn = byId<HTMLButtonElement>("listSources");
const discoverOnvifBtn = byId<HTMLButtonElement>("discoverOnvif");
const listSegmentsBtn = byId<HTMLButtonElement>("listSegments");
const getSegmentBtn = byId<HTMLButtonElement>("getSegment");

let session: SessionState | null = null;
let pendingSegment: SegmentAccumulator | null = null;
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

discoverOnvifBtn.addEventListener("click", async () => {
  await sendCommand({ cmd: "discover_onvif" });
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

  if (cmd === "discover_onvif") {
    applyOnvifDiscovery(body);
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

  if (!url || !identityId || !devicePk || !identitySecretHex) {
    throw new Error("url, identityId, devicePk, and identitySecret are required");
  }

  return {
    url,
    identityId,
    devicePk,
    identitySecretHex,
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
  discoverOnvifBtn.disabled = !enabled;
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

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id) as T | null;
  if (!element) {
    throw new Error(`missing element: ${id}`);
  }
  return element;
}
