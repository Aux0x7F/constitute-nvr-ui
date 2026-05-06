import "constitute-ui/styles.css";
import "./styles.css";
import { renderActionList, renderAccountCenterSummary, setConnectionStateText } from "constitute-ui";
import { BROKER } from "constitute-protocol";
import { renderShell } from "./shell";

type IceServerHints = {
  stun?: string[];
  turn?: string[];
};

type ServiceAccessCameraDisplay = {
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

type ServiceAccessDisplay = {
  serviceLabel?: string;
  serviceVersion?: string;
  service?: string;
  status?: string;
  cameraCount?: number;
  configuredSources?: number;
  sources?: string[];
  cameras?: ServiceAccessCameraDisplay[];
  iceServers?: IceServerHints;
  grantedScope?: GrantedScope;
};

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
  display?: ServiceAccessDisplay;
  createdAt: number;
  expiresAt: number;
};

type ServiceAccessStage =
  | "surface_load"
  | "service_access_context"
  | "service_access_authorization"
  | "service_signal"
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

type GatewayServiceAccessResult = {
  requestId: string;
  gatewayPk: string;
  servicePk: string;
  service: string;
  capability: string;
  serviceCapability: string;
  display?: ServiceAccessDisplay;
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
  timezone?: string;
  dnsServer?: string;
  leaseFile?: string;
};

type CameraInventoryRecord = {
  mountedDevices: MountedCameraRecord[];
  candidateDevices: DiscoveryCandidateRecord[];
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
  buildId?: string;
  updatedAt?: number;
  shell?: Record<string, unknown> | null;
  services?: Record<string, unknown>;
  managedAppliances?: {
    owned?: Array<Record<string, unknown>>;
    granted?: Array<Record<string, unknown>>;
    discoverable?: Array<Record<string, unknown>>;
  };
  resourceNames?: Record<string, unknown>;
  managedServiceIssue?: Record<string, unknown> | null;
  serviceAccessContextCount?: number;
};

type ManagedApplianceRecord = Record<string, unknown> & {
  __scope?: string;
};

type CameraSettingsDraft = {
  displayName: string;
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

type CameraSettingsFocusSnapshot = {
  sourceId: string;
  field: string;
  selectionStart: number | null;
  selectionEnd: number | null;
};

const DIAGNOSTICS_STORAGE_KEY = "constitute.nvr.diagnostics";
const SERVICE_ACCESS_REQUEST_TIMEOUT_MS = 6_000;
const SERVICE_ACCESS_REFRESH_TIMEOUT_MS = 20_000;
const SIGNAL_REQUEST_TIMEOUT_MS = 30_000;
const ADMIN_SIGNAL_REQUEST_TIMEOUT_MS = 135_000;
const CAMERA_APPLY_REQUEST_TIMEOUT_MS = 135_000;
const GRANT_REQUEST_TIMEOUT_MS = 30_000;
const DIRECT_ENTRY_SERVICE_ACCESS_REQUEST_TIMEOUT_MS = 135_000;
const DIRECT_ENTRY_SERVICE_ACCESS_RETRY_BASE_MS = 1_000;
const DIRECT_ENTRY_SERVICE_ACCESS_RETRY_MAX_MS = 10_000;
const RUNTIME_WORKER_VERSION = Object.freeze({ major: 2, minor: 12 });
const RUNTIME_WORKER_BUILD_ID = `runtime-${RUNTIME_WORKER_VERSION.major}.${RUNTIME_WORKER_VERSION.minor}`;
const RUNTIME_ATTACH_TIMEOUT_MS = 5_000;
const RUNTIME_WRITE_TIMEOUT_MS = 10_000;
const DIRECT_ENTRY_ACCOUNT_HYDRATION_TIMEOUT_MS = 15_000;
const DIRECT_ENTRY_ACCOUNT_HYDRATION_POLL_MS = 350;
const DIRECT_ENTRY_ACCOUNT_HYDRATED_SETTLE_MS = 2_000;
const SERVICE_ACCESS_REFRESH_SKEW_MS = 15_000;
const PTZ_STEP_DEGREES = 10;
const PTZ_STEP_NORMALIZED = PTZ_STEP_DEGREES / 180;
// Keep PTZ hidden until the driver reports a verified control surface.
// The current Reolink control path is not reliable enough to expose generically.
const PTZ_UI_ENABLED = false;

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("#app not found");
}

const shell = renderShell(app);
const btnBellEl = shell.btnBellEl;
const notifMenuEl = shell.notifMenuEl;
const btnNotifClearEl = shell.btnNotifClearEl;
const notifListEl = shell.notifListEl;
const btnMenuEl = shell.btnMenuEl;
const drawerEl = shell.drawerEl;
const drawerBackdropEl = shell.drawerBackdropEl;
const btnDrawerCloseEl = shell.btnDrawerCloseEl;
const navButtons = shell.navButtons;
const accountRailButtonEl = shell.accountRailButtonEl;
const accountCenterMenuEl = shell.accountCenterMenuEl;
const accountCenterSummaryEl = shell.accountCenterSummaryEl;
const accountCenterActionsEl = shell.accountCenterActionsEl;
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
const cameraGridEl = shell.cameraGridEl;
const historyHintEl = shell.historyHintEl;
const settingsTabButtons = shell.settingsTabButtons;
const nvrSettingsPanelEl = shell.nvrSettingsPanelEl;
const camerasPanelEl = shell.camerasPanelEl;
const cameraListEl = shell.cameraListEl;
const addCameraButtonEl = shell.addCameraButtonEl;
const cameraRefreshStatusEl = shell.cameraRefreshStatusEl;
const nvrSettingsSummaryEl = document.getElementById("nvrSettingsSummary") as HTMLDivElement | null;

const cameraTiles = new Map<string, CameraTile>();
const serviceAccessCameraInfoBySourceId = new Map<string, ServiceAccessCameraDisplay>();
const notifications: NotificationEntry[] = [];

let runtimePort: MessagePort | null = null;
let runtimeRequestSeq = 1;
const pendingRuntimeResponses = new Map<string, PendingRequest<unknown>>();
let runtimeReadyPromise: Promise<MessagePort | null> | null = null;
let resolveRuntimeReady: ((value: MessagePort | null) => void) | null = null;
let serviceAccessContext: ServiceAccessContext | null = null;
let peerConnection: RTCPeerConnection | null = null;
let transceiverSourceIds: string[] = [];
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
const dirtyCameraSettings = new Set<string>();
const cameraApplyPending = new Set<string>();
const candidateMountDrafts = new Map<string, CandidateMountDraft>();
const cameraProbeResults = new Map<string, ProbeResultRecord>();
const currentPoseBySourceId = new Map<string, CameraPoseView>();
const desiredPoseBySourceId = new Map<string, CameraPoseView>();
const poseStatusBySourceId = new Map<string, string>();
const knownCandidateIds = new Set<string>();
let cameraInventory: CameraInventoryRecord | null = null;
let cameraInventoryLoading = false;
let cameraInventoryError = "";
let cameraInventoryRefreshPromise: Promise<void> | null = null;
let expandedCandidateId = "";
let notificationMenuOpen = false;
let accountCenterOpen = false;
let serviceAccessRefreshPromise: Promise<ServiceAccessContext> | null = null;
let scheduledReconnectTimer = 0;
let reconnectInFlight: Promise<void> | null = null;
let reconnectAttemptCount = 0;
let accountBridgeFrame: HTMLIFrameElement | null = null;
let accountBridgePromise: Promise<void> | null = null;
let directEntryServiceAccessAttempted = false;

function ptzUiCapable(camera: ServiceAccessCameraDisplay | null | undefined): boolean {
  return PTZ_UI_ENABLED && camera?.ptzCapable === true;
}

function ptzUiInteractive(camera: ServiceAccessCameraDisplay | null | undefined): boolean {
  return PTZ_UI_ENABLED && camera?.ptzCapable === true && camera?.controlGranted === true;
}

class ServiceAccessError extends Error {
  stage: ServiceAccessStage;
  detail: string;

  constructor(stage: ServiceAccessStage, detail: string) {
    super(`${stage}: ${detail}`);
    this.name = "ServiceAccessError";
    this.stage = stage;
    this.detail = detail;
  }
}

function serviceAccessError(stage: ServiceAccessStage, detail: string): ServiceAccessError {
  return new ServiceAccessError(stage, String(detail || "Unknown error").trim() || "Unknown error");
}

function asServiceAccessError(error: unknown, fallbackStage: ServiceAccessStage): ServiceAccessError {
  if (error instanceof ServiceAccessError) return error;
  return serviceAccessError(fallbackStage, String((error as Error)?.message || error || "Unknown error"));
}

function appendLog(message: string): void {
  if (diagnosticsEnabled) {
    console.info(`[nvr-ui] ${message}`);
  }
}

