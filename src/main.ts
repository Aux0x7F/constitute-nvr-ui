import "./styles.css";
import { renderShell } from "./shell";

type IceServerHints = {
  stun?: string[];
  turn?: string[];
};

type LaunchCameraDisplay = {
  sourceId?: string;
  name?: string;
  viewGranted?: boolean;
  controlGranted?: boolean;
  ptzCapable?: boolean;
};

type GrantedScope = {
  owner?: boolean;
  viewSources?: string[];
  controlSources?: string[];
  grantIds?: string[];
};

type LaunchDisplay = {
  serviceLabel?: string;
  serviceVersion?: string;
  service?: string;
  status?: string;
  cameraCount?: number;
  configuredSources?: number;
  sources?: string[];
  cameras?: LaunchCameraDisplay[];
  iceServers?: IceServerHints;
  grantedScope?: GrantedScope;
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

type GatewayGrantResult = {
  requestId: string;
  ok: boolean;
  result?: unknown;
  error?: string;
};

type GatewayLaunchResult = {
  requestId: string;
  gatewayPk: string;
  servicePk: string;
  service: string;
  capability: string;
  launchToken: string;
  display?: LaunchDisplay;
  expiresAt: number;
  ts: number;
};

type GatewayGrantRecord = {
  grantId?: string;
  granteeIdentityId?: string;
  viewSources?: string[];
  controlSources?: string[];
};

type CameraGrantView = {
  sourceId?: string;
  name?: string;
  ptzCapable?: boolean;
};

type GrantInventory = {
  grants: GatewayGrantRecord[];
  availableCameras: CameraGrantView[];
};

type CameraCapabilitySet = {
  liveView?: boolean;
  ptz?: boolean;
  timeSync?: boolean;
  manualTime?: boolean;
  timezone?: boolean;
  overlayText?: boolean;
  overlayTimestamp?: boolean;
  passwordRotate?: boolean;
  hardeningProfile?: boolean;
  rawProbe?: boolean;
};

type CameraPoseView = {
  pan?: number;
  tilt?: number;
  zoom?: number;
};

type MountedCameraRecord = {
  sourceId?: string;
  driverId?: string;
  displayName?: string;
  vendor?: string;
  model?: string;
  ip?: string;
  macAddress?: string;
  enabled?: boolean;
  rtspUrl?: string;
  capabilities?: CameraCapabilitySet;
  credentialSafety?: {
    status?: string;
    pending?: boolean;
    historyDepth?: number;
    lastError?: string;
  };
  desired?: Partial<CameraSettingsDraft> & {
    hardening?: {
      enableOnvif?: boolean;
      enableRtsp?: boolean;
      disableP2p?: boolean;
      disableHttp?: boolean;
      disableHttps?: boolean;
      preserveProprietary9000?: boolean;
    };
  };
  observed?: {
    displayName?: string;
    driverId?: string;
    vendor?: string;
    model?: string;
    timeMode?: string;
    ntpServer?: string;
    manualTime?: string;
    timezone?: string;
    overlayText?: string;
    overlayTimestamp?: boolean;
    ptzCapable?: boolean;
    currentPose?: CameraPoseView;
    poseStatus?: string;
    poseSource?: string;
    services?: unknown;
  };
  currentPose?: CameraPoseView;
  desiredPose?: CameraPoseView;
  poseStatus?: string;
  verification?: {
    status?: string;
    message?: string;
    verified?: boolean;
    driftFields?: string[];
    failedFields?: string[];
    unsupportedFields?: string[];
  };
};

type DiscoveryCandidateRecord = {
  candidateId?: string;
  ip?: string;
  mac?: string;
  leaseHostname?: string;
  discoveredVia?: string[];
  driverMatch?: {
    driverId?: string;
    kind?: string;
    confidence?: number;
    reason?: string;
    mountable?: boolean;
  };
  signatures?: {
    vendor?: string;
    model?: string;
    publicTitle?: string;
  };
  transports?: {
    http?: boolean;
    https?: boolean;
    rtsp?: boolean;
    onvif?: boolean;
    proprietary9000?: boolean;
  };
};

type CameraNetworkSummaryRecord = {
  managed?: boolean;
  interface?: string;
  subnetCidr?: string;
  hostIp?: string;
  dhcpEnabled?: boolean;
  dhcpRangeStart?: string;
  dhcpRangeEnd?: string;
  ntpEnabled?: boolean;
  ntpServer?: string;
  dnsServer?: string;
  leaseFile?: string;
};

type CameraInventoryRecord = {
  mounted: MountedCameraRecord[];
  candidates: DiscoveryCandidateRecord[];
  cameraNetwork?: CameraNetworkSummaryRecord;
};

type CandidateMountDraft = {
  displayName: string;
  username: string;
  password: string;
  desiredPassword: string;
  generatePassword: boolean;
  rtspUrl: string;
};

type ProbeResultRecord = {
  tone: NotificationTone;
  summary: string;
  detail: string;
  payload: unknown;
  ts: number;
};

type NotificationTone = "neutral" | "warn" | "good" | "bad";
type NvrActivity = "live" | "history" | "settings";
type NvrSettingsTab = "nvr" | "cameras";

type NotificationAction = {
  activity?: NvrActivity;
  settingsTab?: NvrSettingsTab;
  cameraId?: string;
};

type NotificationEntry = {
  id: string;
  tone: NotificationTone;
  title: string;
  body: string;
  scope: string;
  ts: number;
  read: boolean;
  action?: NotificationAction;
};

type CameraTile = {
  id: string;
  card: HTMLDivElement;
  video: HTMLVideoElement;
  title: HTMLDivElement;
  gearButton: HTMLButtonElement;
  ptzButton: HTMLButtonElement;
  videoWrap: HTMLDivElement;
  statusDot: HTMLSpanElement;
  overlayTop: HTMLDivElement;
  overlayBottom: HTMLDivElement;
  ptzZones: HTMLDivElement;
  overlayHideTimer: number;
};

type RuntimeSnapshot = {
  projections?: Record<string, Record<string, unknown>>;
};

type CameraSettingsDraft = {
  displayName: string;
  timeMode: "ntp" | "manual";
  ntpServer: string;
  manualTime: string;
  timezone: string;
  overlayText: string;
  overlayTimestamp: boolean;
  desiredPassword: string;
  generatePassword: boolean;
  enableOnvif: boolean;
  enableRtsp: boolean;
  disableP2p: boolean;
  disableHttp: boolean;
  disableHttps: boolean;
  preserveProprietary9000: boolean;
};

const APP_CHANNEL_NAME = "constitute.app.launch";
const LAUNCH_STORAGE_PREFIX = "constitute.launch.";
const DIAGNOSTICS_STORAGE_KEY = "constitute.nvr.diagnostics";
const LAUNCH_REQUEST_TIMEOUT_MS = 6_000;
const LAUNCH_REFRESH_TIMEOUT_MS = 20_000;
const SIGNAL_REQUEST_TIMEOUT_MS = 30_000;
const GRANT_REQUEST_TIMEOUT_MS = 30_000;
const RUNTIME_WORKER_BUILD_ID = "2026-04-03-runtime-v1";
const LAUNCH_REFRESH_SKEW_MS = 15_000;
const PTZ_STEP_DEGREES = 10;
const PTZ_STEP_NORMALIZED = PTZ_STEP_DEGREES / 180;
// Temporary kill-switch: hide PTZ UI until the Reolink path stops failing with
// native absolute `405`/no-move plus CGI session exhaustion (`rspCode -5: max session`).
const PTZ_UI_ENABLED = false;

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("#app not found");
}

const shell = renderShell(app);
const subtitleEl = shell.subtitleEl;
const btnBellEl = shell.btnBellEl;
const notifMenuEl = shell.notifMenuEl;
const btnNotifClearEl = shell.btnNotifClearEl;
const notifListEl = shell.notifListEl;
const closeAppButtonEl = shell.closeAppButtonEl;
const btnMenuEl = shell.btnMenuEl;
const drawerEl = shell.drawerEl;
const drawerBackdropEl = shell.drawerBackdropEl;
const btnDrawerCloseEl = shell.btnDrawerCloseEl;
const navButtons = shell.navButtons;
const identityHandleEl = shell.identityHandleEl;
const connWrapEl = shell.connWrapEl;
const connStateTextEl = shell.connStateTextEl;
const connPopoverEl = shell.connPopoverEl;
const popConnectionEl = shell.popConnectionEl;
const popRelayEl = shell.popRelayEl;
const popGatewayEl = shell.popGatewayEl;
const popServicesEl = shell.popServicesEl;
const popConnectionReasonEl = shell.popConnectionReasonEl;
const liveViewEl = shell.liveViewEl;
const historyViewEl = shell.historyViewEl;
const settingsViewEl = shell.settingsViewEl;
const bootSplashEl = document.getElementById("bootSplash");
const bootSplashTitleEl = document.getElementById("bootSplashTitle");
const bootSplashStatusEl = document.getElementById("bootSplashStatus");
const summaryPanelEl = shell.summaryPanelEl;
const summaryGatewayEl = shell.summaryGatewayEl;
const summaryServiceEl = shell.summaryServiceEl;
const summaryCamerasEl = shell.summaryCamerasEl;
const summaryStateEl = shell.summaryStateEl;
const gridHintEl = shell.gridHintEl;
const cameraGridEl = shell.cameraGridEl;
const btnReconnect = shell.btnReconnect;
const historyHintEl = shell.historyHintEl;
const settingsTabButtons = shell.settingsTabButtons;
const nvrSettingsPanelEl = shell.nvrSettingsPanelEl;
const camerasPanelEl = shell.camerasPanelEl;
const cameraListEl = shell.cameraListEl;
const addCameraButtonEl = shell.addCameraButtonEl;
const logPanelEl = shell.logPanelEl;
const logEl = shell.logEl;
const nvrSettingsSummaryEl = document.getElementById("nvrSettingsSummary") as HTMLDivElement | null;

const pendingLaunchResponses = new Map<string, PendingRequest<LaunchContext | null>>();
const pendingSignalResponses = new Map<string, PendingRequest<GatewaySignalResult>>();
const pendingGrantResponses = new Map<string, PendingRequest<GatewayGrantResult>>();
const pendingGatewayLaunchResponses = new Map<string, PendingRequest<GatewayLaunchResult>>();
const cameraTiles = new Map<string, CameraTile>();
const launchCameraInfoBySourceId = new Map<string, LaunchCameraDisplay>();
const notifications: NotificationEntry[] = [];

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
let grantInventory: GrantInventory | null = null;
let currentActivity: NvrActivity = "live";
let currentSettingsTab: NvrSettingsTab = "nvr";
let selectedCameraId = "";
let ptzActiveSourceId = "";
let selectedLiveCameraId = "";
let runtimeSnapshot: RuntimeSnapshot | null = null;
const resolvedResourceNames = new Map<string, string>();
const cameraSettingsDrafts = new Map<string, CameraSettingsDraft>();
const candidateMountDrafts = new Map<string, CandidateMountDraft>();
const cameraProbeResults = new Map<string, ProbeResultRecord>();
const cameraNameOverrides = new Map<string, string>();
const currentPoseBySourceId = new Map<string, CameraPoseView>();
const desiredPoseBySourceId = new Map<string, CameraPoseView>();
const poseStatusBySourceId = new Map<string, string>();
const knownCandidateIds = new Set<string>();
let cameraInventory: CameraInventoryRecord | null = null;
let cameraInventoryLoading = false;
let cameraInventoryError = "";
let expandedCandidateId = "";
let notificationMenuOpen = false;
let identityHandleCopied = false;
let launchRefreshPromise: Promise<LaunchContext> | null = null;

function ptzUiCapable(camera: LaunchCameraDisplay | null | undefined): boolean {
  return PTZ_UI_ENABLED && camera?.ptzCapable === true;
}

function ptzUiInteractive(camera: LaunchCameraDisplay | null | undefined): boolean {
  return PTZ_UI_ENABLED && camera?.ptzCapable === true && camera?.controlGranted === true;
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

function addNotification(
  tone: NotificationTone,
  title: string,
  body: string,
  scope = "app",
  action?: NotificationAction,
): void {
  notifications.unshift({
    id: randomOpaqueId("notif"),
    tone,
    title,
    body,
    scope,
    ts: Date.now(),
    read: false,
    action,
  });
  while (notifications.length > 20) notifications.pop();
  renderNotifications();
}

function renderNotifications(): void {
  notifListEl.innerHTML = "";
  btnBellEl.classList.toggle("has-unread", notifications.some((entry) => !entry.read));
  if (notifications.length === 0) {
    notifListEl.innerHTML = `<div class="notificationItem"><div class="notificationTitle">No notifications</div><div class="notificationBody">Actionable camera and NVR updates will appear here.</div></div>`;
    return;
  }
  for (const entry of notifications.slice(0, 12)) {
    const item = document.createElement("article");
    item.className = `notificationItem ${entry.tone}`;
    item.innerHTML = `
      <div class="notificationTitle">${escapeHtml(entry.title)}</div>
      <div class="notificationBody">${escapeHtml(entry.body)}</div>
      <div class="notificationMeta">
        <span>${escapeHtml(entry.scope)}</span>
        <span>${escapeHtml(new Date(entry.ts).toLocaleTimeString())}</span>
      </div>
    `;
    item.addEventListener("click", () => {
      entry.read = true;
      renderNotifications();
      closeNotificationMenu();
      if (entry.action) {
        if (entry.action.cameraId) {
          openCameraSettings(entry.action.cameraId);
        } else if (entry.action.settingsTab) {
          setSettingsTab(entry.action.settingsTab);
        } else if (entry.action.activity) {
          setActivity(entry.action.activity);
        }
      }
    });
    notifListEl.appendChild(item);
  }
}

function connectionTextClass(tone: "neutral" | "warn" | "good" | "bad"): string {
  if (tone === "good") return "connStateText-connected";
  if (tone === "warn" || tone === "neutral") return "connStateText-limited";
  return "connStateText-error";
}

function setConnectionState(label: string, tone: "neutral" | "warn" | "good" | "bad"): void {
  connStateTextEl.textContent = label;
  connStateTextEl.classList.remove("connStateText-connected", "connStateText-limited", "connStateText-error");
  connStateTextEl.classList.add(connectionTextClass(tone));
  popConnectionEl.textContent = label.toLowerCase();
  popRelayEl.textContent = label.toLowerCase();
}

function setDrawerStatus(detail: string): void {
  popConnectionReasonEl.textContent = detail;
}

function setSummaryState(value: string): void {
  summaryStateEl.textContent = value;
}

function shortPk(value: string): string {
  const raw = String(value || "").trim();
  if (!raw) return "—";
  return raw.length > 16 ? `${raw.slice(0, 16)}…` : raw;
}

function rememberResolvedResourceName(pk: unknown, label: unknown): void {
  const key = String(pk || "").trim();
  const text = String(label || "").trim();
  if (!key || !text) return;
  resolvedResourceNames.set(key, text);
}

function resetIdentityHandleCopyHint(): void {
  if (!identityHandleCopied) return;
  identityHandleCopied = false;
  refreshIdentityHandle();
}

function absorbRuntimeSnapshot(snapshot: unknown): void {
  runtimeSnapshot = (snapshot && typeof snapshot === "object") ? snapshot as RuntimeSnapshot : null;
  const projections = runtimeSnapshot?.projections;
  if (!projections || typeof projections !== "object") return;
  for (const category of ["owned", "granted", "discoverable"]) {
    const bucket = projections[category];
    if (!bucket || typeof bucket !== "object") continue;
    const appliances = Array.isArray(bucket.appliances) ? bucket.appliances as Array<Record<string, unknown>> : [];
    for (const record of appliances) {
      rememberResolvedResourceName(record.devicePk || record.pk, record.deviceLabel || record.label);
      rememberResolvedResourceName(record.hostGatewayPk || record.host_gateway_pk, record.hostGatewayLabel || record.host_gateway_label);
    }
  }
}

function resolvedResourceName(pk: string, fallback = ""): string {
  const key = String(pk || "").trim();
  if (!key) return fallback || "—";
  return resolvedResourceNames.get(key) || fallback || shortPk(key);
}

function pkLabel(value: string): string {
  const raw = String(value || "").trim();
  if (!raw) return "—";
  return resolvedResourceName(raw, shortPk(raw));
}

function serviceLabelForContext(context: LaunchContext | null): string {
  if (!context) return "Constitute NVR";
  const explicit = String(context.display?.serviceLabel || "").trim();
  if (explicit) return explicit;
  return resolvedResourceName(context.servicePk, shortPk(context.servicePk));
}

function gatewayLabelForContext(context: LaunchContext | null): string {
  if (!context) return "—";
  return resolvedResourceName(context.gatewayPk, shortPk(context.gatewayPk));
}

function humanizeSourceId(sourceId: string): string {
  const raw = String(sourceId || "").trim();
  if (!raw) return "Camera";
  if (raw.startsWith("reolink-")) return "Reolink Camera";
  return raw
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function cameraDisplayName(sourceId: string): string {
  const key = String(sourceId || "").trim();
  if (!key) return "Camera";
  const override = String(cameraNameOverrides.get(key) || "").trim();
  if (override) return override;
  const mounted = mountedCameraRecord(key);
  const mountedLabel = String(
    mounted?.displayName
      || mounted?.observed?.displayName
      || mounted?.desired?.displayName
      || "",
  ).trim();
  if (mountedLabel) return mountedLabel;
  const available = availableCameraInfo(key);
  const availableLabel = String(available?.name || "").trim();
  if (availableLabel) return availableLabel;
  const base = launchCameraInfoBySourceId.get(key);
  const baseLabel = String(base?.name || "").trim();
  if (baseLabel && !baseLabel.includes("192.168.")) return baseLabel;
  return humanizeSourceId(key);
}

function cameraLabelForSource(sourceId: string): string {
  return cameraDisplayName(sourceId);
}

function formatCameraScope(sourceIds: unknown): string {
  const normalized = normalizeSourceIds(sourceIds);
  if (normalized.length === 0) return "";
  return normalized.map((sourceId) => cameraLabelForSource(sourceId)).join(", ");
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

function readUiState(): { launchId: string; activity: NvrActivity; settingsTab: NvrSettingsTab; cameraId: string } {
  const params = hashParams();
  const activity = String(params.get("activity") || "live").trim().toLowerCase();
  const settingsTab = String(params.get("settings") || "nvr").trim().toLowerCase();
  return {
    launchId: String(params.get("launch") || "").trim(),
    activity: activity === "history" || activity === "settings" ? activity : "live",
    settingsTab: settingsTab === "cameras" ? settingsTab : "nvr",
    cameraId: String(params.get("camera") || "").trim(),
  };
}

function writeUiState(
  partial: Partial<{ activity: NvrActivity; settingsTab: NvrSettingsTab; cameraId: string }>,
  replace = false,
): void {
  const current = readUiState();
  const params = new URLSearchParams();
  if (current.launchId) params.set("launch", current.launchId);
  const activity = partial.activity ?? current.activity;
  const settingsTab = partial.settingsTab ?? current.settingsTab;
  const cameraId = partial.cameraId !== undefined ? partial.cameraId : current.cameraId;
  if (activity && activity !== "live") params.set("activity", activity);
  if (settingsTab && settingsTab !== "nvr") params.set("settings", settingsTab);
  if (cameraId) params.set("camera", cameraId);
  const nextHash = `#${params.toString()}`;
  if (replace) {
    window.history.replaceState(null, "", nextHash);
  } else {
    window.history.pushState(null, "", nextHash);
  }
  syncUiToHash();
}

function parseLaunchId(): string {
  return readUiState().launchId;
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

function openNotificationMenu(): void {
  notificationMenuOpen = true;
  notifMenuEl.classList.remove("hidden");
  for (const entry of notifications) entry.read = true;
  renderNotifications();
}

function closeNotificationMenu(): void {
  notificationMenuOpen = false;
  notifMenuEl.classList.add("hidden");
}

function toggleNotificationMenu(): void {
  if (notificationMenuOpen) {
    closeNotificationMenu();
  } else {
    openNotificationMenu();
  }
}

function identityHandleForContext(context: LaunchContext | null): string {
  const identityId = String(context?.identityId || "").trim();
  if (!identityId) return "@unlinked";
  const label = resolvedResourceName(identityId, shortPk(identityId));
  return `@${String(label || "identity").replace(/^@+/, "")}`;
}

function refreshIdentityHandle(): void {
  const identityId = String(launchContext?.identityId || "").trim();
  const linked = Boolean(identityId);
  identityHandleEl.textContent = identityHandleForContext(launchContext);
  identityHandleEl.classList.toggle("identityHandle-linked", linked);
  identityHandleEl.classList.toggle("identityHandle-unlinked", !linked);
  identityHandleEl.title = identityId
    ? (identityHandleCopied ? "Copied!" : "Click to copy ID")
    : "Identity not linked yet";
  identityHandleEl.setAttribute("aria-label", identityId ? `Identity ${identityId}` : "Identity not linked");
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

function openDrawer(): void {
  drawerEl.classList.remove("hidden");
  drawerBackdropEl.classList.remove("hidden");
}

function closeDrawer(): void {
  drawerEl.classList.add("hidden");
  drawerBackdropEl.classList.add("hidden");
}

function syncUiToHash(): void {
  const state = readUiState();
  currentActivity = state.activity;
  currentSettingsTab = state.settingsTab;
  selectedCameraId = state.cameraId;

  liveViewEl.classList.toggle("hidden", currentActivity !== "live");
  historyViewEl.classList.toggle("hidden", currentActivity !== "history");
  settingsViewEl.classList.toggle("hidden", currentActivity !== "settings");

  navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.activity === currentActivity);
  });
  settingsTabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.settingsTab === currentSettingsTab);
  });

  nvrSettingsPanelEl.classList.toggle("hidden", currentActivity !== "settings" || currentSettingsTab !== "nvr");
  camerasPanelEl.classList.toggle("hidden", currentActivity !== "settings" || currentSettingsTab !== "cameras");
  renderCameraList();
  if (currentActivity === "settings" && viewerIsOwner() && (currentSettingsTab === "cameras" || currentSettingsTab === "nvr")) {
    if (!cameraInventory && !cameraInventoryLoading) {
      void refreshCameraInventory();
    }
  }
}

function setActivity(activity: NvrActivity, replace = false): void {
  writeUiState({ activity, cameraId: activity === "settings" ? selectedCameraId : "" }, replace);
}

function setSettingsTab(settingsTab: NvrSettingsTab, replace = false): void {
  writeUiState({ activity: "settings", settingsTab, cameraId: "" }, replace);
}

function openCameraSettings(sourceId: string): void {
  const normalized = String(sourceId || "").trim();
  const alreadyOpen =
    currentActivity === "settings" &&
    currentSettingsTab === "cameras" &&
    selectedCameraId === normalized;
  writeUiState({ activity: "settings", settingsTab: "cameras", cameraId: alreadyOpen ? "" : normalized });
}

function closeCameraSettings(): void {
  writeUiState({ activity: "settings", settingsTab: currentSettingsTab, cameraId: "" });
}

function runtimeWorkerUrl(): string {
  const target = new URL("/constitute/runtime.worker.js", window.location.origin);
  target.searchParams.set("v", RUNTIME_WORKER_BUILD_ID);
  return target.toString();
}

function launchStorageKey(launchId: string): string {
  return `${LAUNCH_STORAGE_PREFIX}${launchId}`;
}