function markStartupStage(stage: string): void {
  const label = String(stage || "").trim();
  if (!label) return;
  try {
    performance.mark(`constitute-nvr-ui:${label}`);
  } catch {}
  if (diagnosticsEnabled) {
    try {
      console.debug("[nvr-ui boot]", label, Math.round(performance.now()));
    } catch {
      console.debug("[nvr-ui boot]", label);
    }
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
  setConnectionStateText(connStateTextEl, {
    label,
    toneClass: connectionTextClass(tone),
  });
  popConnectionEl.textContent = label.toLowerCase();
  popRelayEl.textContent = label.toLowerCase();
  renderAccountCenter();
}

function setDrawerStatus(detail: string): void {
  popConnectionReasonEl.textContent = detail;
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

function absorbRuntimeSnapshot(snapshot: unknown): void {
  runtimeSnapshot = (snapshot && typeof snapshot === "object") ? snapshot as RuntimeSnapshot : null;
  const names = runtimeSnapshot?.resourceNames;
  if (!names || typeof names !== "object") return;
  for (const [pk, label] of Object.entries(names)) {
    rememberResolvedResourceName(pk, label);
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

function serviceLabelForContext(context: ServiceAccessContext | null): string {
  if (!context) return "Constitute NVR";
  const explicit = String(context.display?.serviceLabel || "").trim();
  if (explicit) return explicit;
  return resolvedResourceName(context.servicePk, shortPk(context.servicePk));
}

function gatewayLabelForContext(context: ServiceAccessContext | null): string {
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
  const mounted = mountedCameraRecord(key);
  const mountedLabel = String(
    mounted?.observed?.displayName
      || mounted?.displayName
      || mounted?.desired?.displayName
      || "",
  ).trim();
  if (mountedLabel) return mountedLabel;
  const available = availableCameraInfo(key);
  const availableLabel = String(available?.name || "").trim();
  if (availableLabel) return availableLabel;
  const base = serviceAccessCameraInfoBySourceId.get(key);
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

function readUiState(): { contextId: string; activity: NvrActivity; settingsTab: NvrSettingsTab; cameraId: string } {
  const params = hashParams();
  const activity = String(params.get("activity") || "live").trim().toLowerCase();
  const settingsTab = String(params.get("settings") || "nvr").trim().toLowerCase();
  return {
    contextId: String(params.get("serviceAccess") || "").trim(),
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
  if (current.contextId) params.set("serviceAccess", current.contextId);
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

function parseServiceAccessId(): string {
  return readUiState().contextId;
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

function applyDiagnosticsMode(): void {
  diagnosticsEnabled = readDiagnosticsPreference();
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
  return new URL("/constitute-account/", window.location.origin).toString();
}

function setBootSplash(title: string): void {
  if (!bootSplashEl || bootSplashDismissed) return;
  if (bootSplashTitleEl) bootSplashTitleEl.textContent = title;
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

function identityHandleForContext(context: ServiceAccessContext | null): string {
  const identityId = String(context?.identityId || "").trim();
  if (!identityId) return "@unlinked";
  const runtimeHandle = runtimeIdentityHandle();
  if (runtimeHandle !== "@linked") return runtimeHandle;
  const label = String(resolvedResourceNames.get(identityId) || "").trim().replace(/^@+/, "");
  return label ? `@${label}` : runtimeHandle;
}

function runtimeIdentityHandle(): string {
  const rawLabel = String(runtimeSnapshot?.shell?.identity?.label || "").trim().replace(/^@+/, "");
  if (rawLabel) return `@${rawLabel}`;
  return "@linked";
}

function refreshIdentityHandle(): void {
  const identityId = String(serviceAccessContext?.identityId || "").trim();
  const linked = Boolean(identityId);
  identityHandleEl.textContent = identityHandleForContext(serviceAccessContext);
  identityHandleEl.classList.toggle("identityHandle-linked", linked);
  identityHandleEl.classList.toggle("identityHandle-unlinked", !linked);
  identityHandleEl.title = linked ? "Open account center" : "Open account center";
  identityHandleEl.setAttribute("aria-label", identityId ? `Identity ${identityId}` : "Identity not linked");
  renderAccountCenter();
}

function openAccountCenter(): void {
  accountCenterOpen = true;
  accountCenterMenuEl.classList.remove("hidden");
  accountRailButtonEl.setAttribute("aria-expanded", "true");
}

function closeAccountCenter(): void {
  accountCenterOpen = false;
  accountCenterMenuEl.classList.add("hidden");
  accountRailButtonEl.setAttribute("aria-expanded", "false");
}

function toggleAccountCenter(): void {
  if (accountCenterOpen) {
    closeAccountCenter();
  } else {
    openAccountCenter();
  }
}

function openAccountCenterApp(targetHash = ""): void {
  const url = new URL("/constitute-account/", window.location.origin);
  if (targetHash) url.hash = targetHash;
  window.location.assign(url.toString());
}

function renderAccountCenter(): void {
  const identityId = String(serviceAccessContext?.identityId || "").trim();
  const handle = identityHandleForContext(serviceAccessContext);
  const connection = String(connStateTextEl.textContent || "Offline").trim() || "Offline";
  renderAccountCenterSummary(accountCenterSummaryEl, {
    handle,
    linked: Boolean(identityId),
    connectionLabel: connection,
    connectionToneClass: Array.from(connStateTextEl.classList)
      .find((value) => value.startsWith("connStateText-") && value !== "connStateText")
      || "connStateText-offline",
  });
  renderActionList(accountCenterActionsEl, [
    {
      id: "account.open_center",
      label: "Open Account Center",
      description: "Open constitute-account.",
      onSelect: () => openAccountCenterApp("activity=home"),
    },
    {
      id: "account.copy_identity",
      label: "Copy Identity ID",
      description: identityId ? "Copy the linked identity id." : "Identity is not linked yet.",
      disabled: !identityId,
      onSelect: async () => {
        if (!identityId) return;
        try {
          await navigator.clipboard.writeText(identityId);
          addNotification("good", "Identity copied", "Copied the linked identity id.", "account");
        } catch (error) {
          addNotification("bad", "Identity copy failed", String((error as Error)?.message || error), "account");
        }
      },
    },
  ]);
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
  const target = new URL("/constitute-account/runtime.worker.js", window.location.origin);
  target.searchParams.set("v", RUNTIME_WORKER_BUILD_ID);
  return target.toString();
}

function accountBridgeUrl(): string {
  const target = new URL("/constitute-account/", window.location.origin);
  target.searchParams.set("bridge", "1");
  return target.toString();
}

function isRuntimeBrokerUnavailable(error: unknown): boolean {
  const message = String((error as Error)?.message || error || "").toLowerCase();
  return message.includes("runtime broker unavailable") || message.includes("runtime broker missing");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, Math.max(0, ms)));
}

async function ensureAccountBridge(reason = ""): Promise<void> {
  if (accountBridgePromise) return await accountBridgePromise;
  accountBridgePromise = new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    accountBridgeFrame = document.getElementById("constituteAccountBridge") as HTMLIFrameElement | null;
    if (!accountBridgeFrame) {
      const iframe = document.createElement("iframe");
      iframe.id = "constituteAccountBridge";
      iframe.hidden = true;
      iframe.tabIndex = -1;
      iframe.setAttribute("aria-hidden", "true");
      iframe.style.cssText = "position:absolute;width:0;height:0;border:0;opacity:0;pointer-events:none";
      iframe.src = accountBridgeUrl();
      iframe.addEventListener("load", () => window.setTimeout(done, 450), { once: true });
      document.body.appendChild(iframe);
      accountBridgeFrame = iframe;
    } else {
      window.setTimeout(done, 450);
    }
    window.setTimeout(done, 1_500);
    if (reason) appendLog(`opened account bridge (${reason})`);
  });
  try {
    await accountBridgePromise;
  } finally {
    accountBridgePromise = null;
  }
}

function handleRuntimeMessage(message: unknown): void {
  if (!message || typeof message !== "object") return;
  const payload = message as Record<string, unknown>;
  const type = String(payload.type || "").trim();
  if (type === "runtime.attached" || type === "runtime.snapshot") {
    absorbRuntimeSnapshot(payload.snapshot);
    if (type === "runtime.attached" && resolveRuntimeReady) {
      resolveRuntimeReady(runtimePort);
      resolveRuntimeReady = null;
    }
    appendLog(`runtime ${type === "runtime.attached" ? "attached" : "snapshot"} ${String(payload.buildId || "")}`.trim());
    refreshRuntimeProjectionLabels();
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
      appendLog("runtime attach unavailable");
    }, RUNTIME_ATTACH_TIMEOUT_MS);
    resolveRuntimeReady = (value) => {
      window.clearTimeout(timeout);
      resolve(value);
    };
    try {
      const worker = new SharedWorker(runtimeWorkerUrl(), {
        type: "module",
        name: `constitute-account-runtime-${RUNTIME_WORKER_BUILD_ID}`,
      });
      try {
        worker.onerror = (event: ErrorEvent) => {
          appendLog(`runtime worker error: ${String(event?.message || "worker failure")}`);
        };
      } catch {}
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
      appendLog(`runtime attach unavailable (${String((error as Error)?.message || error)})`);
      runtimePort = null;
      runtimeReadyPromise = null;
      resolveRuntimeReady = null;
      resolve(null);
    }
  });
  return await runtimeReadyPromise;
}

async function runtimeCall<T = unknown>(type: string, payload: Record<string, unknown>, timeoutMs: number): Promise<T> {
  const port = await ensureRuntimePort();
  if (!port) throw new Error("shared browser runtime unavailable");
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

async function runtimeBrokerCall<T = unknown>(
  type: string,
  payload: Record<string, unknown>,
  timeoutMs: number,
  reason = "",
): Promise<T> {
  try {
    return await runtimeCall<T>(type, payload, timeoutMs);
  } catch (error) {
    if (!isRuntimeBrokerUnavailable(error)) throw error;
    appendLog(`runtime broker unavailable${reason ? ` during ${reason}` : ""}; booting account bridge`);
    await ensureAccountBridge(reason || type);
    return await runtimeCall<T>(type, payload, timeoutMs);
  }
}

async function reportServiceStatus(state: string, reason: string, stage: ServiceAccessStage | "" = ""): Promise<void> {
  try {
    await runtimeCall("runtime.status.put", {
      role: "service",
      service: "nvr",
      status: {
        service: "nvr",
        state,
        reason,
        stage,
        updatedAt: Date.now(),
      },
    }, RUNTIME_WRITE_TIMEOUT_MS);
  } catch {}
}

async function requestServiceAccessContextFromRuntime(contextId: string): Promise<ServiceAccessContext | null> {
  return await runtimeCall<ServiceAccessContext | null>(BROKER.SERVICE_ACCESS_CONTEXT_GET, { contextId }, SERVICE_ACCESS_REQUEST_TIMEOUT_MS);
}

function accountRuntimeNeedsIdentity(snapshot: RuntimeSnapshot | null): boolean {
  const shell = snapshot?.shell && typeof snapshot.shell === "object"
    ? snapshot.shell as Record<string, unknown>
    : null;
  const identity = shell?.identity && typeof shell.identity === "object"
    ? shell.identity as Record<string, unknown>
    : null;
  return identity?.linked === false;
}

function accountRuntimeIdentityResolved(snapshot: RuntimeSnapshot | null): boolean {
  const shell = snapshot?.shell && typeof snapshot.shell === "object"
    ? snapshot.shell as Record<string, unknown>
    : null;
  const identity = shell?.identity && typeof shell.identity === "object"
    ? shell.identity as Record<string, unknown>
    : null;
  return typeof identity?.linked === "boolean";
}

async function waitForDirectEntryNvrServiceRecord(): Promise<{
  snapshot: RuntimeSnapshot | null;
  record: ManagedApplianceRecord | null;
}> {
  await ensureAccountBridge("direct app entry");
  let snapshot = await currentRuntimeSnapshot();
  let record = directEntryNvrServiceRecord(snapshot);
  if (record) return { snapshot, record };

  const deadline = Date.now() + DIRECT_ENTRY_ACCOUNT_HYDRATION_TIMEOUT_MS;
  let identityResolvedAt = 0;
  while (Date.now() < deadline) {
    snapshot = await currentRuntimeSnapshot();
    record = directEntryNvrServiceRecord(snapshot);
    if (record) return { snapshot, record };
    if (accountRuntimeIdentityResolved(snapshot)) {
      identityResolvedAt ||= Date.now();
      if (Date.now() - identityResolvedAt >= DIRECT_ENTRY_ACCOUNT_HYDRATED_SETTLE_MS) {
        return { snapshot, record: null };
      }
    }
    await delay(DIRECT_ENTRY_ACCOUNT_HYDRATION_POLL_MS);
  }

  return { snapshot, record: null };
}

async function requestDirectEntryServiceAccessContext(): Promise<ServiceAccessContext> {
  directEntryServiceAccessAttempted = true;
  setConnectionState("opening", "warn");
  setDrawerStatus("Opening Security Cameras through your account runtime.");
  setGridEmpty("Opening Security Cameras", "Resolving an account-authorized camera session through the gateway.");
  dismissBootSplash();
  void reportServiceStatus("opening", "Resolving an account-authorized camera session.", "service_access_authorization");

  const { snapshot, record } = await waitForDirectEntryNvrServiceRecord();
  if (!record) {
    if (accountRuntimeNeedsIdentity(snapshot)) {
      throw serviceAccessError(
        "service_access_context",
        "link an identity before opening Security Cameras",
      );
    }
    throw serviceAccessError(
      "service_access_context",
      "no Security Cameras service is available from this account runtime",
    );
  }

  let selectedRecord = record;
  let selectedSnapshot = snapshot;
  let result: Record<string, unknown> | null = null;
  let attempt = 0;
  while (!result) {
    attempt += 1;
    try {
      result = await runtimeBrokerCall<Record<string, unknown>>(BROKER.SERVICE_ACCESS_REQUEST, {
        payload: {
          record: selectedRecord,
          options: {
            service: "nvr",
            capability: "nvr.view",
          },
        },
      }, DIRECT_ENTRY_SERVICE_ACCESS_REQUEST_TIMEOUT_MS, "direct service access");
    } catch (error) {
      const message = String((error as Error)?.message || error || "Security Cameras service access failed");
      const lowerMessage = message.toLowerCase();
      if (lowerMessage.includes("link an identity") || lowerMessage.includes("identity is not linked")) {
        throw serviceAccessError("service_access_context", "link an identity before opening Security Cameras");
      }
      appendLog(`direct service access attempt ${attempt} deferred: ${message}`);
      setConnectionState("opening", "warn");
      setDrawerStatus("Security Cameras service access is still resolving through the gateway.");
      setGridEmpty("Opening Security Cameras", "Resolving an account-authorized camera session through the gateway.");
      void reportServiceStatus("opening", message, "service_access_authorization");

      const refreshedSnapshot = await currentRuntimeSnapshot().catch(() => null);
      const refreshedRecord = directEntryNvrServiceRecord(refreshedSnapshot);
      if (refreshedRecord) {
        selectedRecord = refreshedRecord;
        selectedSnapshot = refreshedSnapshot;
      }
      const retryDelayMs = Math.min(
        DIRECT_ENTRY_SERVICE_ACCESS_RETRY_MAX_MS,
        DIRECT_ENTRY_SERVICE_ACCESS_RETRY_BASE_MS * Math.max(1, attempt),
      );
      await delay(retryDelayMs);
    }
  }
  const access = normalizeGatewayServiceAccessResult(result);
  if (!access.serviceCapability) {
    throw serviceAccessError("service_access_authorization", "Security Cameras service access returned no service capability");
  }

  const servicePk = String(access.servicePk || applianceDevicePk(record)).trim();
  const gatewayPk = String(access.gatewayPk || applianceGatewayPk(record)).trim();
  if (!servicePk || !gatewayPk) {
    throw serviceAccessError("service_access_authorization", "Security Cameras service access did not include service and gateway identity");
  }

  const identity = selectedSnapshot?.shell && typeof selectedSnapshot.shell === "object"
    ? selectedSnapshot.shell.identity as Record<string, unknown> | undefined
    : undefined;
  return {
    contextId: randomOpaqueId("service-access"),
    app: "nvr",
    repo: "constitute-nvr-ui",
    identityId: String(identity?.identityId || "").trim(),
    devicePk: servicePk,
    gatewayPk,
    servicePk,
    service: access.service || "nvr",
    serviceCapability: access.serviceCapability,
    display: access.display ?? {},
    createdAt: Date.now(),
    expiresAt: Number(access.expiresAt || (Date.now() + (2 * 60_000))),
  };
}

function normalizeGatewayServiceAccessResult(result: unknown, fallbackRequestId = ""): GatewayServiceAccessResult {
  const payload = (result && typeof result === "object")
    ? result as Record<string, unknown>
    : {};
  return {
    requestId: String(payload.requestId || fallbackRequestId).trim(),
    gatewayPk: String(payload.gatewayPk || "").trim(),
    servicePk: String(payload.servicePk || "").trim(),
    service: String(payload.service || "nvr").trim() || "nvr",
    capability: String(payload.capability || "").trim(),
    serviceCapability: String(payload.serviceCapability || "").trim(),
    display: payload.display && typeof payload.display === "object"
      ? payload.display as ServiceAccessDisplay
      : undefined,
    expiresAt: Number(payload.expiresAt || 0),
    ts: Number(payload.ts || Date.now()),
  };
}

function serviceAccessContextNeedsRefresh(context: ServiceAccessContext | null, skewMs = SERVICE_ACCESS_REFRESH_SKEW_MS): boolean {
  if (!context) return true;
  const expiresAt = Number(context.expiresAt || 0);
  if (!expiresAt) return true;
  return expiresAt <= (Date.now() + Math.max(0, skewMs));
}

function serviceAccessRefreshRecord(context: ServiceAccessContext): Record<string, string> {
  return {
    devicePk: context.servicePk,
    pk: context.servicePk,
    hostGatewayPk: context.gatewayPk,
    service: context.service || "nvr",
  };
}

function serviceAccessRefreshOptions(context: ServiceAccessContext): Record<string, string> {
  const service = String(context.service || "nvr").trim() || "nvr";
  return {
    service,
    capability: `${service}.view`,
  };
}

async function persistServiceAccessContext(context: ServiceAccessContext): Promise<ServiceAccessContext> {
  serviceAccessContext = context;
  refreshSummary(context);
  await runtimeCall(BROKER.SERVICE_ACCESS_CONTEXT_PUT, { context }, RUNTIME_WRITE_TIMEOUT_MS);
  return context;
}

function isExpiredServiceCapabilityError(error: unknown): boolean {
  const message = String((error as Error)?.message || error || "").toLowerCase();
  return message.includes("service capability expired") || message.includes("invalid_service_capability");
}

async function requestGatewayServiceAccess(): Promise<GatewayServiceAccessResult> {
  if (!serviceAccessContext) throw new Error("service access context is not loaded");
  const result = await runtimeBrokerCall<Record<string, unknown>>(BROKER.SERVICE_ACCESS_REQUEST, {
    payload: {
      record: serviceAccessRefreshRecord(serviceAccessContext),
      options: serviceAccessRefreshOptions(serviceAccessContext),
    },
  }, SERVICE_ACCESS_REFRESH_TIMEOUT_MS, "service access refresh");
  appendLog("runtime broker delivered service access refresh");
  return normalizeGatewayServiceAccessResult(result);
}

async function ensureFreshServiceAccessContext(force = false, reason = ""): Promise<ServiceAccessContext> {
  if (!serviceAccessContext) throw new Error("service access context is not loaded");
  if (!force && !serviceAccessContextNeedsRefresh(serviceAccessContext)) {
    return serviceAccessContext;
  }
  if (serviceAccessRefreshPromise) {
    return await serviceAccessRefreshPromise;
  }

  const current = serviceAccessContext;
  serviceAccessRefreshPromise = (async () => {
    const cause = String(reason || "").trim();
    appendLog(`refreshing managed service access context${cause ? ` (${cause})` : ""}`);
    const refreshed = await requestGatewayServiceAccess();
    if (!refreshed.serviceCapability) {
      throw new Error("service access refresh returned no service capability");
    }
    const next = await persistServiceAccessContext({
      ...current,
      gatewayPk: refreshed.gatewayPk || current.gatewayPk,
      servicePk: refreshed.servicePk || current.servicePk,
      service: refreshed.service || current.service,
      serviceCapability: refreshed.serviceCapability,
      display: refreshed.display ?? current.display,
      createdAt: Date.now(),
      expiresAt: Number(refreshed.expiresAt || (Date.now() + (2 * 60_000))),
    });
    appendLog(`service access context refreshed until ${new Date(next.expiresAt).toLocaleTimeString()}`);
    return next;
  })();

  try {
    return await serviceAccessRefreshPromise;
  } finally {
    serviceAccessRefreshPromise = null;
  }
}

async function requestGatewaySignalOnce(
  signalType: string,
  payload: unknown,
  timeoutMs = SIGNAL_REQUEST_TIMEOUT_MS,
): Promise<GatewaySignalResult> {
  if (!serviceAccessContext) throw new Error("service access context is not loaded");
  const requestId = randomOpaqueId("nvr-signal");
  const runtimeResult = await runtimeBrokerCall<GatewaySignalResult>(BROKER.SERVICE_SIGNAL_REQUEST, {
    payload: {
      requestId,
      gatewayPk: serviceAccessContext.gatewayPk,
      servicePk: serviceAccessContext.servicePk,
      service: serviceAccessContext.service || "nvr",
      serviceCapability: serviceAccessContext.serviceCapability,
      signalType,
      payload,
    },
  }, timeoutMs, signalType);
  appendLog(`runtime broker delivered ${signalType} response`);
  return runtimeResult;
}

async function requestGatewaySignal(
  signalType: string,
  payload: unknown,
  timeoutMs = SIGNAL_REQUEST_TIMEOUT_MS,
): Promise<GatewaySignalResult> {
  if (!serviceAccessContext) throw new Error("service access context is not loaded");
  await ensureFreshServiceAccessContext(false, `${signalType} preflight`);
  try {
    return await requestGatewaySignalOnce(signalType, payload, timeoutMs);
  } catch (error) {
    if (!isExpiredServiceCapabilityError(error)) {
      throw error;
    }
    appendLog(`service capability expired during ${signalType}; refreshing and retrying`);
    await ensureFreshServiceAccessContext(true, `${signalType} retry`);
    return await requestGatewaySignalOnce(signalType, payload, timeoutMs);
  }
}

async function requestGatewayGrantAction(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<GatewayGrantResult> {
  if (!serviceAccessContext) throw new Error("service access context is not loaded");
  const requestId = randomOpaqueId("nvr-grant");
  return await runtimeBrokerCall<GatewayGrantResult>("gateway.grant.request", {
    payload: {
      requestId,
      gatewayPk: serviceAccessContext.gatewayPk,
      servicePk: serviceAccessContext.servicePk,
      service: serviceAccessContext.service || "nvr",
      action,
      ...payload,
    },
  }, GRANT_REQUEST_TIMEOUT_MS, action);
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
  const timeoutMs = action === "apply_camera_device_config"
    ? CAMERA_APPLY_REQUEST_TIMEOUT_MS
    : ADMIN_SIGNAL_REQUEST_TIMEOUT_MS;
  try {
    const result = await requestGatewaySignal("admin", {
      action,
      payload,
    }, timeoutMs);
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

function normalizeRecords(value: unknown): ManagedApplianceRecord[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is ManagedApplianceRecord => Boolean(entry) && typeof entry === "object")
    : [];
}

function normalizeRole(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function snapshotManagedApplianceRecords(snapshot: RuntimeSnapshot | null): ManagedApplianceRecord[] {
  const managed = snapshot?.managedAppliances || {};
  const buckets = [
    { scope: "owned", items: normalizeRecords(managed.owned) },
    { scope: "shared", items: normalizeRecords(managed.granted) },
    { scope: "discoverable", items: normalizeRecords(managed.discoverable) },
  ];
  const out: ManagedApplianceRecord[] = [];
  const seen = new Set<string>();
  for (const bucket of buckets) {
    for (const raw of bucket.items) {
      const key = `${bucket.scope}:${String(raw.devicePk || raw.pk || raw.hostGatewayPk || raw.service || "").trim()}`;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({ ...raw, __scope: bucket.scope });
    }
  }
  return out;
}

function isGatewayApplianceRecord(record: ManagedApplianceRecord): boolean {
  const role = normalizeRole(record.role || record.type || "");
  const service = normalizeRole(record.service || "");
  return role === "gateway" || service === "gateway";
}

function isNvrApplianceRecord(record: ManagedApplianceRecord): boolean {
  if (isGatewayApplianceRecord(record)) return false;
  const role = normalizeRole(record.role || record.type || "");
  const service = normalizeRole(record.service || "");
  return role === "nvr" || service === "nvr";
}

function applianceDevicePk(record: ManagedApplianceRecord): string {
  return String(record.devicePk || record.device_pk || record.pk || "").trim();
}

function applianceGatewayPk(record: ManagedApplianceRecord): string {
  return String(record.hostGatewayPk || record.host_gateway_pk || "").trim();
}

function applianceUpdatedAt(record: ManagedApplianceRecord): number {
  return Number(
    record.managedAvailabilityUpdatedAt
      || record.managed_availability_updated_at
      || record.updatedAt
      || record.updated_at
      || record.ts
      || 0,
  );
}

function directEntryNvrRecordFromGateway(gateway: ManagedApplianceRecord): ManagedApplianceRecord | null {
  const gatewayPk = applianceDevicePk(gateway);
  if (!gatewayPk) return null;
  const hosted = normalizeRecords(gateway.hostedServices || gateway.hosted_services)
    .find((service) => normalizeRole(service.service || service.slug || service.name || service) === "nvr");
  if (!hosted) return null;
  const servicePk = applianceDevicePk(hosted);
  if (!servicePk) return null;
  return {
    ...hosted,
    devicePk: servicePk,
    pk: servicePk,
    deviceKind: String(hosted.deviceKind || hosted.device_kind || "service"),
    role: "nvr",
    service: "nvr",
    hostGatewayPk: gatewayPk,
    serviceVersion: String(hosted.serviceVersion || hosted.service_version || ""),
    updatedAt: Number(hosted.updatedAt || hosted.updated_at || gateway.updatedAt || gateway.updated_at || Date.now()),
  };
}

function directEntryNvrServiceRecord(snapshot: RuntimeSnapshot | null): ManagedApplianceRecord | null {
  const records = snapshotManagedApplianceRecords(snapshot);
  const services = records
    .filter((record) => isNvrApplianceRecord(record) && applianceDevicePk(record) && applianceGatewayPk(record))
    .sort((left, right) => applianceUpdatedAt(right) - applianceUpdatedAt(left));
  if (services[0]) return services[0];
  for (const gateway of records.filter(isGatewayApplianceRecord)) {
    const hosted = directEntryNvrRecordFromGateway(gateway);
    if (hosted) return hosted;
  }
  return null;
}

async function currentRuntimeSnapshot(): Promise<RuntimeSnapshot | null> {
  try {
    const snapshot = await runtimeCall<RuntimeSnapshot>("runtime.snapshot.get", {}, RUNTIME_WRITE_TIMEOUT_MS);
    absorbRuntimeSnapshot(snapshot);
  } catch {}
  return runtimeSnapshot;
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

function normalizeServiceAccessCameraEntries(display: ServiceAccessDisplay): ServiceAccessCameraDisplay[] {
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
    .filter((entry): entry is ServiceAccessCameraDisplay => !!entry);
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

function serviceAccessCameraInfo(sourceId: string): ServiceAccessCameraDisplay | null {
  const key = String(sourceId || "").trim();
  if (!key) return null;
  const base = serviceAccessCameraInfoBySourceId.get(key) || null;
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
  return serviceAccessContext?.display?.grantedScope?.owner === true;
}

function ownerCanAdmin(): boolean {
  return viewerIsOwner();
}

function normalizeAdminError(error: unknown): string {
  const message = String((error as Error)?.message || error || "Camera administration is unavailable.").trim();
  const lowered = message.toLowerCase();
  if (lowered.includes("unsupported_signal") || lowered.includes("only offer and session_close are supported")) {
    return "Gateway update required before camera administration is available from this NVR surface.";
  }
  if (lowered.includes("admin_requires_owner")) {
    return "Owner service access is required before camera administration is available.";
  }
  return message || "Camera administration is unavailable.";
}

function defaultCameraSettingsDraft(sourceId: string): CameraSettingsDraft {
  const camera = serviceAccessCameraInfo(sourceId);
  const displayName = cameraDisplayName(sourceId);
  return {
    displayName,
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
  const candidate = (cameraInventory?.candidateDevices || []).find((item) => String(item.candidateId || "").trim() === key) || null;
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
  const current = cameraSettingsDraft(key);
  const next: CameraSettingsDraft = {
    ...current,
    ...patch,
  };
  if (Object.prototype.hasOwnProperty.call(patch, "displayName") && !Object.prototype.hasOwnProperty.call(patch, "overlayText")) {
    const previousName = String(current.displayName || "").trim();
    const previousOverlay = String(current.overlayText || "").trim();
    if (!previousOverlay || previousOverlay === previousName) {
      next.overlayText = String(next.displayName || "").trim();
    }
  }
  cameraSettingsDrafts.set(key, next);
  dirtyCameraSettings.add(key);
}

function updateCameraListHeading(sourceId: string): void {
  const key = String(sourceId || "").trim();
  if (!key) return;
  const item = cameraListEl.querySelector<HTMLElement>(`.cameraListItem[data-source-id="${CSS.escape(key)}"]`);
  if (!item) return;
  const title = item.querySelector<HTMLElement>(".cameraListHeading strong");
  if (title) title.textContent = cameraDisplayName(key);
}

function updateCameraApplyUi(sourceId: string): void {
  const key = String(sourceId || "").trim();
  if (!key) return;
  const tray = cameraListEl.querySelector<HTMLElement>(`.cameraSettingsTray[data-source-id="${CSS.escape(key)}"]`);
  if (!tray) return;
  const button = tray.querySelector<HTMLButtonElement>("button[data-action='apply-camera-settings']");
  const status = tray.querySelector<HTMLElement>("[data-role='apply-status']");
  const pending = cameraApplyPending.has(key);
  if (button) {
    button.disabled = pending;
    button.textContent = pending ? "Applying Camera Settings…" : "Apply Camera Settings";
  }
  if (status) {
    status.hidden = !pending;
    status.setAttribute("aria-busy", pending ? "true" : "false");
    status.innerHTML = pending
      ? `<span class="inlineSpinner" aria-hidden="true"></span><span>Applying camera settings…</span>`
      : "";
  }
}

function cameraSettingsTrayOpen(): boolean {
  return Boolean(
    currentActivity === "settings"
    && currentSettingsTab === "cameras"
    && selectedCameraId
    && cameraListEl.querySelector(`.cameraSettingsTray[data-source-id="${CSS.escape(selectedCameraId)}"]`),
  );
}

function renderCameraRefreshStatus(): void {
  const loading = cameraInventoryLoading;
  addCameraButtonEl.disabled = loading;
  addCameraButtonEl.textContent = loading ? "Refreshing Cameras…" : "Refresh Cameras";
  cameraRefreshStatusEl.hidden = !loading;
  cameraRefreshStatusEl.setAttribute("aria-busy", loading ? "true" : "false");
  cameraRefreshStatusEl.innerHTML = loading
    ? `<span class="inlineSpinner" aria-hidden="true"></span><span>Refreshing camera state…</span>`
    : "";
}

function captureCameraSettingsFocus(): CameraSettingsFocusSnapshot | null {
  const active = document.activeElement;
  if (!(active instanceof HTMLInputElement || active instanceof HTMLSelectElement || active instanceof HTMLTextAreaElement)) {
    return null;
  }
  if (!cameraListEl.contains(active)) return null;
  const field = String(active.dataset.field || "").trim();
  const tray = active.closest<HTMLElement>(".cameraSettingsTray");
  const sourceId = String(tray?.dataset.sourceId || "").trim();
  if (!field || !sourceId) return null;
  return {
    sourceId,
    field,
    selectionStart: active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement ? active.selectionStart : null,
    selectionEnd: active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement ? active.selectionEnd : null,
  };
}

function restoreCameraSettingsFocus(snapshot: CameraSettingsFocusSnapshot | null): void {
  if (!snapshot) return;
  const target = cameraListEl.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    `.cameraSettingsTray[data-source-id="${CSS.escape(snapshot.sourceId)}"] [data-field="${CSS.escape(snapshot.field)}"]`,
  );
  if (!target) return;
  target.focus({ preventScroll: true });
  if ((target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
    && snapshot.selectionStart != null && snapshot.selectionEnd != null) {
    try {
      target.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
    } catch {}
  }
}

function hasCameraInventoryData(): boolean {
  return Boolean((cameraInventory?.mountedDevices?.length || 0) > 0 || (cameraInventory?.candidateDevices?.length || 0) > 0);
}

function upsertMountedCameraInventoryRecord(record: MountedCameraRecord | null | undefined): void {
  const sourceId = String(record?.sourceId || "").trim();
  if (!sourceId || !cameraInventory) return;
  const mounted = Array.isArray(cameraInventory.mountedDevices) ? cameraInventory.mountedDevices.slice() : [];
  const index = mounted.findIndex((camera) => String(camera.sourceId || "").trim() === sourceId);
  if (index >= 0) mounted[index] = record as MountedCameraRecord;
  else mounted.push(record as MountedCameraRecord);
  cameraInventory = {
    ...cameraInventory,
    mountedDevices: mounted,
  };
}

function settingsCameraRows(): CameraGrantView[] {
  if (cameraInventory?.mountedDevices?.length) {
    return cameraInventory.mountedDevices.map((camera) => ({
      sourceId: String(camera.sourceId || "").trim(),
      name: cameraDisplayName(String(camera.sourceId || "").trim()),
      ptzCapable: camera.observed?.ptzCapable === true || camera.capabilities?.ptz === true,
    })).filter((camera) => camera.sourceId);
  }
  if (grantInventory?.availableCameras?.length) {
    return grantInventory.availableCameras;
  }
  return normalizeServiceAccessCameraEntries(serviceAccessContext?.display || {}).map((camera) => {
    const merged = serviceAccessCameraInfo(String(camera.sourceId || "").trim()) || camera;
    return {
      sourceId: merged.sourceId,
      name: merged.name,
      ptzCapable: merged.ptzCapable,
    };
  });
}

function mountedCameraRecord(sourceId: string): MountedCameraRecord | null {
  const target = String(sourceId || "").trim();
  if (!target || !cameraInventory?.mountedDevices?.length) return null;
  return cameraInventory.mountedDevices.find((camera) => String(camera.sourceId || "").trim() === target) || null;
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
  if (cameraInventoryRefreshPromise) {
    return await cameraInventoryRefreshPromise;
  }
  cameraInventoryRefreshPromise = (async () => {
    if (!viewerIsOwner()) {
      cameraInventory = null;
      cameraInventoryLoading = false;
      cameraInventoryError = "";
      renderCameraRefreshStatus();
      renderCameraList();
      renderNvrSettingsSummary();
      return;
    }
    const hadInventory = hasCameraInventoryData();
    const previousInventory = cameraInventory;
    const trayWasOpen = cameraSettingsTrayOpen();
    cameraInventoryLoading = true;
    cameraInventoryError = "";
    renderCameraRefreshStatus();
    if (!hadInventory && cameraListEl.childElementCount === 0) {
      renderCameraList();
    }
    renderNvrSettingsSummary();
    try {
      const payload = await requestAdminAction("list_camera_device_inventory");
      const inventory = payload.inventory && typeof payload.inventory === "object"
        ? payload.inventory as CameraInventoryRecord
        : { mountedDevices: [], candidateDevices: [], cameraNetwork: {} };
      cameraInventory = {
        mountedDevices: Array.isArray(inventory.mountedDevices) ? inventory.mountedDevices : [],
        candidateDevices: Array.isArray(inventory.candidateDevices) ? inventory.candidateDevices : [],
        cameraNetwork: inventory.cameraNetwork && typeof inventory.cameraNetwork === "object"
          ? inventory.cameraNetwork as CameraNetworkSummaryRecord
          : {},
      };
      seedCameraDraftsFromInventory();
      for (const candidate of cameraInventory.candidateDevices || []) {
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
      cameraInventory = previousInventory || { mountedDevices: [], candidateDevices: [], cameraNetwork: {} };
    } finally {
      cameraInventoryLoading = false;
      renderCameraRefreshStatus();
      for (const sourceId of cameraTiles.keys()) {
        updateLiveTileMetadata(sourceId);
      }
      if (!trayWasOpen || !hadInventory) {
        renderCameraList();
      }
      renderNvrSettingsSummary();
    }
  })();
  try {
    await cameraInventoryRefreshPromise;
  } finally {
    cameraInventoryRefreshPromise = null;
  }
}

function seedCameraDraftsFromInventory(): void {
  for (const camera of cameraInventory?.mountedDevices || []) {
    const sourceId = String(camera.sourceId || "").trim();
    if (!sourceId) continue;
    const supportsOverlayText = camera.capabilities?.overlayText === true;
    const supportsOverlayTimestamp = camera.capabilities?.overlayTimestamp === true;
    const observedServices = camera.observed?.services || {};
    const observedOnvif = serviceEnabled(observedServices.onvif);
    const observedRtsp = serviceEnabled(observedServices.rtsp);
    const observedP2p = serviceEnabled(observedServices.p2p);
    const observedHttp = serviceEnabled(observedServices.http);
    const observedHttps = serviceEnabled(observedServices.https);
    const observed9000 = serviceEnabled(observedServices.proprietary9000);
    const nextDraft: CameraSettingsDraft = {
      displayName: String(camera.desired?.displayName || camera.displayName || camera.observed?.displayName || sourceId).trim() || sourceId,
      overlayText: supportsOverlayText
        ? String(camera.desired?.overlayText || camera.observed?.overlayText || camera.displayName || camera.observed?.displayName || "").trim()
        : "",
      overlayTimestamp: supportsOverlayTimestamp
        ? camera.desired?.overlayTimestamp !== false && camera.observed?.overlayTimestamp !== false
        : false,
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
    if (!cameraSettingsDrafts.has(sourceId) || !dirtyCameraSettings.has(sourceId)) {
      cameraSettingsDrafts.set(sourceId, nextDraft);
    }
    const currentPose = camera.currentPose || camera.observed?.currentPose;
    if (currentPose) {
      currentPoseBySourceId.set(sourceId, { ...currentPose });
      desiredPoseBySourceId.set(sourceId, { ...(camera.desiredPose || currentPose) });
    }
    poseStatusBySourceId.set(sourceId, String(camera.poseStatus || camera.observed?.poseStatus || "").trim());
  }
  for (const candidate of cameraInventory?.candidateDevices || []) {
    const candidateId = String(candidate.candidateId || "").trim();
    if (!candidateId || candidateMountDrafts.has(candidateId)) continue;
    candidateMountDrafts.set(candidateId, defaultCandidateMountDraft(candidate));
  }
}

async function saveCameraSettings(sourceId: string): Promise<void> {
  const key = String(sourceId || "").trim();
  if (!key) throw new Error("camera source is missing");
  const draft = cameraSettingsDraft(sourceId);
  const caps = cameraCapabilities(sourceId);
  cameraApplyPending.add(key);
  updateCameraApplyUi(key);
  try {
    const payload = await requestAdminAction("apply_camera_device_config", {
      sourceId,
      desired: {
        displayName: draft.displayName,
        overlayText: caps.overlayText ? draft.overlayText : "",
        overlayTimestamp: caps.overlayTimestamp ? draft.overlayTimestamp : false,
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
      credentialStatus === "failed"
        ? "bad"
        : credentialStatus === "recovered" || mounted?.credentialSafety?.pending
          ? "warn"
          : "good";
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
    dirtyCameraSettings.delete(key);
    if (mounted?.sourceId) {
      upsertMountedCameraInventoryRecord(mounted);
      updateLiveTileMetadata(String(mounted.sourceId || ""));
      updateCameraListHeading(String(mounted.sourceId || ""));
    }
  } finally {
    cameraApplyPending.delete(key);
    updateCameraApplyUi(key);
  }
}

async function mountCameraCandidate(candidateId: string): Promise<void> {
  const candidate = (cameraInventory?.candidateDevices || []).find((item) => String(item.candidateId || "").trim() === candidateId);
  if (!candidate) {
    throw new Error("camera candidate is no longer available");
  }
  const draft = candidateMountDraft(candidateId, candidate);
  if (!draft.username.trim() || !draft.password.trim()) {
    throw new Error("username and password are required to mount this camera");
  }
  const payload = await requestAdminAction("mount_camera_device", {
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
  const payload = await requestAdminAction("probe_camera_device", { sourceId });
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
  const candidate = (cameraInventory?.candidateDevices || []).find((item) => String(item.candidateId || "").trim() === candidateId);
  if (!candidate) {
    throw new Error("camera candidate is no longer available");
  }
  const draft = candidateMountDraft(candidateId, candidate);
  const payload = await requestAdminAction("probe_camera_device", {
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
  const info = serviceAccessCameraInfo(sourceId);
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
  const info = serviceAccessCameraInfo(sourceId);
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
  const info = serviceAccessCameraInfo(sourceId);
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
  const sdp = typeof candidate?.sdp === "string" ? candidate.sdp : "";
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

function renderCameraNetworkSummary(network: CameraNetworkSummaryRecord): string {
  const hasNetworkProjection = Boolean(
    String(network.interface || "").trim() ||
    String(network.subnetCidr || "").trim() ||
    String(network.hostIp || "").trim() ||
    String(network.dnsServer || "").trim() ||
    String(network.ntpServer || "").trim() ||
    typeof network.managed === "boolean" ||
    typeof network.dhcpEnabled === "boolean" ||
    typeof network.ntpEnabled === "boolean" ||
    String(network.timezone || "").trim(),
  );

  if (cameraInventoryLoading && !hasNetworkProjection) {
    return `<p class="panelHint">Loading camera network…</p>`;
  }
  if (!hasNetworkProjection) {
    const detail = cameraInventoryError
      ? escapeHtml(cameraInventoryError)
      : "Camera network details will appear after gateway inventory resolves.";
    const toneClass = cameraInventoryError ? "warnText" : "";
    return `<p class="panelHint ${toneClass}">${detail}</p>`;
  }

  return `
    ${renderKvRow("Managed", network.managed ? "yes" : "no")}
    ${renderKvRow("Interface", String(network.interface || "not configured"))}
    ${renderKvRow("Subnet", String(network.subnetCidr || "not configured"))}
    ${renderKvRow("Host IP", String(network.hostIp || "not configured"))}
    ${renderKvRow("DHCP", network.dhcpEnabled ? `${String(network.dhcpRangeStart || "—")} → ${String(network.dhcpRangeEnd || "—")}` : "disabled")}
    ${renderKvRow("NTP", network.ntpEnabled ? String(network.ntpServer || "enabled") : "disabled")}
    ${renderKvRow("Timezone", String(network.timezone || "UTC"))}
    ${renderKvRow("DNS", String(network.dnsServer || "not configured"))}
    ${cameraInventoryError ? `<p class="panelHint warnText">${escapeHtml(cameraInventoryError)}</p>` : ""}
  `;
}

function renderNvrSettingsSummary(): void {
  if (!nvrSettingsSummaryEl || !serviceAccessContext) return;
  const display = serviceAccessContext.display || {};
  const grantedScope = display.grantedScope || {};
  const network = cameraInventory?.cameraNetwork || {};
  const accessSummary = nvrAccessSummary();
  nvrSettingsSummaryEl.innerHTML = `
    <section class="nestedPanel">
      <div class="summaryLabel">Service</div>
      ${renderKvRow("Label", serviceLabelForContext(serviceAccessContext))}
      ${renderKvRow("Service", String(display.service || serviceAccessContext.service || "nvr"))}
      ${renderKvRow("Version", String(display.serviceVersion || "unknown"))}
      ${renderKvRow("Health", String(display.status || "online"))}
      ${viewerIsOwner() ? renderKvRow("Admin", cameraInventoryError ? "gateway update required" : "available") : ""}
    </section>
    <section class="nestedPanel">
      <div class="summaryLabel">Gateway</div>
      ${renderKvRow("Gateway", gatewayLabelForContext(serviceAccessContext))}
      ${renderKvRow("Access scope", viewerIsOwner() ? "owner" : "granted")}
      ${renderKvRow("Access", accessSummary)}
      ${!viewerIsOwner() ? renderKvRow("Live scope", formatCameraScope(grantedScope.viewSources || []) || "granted cameras") : ""}
      ${!viewerIsOwner() && PTZ_UI_ENABLED ? renderKvRow("PTZ scope", formatCameraScope(grantedScope.controlSources || []) || "none") : ""}
    </section>
    ${
      viewerIsOwner()
        ? `<section class="nestedPanel">
      <div class="summaryLabel">Camera Network</div>
      ${renderCameraNetworkSummary(network)}
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
  const grantedScope = serviceAccessContext?.display?.grantedScope || {};
  const live = formatCameraScope(grantedScope.viewSources || []) || "granted cameras";
  if (!PTZ_UI_ENABLED) {
    return `Granted access • live ${live}`;
  }
  const ptz = formatCameraScope(grantedScope.controlSources || []) || "none";
  return `Granted access • live ${live} • PTZ ${ptz}`;
}

function cameraAccessSummary(camera: ServiceAccessCameraDisplay | null): string {
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
  const focusSnapshot = captureCameraSettingsFocus();
  cameraListEl.innerHTML = "";
  if (!serviceAccessContext) return;
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
    .map((row) => serviceAccessCameraInfo(String(row.sourceId || "").trim()) || {
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
      const info = serviceAccessCameraInfo(sourceId) || camera;
      const mounted = mountedCameraRecord(sourceId);
      const item = document.createElement("article");
      item.className = "cameraListItem";
      item.dataset.sourceId = sourceId;
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
          <button type="button" class="cameraActionButton" data-action="focus" title="Focus this camera in Live">↗</button>
          <button type="button" class="cameraActionButton" data-action="settings" title="Camera settings">⚙</button>
        </div>
      `;
      item.querySelector<HTMLButtonElement>("button[data-action='focus']")?.addEventListener("click", () => {
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

  if (viewerIsOwner() && cameraInventory?.candidateDevices?.length) {
    const section = document.createElement("section");
    section.className = "nestedPanel";
    section.innerHTML = `<div class="summaryLabel">Discovery Candidates</div>`;
    for (const candidate of cameraInventory.candidateDevices) {
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
  restoreCameraSettingsFocus(focusSnapshot);
}

function buildCameraSettingsTray(sourceId: string): HTMLElement {
  const camera = serviceAccessCameraInfo(sourceId);
  const mounted = mountedCameraRecord(sourceId);
  const caps = mounted?.capabilities || {};
  const canAdmin = ownerCanAdmin();
  const tray = document.createElement("section");
  tray.className = "cameraSettingsTray";
  tray.dataset.sourceId = sourceId;
  if (!camera) {
    tray.innerHTML = `<article class="emptyState emptyStateTight"><strong>Camera not found</strong><p>Select another camera to continue.</p></article>`;
    return tray;
  }

  const draft = cameraSettingsDraft(sourceId);
  const vendor = String(mounted?.vendor || mounted?.observed?.vendor || "").trim();
  const model = String(mounted?.model || mounted?.observed?.model || "").trim();
  const driverId = String(mounted?.driverId || mounted?.observed?.driverId || "").trim();
  const currentPose = currentPoseBySourceId.get(sourceId) || mounted?.currentPose || mounted?.observed?.currentPose || {};
  const poseStatus = String(poseStatusBySourceId.get(sourceId) || mounted?.poseStatus || mounted?.observed?.poseStatus || "idle").trim() || "idle";
  const adminWarning = viewerIsOwner() && !!cameraInventoryError;
  const showPtzSummary = !!(PTZ_UI_ENABLED && (caps.ptz || camera.ptzCapable || mounted?.observed?.ptzCapable));

  const summaryPanel = document.createElement("section");
  summaryPanel.className = "nestedPanel";
  summaryPanel.innerHTML = `
    <div class="summaryLabel">Camera Summary</div>
    ${driverId ? renderKvRow("Driver", driverId) : ""}
    ${vendor ? renderKvRow("Vendor", vendor) : ""}
    ${model ? renderKvRow("Model", model) : ""}
    ${renderKvRow("Access", cameraAccessSummary(camera))}
    ${showPtzSummary ? renderKvRow("PTZ", camera.controlGranted ? "owner control ready" : "available") : ""}
    ${showPtzSummary ? renderKvRow("Pose", formatPose(currentPose, poseStatus)) : ""}
  `;
  tray.appendChild(summaryPanel);

  if (adminWarning) {
    const blockedPanel = document.createElement("section");
    blockedPanel.className = "nestedPanel";
    blockedPanel.innerHTML = `
      <div class="summaryLabel">Administration</div>
      <p class="panelHint warnText">${escapeHtml(cameraInventoryError || "Camera administration is degraded right now.")}</p>
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

  if (caps.overlayText || caps.overlayTimestamp) {
    const timePanel = document.createElement("section");
    timePanel.className = "cameraSection";
    timePanel.innerHTML = `
      <div class="summaryLabel">Overlay</div>
      <div class="cameraSectionBody cameraConfigGrid">
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
      const previousDraft = cameraSettingsDraft(sourceId);
      const value = input instanceof HTMLInputElement && input.type === "checkbox" ? input.checked : input.value;
      updateCameraSettingsDraft(sourceId, { [field]: value } as Partial<CameraSettingsDraft>);
      if (field === "displayName") {
        const next = cameraSettingsDraft(sourceId);
        if (next.overlayText !== previousDraft.overlayText) {
          const overlayInput = configRoot.querySelector<HTMLInputElement>("input[data-field='overlayText']");
          if (overlayInput && overlayInput !== document.activeElement) {
            overlayInput.value = next.overlayText;
          }
        }
      }
    });
  }
  if (canAdmin) {
    const applyPending = cameraApplyPending.has(sourceId);
    const saveRow = document.createElement("div");
    saveRow.className = "cameraSectionActions";
    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.className = "secondary";
    saveButton.dataset.action = "apply-camera-settings";
    saveButton.textContent = applyPending ? "Applying Camera Settings…" : "Apply Camera Settings";
    saveButton.disabled = applyPending;
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
    const saveStatus = document.createElement("div");
    saveStatus.className = "cameraApplyStatus";
    saveStatus.dataset.role = "apply-status";
    saveStatus.hidden = !applyPending;
    saveStatus.setAttribute("aria-live", "polite");
    saveStatus.setAttribute("aria-busy", applyPending ? "true" : "false");
    if (applyPending) {
      saveStatus.innerHTML = `<span class="inlineSpinner" aria-hidden="true"></span><span>Applying camera settings…</span>`;
    }
    saveRow.appendChild(saveStatus);
    tray.appendChild(saveRow);
  }

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
        adminWarning
          ? `<p class="panelHint warnText">${escapeHtml(cameraInventoryError || "Camera administration is degraded right now.")}</p>`
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

function cameraCountForContext(context: ServiceAccessContext): number {
  const display = context.display || {};
  return Number(
    display.cameraCount
    || normalizeServiceAccessCameraEntries(display).length
    || display.configuredSources
    || normalizeSourceIds(display.sources).length
    || 0,
  );
}

function refreshSummary(context: ServiceAccessContext): void {
  const display = context.display || {};
  rememberResolvedResourceName(context.servicePk, display.serviceLabel);
  serviceAccessCameraInfoBySourceId.clear();
  for (const camera of normalizeServiceAccessCameraEntries(display)) {
    serviceAccessCameraInfoBySourceId.set(String(camera.sourceId || "").trim(), camera);
  }
  popGatewayEl.textContent = gatewayLabelForContext(context);
  popGatewayEl.title = context.gatewayPk;
  const cameraCount = cameraCountForContext(context);
  popServicesEl.textContent = `${serviceLabelForContext(context)} (${cameraCount} camera${cameraCount === 1 ? "" : "s"})`;
  popServicesEl.title = context.servicePk;
  refreshIdentityHandle();
  for (const sourceId of cameraTiles.keys()) {
    updateLiveTileMetadata(sourceId);
  }
  renderNvrSettingsSummary();
}

function refreshRuntimeProjectionLabels(): void {
  if (!serviceAccessContext) return;
  popGatewayEl.textContent = gatewayLabelForContext(serviceAccessContext);
  popGatewayEl.title = serviceAccessContext.gatewayPk;
  const cameraCount = cameraCountForContext(serviceAccessContext);
  popServicesEl.textContent = `${serviceLabelForContext(serviceAccessContext)} (${cameraCount} camera${cameraCount === 1 ? "" : "s"})`;
  popServicesEl.title = serviceAccessContext.servicePk;
  refreshIdentityHandle();
}

function renderServiceAccessContextTiles(context: ServiceAccessContext): boolean {
  const requestedSources = normalizeSourceIds(context.display?.sources);
  if (requestedSources.length === 0) {
    cameraTiles.clear();
    setGridEmpty("No Cameras", "The managed NVR service has not reported any enabled sources yet.");
    setConnectionState("no cameras", "warn");
    setDrawerStatus("No enabled camera sources were advertised by the NVR service.");
    return false;
  }

  const currentSources = Array.from(cameraTiles.keys());
  if (currentSources.join("\n") !== requestedSources.join("\n")) {
    cameraGridEl.innerHTML = "";
    cameraTiles.clear();
  }
  for (const sourceId of requestedSources) {
    ensureCameraTile(sourceId);
    updateLiveTileMetadata(sourceId);
    setTileState(sourceId, "connecting", "Preparing live preview…");
  }
  setConnectionState("connecting", "warn");
  setDrawerStatus("Connecting live preview in the background.");
  return true;
}

async function loadServiceAccessContext(): Promise<ServiceAccessContext> {
  const contextId = parseServiceAccessId();
  if (!contextId) return await requestDirectEntryServiceAccessContext();

  let fromRuntime: ServiceAccessContext | null = null;
  try {
    fromRuntime = await requestServiceAccessContextFromRuntime(contextId);
  } catch (error) {
    throw serviceAccessError("service_access_context", String((error as Error)?.message || error || "runtime service access context request failed"));
  }
  if (fromRuntime) return fromRuntime;
  throw serviceAccessError("service_access_context", "service access context is unavailable in the shared runtime");
}

function isDirectEntryIdleServiceAccessFailure(error: ServiceAccessError): boolean {
  if (!directEntryServiceAccessAttempted) return false;
  const detail = String(error.detail || "").toLowerCase();
  return detail.includes("no security cameras service is available")
    || detail.includes("service access context is unavailable")
    || detail.includes("shared browser runtime unavailable")
    || detail.includes("runtime broker unavailable")
    || detail.includes("runtime broker missing")
    || detail.includes("link an identity")
    || detail.includes("device key is not ready");
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

async function connectLiveGrid(context: ServiceAccessContext): Promise<void> {
  const display = context.display || {};
  app.dataset.serviceAccessStage = "service_signal";
  const requestedSources = normalizeSourceIds(display.sources);
  if (requestedSources.length === 0) {
    cancelScheduledReconnect();
    setGridEmpty("No Cameras", "The managed NVR service has not reported any enabled sources yet.");
    setConnectionState("no cameras", "warn");
    setDrawerStatus("No enabled camera sources were advertised by the NVR service.");
    void reportServiceStatus("no cameras", "The managed NVR service did not advertise any enabled sources.", "service_access_authorization");
    return;
  }

  renderServiceAccessContextTiles(context);

  setConnectionState("negotiating", "warn");
  setDrawerStatus("Negotiating live preview through the owned gateway.");
  void reportServiceStatus("negotiating", "Negotiating live preview through the owned gateway.", "service_signal");

  const rtcConfig: RTCConfiguration = {
    iceServers: buildRtcIceServers(display.iceServers),
    bundlePolicy: "max-bundle",
  };

  closePeerConnection();
  const connection = new RTCPeerConnection(rtcConfig);
  peerConnection = connection;
  transceiverSourceIds = [...requestedSources];
  const localCandidates: RTCIceCandidateInit[] = [];
  let firstTrackSeen = false;

  for (const sourceId of requestedSources) {
    connection.addTransceiver("video", { direction: "recvonly" });
    setTileState(sourceId, "connecting", "Waiting for answer from the gateway.");
  }

  connection.addEventListener("icecandidate", (event) => {
    if (peerConnection !== connection) return;
    const json = event.candidate?.toJSON();
    if (!json || !String(json.candidate || "").trim()) return;
    if (!localCandidates.some((existing) => sameIceCandidate(existing, json))) {
      localCandidates.push(json);
    }
  });

  connection.addEventListener("track", (event) => {
    if (peerConnection !== connection) return;
    cancelScheduledReconnect();
    reconnectAttemptCount = 0;
    if (!firstTrackSeen) {
      firstTrackSeen = true;
      markStartupStage("nvr.first-track");
    }
    const sourceId = sourceIdForTrack(event);
    // Bind each preview tile to the specific remote video track instead of trusting
    // browser stream grouping. Multiple remote video tracks may share one MediaStream id.
    const stream = new MediaStream([event.track]);
    attachTrackToTile(sourceId || event.track.id, stream);
    setConnectionState("live", "good");
    setDrawerStatus("Live preview connected.");
    void reportServiceStatus("live", "Receiving live H.264 preview.", "webrtc_media");
  });

  connection.addEventListener("connectionstatechange", () => {
    if (peerConnection !== connection) return;
    const state = connection.connectionState || "unknown";
    appendLog(`peer connection state -> ${state}`);
    if (state === "failed" || state === "disconnected") {
      scheduleAutomaticReconnect(`peer connection ${state}`);
    }
  });

  connection.addEventListener("iceconnectionstatechange", () => {
    if (peerConnection !== connection) return;
    const state = connection.iceConnectionState || "unknown";
    appendLog(`ice connection state -> ${state}`);
    if (state === "checking") {
      setConnectionState("checking", "warn");
      setDrawerStatus("Checking ICE connectivity.");
    } else if (state === "connected" || state === "completed") {
      cancelScheduledReconnect();
      reconnectAttemptCount = 0;
      setConnectionState("connected", "good");
      setDrawerStatus("WebRTC peer connection established.");
      void reportServiceStatus("connected", "WebRTC peer connection established.", "webrtc_media");
    } else if (state === "failed") {
      scheduleAutomaticReconnect("ice connectivity failed");
    }
  });

  const offer = await connection.createOffer();
  await connection.setLocalDescription(offer);
  await waitForIceGatheringComplete(connection);

  appendLog(`sending offer for ${requestedSources.length} source(s)`);
  markStartupStage("nvr.offer-sent");
  const result = await requestGatewaySignal("offer", {
    description: localDescriptionPayload(connection),
    candidates: localCandidates,
    sourceIds: requestedSources,
  }).catch((error) => {
    throw serviceAccessError("service_signal", String((error as Error)?.message || error || "gateway signaling failed"));
  });

  const grantedSources = extractGrantedSources(result, requestedSources);
  for (const sourceId of requestedSources) {
    if (!grantedSources.includes(sourceId)) {
      setTileState(sourceId, "unavailable", "Source was not granted by the NVR service.");
    }
  }

  const answer = extractAnswerDescription(result);
  const remoteCandidates = extractRemoteCandidates(result);
  app.dataset.serviceAccessStage = "webrtc_media";
  await connection.setRemoteDescription(answer).catch((error) => {
    throw serviceAccessError("webrtc_media", String((error as Error)?.message || error || "remote description failed"));
  });
  await addRemoteIceCandidates(connection, remoteCandidates).catch((error) => {
    throw serviceAccessError("webrtc_media", String((error as Error)?.message || error || "remote ICE candidate failed"));
  });
  appendLog("remote answer applied");
  markStartupStage("nvr.answer-applied");
  if (!hasLiveTiles()) {
    setConnectionState("connecting", "warn");
    setDrawerStatus("Waiting for live media tracks.");
  }
}

function cancelScheduledReconnect(): void {
  if (scheduledReconnectTimer) {
    window.clearTimeout(scheduledReconnectTimer);
    scheduledReconnectTimer = 0;
  }
}

function scheduleAutomaticReconnect(reason: string): void {
  if (!serviceAccessContext || scheduledReconnectTimer || reconnectInFlight) return;
  reconnectAttemptCount += 1;
  const delayMs = Math.min(5_000, 1_500 + ((reconnectAttemptCount - 1) * 1_000));
  appendLog(`scheduling automatic reconnect in ${delayMs}ms (${reason})`);
  setConnectionState("reconnecting", "warn");
  setDrawerStatus("Live preview interrupted. Reconnecting automatically.");
  for (const sourceId of cameraTiles.keys()) {
    setTileState(sourceId, "connecting", "Reconnecting live preview…");
  }
  void reportServiceStatus("reconnecting", `Live preview interrupted; reconnecting automatically (${reason}).`, "webrtc_media");
  scheduledReconnectTimer = window.setTimeout(() => {
    scheduledReconnectTimer = 0;
    reconnectInFlight = (async () => {
      let retryReason = "";
      try {
        await reconnect();
      } catch (error) {
        const detail = String((error as Error)?.message || error || "automatic reconnect failed");
        appendLog(`automatic reconnect failed: ${detail}`);
        setConnectionState("reconnect failed", "bad");
        setDrawerStatus(detail);
        markAllTiles("unavailable", "Live preview unavailable.");
        void reportServiceStatus("degraded", detail, "webrtc_media");
        retryReason = detail;
      } finally {
        reconnectInFlight = null;
        if (retryReason) scheduleAutomaticReconnect(retryReason);
      }
    })();
  }, delayMs);
}

async function reconnect(): Promise<void> {
  cancelScheduledReconnect();
  if (!serviceAccessContext) {
    serviceAccessContext = await loadServiceAccessContext();
  }
  refreshSummary(serviceAccessContext);
  await connectLiveGrid(serviceAccessContext);
}

function handleNonFatalLiveFailure(error: unknown): void {
  const serviceAccessFailure = asServiceAccessError(error, "webrtc_media");
  console.error(serviceAccessFailure);
  closePeerConnection();
  app.dataset.serviceAccessStage = serviceAccessFailure.stage;
  setConnectionState("unavailable", "bad");
  setDrawerStatus(serviceAccessFailure.detail);
  if (cameraTiles.size > 0) {
    markAllTiles("unavailable", "Live preview unavailable.");
  } else {
    setGridEmpty("Live Preview Unavailable", serviceAccessFailure.detail);
  }
  addNotification("bad", "Live preview unavailable", serviceAccessFailure.detail, "app");
  appendLog(`degraded [${serviceAccessFailure.stage}] ${serviceAccessFailure.detail}`);
  void reportServiceStatus("degraded", serviceAccessFailure.detail, serviceAccessFailure.stage);
  scheduleAutomaticReconnect(serviceAccessFailure.detail);
}

function closePeerConnection(): void {
  cancelScheduledReconnect();
  if (peerConnection) {
    try {
      peerConnection.close();
    } catch {}
    peerConnection = null;
  }
}

function fireAndForgetSessionClose(): void {
  if (!serviceAccessContext || !runtimePort) return;
  try {
    const requestId = randomOpaqueId("nvr-close");
    runtimePort.postMessage({
      type: BROKER.SERVICE_SIGNAL_REQUEST,
      requestId,
      payload: {
        requestId,
        gatewayPk: serviceAccessContext.gatewayPk,
        servicePk: serviceAccessContext.servicePk,
        service: serviceAccessContext.service || "nvr",
        serviceCapability: serviceAccessContext.serviceCapability,
        signalType: "session_close",
        payload: { reason: "page_unload" },
      },
    });
  } catch {}
}

function bindUi(): void {
  btnBellEl.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleNotificationMenu();
  });
  btnNotifClearEl.addEventListener("click", () => {
    notifications.splice(0, notifications.length);
    renderNotifications();
  });

  btnMenuEl.addEventListener("click", openDrawer);
  btnDrawerCloseEl.addEventListener("click", closeDrawer);
  drawerBackdropEl.addEventListener("click", closeDrawer);
  document.addEventListener("click", (event) => {
    if (notificationMenuOpen && !notifMenuEl.contains(event.target as Node) && !btnBellEl.contains(event.target as Node)) {
      closeNotificationMenu();
    }
    if (accountCenterOpen && !accountCenterMenuEl.contains(event.target as Node) && !accountRailButtonEl.contains(event.target as Node)) {
      closeAccountCenter();
    }
  });

  connWrapEl.addEventListener("mouseenter", () => connPopoverEl.classList.remove("hidden"));
  connWrapEl.addEventListener("mouseleave", () => connPopoverEl.classList.add("hidden"));
  accountRailButtonEl.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleAccountCenter();
  });

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
  void reportServiceStatus("idle", "Constitute NVR window closed.", "service_signal");
  fireAndForgetSessionClose();
  closePeerConnection();
});

installDiagnosticsBridge();
applyDiagnosticsMode();
bindUi();
renderCameraRefreshStatus();
renderAccountCenter();
setDrawerStatus("Waiting for account runtime.");
renderNotifications();
refreshIdentityHandle();
syncUiToHash();

async function bootstrap(): Promise<void> {
  setBootSplash("Connecting");
  setConnectionState("loading", "neutral");
  setDrawerStatus("Preparing Security Cameras.");
  app.dataset.serviceAccessStage = "service_access_context";
  appendLog("bootstrapping managed NVR app surface");
  markStartupStage("nvr.boot.start");
  void reportServiceStatus("loading", "Bootstrapping managed NVR app surface.", "service_access_context");

  serviceAccessContext = await loadServiceAccessContext();
  serviceAccessContext = await persistServiceAccessContext(serviceAccessContext);
  appendLog(`service access context loaded for service ${pkLabel(serviceAccessContext.servicePk)}`);
  markStartupStage("nvr.service-access-context.loaded");
  refreshSummary(serviceAccessContext);
  renderServiceAccessContextTiles(serviceAccessContext);
  syncUiToHash();
  dismissBootSplash();
  markStartupStage("nvr.first-paint");
  void fetchGrantInventory().catch(() => {});
  void refreshCameraInventory().catch((error) => {
    addNotification("warn", "Camera inventory unavailable", String((error as Error)?.message || error), "camera", {
      activity: "settings",
      settingsTab: "cameras",
    });
  });
  void reconnect().catch((error) => {
    handleNonFatalLiveFailure(error);
  });
}

void bootstrap().catch((error) => {
  const serviceAccessFailure = asServiceAccessError(error, "service_access_context");
  closePeerConnection();
  dismissBootSplash();
  app.dataset.serviceAccessStage = serviceAccessFailure.stage;
  const message = serviceAccessFailure.detail;
  if (isDirectEntryIdleServiceAccessFailure(serviceAccessFailure)) {
    console.warn(serviceAccessFailure);
    setConnectionState("idle", "neutral");
    const lowerMessage = message.toLowerCase();
    const accountRequired = lowerMessage.includes("link an identity") || lowerMessage.includes("device key is not ready");
    const title = accountRequired
      ? "Account Required"
      : "No Security Cameras Service";
    const body = accountRequired
      ? "Open Account Center to finish onboarding, then Security Cameras will open directly."
      : "Connect an account with access to an NVR service, then this app will open it directly.";
    setDrawerStatus(accountRequired
      ? "Account setup is required before Security Cameras can connect."
      : "No Security Cameras service is currently available from this account runtime.");
    setGridEmpty(title, body);
    addNotification("warn", "Security Cameras unavailable", message, "app");
    appendLog(`idle [${serviceAccessFailure.stage}] ${message}`);
    void reportServiceStatus("idle", message, serviceAccessFailure.stage);
    return;
  }
  console.error(serviceAccessFailure);
  setConnectionState("error", "bad");
  setDrawerStatus(serviceAccessFailure.detail);
  setGridEmpty("Service Access Failed", `${serviceAccessFailure.stage}: ${message}`);
  addNotification("bad", "Service access failed", message, "app");
  appendLog(`fatal [${serviceAccessFailure.stage}] ${message}`);
  void reportServiceStatus("error", message, serviceAccessFailure.stage);
});