function writeStoredLaunchContext(context: LaunchContext): LaunchContext {
  const launchId = String(context?.launchId || "").trim();
  if (!launchId) throw new Error("launch context is missing launchId");
  const stored = {
    ...context,
    createdAt: Number(context?.createdAt || Date.now()),
    expiresAt: Number(context?.expiresAt || (Date.now() + (2 * 60_000))),
  };
  localStorage.setItem(launchStorageKey(launchId), JSON.stringify(stored));
  return stored;
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
    absorbRuntimeSnapshot(payload.snapshot);
    if (type === "runtime.attached" && resolveRuntimeReady) {
      resolveRuntimeReady(runtimePort);
      resolveRuntimeReady = null;
    }
    appendLog(`runtime ${type === "runtime.attached" ? "attached" : "snapshot"} ${String(payload.buildId || "")}`.trim());
    if (launchContext) {
      refreshSummary(launchContext);
      renderCameraList();
    }
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
    return;
  }

  if (type === "gateway.grant.response") {
    const requestId = String(payload.requestId || "").trim();
    const pending = pendingGrantResponses.get(requestId);
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingGrantResponses.delete(requestId);
    const ok = payload.ok === true;
    if (!ok) {
      pending.reject(new Error(String(payload.error || "gateway grant request failed")));
      return;
    }
    pending.resolve({
      requestId,
      ok: true,
      result: payload.result,
    });
    return;
  }

  if (type === "gateway.launch.response") {
    const requestId = String(payload.requestId || "").trim();
    const pending = pendingGatewayLaunchResponses.get(requestId);
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingGatewayLaunchResponses.delete(requestId);
    if (payload.ok !== true) {
      pending.reject(new Error(String(payload.error || "gateway launch request failed")));
      return;
    }
    pending.resolve(normalizeGatewayLaunchResult(payload.result, requestId));
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

function normalizeGatewayLaunchResult(result: unknown, fallbackRequestId = ""): GatewayLaunchResult {
  const payload = (result && typeof result === "object")
    ? result as Record<string, unknown>
    : {};
  return {
    requestId: String(payload.requestId || fallbackRequestId).trim(),
    gatewayPk: String(payload.gatewayPk || "").trim(),
    servicePk: String(payload.servicePk || "").trim(),
    service: String(payload.service || "nvr").trim() || "nvr",
    capability: String(payload.capability || "").trim(),
    launchToken: String(payload.launchToken || "").trim(),
    display: payload.display && typeof payload.display === "object"
      ? payload.display as LaunchDisplay
      : undefined,
    expiresAt: Number(payload.expiresAt || 0),
    ts: Number(payload.ts || Date.now()),
  };
}

function launchContextNeedsRefresh(context: LaunchContext | null, skewMs = LAUNCH_REFRESH_SKEW_MS): boolean {
  if (!context) return true;
  const expiresAt = Number(context.expiresAt || 0);
  if (!expiresAt) return true;
  return expiresAt <= (Date.now() + Math.max(0, skewMs));
}

function launchRefreshRecord(context: LaunchContext): Record<string, string> {
  return {
    devicePk: context.servicePk,
    pk: context.servicePk,
    hostGatewayPk: context.gatewayPk,
    service: context.service || "nvr",
  };
}

function launchRefreshOptions(context: LaunchContext): Record<string, string> {
  const service = String(context.service || "nvr").trim() || "nvr";
  return {
    service,
    capability: `${service}.view`,
  };
}

async function persistLaunchContext(context: LaunchContext): Promise<LaunchContext> {
  const stored = writeStoredLaunchContext(context);
  launchContext = stored;
  refreshSummary(stored);
  renderCameraList();
  await runtimeCall("launchContext.put", { context: stored }, 5_000).catch(() => null);
  return stored;
}

function isExpiredLaunchTokenError(error: unknown): boolean {
  const message = String((error as Error)?.message || error || "").toLowerCase();
  return message.includes("launch token expired") || message.includes("invalid_launch_token");
}

async function requestGatewayLaunchViaShellChannel(requestId: string): Promise<GatewayLaunchResult> {
  if (!launchContext) throw new Error("launch context is not loaded");
  const bc = ensureChannel();
  const promise = new Promise<GatewayLaunchResult>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pendingGatewayLaunchResponses.delete(requestId);
      reject(new Error("gateway launch response timed out"));
    }, LAUNCH_REFRESH_TIMEOUT_MS);
    pendingGatewayLaunchResponses.set(requestId, { resolve, reject, timer });
  });
  bc.postMessage({
    type: "gateway.launch.request",
    launchId: launchContext.launchId,
    requestId,
    record: launchRefreshRecord(launchContext),
    options: launchRefreshOptions(launchContext),
  });
  return await promise;
}

async function requestGatewayLaunch(): Promise<GatewayLaunchResult> {
  if (!launchContext) throw new Error("launch context is not loaded");
  const requestId = randomOpaqueId("nvr-launch");
  const runtime = await ensureRuntimePort();
  if (runtime) {
    try {
      const result = await runtimeCall<Record<string, unknown>>("gateway.launch.request", {
        payload: {
          record: launchRefreshRecord(launchContext),
          options: launchRefreshOptions(launchContext),
        },
      }, LAUNCH_REFRESH_TIMEOUT_MS);
      if (result) {
        appendLog("runtime broker delivered launch refresh");
        return normalizeGatewayLaunchResult(result, requestId);
      }
    } catch (error) {
      appendLog(`runtime broker launch refresh failed; using shell channel (${String((error as Error)?.message || error)})`);
    }
  }
  appendLog("requesting launch refresh from shell channel");
  return await requestGatewayLaunchViaShellChannel(requestId);
}

async function ensureFreshLaunchContext(force = false, reason = ""): Promise<LaunchContext> {
  if (!launchContext) throw new Error("launch context is not loaded");
  if (!force && !launchContextNeedsRefresh(launchContext)) {
    return launchContext;
  }
  if (launchRefreshPromise) {
    return await launchRefreshPromise;
  }

  const current = launchContext;
  launchRefreshPromise = (async () => {
    const cause = String(reason || "").trim();
    appendLog(`refreshing managed launch context${cause ? ` (${cause})` : ""}`);
    const refreshed = await requestGatewayLaunch();
    if (!refreshed.launchToken) {
      throw new Error("managed launch refresh returned no launch token");
    }
    const next = await persistLaunchContext({
      ...current,
      gatewayPk: refreshed.gatewayPk || current.gatewayPk,
      servicePk: refreshed.servicePk || current.servicePk,
      service: refreshed.service || current.service,
      launchToken: refreshed.launchToken,
      display: refreshed.display ?? current.display,
      createdAt: Date.now(),
      expiresAt: Number(refreshed.expiresAt || (Date.now() + (2 * 60_000))),
    });
    appendLog(`launch context refreshed until ${new Date(next.expiresAt).toLocaleTimeString()}`);
    return next;
  })();

  try {
    return await launchRefreshPromise;
  } finally {
    launchRefreshPromise = null;
  }
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

async function requestGatewaySignalOnce(signalType: string, payload: unknown): Promise<GatewaySignalResult> {
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
    return mirrored;
  } catch (error) {
    appendLog(`shell mirror ${signalType} failed; retrying via shell channel (${String((error as Error)?.message || error)})`);
    return await requestGatewaySignalViaShellChannel(signalType, payload, randomOpaqueId("nvr-signal-bc"));
  }
}

async function requestGatewaySignal(signalType: string, payload: unknown): Promise<GatewaySignalResult> {
  if (!launchContext) throw new Error("launch context is not loaded");
  await ensureFreshLaunchContext(false, `${signalType} preflight`);
  try {
    return await requestGatewaySignalOnce(signalType, payload);
  } catch (error) {
    if (!isExpiredLaunchTokenError(error)) {
      throw error;
    }
    appendLog(`launch token expired during ${signalType}; refreshing and retrying`);
    await ensureFreshLaunchContext(true, `${signalType} retry`);
    return await requestGatewaySignalOnce(signalType, payload);
  }
}

async function requestGatewayGrantAction(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<GatewayGrantResult> {
  if (!launchContext) throw new Error("launch context is not loaded");
  const requestId = randomOpaqueId("nvr-grant");
  const bc = ensureChannel();
  const promise = new Promise<GatewayGrantResult>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pendingGrantResponses.delete(requestId);
      reject(new Error("gateway grant response timed out"));
    }, GRANT_REQUEST_TIMEOUT_MS);
    pendingGrantResponses.set(requestId, { resolve, reject, timer });
  });
  bc.postMessage({
    type: "gateway.grant.request",
    launchId: launchContext.launchId,
    requestId,
    action,
    ...payload,
  });
  return await promise;
}

function unwrapGatewaySignalPayload(result: GatewaySignalResult): Record<string, unknown> {
  const root = result.result && typeof result.result === "object"
    ? result.result as Record<string, unknown>
    : {};
  const payload = root.payload && typeof root.payload === "object"
    ? root.payload as Record<string, unknown>
    : root;
  return payload;
}

async function requestAdminAction(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  try {
    const result = await requestGatewaySignal("admin", {
      action,
      payload,
    });
    return unwrapGatewaySignalPayload(result);
  } catch (error) {
    throw new Error(normalizeAdminError(error));
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

function normalizeLaunchCameraEntries(display: LaunchDisplay): LaunchCameraDisplay[] {
  const entries = Array.isArray(display?.cameras) ? display.cameras : [];
  const normalized = entries
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const sourceId = String(entry.sourceId || "").trim();
      if (!sourceId) return null;
      return {
        sourceId,
        name: String(entry.name || humanizeSourceId(sourceId)).trim() || humanizeSourceId(sourceId),
        viewGranted: entry.viewGranted !== false,
        controlGranted: entry.controlGranted === true,
        ptzCapable: entry.ptzCapable === true,
      };
    })
    .filter((entry): entry is LaunchCameraDisplay => !!entry);
  if (normalized.length > 0) return normalized;
  return normalizeSourceIds(display?.sources || []).map((sourceId) => ({
    sourceId,
    name: humanizeSourceId(sourceId),
    viewGranted: true,
    controlGranted: false,
    ptzCapable: false,
  }));
}

function availableCameraInfo(sourceId: string): CameraGrantView | null {
  const target = String(sourceId || "").trim();
  if (!target || !grantInventory?.availableCameras?.length) return null;
  return grantInventory.availableCameras.find((camera) => String(camera.sourceId || "").trim() === target) || null;
}

function launchCameraInfo(sourceId: string): LaunchCameraDisplay | null {
  const key = String(sourceId || "").trim();
  if (!key) return null;
  const base = launchCameraInfoBySourceId.get(key) || null;
  const available = availableCameraInfo(key);
  const mounted = mountedCameraRecord(key);
  if (!base && !available && !mounted) return null;
  return {
    sourceId: key,
    name: cameraDisplayName(key),
    viewGranted: base?.viewGranted !== false,
    controlGranted: base?.controlGranted === true || viewerIsOwner(),
    ptzCapable: mounted?.observed?.ptzCapable === true || mounted?.capabilities?.ptz === true || available?.ptzCapable === true || base?.ptzCapable === true,
  };
}

function viewerIsOwner(): boolean {
  return launchContext?.display?.grantedScope?.owner === true;
}

function ownerCanAdmin(): boolean {
  return viewerIsOwner() && !cameraInventoryError;
}

function normalizeAdminError(error: unknown): string {
  const message = String((error as Error)?.message || error || "Camera administration is unavailable.").trim();
  const lowered = message.toLowerCase();
  if (lowered.includes("unsupported_signal") || lowered.includes("only offer and session_close are supported")) {
    return "Gateway update required before camera administration is available from this NVR surface.";
  }
  if (lowered.includes("admin_requires_owner")) {
    return "Owner launch is required before camera administration is available.";
  }
  return message || "Camera administration is unavailable.";
}

function defaultCameraSettingsDraft(sourceId: string): CameraSettingsDraft {
  const camera = launchCameraInfo(sourceId);
  const displayName = cameraDisplayName(sourceId);
  const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  const managedNtpServer = String(cameraInventory?.cameraNetwork?.ntpServer || "").trim();
  return {
    displayName,
    timeMode: "ntp",
    ntpServer: managedNtpServer,
    manualTime: nowLocal,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    overlayText: String(displayName || camera?.name || "").trim(),
    overlayTimestamp: true,
    desiredPassword: "",
    generatePassword: false,
    enableOnvif: true,
    enableRtsp: true,
    disableP2p: false,
    disableHttp: false,
    disableHttps: false,
    preserveProprietary9000: true,
  };
}

function defaultCandidateMountDraft(candidate: DiscoveryCandidateRecord): CandidateMountDraft {
  return {
    displayName: String(
      candidate.signatures?.model
      || candidate.signatures?.publicTitle
      || candidate.leaseHostname
      || candidate.ip
      || "Camera",
    ).trim(),
    username: "admin",
    password: "",
    desiredPassword: "",
    generatePassword: false,
    rtspUrl: "",
  };
}

function candidateMountDraft(candidateId: string, candidate?: DiscoveryCandidateRecord | null): CandidateMountDraft {
  const key = String(candidateId || "").trim();
  const existing = key ? candidateMountDrafts.get(key) : null;
  if (existing) return { ...existing };
  const base = defaultCandidateMountDraft(candidate || {});
  if (key) candidateMountDrafts.set(key, { ...base });
  return base;
}

function updateCandidateMountDraft(candidateId: string, patch: Partial<CandidateMountDraft>): void {
  const key = String(candidateId || "").trim();
  if (!key) return;
  const candidate = (cameraInventory?.candidates || []).find((item) => String(item.candidateId || "").trim() === key) || null;
  candidateMountDrafts.set(key, {
    ...candidateMountDraft(key, candidate),
    ...patch,
  });
}

function setProbeResult(key: string, tone: NotificationTone, summary: string, detail: string, payload: unknown): void {
  const normalized = String(key || "").trim();
  if (!normalized) return;
  cameraProbeResults.set(normalized, {
    tone,
    summary: summary.trim(),
    detail: detail.trim(),
    payload,
    ts: Date.now(),
  });
}

function probeResultFor(key: string): ProbeResultRecord | null {
  return cameraProbeResults.get(String(key || "").trim()) || null;
}

function cameraSettingsDraft(sourceId: string): CameraSettingsDraft {
  const key = String(sourceId || "").trim();
  if (!key) return defaultCameraSettingsDraft("");
  let draft = cameraSettingsDrafts.get(key);
  if (!draft) {
    draft = defaultCameraSettingsDraft(key);
    cameraSettingsDrafts.set(key, draft);
  }
  return { ...draft };
}

function updateCameraSettingsDraft(sourceId: string, patch: Partial<CameraSettingsDraft>): void {
  const key = String(sourceId || "").trim();
  if (!key) return;
  cameraSettingsDrafts.set(key, {
    ...cameraSettingsDraft(key),
    ...patch,
  });
}

function settingsCameraRows(): CameraGrantView[] {
  if (cameraInventory?.mounted?.length) {
    return cameraInventory.mounted.map((camera) => ({
      sourceId: String(camera.sourceId || "").trim(),
      name: cameraDisplayName(String(camera.sourceId || "").trim()),
      ptzCapable: camera.observed?.ptzCapable === true || camera.capabilities?.ptz === true,
    })).filter((camera) => camera.sourceId);
  }
  if (grantInventory?.availableCameras?.length) {
    return grantInventory.availableCameras;
  }
  return normalizeLaunchCameraEntries(launchContext?.display || {}).map((camera) => {
    const merged = launchCameraInfo(String(camera.sourceId || "").trim()) || camera;
    return {
      sourceId: merged.sourceId,
      name: merged.name,
      ptzCapable: merged.ptzCapable,
    };
  });
}

function mountedCameraRecord(sourceId: string): MountedCameraRecord | null {
  const target = String(sourceId || "").trim();
  if (!target || !cameraInventory?.mounted?.length) return null;
  return cameraInventory.mounted.find((camera) => String(camera.sourceId || "").trim() === target) || null;
}

function serviceEnabled(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (["true", "1", "enabled", "open", "ready", "yes"].includes(normalized)) return true;
    if (["false", "0", "disabled", "closed", "no"].includes(normalized)) return false;
  }
  return null;
}

function cameraCapabilities(sourceId: string): CameraCapabilitySet {
  return mountedCameraRecord(sourceId)?.capabilities || {};
}

async function refreshCameraInventory(): Promise<void> {
  if (!viewerIsOwner()) {
    cameraInventory = null;
    cameraInventoryLoading = false;
    cameraInventoryError = "";
    renderCameraList();
    renderNvrSettingsSummary();
    return;
  }
  cameraInventoryLoading = true;
  cameraInventoryError = "";
  renderCameraList();
  renderNvrSettingsSummary();
  try {
    const payload = await requestAdminAction("list_inventory");
    const inventory = payload.inventory && typeof payload.inventory === "object"
      ? payload.inventory as CameraInventoryRecord
      : { mounted: [], candidates: [], cameraNetwork: {} };
    cameraInventory = {
      mounted: Array.isArray(inventory.mounted) ? inventory.mounted : [],
      candidates: Array.isArray(inventory.candidates) ? inventory.candidates : [],
      cameraNetwork: inventory.cameraNetwork && typeof inventory.cameraNetwork === "object"
        ? inventory.cameraNetwork as CameraNetworkSummaryRecord
        : {},
    };
    seedCameraDraftsFromInventory();
    for (const candidate of cameraInventory.candidates || []) {
      const candidateId = String(candidate.candidateId || "").trim();
      if (!candidateId || knownCandidateIds.has(candidateId)) continue;
      knownCandidateIds.add(candidateId);
      const label = String(candidate.signatures?.model || candidate.leaseHostname || "camera").trim();
      addNotification(
        "neutral",
        `New camera discovered`,
        `${label} is ready for review in Cameras.`,
        "camera",
        { activity: "settings", settingsTab: "cameras" },
      );
    }
    cameraInventoryError = "";
  } catch (error) {
    cameraInventoryError = normalizeAdminError(error);
    addNotification("warn", "Camera inventory unavailable", cameraInventoryError, "camera", {
      activity: "settings",
      settingsTab: "nvr",
    });
    cameraInventory = { mounted: [], candidates: [], cameraNetwork: {} };
  } finally {
    cameraInventoryLoading = false;
    for (const sourceId of cameraTiles.keys()) {
      updateLiveTileMetadata(sourceId);
    }
    renderCameraList();
    renderNvrSettingsSummary();
  }
}

function seedCameraDraftsFromInventory(): void {
  for (const camera of cameraInventory?.mounted || []) {
    const sourceId = String(camera.sourceId || "").trim();
    if (!sourceId) continue;
    const observedServices = camera.observed?.services || {};
    const observedOnvif = serviceEnabled(observedServices.onvif);
    const observedRtsp = serviceEnabled(observedServices.rtsp);
    const observedP2p = serviceEnabled(observedServices.p2p);
    const observedHttp = serviceEnabled(observedServices.http);
    const observedHttps = serviceEnabled(observedServices.https);
    const observed9000 = serviceEnabled(observedServices.proprietary9000);
    const nextDraft: CameraSettingsDraft = {
      displayName: String(camera.desired?.displayName || camera.displayName || camera.observed?.displayName || sourceId).trim() || sourceId,
      timeMode: String(camera.desired?.timeMode || camera.observed?.timeMode || "ntp").trim() === "manual" ? "manual" : "ntp",
      ntpServer: String(camera.desired?.ntpServer || camera.observed?.ntpServer || "").trim(),
      manualTime: String(camera.desired?.manualTime || camera.observed?.manualTime || "").trim(),
      timezone: String(camera.desired?.timezone || camera.observed?.timezone || "UTC").trim() || "UTC",
      overlayText: String(camera.desired?.overlayText || camera.observed?.overlayText || camera.displayName || camera.observed?.displayName || "").trim(),
      overlayTimestamp: camera.desired?.overlayTimestamp !== false && camera.observed?.overlayTimestamp !== false,
      desiredPassword: String(camera.desired?.desiredPassword || "").trim(),
      generatePassword: camera.desired?.generatePassword === true,
      enableOnvif: typeof camera.desired?.hardening?.enableOnvif === "boolean"
        ? camera.desired.hardening.enableOnvif !== false
        : observedOnvif !== false,
      enableRtsp: typeof camera.desired?.hardening?.enableRtsp === "boolean"
        ? camera.desired.hardening.enableRtsp !== false
        : observedRtsp !== false,
      disableP2p: typeof camera.desired?.hardening?.disableP2p === "boolean"
        ? camera.desired.hardening.disableP2p === true
        : observedP2p === false,
      disableHttp: typeof camera.desired?.hardening?.disableHttp === "boolean"
        ? camera.desired.hardening.disableHttp === true
        : observedHttp === false,
      disableHttps: typeof camera.desired?.hardening?.disableHttps === "boolean"
        ? camera.desired.hardening.disableHttps === true
        : observedHttps === false,
      preserveProprietary9000: typeof camera.desired?.hardening?.preserveProprietary9000 === "boolean"
        ? camera.desired.hardening.preserveProprietary9000 !== false
        : observed9000 !== false,
    };
    if (!cameraSettingsDrafts.has(sourceId)) {
      cameraSettingsDrafts.set(sourceId, nextDraft);
    }
    const observedLabel = String(camera.displayName || camera.observed?.displayName || camera.desired?.displayName || "").trim();
    if (observedLabel) {
      const override = cameraNameOverrides.get(sourceId);
      if (!override || override === observedLabel) {
        cameraNameOverrides.set(sourceId, observedLabel);
      }
    }
    const currentPose = camera.currentPose || camera.observed?.currentPose;
    if (currentPose) {
      currentPoseBySourceId.set(sourceId, { ...currentPose });
      desiredPoseBySourceId.set(sourceId, { ...(camera.desiredPose || currentPose) });
    }
    poseStatusBySourceId.set(sourceId, String(camera.poseStatus || camera.observed?.poseStatus || "").trim());
  }
  for (const candidate of cameraInventory?.candidates || []) {
    const candidateId = String(candidate.candidateId || "").trim();
    if (!candidateId || candidateMountDrafts.has(candidateId)) continue;
    candidateMountDrafts.set(candidateId, defaultCandidateMountDraft(candidate));
  }
}

async function saveCameraSettings(sourceId: string): Promise<void> {
  const draft = cameraSettingsDraft(sourceId);
  if (draft.displayName.trim()) {
    cameraNameOverrides.set(sourceId, draft.displayName.trim());
    updateLiveTileMetadata(sourceId);
  }
  const payload = await requestAdminAction("apply_camera_config", {
    sourceId,
    desired: {
      displayName: draft.displayName,
      timeMode: draft.timeMode,
      ntpServer: draft.ntpServer,
      manualTime: draft.manualTime,
      timezone: draft.timezone,
      overlayText: draft.overlayText,
      overlayTimestamp: draft.overlayTimestamp,
      desiredPassword: draft.desiredPassword,
      generatePassword: draft.generatePassword,
      hardening: {
        enableOnvif: draft.enableOnvif,
        enableRtsp: draft.enableRtsp,
        disableP2p: draft.disableP2p,
        disableHttp: draft.disableHttp,
        disableHttps: draft.disableHttps,
        preserveProprietary9000: draft.preserveProprietary9000,
      },
    },
  });
  const mounted = payload.mounted && typeof payload.mounted === "object"
    ? payload.mounted as MountedCameraRecord
    : null;
  const credentialStatus = String(mounted?.credentialSafety?.status || "").trim();
  const notificationTone: NotificationTone =
    mounted?.verification?.status === "verified" && !mounted?.credentialSafety?.pending && credentialStatus !== "failed"
      ? "good"
      : credentialStatus === "failed"
        ? "bad"
        : credentialStatus === "recovered" || mounted?.credentialSafety?.pending || mounted?.verification?.status === "drift"
          ? "warn"
          : "neutral";
  if (notificationTone !== "good") {
    addNotification(
      notificationTone,
      `Camera settings need review`,
      String(
        mounted?.credentialSafety?.lastError ||
        mounted?.verification?.message ||
        "Camera configuration update was accepted."
      ),
      "camera",
      {
        activity: "settings",
        settingsTab: "cameras",
        cameraId: sourceId,
      },
    );
  }
  await refreshCameraInventory();
}

async function mountCameraCandidate(candidateId: string): Promise<void> {
  const candidate = (cameraInventory?.candidates || []).find((item) => String(item.candidateId || "").trim() === candidateId);
  if (!candidate) {
    throw new Error("camera candidate is no longer available");
  }
  const draft = candidateMountDraft(candidateId, candidate);
  if (!draft.username.trim() || !draft.password.trim()) {
    throw new Error("username and password are required to mount this camera");
  }
  const payload = await requestAdminAction("mount_candidate", {
    candidate,
    displayName: draft.displayName,
    username: draft.username,
    password: draft.password,
    desiredPassword: draft.desiredPassword,
    generatePassword: draft.generatePassword,
    rtspUrl: draft.rtspUrl,
  });
  const mounted = payload.mounted && typeof payload.mounted === "object"
    ? payload.mounted as MountedCameraRecord
    : null;
  addNotification(
    "good",
    `Mounted ${draft.displayName || candidate.ip || "camera"}`,
    String(mounted?.verification?.message || "Camera was mounted into the NVR inventory."),
    "camera",
    {
      activity: "settings",
      settingsTab: "cameras",
      cameraId: String(mounted?.sourceId || ""),
    },
  );
  if (mounted?.sourceId) {
    selectedCameraId = String(mounted.sourceId || "");
    expandedCandidateId = "";
  }
  await refreshCameraInventory();
}

async function runMountedCameraProbe(sourceId: string): Promise<void> {
  const payload = await requestAdminAction("probe_camera", { sourceId });
  const result = payload.result && typeof payload.result === "object" ? payload.result : payload;
  const mounted = (result as Record<string, unknown>)?.camera;
  const verification = mounted && typeof mounted === "object" && (mounted as Record<string, unknown>).verification
    && typeof (mounted as Record<string, unknown>).verification === "object"
      ? ((mounted as Record<string, unknown>).verification as Record<string, unknown>)
      : null;
  const verificationStatus = String(verification?.status || "").trim();
  const tone: NotificationTone =
    verificationStatus === "verified" ? "good" : verificationStatus === "drift" ? "warn" : verificationStatus === "failed" ? "bad" : "neutral";
  const summary = `Probe refreshed for ${sourceId}`;
  const detail = String(
    verification?.message || "Readback and raw driver payload captured."
  ).trim();
  setProbeResult(`mounted:${sourceId}`, tone, summary, detail, result);
  if (tone !== "good") {
    addNotification(tone, summary, detail, "camera", {
      activity: "settings",
      settingsTab: "cameras",
      cameraId: sourceId,
    });
  }
}

async function runCandidateProbe(candidateId: string): Promise<void> {
  const candidate = (cameraInventory?.candidates || []).find((item) => String(item.candidateId || "").trim() === candidateId);
  if (!candidate) {
    throw new Error("camera candidate is no longer available");
  }
  const draft = candidateMountDraft(candidateId, candidate);
  const payload = await requestAdminAction("probe_camera", {
    ip: candidate.ip,
    username: draft.username,
    password: draft.password,
    driverId: candidate.driverMatch?.driverId || "",
  });
  const result = payload.result && typeof payload.result === "object" ? payload.result : payload;
  const candidateLabel = draft.displayName || candidate.ip || "camera";
  const diagnostics = (result as Record<string, unknown>)?.diagnostics;
  const diagnosticsRecord = diagnostics && typeof diagnostics === "object"
    ? diagnostics as Record<string, unknown>
    : null;
  const diagnosticsStatus = String(diagnosticsRecord?.status || "").trim();
  const tone: NotificationTone =
    diagnosticsStatus === "ok" ? "good" : diagnosticsStatus === "error" ? "bad" : "neutral";
  const detail = String(
    diagnosticsRecord?.message
    || ((result as Record<string, unknown>)?.candidate && candidate.driverMatch?.reason)
    || "Probe captured discovery and driver details."
  ).trim();
  setProbeResult(`candidate:${candidateId}`, tone, `Probe refreshed for ${candidateLabel}`, detail, result);
  if (tone !== "good") {
    addNotification(tone, `Probe refreshed for ${candidateLabel}`, detail, "camera", {
      activity: "settings",
      settingsTab: "cameras",
    });
  }
}

function ensureCameraTile(sourceId: string): CameraTile {
  const existing = cameraTiles.get(sourceId);
  if (existing) return existing;

  if (cameraTiles.size === 0) {
    cameraGridEl.innerHTML = "";
  }

  const card = document.createElement("article");
  card.className = "cameraTile";
  card.tabIndex = 0;

  const header = document.createElement("div");
  header.className = "cameraHeader";

  const title = document.createElement("div");
  title.className = "cameraTitle";
  const info = launchCameraInfo(sourceId);
  title.textContent = cameraDisplayName(sourceId);
  header.appendChild(title);

  const videoWrap = document.createElement("div");
  videoWrap.className = "cameraVideoWrap";
  const video = document.createElement("video");
  video.className = "cameraVideo";
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.controls = false;
  videoWrap.appendChild(video);

  const statusDot = document.createElement("span");
  statusDot.className = "cameraStatusDot cameraStatusDot-waiting";
  statusDot.title = "Waiting for media";
  videoWrap.appendChild(statusDot);

  const overlayTop = document.createElement("div");
  overlayTop.className = "cameraOverlayTop";

  const gearButton = document.createElement("button");
  gearButton.type = "button";
  gearButton.className = "cameraActionButton";
  gearButton.title = "Camera settings";
  gearButton.textContent = "⚙";
  gearButton.addEventListener("click", (event) => {
    event.stopPropagation();
    openCameraSettings(sourceId);
    showCameraOverlay(sourceId);
  });
  overlayTop.appendChild(gearButton);
  videoWrap.appendChild(overlayTop);

  const overlayBottom = document.createElement("div");
  overlayBottom.className = "cameraOverlayBottom";

  const ptzButton = document.createElement("button");
  ptzButton.type = "button";
  ptzButton.className = "cameraActionButton";
  ptzButton.textContent = "PTZ";
  ptzButton.hidden = !PTZ_UI_ENABLED;
  ptzButton.disabled = !ptzUiInteractive(info);
  ptzButton.title = PTZ_UI_ENABLED
    ? (info?.ptzCapable
      ? (info?.controlGranted ? "Toggle PTZ mode" : "PTZ is not granted for this camera")
      : "Camera does not advertise PTZ")
    : "PTZ is temporarily hidden";
  ptzButton.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!ptzUiInteractive(info)) return;
    if (ptzActiveSourceId === sourceId) {
      clearPtzActiveSource();
      return;
    }
    ptzActiveSourceId = sourceId;
    updatePtzUi();
    showCameraOverlay(sourceId);
  });
  overlayBottom.appendChild(ptzButton);
  videoWrap.appendChild(overlayBottom);

  const ptzZones = document.createElement("div");
  ptzZones.className = "cameraPtzZones";
  ptzZones.hidden = !PTZ_UI_ENABLED;
  const zones: Array<{ direction: "up" | "down" | "left" | "right"; label: string }> = [
    { direction: "up", label: "↑" },
    { direction: "down", label: "↓" },
    { direction: "left", label: "←" },
    { direction: "right", label: "→" },
  ];
  for (const zone of zones) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `cameraPtzZone cameraPtzZone-${zone.direction}`;
    button.textContent = zone.label;
    button.title = `Move ${zone.direction} ${PTZ_STEP_DEGREES}°`;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!PTZ_UI_ENABLED) return;
      void stepPtz(sourceId, zone.direction).catch(() => {});
    });
    ptzZones.appendChild(button);
  }
  videoWrap.appendChild(ptzZones);

  card.appendChild(header);
  card.appendChild(videoWrap);
  cameraGridEl.appendChild(card);

  card.addEventListener("click", () => {
    selectedLiveCameraId = sourceId;
    updateTileSelection();
  });
  card.addEventListener("focus", () => {
    selectedLiveCameraId = sourceId;
    updateTileSelection();
  });
  videoWrap.addEventListener("pointerenter", () => showCameraOverlay(sourceId));
  videoWrap.addEventListener("pointermove", () => showCameraOverlay(sourceId));
  videoWrap.addEventListener("pointerdown", () => showCameraOverlay(sourceId));
  videoWrap.addEventListener("pointerleave", () => scheduleHideCameraOverlay(sourceId));
  card.addEventListener("focusin", () => showCameraOverlay(sourceId));
  card.addEventListener("focusout", () => scheduleHideCameraOverlay(sourceId));

  const tile = {
    id: sourceId,
    card,
    video,
    title,
    gearButton,
    ptzButton,
    videoWrap,
    statusDot,
    overlayTop,
    overlayBottom,
    ptzZones,
    overlayHideTimer: 0,
  };
  cameraTiles.set(sourceId, tile);
  scheduleHideCameraOverlay(sourceId);
  updatePtzUi();
  return tile;
}

function showCameraOverlay(sourceId: string): void {
  const tile = cameraTiles.get(sourceId);
  if (!tile) return;
  if (tile.overlayHideTimer) {
    window.clearTimeout(tile.overlayHideTimer);
    tile.overlayHideTimer = 0;
  }
  tile.card.classList.add("overlay-visible");
}

function scheduleHideCameraOverlay(sourceId: string): void {
  const tile = cameraTiles.get(sourceId);
  if (!tile) return;
  if (tile.overlayHideTimer) window.clearTimeout(tile.overlayHideTimer);
  tile.overlayHideTimer = window.setTimeout(() => {
    tile.card.classList.remove("overlay-visible");
    tile.overlayHideTimer = 0;
  }, 5_000);
}

function directionFromVector(dx: number, dy: number): string {
  if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return "stop";
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? "right" : "left";
  }
  return dy > 0 ? "down" : "up";
}

function updateTileSelection(): void {
  for (const [sourceId, tile] of cameraTiles.entries()) {
    tile.card.classList.toggle("selected", sourceId === selectedLiveCameraId);
  }
}

function updatePtzUi(): void {
  if (!PTZ_UI_ENABLED && ptzActiveSourceId) {
    ptzActiveSourceId = "";
  }
  for (const [sourceId, tile] of cameraTiles.entries()) {
    const active = PTZ_UI_ENABLED && ptzActiveSourceId === sourceId;
    tile.card.classList.toggle("ptz-active", active);
    tile.ptzButton.hidden = !PTZ_UI_ENABLED;
    tile.ptzButton.classList.toggle("active", active);
    tile.ptzButton.textContent = active ? "PTZ On" : "PTZ";
    tile.ptzZones.hidden = !PTZ_UI_ENABLED;
    tile.ptzZones.classList.toggle("ptz-visible", active);
    if (active) {
      tile.card.classList.add("overlay-visible");
    } else if (!tile.card.matches(":hover") && tile.card !== document.activeElement && !tile.card.contains(document.activeElement)) {
      tile.card.classList.remove("overlay-visible");
    }
  }
}

function clearPtzActiveSource(): void {
  const activeSourceId = ptzActiveSourceId;
  ptzActiveSourceId = "";
  const tile = activeSourceId ? cameraTiles.get(activeSourceId) : null;
  if (tile?.overlayHideTimer) {
    window.clearTimeout(tile.overlayHideTimer);
    tile.overlayHideTimer = 0;
  }
  updatePtzUi();
}

function currentPoseForSource(sourceId: string): CameraPoseView {
  return {
    ...(mountedCameraRecord(sourceId)?.currentPose || {}),
    ...(mountedCameraRecord(sourceId)?.observed?.currentPose || {}),
    ...(currentPoseBySourceId.get(sourceId) || {}),
  };
}

function desiredPoseForSource(sourceId: string): CameraPoseView {
  return {
    ...currentPoseForSource(sourceId),
    ...(desiredPoseBySourceId.get(sourceId) || {}),
  };
}

function nextPoseForStep(sourceId: string, direction: "up" | "down" | "left" | "right"): CameraPoseView {
  const current = desiredPoseForSource(sourceId);
  const next = { ...current };
  if (direction === "left") next.pan = clampPoseValue((next.pan ?? 0) - PTZ_STEP_NORMALIZED);
  if (direction === "right") next.pan = clampPoseValue((next.pan ?? 0) + PTZ_STEP_NORMALIZED);
  if (direction === "up") next.tilt = clampPoseValue((next.tilt ?? 0) + PTZ_STEP_NORMALIZED);
  if (direction === "down") next.tilt = clampPoseValue((next.tilt ?? 0) - PTZ_STEP_NORMALIZED);
  return next;
}

function clampPoseValue(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function updateLiveTileMetadata(sourceId: string): void {
  const tile = cameraTiles.get(sourceId);
  if (!tile) return;
  const info = launchCameraInfo(sourceId);
  tile.title.textContent = cameraDisplayName(sourceId);
  tile.ptzButton.hidden = !PTZ_UI_ENABLED;
  tile.ptzButton.disabled = !ptzUiInteractive(info);
  tile.ptzButton.title = PTZ_UI_ENABLED
    ? (info?.ptzCapable
      ? (info?.controlGranted ? "Toggle PTZ mode" : "PTZ is not granted for this camera")
      : "Camera does not advertise PTZ")
    : "PTZ is temporarily hidden";
  tile.ptzZones.hidden = !PTZ_UI_ENABLED;
}

async function sendPtzCommand(sourceId: string, payload: Record<string, unknown>): Promise<void> {
  const info = launchCameraInfo(sourceId);
  if (!ptzUiInteractive(info)) return;
  appendLog(`PTZ send ${cameraLabelForSource(sourceId)} ${debugJson(payload)}`);
  try {
    const result = await requestGatewaySignal("control", {
      sourceId,
      ptz: payload,
    });
    const ack = extractControlAck(result);
    appendLog(
      `PTZ ack ${cameraLabelForSource(sourceId)} `
      + `status=${ack.poseStatus || "ok"} `
      + `plane=${ack.managementPlane || "unknown"} `
      + `preempted=${ack.preempted ? "yes" : "no"} `
      + `current=${debugJson(ack.currentPose || null)} `
      + `desired=${debugJson(ack.desiredPose || null)}`,
    );
    if (ack.ptzDiagnostics != null) {
      appendLog(`PTZ diagnostics ${cameraLabelForSource(sourceId)} ${debugJson(ack.ptzDiagnostics)}`);
    }
    if (ack.currentPose) currentPoseBySourceId.set(sourceId, { ...ack.currentPose });
    if (ack.desiredPose) desiredPoseBySourceId.set(sourceId, { ...ack.desiredPose });
    if (ack.poseStatus) poseStatusBySourceId.set(sourceId, ack.poseStatus);
    const tile = ensureCameraTile(sourceId);
    tile.statusDot.title = ack.poseStatus
      ? `PTZ ${ack.poseStatus}`
      : (ack.preempted ? "PTZ commandeered" : "PTZ updated");
    showCameraOverlay(sourceId);
    if (ack.preempted) {
      addNotification("warn", `${info.name || sourceId} PTZ commandeered`, "Owner control displaced the previous holder.", "control");
    }
    renderCameraList();
  } catch (error) {
    appendLog(`PTZ failed ${cameraLabelForSource(sourceId)} ${String((error as Error)?.message || error)}`);
    setTileState(sourceId, "unavailable", "PTZ denied or preempted.");
    addNotification("bad", `${info.name || sourceId} PTZ unavailable`, String((error as Error)?.message || error), "control");
  }
}

async function stepPtz(sourceId: string, direction: "up" | "down" | "left" | "right"): Promise<void> {
  if (!PTZ_UI_ENABLED) return;
  const nextPose = nextPoseForStep(sourceId, direction);
  desiredPoseBySourceId.set(sourceId, nextPose);
  poseStatusBySourceId.set(sourceId, "moving");
  renderCameraList();
  await sendPtzCommand(sourceId, {
    targetPose: nextPose,
    step: {
      pan: direction === "left" ? -PTZ_STEP_NORMALIZED : direction === "right" ? PTZ_STEP_NORMALIZED : 0,
      tilt: direction === "up" ? PTZ_STEP_NORMALIZED : direction === "down" ? -PTZ_STEP_NORMALIZED : 0,
      zoom: 0,
    },
    mode: "step",
  });
}

function setTileState(sourceId: string, state: "waiting" | "connecting" | "live" | "unavailable", detail: string): void {
  const tile = ensureCameraTile(sourceId);
  tile.statusDot.className = `cameraStatusDot cameraStatusDot-${state}`;
  tile.statusDot.title = detail;
  tile.card.dataset.state = state;
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
    if (tile.card.dataset.state === "live") return true;
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

function debugJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
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

function extractControlAck(result: GatewaySignalResult): {
  preempted: boolean;
  currentPose?: CameraPoseView;
  desiredPose?: CameraPoseView;
  poseStatus?: string;
  managementPlane?: string;
  ptzDiagnostics?: unknown;
} {
  const outer = (result && typeof result === "object" ? result : {}) as Record<string, unknown>;
  const root = ((outer.result && typeof outer.result === "object") ? outer.result : outer) as Record<string, unknown>;
  const payload = (root.payload || root.result || root) as Record<string, unknown>;
  return {
    preempted: payload.preempted === true,
    currentPose: payload.currentPose && typeof payload.currentPose === "object" ? payload.currentPose as CameraPoseView : undefined,
    desiredPose: payload.desiredPose && typeof payload.desiredPose === "object" ? payload.desiredPose as CameraPoseView : undefined,
    poseStatus: String(payload.poseStatus || "").trim() || undefined,
    managementPlane: String(payload.managementPlane || "").trim() || undefined,
    ptzDiagnostics: payload.ptzDiagnostics,
  };
}

function renderKvRow(label: string, value: string): string {
  return `
    <div class="kv">
      <div class="k">${escapeHtml(label)}</div>
      <div class="v">${escapeHtml(value)}</div>
    </div>
  `;
}

function formatPose(pose: CameraPoseView | null | undefined, status = ""): string {
  const pan = typeof pose?.pan === "number" ? pose.pan.toFixed(2) : "—";
  const tilt = typeof pose?.tilt === "number" ? pose.tilt.toFixed(2) : "—";
  const suffix = status ? ` • ${status}` : "";
  return `pan ${pan} • tilt ${tilt}${suffix}`;
}

function renderNvrSettingsSummary(): void {
  if (!nvrSettingsSummaryEl || !launchContext) return;
  const display = launchContext.display || {};
  const grantedScope = display.grantedScope || {};
  const network = cameraInventory?.cameraNetwork || {};
  const accessSummary = nvrAccessSummary();
  nvrSettingsSummaryEl.innerHTML = `
    <section class="nestedPanel">
      <div class="summaryLabel">Service</div>
      ${renderKvRow("Label", serviceLabelForContext(launchContext))}
      ${renderKvRow("Service", String(display.service || launchContext.service || "nvr"))}
      ${renderKvRow("Version", String(display.serviceVersion || "unknown"))}
      ${renderKvRow("Health", String(display.status || "online"))}
      ${viewerIsOwner() ? renderKvRow("Admin", cameraInventoryError ? "gateway update required" : "available") : ""}
    </section>
    <section class="nestedPanel">
      <div class="summaryLabel">Gateway</div>
      ${renderKvRow("Gateway", gatewayLabelForContext(launchContext))}
      ${renderKvRow("Launch scope", viewerIsOwner() ? "owner" : "granted")}
      ${renderKvRow("Access", accessSummary)}
      ${!viewerIsOwner() ? renderKvRow("Live scope", formatCameraScope(grantedScope.viewSources || []) || "granted cameras") : ""}
      ${!viewerIsOwner() && PTZ_UI_ENABLED ? renderKvRow("PTZ scope", formatCameraScope(grantedScope.controlSources || []) || "none") : ""}
    </section>
    ${
      viewerIsOwner()
        ? `<section class="nestedPanel">
      <div class="summaryLabel">Camera Network</div>
      ${renderKvRow("Managed", network.managed ? "yes" : "no")}
      ${renderKvRow("Interface", String(network.interface || "not configured"))}
      ${renderKvRow("Subnet", String(network.subnetCidr || "not configured"))}
      ${renderKvRow("Host IP", String(network.hostIp || "not configured"))}
      ${renderKvRow("DHCP", network.dhcpEnabled ? `${String(network.dhcpRangeStart || "—")} → ${String(network.dhcpRangeEnd || "—")}` : "disabled")}
      ${renderKvRow("NTP", network.ntpEnabled ? String(network.ntpServer || "enabled") : "disabled")}
      ${renderKvRow("DNS", String(network.dnsServer || "not configured"))}
      ${cameraInventoryError ? `<p class="panelHint warnText">${escapeHtml(cameraInventoryError)}</p>` : ""}
    </section>`
        : ""
    }
  `;
}

async function fetchGrantInventory(): Promise<void> {
  if (!viewerIsOwner()) {
    grantInventory = null;
    return;
  }
  try {
    const result = await requestGatewayGrantAction("list_grants");
    const payload = (result.result && typeof result.result === "object") ? result.result as Record<string, unknown> : {};
    grantInventory = {
      grants: Array.isArray(payload.grants) ? payload.grants as GatewayGrantRecord[] : [],
      availableCameras: Array.isArray(payload.availableCameras) ? payload.availableCameras as CameraGrantView[] : [],
    };
  } catch (error) {
    grantInventory = { grants: [], availableCameras: settingsCameraRows() };
  }
}

function nvrAccessSummary(): string {
  if (viewerIsOwner()) {
    const shareCount = grantInventory?.grants?.length || 0;
    return shareCount > 0
      ? `Owner control • shared with ${shareCount} identit${shareCount === 1 ? "y" : "ies"}`
      : "Owner control";
  }
  const grantedScope = launchContext?.display?.grantedScope || {};
  const live = formatCameraScope(grantedScope.viewSources || []) || "granted cameras";
  if (!PTZ_UI_ENABLED) {
    return `Granted access • live ${live}`;
  }
  const ptz = formatCameraScope(grantedScope.controlSources || []) || "none";
  return `Granted access • live ${live} • PTZ ${ptz}`;
}

function cameraAccessSummary(camera: LaunchCameraDisplay | null): string {
  if (!camera) return "Access unavailable";
  if (viewerIsOwner()) {
    const shareCount = (grantInventory?.grants || []).filter((grant) => {
      const view = normalizeSourceIds(grant.viewSources || []);
      const control = normalizeSourceIds(grant.controlSources || []);
      return view.includes(String(camera.sourceId || "")) || control.includes(String(camera.sourceId || ""));
    }).length;
    return shareCount > 0 ? `Owner control • shared with ${shareCount} identit${shareCount === 1 ? "y" : "ies"}` : "Owner control";
  }
  if (camera.viewGranted === false) return "View blocked";
  if (!PTZ_UI_ENABLED) return "Live view granted";
  if (camera.controlGranted) return "Live view and PTZ granted";
  if (camera.ptzCapable) return "Live view granted • PTZ not granted";
  return "Live view granted";
}

function renderCameraList(): void {
  cameraListEl.innerHTML = "";
  if (!launchContext) return;
  if (cameraInventoryLoading) {
    cameraListEl.innerHTML = `<article class="emptyState emptyStateTight"><strong>Refreshing cameras</strong><p>Reading mounted cameras and discovery candidates from the managed NVR service.</p></article>`;
    return;
  }
  if (viewerIsOwner() && cameraInventoryError) {
    const warning = document.createElement("section");
    warning.className = "nestedPanel";
    warning.innerHTML = `
      <div class="summaryLabel">Camera Administration</div>
      <p class="panelHint warnText">${escapeHtml(cameraInventoryError)}</p>
    `;
    cameraListEl.appendChild(warning);
  }
  const cameras = settingsCameraRows()
    .map((row) => launchCameraInfo(String(row.sourceId || "").trim()) || {
      sourceId: row.sourceId,
      name: row.name,
      viewGranted: true,
      controlGranted: false,
      ptzCapable: row.ptzCapable,
    })
    .sort((left, right) => String(left.name || left.sourceId || "").localeCompare(String(right.name || right.sourceId || "")));
  if (cameras.length === 0) {
    cameraListEl.innerHTML = `<article class="emptyState emptyStateTight"><strong>No cameras</strong><p>Camera inventory appears here once the service reports sources.</p></article>`;
  } else {
    for (const camera of cameras) {
      const sourceId = String(camera.sourceId || "").trim();
      if (!sourceId) continue;
      const info = launchCameraInfo(sourceId) || camera;
      const mounted = mountedCameraRecord(sourceId);
      const item = document.createElement("article");
      item.className = "cameraListItem";
      const expanded = currentActivity === "settings" && currentSettingsTab === "cameras" && selectedCameraId === sourceId;
      item.classList.toggle("expanded", expanded);
      const vendor = String(mounted?.vendor || mounted?.observed?.vendor || "").trim();
      const model = String(mounted?.model || mounted?.observed?.model || "").trim();
      const meta = [vendor, model].filter(Boolean).join(" • ") || "Managed camera";
      const access = cameraAccessSummary(info);
      item.innerHTML = `
        <div class="cameraListHeader">
          <div class="cameraListHeading">
            <strong>${escapeHtml(String(info.name || "Camera"))}</strong>
            <div class="cameraListMeta">${escapeHtml(meta)}</div>
            <div class="panelHint">${escapeHtml(access)}</div>
          </div>
        </div>
        <div class="cameraCapabilities">
          ${PTZ_UI_ENABLED && info.ptzCapable ? `<span class="cameraCapabilityChip ${info.controlGranted ? "good" : "warn"}">PTZ</span>` : ""}
          ${
            mounted?.verification?.status
              ? `<span class="cameraCapabilityChip ${mounted.verification.status === "verified" ? "good" : mounted.verification.status === "drift" ? "warn" : "bad"}">${escapeHtml(mounted.verification.status)}</span>`
              : ""
          }
          ${
            mounted?.credentialSafety?.pending
              ? `<span class="cameraCapabilityChip warn">credential rotation pending</span>`
              : mounted?.credentialSafety?.status === "recovered"
                ? `<span class="cameraCapabilityChip warn">credential recovered</span>`
                : mounted?.credentialSafety?.status === "failed"
                  ? `<span class="cameraCapabilityChip bad">credential attention</span>`
                  : ""
          }
        </div>
        <div class="cameraListActions">
          <button type="button" class="cameraActionButton" data-action="launch" title="Focus this camera in Live">↗</button>
          <button type="button" class="cameraActionButton" data-action="settings" title="Camera settings">⚙</button>
        </div>
      `;
      item.querySelector<HTMLButtonElement>("button[data-action='launch']")?.addEventListener("click", () => {
        selectedLiveCameraId = sourceId;
        updateTileSelection();
        setActivity("live");
      });
      item.querySelector<HTMLButtonElement>("button[data-action='settings']")?.addEventListener("click", () => {
        openCameraSettings(sourceId);
      });
      if (expanded) {
        item.appendChild(buildCameraSettingsTray(sourceId));
      }
      cameraListEl.appendChild(item);
    }
  }

  if (viewerIsOwner() && cameraInventory?.candidates?.length) {
    const section = document.createElement("section");
    section.className = "nestedPanel";
    section.innerHTML = `<div class="summaryLabel">Discovery Candidates</div>`;
    for (const candidate of cameraInventory.candidates) {
      const candidateId = String(candidate.candidateId || "").trim();
      if (!candidateId) continue;
      const item = document.createElement("div");
      item.className = "cameraCandidateItem";
      const draft = candidateMountDraft(candidateId, candidate);
      const expanded = expandedCandidateId === candidateId;
      const probeResult = probeResultFor(`candidate:${candidateId}`);
      const candidateLabel = String(candidate.signatures?.model || candidate.signatures?.publicTitle || candidate.leaseHostname || "Camera").trim();
      const candidateMeta = [candidate.signatures?.vendor, candidate.driverMatch?.driverId || "unmatched"].filter(Boolean).join(" • ");
      item.innerHTML = `
        <div class="cameraCandidateHeader">
          <span>
            <strong>${escapeHtml(candidateLabel)}</strong>
            <span class="panelHint">${escapeHtml(candidateMeta)}${candidate.driverMatch?.reason ? ` • ${escapeHtml(String(candidate.driverMatch.reason))}` : ""}</span>
          </span>
          <div class="permissionCardActions">
            <button type="button" class="secondary" data-action="probe" ${ownerCanAdmin() ? "" : "disabled"}>Probe</button>
            <button type="button" class="secondary" data-action="mount" ${candidate.driverMatch?.mountable && ownerCanAdmin() ? "" : "disabled"}>${expanded ? "Hide" : "Mount"}</button>
          </div>
        </div>
        ${
          expanded
            ? `<section class="permissionComposer cameraCandidateComposer">
            <label>
              <span>Name</span>
              <input data-field="displayName" type="text" value="${escapeHtml(draft.displayName)}" />
            </label>
            <label>
              <span>Username</span>
              <input data-field="username" type="text" value="${escapeHtml(draft.username)}" />
            </label>
            <label>
              <span>Password</span>
              <input data-field="password" type="password" value="${escapeHtml(draft.password)}" />
            </label>
            <label>
              <span>Desired Password</span>
              <input data-field="desiredPassword" type="password" value="${escapeHtml(draft.desiredPassword)}" />
            </label>
            <label>
              <span>RTSP Override</span>
              <input data-field="rtspUrl" type="text" value="${escapeHtml(draft.rtspUrl)}" placeholder="Optional RTSP URL override" />
            </label>
            <label class="cameraCheckboxRow">
              <input data-field="generatePassword" type="checkbox" ${draft.generatePassword ? "checked" : ""} />
              <span>Generate a managed password during mount</span>
            </label>
            <div class="permissionCardActions">
              <button type="button" class="secondary" data-action="mount-submit" ${candidate.driverMatch?.mountable ? "" : "disabled"}>Mount Camera</button>
            </div>
          </section>`
            : ""
        }
        ${
          probeResult
            ? `<div class="probeSummary ${probeResult.tone}">${escapeHtml(probeResult.summary)} — ${escapeHtml(probeResult.detail)}</div>
               <pre class="probeOutput">${escapeHtml(JSON.stringify(probeResult.payload, null, 2))}</pre>`
            : ""
        }
      `;
      item.querySelector<HTMLButtonElement>("button[data-action='probe']")?.addEventListener("click", () => {
        void runCandidateProbe(candidateId).then(() => {
          renderCameraList();
        }).catch((error) => {
          addNotification("bad", "Probe failed", String((error as Error)?.message || error), "camera");
        });
      });
      item.querySelector<HTMLButtonElement>("button[data-action='mount']")?.addEventListener("click", () => {
        expandedCandidateId = expanded ? "" : candidateId;
        renderCameraList();
      });
      for (const input of Array.from(item.querySelectorAll<HTMLInputElement>("[data-field]"))) {
        const field = String(input.dataset.field || "").trim() as keyof CandidateMountDraft;
        input.addEventListener("input", () => {
          const value = input.type === "checkbox" ? input.checked : input.value;
          updateCandidateMountDraft(candidateId, { [field]: value } as Partial<CandidateMountDraft>);
        });
      }
      item.querySelector<HTMLButtonElement>("button[data-action='mount-submit']")?.addEventListener("click", () => {
        void mountCameraCandidate(candidateId).catch((error) => {
          addNotification("bad", "Mount failed", String((error as Error)?.message || error), "camera");
        });
      });
      section.appendChild(item);
    }
    cameraListEl.appendChild(section);
  }
}

function buildCameraSettingsTray(sourceId: string): HTMLElement {
  const camera = launchCameraInfo(sourceId);
  const mounted = mountedCameraRecord(sourceId);
  const caps = mounted?.capabilities || {};
  const canAdmin = ownerCanAdmin();
  const adminBlocked = viewerIsOwner() && !canAdmin;
  const tray = document.createElement("section");
  tray.className = "cameraSettingsTray";
  if (!camera) {
    tray.innerHTML = `<article class="emptyState emptyStateTight"><strong>Camera not found</strong><p>Select another camera to continue.</p></article>`;
    return tray;
  }

  const draft = cameraSettingsDraft(sourceId);
  const vendor = String(mounted?.vendor || mounted?.observed?.vendor || "").trim() || "Reolink";
  const model = String(mounted?.model || mounted?.observed?.model || "").trim() || "E1 Outdoor SE";
  const driverId = String(mounted?.driverId || mounted?.observed?.driverId || "").trim() || "reolink";
  const currentPose = currentPoseBySourceId.get(sourceId) || mounted?.currentPose || mounted?.observed?.currentPose || {};
  const poseStatus = String(poseStatusBySourceId.get(sourceId) || mounted?.poseStatus || mounted?.observed?.poseStatus || "idle").trim() || "idle";

  const summaryPanel = document.createElement("section");
  summaryPanel.className = "nestedPanel";
  summaryPanel.innerHTML = `
    <div class="summaryLabel">Camera Summary</div>
    ${renderKvRow("Driver", driverId)}
    ${renderKvRow("Model", model)}
    ${renderKvRow("Access", cameraAccessSummary(camera))}
    ${PTZ_UI_ENABLED ? renderKvRow("PTZ", camera.ptzCapable ? (camera.controlGranted ? "owner control ready" : "available") : "not supported") : ""}
    ${renderKvRow("Pose", formatPose(currentPose, poseStatus))}
  `;
  tray.appendChild(summaryPanel);

  if (adminBlocked) {
    const blockedPanel = document.createElement("section");
    blockedPanel.className = "nestedPanel";
    blockedPanel.innerHTML = `
      <div class="summaryLabel">Administration</div>
      <p class="panelHint warnText">${escapeHtml(cameraInventoryError || "Camera administration is unavailable right now.")}</p>
    `;
    tray.appendChild(blockedPanel);
  }

  const generalPanel = document.createElement("section");
  generalPanel.className = "cameraSection";
  generalPanel.innerHTML = `
    <div class="summaryLabel">General</div>
    <div class="cameraSectionBody cameraConfigGrid">
      <label>
        <span>Name</span>
        <input data-field="displayName" type="text" value="${escapeHtml(draft.displayName)}" ${canAdmin ? "" : "disabled"} />
      </label>
    </div>
  `;
  tray.appendChild(generalPanel);

  if (caps.timeSync || caps.manualTime || caps.timezone || caps.overlayText || caps.overlayTimestamp) {
    const timePanel = document.createElement("section");
    timePanel.className = "cameraSection";
    timePanel.innerHTML = `
      <div class="summaryLabel">Time & Overlay</div>
      <div class="cameraSectionBody cameraConfigGrid">
        ${
          caps.timeSync || caps.manualTime
            ? `<label>
          <span>Clock Mode</span>
          <select data-field="timeMode" ${canAdmin ? "" : "disabled"}>
            ${caps.timeSync ? `<option value="ntp" ${draft.timeMode === "ntp" ? "selected" : ""}>NTP</option>` : ""}
            ${caps.manualTime ? `<option value="manual" ${draft.timeMode === "manual" ? "selected" : ""}>Manual</option>` : ""}
          </select>
        </label>`
            : ""
        }
        ${caps.timeSync ? `<label><span>NTP Server</span><input data-field="ntpServer" type="text" value="${escapeHtml(draft.ntpServer)}" ${canAdmin ? "" : "disabled"} /></label>` : ""}
        ${caps.timezone ? `<label><span>Timezone</span><input data-field="timezone" type="text" value="${escapeHtml(draft.timezone)}" ${canAdmin ? "" : "disabled"} /></label>` : ""}
        ${caps.manualTime ? `<label><span>Manual Time</span><input data-field="manualTime" type="datetime-local" value="${escapeHtml(draft.manualTime)}" ${canAdmin ? "" : "disabled"} /></label>` : ""}
        ${caps.overlayText ? `<label class="cameraConfigWide"><span>Overlay Text</span><input data-field="overlayText" type="text" value="${escapeHtml(draft.overlayText)}" ${canAdmin ? "" : "disabled"} /></label>` : ""}
        ${caps.overlayTimestamp ? `<label class="cameraCheckboxRow"><input data-field="overlayTimestamp" type="checkbox" ${draft.overlayTimestamp ? "checked" : ""} ${canAdmin ? "" : "disabled"} /><span>Show timestamp overlay</span></label>` : ""}
      </div>
    `;
    tray.appendChild(timePanel);
  }

  if (caps.passwordRotate || caps.hardeningProfile) {
    const securityPanel = document.createElement("section");
    securityPanel.className = "cameraSection";
    securityPanel.innerHTML = `
      <div class="summaryLabel">Security & Network</div>
      <div class="cameraSectionBody cameraConfigGrid">
        ${
          caps.passwordRotate
            ? `<label><span>Desired Password</span><input data-field="desiredPassword" type="password" value="${escapeHtml(draft.desiredPassword)}" ${canAdmin ? "" : "disabled"} /></label>
               <label class="cameraCheckboxRow"><input data-field="generatePassword" type="checkbox" ${draft.generatePassword ? "checked" : ""} ${canAdmin ? "" : "disabled"} /><span>Generate password</span></label>`
            : ""
        }
        ${
          caps.hardeningProfile
            ? `<label class="cameraCheckboxRow"><input data-field="enableOnvif" type="checkbox" ${draft.enableOnvif ? "checked" : ""} ${canAdmin ? "" : "disabled"} /><span>Keep ONVIF enabled</span></label>
               <label class="cameraCheckboxRow"><input data-field="enableRtsp" type="checkbox" ${draft.enableRtsp ? "checked" : ""} ${canAdmin ? "" : "disabled"} /><span>Keep RTSP enabled</span></label>
               <label class="cameraCheckboxRow"><input data-field="disableP2p" type="checkbox" ${draft.disableP2p ? "checked" : ""} ${canAdmin ? "" : "disabled"} /><span>Disable P2P</span></label>
               <label class="cameraCheckboxRow"><input data-field="disableHttp" type="checkbox" ${draft.disableHttp ? "checked" : ""} ${canAdmin ? "" : "disabled"} /><span>Disable HTTP</span></label>
               <label class="cameraCheckboxRow"><input data-field="disableHttps" type="checkbox" ${draft.disableHttps ? "checked" : ""} ${canAdmin ? "" : "disabled"} /><span>Disable HTTPS</span></label>
               <label class="cameraCheckboxRow"><input data-field="preserveProprietary9000" type="checkbox" ${draft.preserveProprietary9000 ? "checked" : ""} ${canAdmin ? "" : "disabled"} /><span>Keep port 9000</span></label>`
            : ""
        }
      </div>
    `;
    if (caps.passwordRotate) {
      const credentialState = mounted?.credentialSafety;
      const credentialPanel = document.createElement("div");
      credentialPanel.className = "panelHint";
      credentialPanel.textContent =
        credentialState?.pending
          ? `Credential rotation pending. ${credentialState.historyDepth || 0} stored credential entr${credentialState?.historyDepth === 1 ? "y" : "ies"} retained for recovery.`
          : credentialState?.status === "recovered"
            ? `Recovered with stored credential history. ${credentialState.historyDepth || 0} stored credential entr${credentialState?.historyDepth === 1 ? "y" : "ies"} retained.`
            : credentialState?.status === "failed"
              ? `Credential rotation needs attention. ${credentialState.lastError || "Stored credential history is available for recovery."}`
              : `Stored credential history protects failed rotations from locking you out. ${credentialState?.historyDepth || 0} stored credential entr${credentialState?.historyDepth === 1 ? "y" : "ies"} available.`;
      securityPanel.appendChild(credentialPanel);
    }
    tray.appendChild(securityPanel);
  }

  const accessPanel = document.createElement("section");
  accessPanel.className = "cameraSection";
  accessPanel.innerHTML = `
    <div class="summaryLabel">Access</div>
    <div class="cameraAccessSummary">
      <span class="permissionChip ${camera.viewGranted === false ? "bad" : "good"}">${escapeHtml(cameraAccessSummary(camera))}</span>
      ${PTZ_UI_ENABLED && camera.ptzCapable ? `<span class="permissionChip ${camera.controlGranted ? "good" : "warn"}">${camera.controlGranted ? "PTZ ready" : "PTZ available"}</span>` : ""}
    </div>
    <div class="panelHint">${viewerIsOwner() ? "Access is summarized here for the owner pass. Full grant editing lands later." : "This is your current effective access for this camera."}</div>
  `;
  tray.appendChild(accessPanel);

  const configRoot = tray;
  for (const input of Array.from(configRoot.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-field]"))) {
    const field = String(input.dataset.field || "").trim() as keyof CameraSettingsDraft;
    input.addEventListener("input", () => {
      const value = input instanceof HTMLInputElement && input.type === "checkbox" ? input.checked : input.value;
      updateCameraSettingsDraft(sourceId, { [field]: value } as Partial<CameraSettingsDraft>);
      if (field === "displayName") {
        const next = cameraSettingsDraft(sourceId);
        cameraNameOverrides.set(sourceId, next.displayName.trim() || cameraDisplayName(sourceId));
        renderCameraList();
        updateLiveTileMetadata(sourceId);
      }
    });
  }
  if (canAdmin) {
    const saveRow = document.createElement("div");
    saveRow.className = "cameraSectionActions";
    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.className = "secondary";
    saveButton.textContent = "Save Camera Settings";
    saveButton.addEventListener("click", () => {
      void saveCameraSettings(sourceId).catch((error) => {
        addNotification("bad", "Camera save failed", String((error as Error)?.message || error), "camera", {
          activity: "settings",
          settingsTab: "cameras",
          cameraId: sourceId,
        });
      });
    });
    saveRow.appendChild(saveButton);
    tray.appendChild(saveRow);
  }

  const timeModeInput = tray.querySelector<HTMLSelectElement>("select[data-field='timeMode']");
  const ntpInput = tray.querySelector<HTMLInputElement>("input[data-field='ntpServer']");
  const manualInput = tray.querySelector<HTMLInputElement>("input[data-field='manualTime']");
  const applyTimeMode = () => {
    const mode = String(timeModeInput?.value || draft.timeMode);
    if (ntpInput) ntpInput.disabled = !canAdmin || mode !== "ntp";
    if (manualInput) manualInput.disabled = !canAdmin || mode !== "manual";
  };
  applyTimeMode();
  timeModeInput?.addEventListener("change", applyTimeMode);

  if (caps.rawProbe && viewerIsOwner()) {
    const probePanel = document.createElement("section");
    probePanel.className = "cameraSection";
    const result = probeResultFor(`mounted:${sourceId}`);
    probePanel.innerHTML = `
      <div class="summaryLabel">Advanced Probe</div>
      <div class="cameraSectionActions">
        <button type="button" class="secondary" data-action="probe" ${canAdmin ? "" : "disabled"}>Run Raw Probe</button>
      </div>
      ${
        adminBlocked
          ? `<p class="panelHint warnText">${escapeHtml(cameraInventoryError || "Camera administration is unavailable.")}</p>`
          : `<p class="panelHint">Read current driver-backed state and inspect structured raw payloads when something looks off.</p>`
      }
      ${
        result
          ? `<div class="probeSummary ${result.tone}">${escapeHtml(result.summary)} — ${escapeHtml(result.detail)}</div>
             <pre class="probeOutput">${escapeHtml(JSON.stringify(result.payload, null, 2))}</pre>`
          : ""
      }
    `;
    probePanel.querySelector<HTMLButtonElement>("button[data-action='probe']")?.addEventListener("click", () => {
      void runMountedCameraProbe(sourceId).then(() => {
        renderCameraList();
      }).catch((error) => {
        addNotification("bad", "Probe failed", String((error as Error)?.message || error), "camera", {
          activity: "settings",
          settingsTab: "cameras",
          cameraId: sourceId,
        });
      });
    });
    tray.appendChild(probePanel);
  }
  return tray;
}

function refreshSummary(context: LaunchContext): void {
  const display = context.display || {};
  rememberResolvedResourceName(context.servicePk, display.serviceLabel);
  launchCameraInfoBySourceId.clear();
  for (const camera of normalizeLaunchCameraEntries(display)) {
    launchCameraInfoBySourceId.set(String(camera.sourceId || "").trim(), camera);
  }
  subtitleEl.textContent = `${serviceLabelForContext(context)} • ${gatewayLabelForContext(context)} • ${String(
    display.cameraCount
    || normalizeLaunchCameraEntries(display).length
    || display.configuredSources
    || normalizeSourceIds(display.sources).length
    || 0,
  )} camera${Number(
    display.cameraCount
    || normalizeLaunchCameraEntries(display).length
    || display.configuredSources
    || normalizeSourceIds(display.sources).length
    || 0,
  ) === 1 ? "" : "s"}`;
  summaryGatewayEl.textContent = gatewayLabelForContext(context);
  summaryGatewayEl.title = context.gatewayPk;
  summaryServiceEl.textContent = serviceLabelForContext(context);
  summaryServiceEl.title = context.servicePk;
  summaryCamerasEl.textContent = String(
    display.cameraCount
    || normalizeLaunchCameraEntries(display).length
    || display.configuredSources
    || normalizeSourceIds(display.sources).length
    || 0,
  );
  popGatewayEl.textContent = gatewayLabelForContext(context);
  popServicesEl.textContent = `${summaryCamerasEl.textContent} camera${summaryCamerasEl.textContent === "1" ? "" : "s"}`;
  refreshIdentityHandle();
  for (const sourceId of cameraTiles.keys()) {
    updateLiveTileMetadata(sourceId);
  }
  renderNvrSettingsSummary();
  renderCameraList();
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
    setConnectionState("no cameras", "warn");
    setDrawerStatus("No enabled camera sources were advertised by the NVR service.");
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

  gridHintEl.textContent = "Preparing camera previews.";
  setConnectionState("negotiating", "warn");
  setDrawerStatus("Negotiating live preview through the owned gateway.");
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
    setConnectionState("live", "good");
    setDrawerStatus("Live preview connected.");
    setSummaryState("live");
    gridHintEl.textContent = "Move within a preview to reveal controls.";
    void reportServiceStatus("live", "Receiving live H.264 preview.", "webrtc_media");
  });

  peerConnection.addEventListener("connectionstatechange", () => {
    const state = peerConnection?.connectionState || "unknown";
    appendLog(`peer connection state -> ${state}`);
    if (state === "failed" || state === "disconnected") {
      setConnectionState(state, "bad");
      setDrawerStatus(`Peer connection ${state}.`);
      setSummaryState(state);
      markAllTiles("unavailable", "Peer connection dropped.");
      addNotification("bad", "Peer connection dropped", `Peer connection ${state}.`, "app");
      void reportServiceStatus("degraded", `Peer connection ${state}.`, "webrtc_media");
    }
  });

  peerConnection.addEventListener("iceconnectionstatechange", () => {
    const state = peerConnection?.iceConnectionState || "unknown";
    appendLog(`ice connection state -> ${state}`);
    if (state === "checking") {
      setConnectionState("checking", "warn");
      setDrawerStatus("Checking ICE connectivity.");
      setSummaryState("checking");
    } else if (state === "connected" || state === "completed") {
      setConnectionState("connected", "good");
      setDrawerStatus("WebRTC peer connection established.");
      setSummaryState("connected");
      void reportServiceStatus("connected", "WebRTC peer connection established.", "webrtc_media");
    } else if (state === "failed") {
      setConnectionState("failed", "bad");
      setDrawerStatus("ICE connectivity failed.");
      setSummaryState("failed");
      markAllTiles("unavailable", "ICE connectivity failed.");
      addNotification("bad", "ICE failed", "WebRTC ICE connectivity failed for the managed preview.", "app");
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
    setConnectionState("connecting", "warn");
    setDrawerStatus("Waiting for live media tracks.");
    setSummaryState("connecting");
  }
}

async function reconnect(): Promise<void> {
  setBootSplash("Connecting", launchContext ? "Reconnecting live preview…" : "Restoring launch context…");
  if (!launchContext) {
    launchContext = await loadLaunchContext();
  }
  refreshSummary(launchContext);
  await fetchGrantInventory();
  await refreshCameraInventory();
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

function bindUi(): void {
  btnReconnect.addEventListener("click", () => {
    void reconnect();
  });

  btnBellEl.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleNotificationMenu();
  });
  btnNotifClearEl.addEventListener("click", () => {
    notifications.splice(0, notifications.length);
    renderNotifications();
  });

  closeAppButtonEl.addEventListener("click", () => {
    void focusShellAndClose();
  });

  btnMenuEl.addEventListener("click", openDrawer);
  btnDrawerCloseEl.addEventListener("click", closeDrawer);
  drawerBackdropEl.addEventListener("click", closeDrawer);
  document.addEventListener("click", (event) => {
    if (notificationMenuOpen && !notifMenuEl.contains(event.target as Node) && !btnBellEl.contains(event.target as Node)) {
      closeNotificationMenu();
    }
  });

  connWrapEl.addEventListener("mouseenter", () => connPopoverEl.classList.remove("hidden"));
  connWrapEl.addEventListener("mouseleave", () => connPopoverEl.classList.add("hidden"));
  identityHandleEl.addEventListener("click", async () => {
    const identityId = String(launchContext?.identityId || "").trim();
    if (!identityId) return;
    try {
      await navigator.clipboard.writeText(identityId);
      identityHandleCopied = true;
      refreshIdentityHandle();
    } catch {}
  });
  identityHandleEl.addEventListener("mouseleave", resetIdentityHandleCopyHint);

  navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setActivity((button.dataset.activity || "live") as NvrActivity);
      closeDrawer();
    });
  });

  settingsTabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setSettingsTab((button.dataset.settingsTab || "nvr") as NvrSettingsTab);
    });
  });

  addCameraButtonEl.addEventListener("click", () => {
    void refreshCameraInventory().then(() => {
    }).catch((error) => {
      addNotification("bad", "Camera refresh failed", String((error as Error)?.message || error), "camera", {
        activity: "settings",
        settingsTab: "cameras",
      });
    });
  });
}

window.addEventListener("keydown", (event) => {
  if (!PTZ_UI_ENABLED) return;
  if (!ptzActiveSourceId || currentActivity !== "live") return;
  if (event.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
  const map: Record<string, string> = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
  };
  const direction = map[event.key];
  if (!direction) return;
  event.preventDefault();
  showCameraOverlay(ptzActiveSourceId);
});

window.addEventListener("keyup", (event) => {
  if (!PTZ_UI_ENABLED) return;
  if (!ptzActiveSourceId || currentActivity !== "live") return;
  if (event.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
  const map: Record<string, "up" | "down" | "left" | "right"> = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
  };
  const direction = map[event.key];
  if (!direction) return;
  event.preventDefault();
  void stepPtz(ptzActiveSourceId, direction).catch(() => {});
});

window.addEventListener("hashchange", () => syncUiToHash());

window.addEventListener("beforeunload", () => {
  void reportServiceStatus("idle", "Constitute NVR window closed.", "gateway_signal");
  fireAndForgetSessionClose();
  closePeerConnection();
});

installDiagnosticsBridge();
applyDiagnosticsMode();
updateCloseAppButton();
bindUi();
setDrawerStatus("Waiting for managed launch context.");
renderNotifications();
refreshIdentityHandle();
syncUiToHash();

async function bootstrap(): Promise<void> {
  setBootSplash("Connecting", "Preparing your Constitute NVR view.");
  setConnectionState("loading", "neutral");
  setDrawerStatus("Preparing your Constitute NVR view.");
  setSummaryState("loading");
  app.dataset.launchStage = "launch_context";
  appendLog("bootstrapping managed NVR app surface");
  void reportServiceStatus("loading", "Bootstrapping managed NVR app surface.", "launch_context");

  launchContext = await loadLaunchContext();
  launchContext = await persistLaunchContext(launchContext);
  setBootSplash("Connecting", "Launch context restored. Negotiating live preview…");
  appendLog(`launch context loaded for service ${pkLabel(launchContext.servicePk)}`);
  refreshSummary(launchContext);
  await fetchGrantInventory();
  await refreshCameraInventory();
  syncUiToHash();
  await reconnect();
  dismissBootSplash();
}

void bootstrap().catch((error) => {
  const launchFailure = asManagedLaunchError(error, "launch_context");
  console.error(launchFailure);
  closePeerConnection();
  dismissBootSplash();
  setConnectionState("error", "bad");
  setDrawerStatus(launchFailure.detail);
  setSummaryState("error");
  app.dataset.launchStage = launchFailure.stage;
  const message = launchFailure.detail;
  subtitleEl.textContent = "Managed launch failed.";
  gridHintEl.textContent = message;
  setGridEmpty("Launch Failed", `${launchFailure.stage}: ${message}`);
  addNotification("bad", "Managed launch failed", message, "app");
  appendLog(`fatal [${launchFailure.stage}] ${message}`);
  void reportServiceStatus("error", message, launchFailure.stage);
});
