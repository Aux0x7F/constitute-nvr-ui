import "constitute-ui/styles.css";
import "./styles.css";
import { prepareRuntimeReadModel, renderActionList, setConnectionStateText } from "constitute-ui";
import { createKeyValueGrid } from "constitute-ui";
import { nvrSurfaceApp, nvrSurfaceAttachContext } from "./surface-app-contract.js";
import {
  NVR_PREVIEW_SOURCE_LIMIT,
  NVR_STREAM_EVENT_LIMIT,
  nvrPlatformAdapterBindingPosture,
  nvrPlatformAdapterModule,
  nvrProductViewModule,
  nvrProjectionModelModule,
  nvrRuntimeClientModule,
  nvrServiceSurfaceAdapterBindingPosture,
  nvrServiceSurfaceAdapterModule,
  nvrSurfaceBudgets,
  nvrSurfaceModules,
} from "./surface-modules";
import {
  PLATFORM_RUNTIME_BUILD_ID as RUNTIME_WORKER_BUILD_ID,
  RUNTIME_AUTHORITY_POSTURE_GET,
  RUNTIME_MEDIA_FULFILLMENT_EVIDENCE_PUT,
  RUNTIME_MEDIA_TRANSPORT_OBSERVATION_PUT,
  RUNTIME_MEDIA_TRANSPORT_PROFILE_GET,
  RUNTIME_STREAM_CLOSE,
  RUNTIME_STREAM_CONTROL,
  RUNTIME_STREAM_OPEN,
  RUNTIME_STREAM_RECOVERY_REQUEST,
  runtimeAttachDebugInfo,
  runtimeAuthorityPayloadFromContext,
  runtimeSharedWorkerName,
  runtimeWorkerScriptUrl as accountRuntimeWorkerScriptUrl,
} from "../../constitute-account/runtime-contract.js";
import { RUNTIME_DIAGNOSTIC_OPERATOR_PLANES, attachRuntimeDiagnostics } from "../../constitute-account/runtime-diagnostics.js";
import {
  browserStorageShellContext,
  deriveRuntimeMaterializationPosture,
} from "constitute-ui/runtime-shell-state";
import {
  adapterReconnectDelayMs,
  adapterReconnectJitterMs,
  adapterReconnectLifecyclePosture,
  adapterReleaseLifecyclePosture,
} from "constitute-ui/adapter-lifecycle";
import {
  applyRuntimeActivationPostureToStreamSession,
  applyRuntimeStreamLifecycleToStreamSession,
  applyRuntimeMediaFulfillmentPostureToStreamSession,
  applyRuntimeRouteObservationToStreamSession,
  collectRuntimeActivationKeys,
  collectRuntimeIntentResultKeys,
  collectRuntimeMediaFulfillmentKeys,
  collectRuntimeObservationKeys,
  collectRuntimeStreamFrameKeys,
  runtimeIntentFrameId,
  runtimeIntentPendingRoute,
  runtimeIntentState,
  runtimeIntentWaitingAuthority,
  runtimeRouteObservationPosture,
  runtimeStreamSessionPosture as summarizeRuntimeStreamSessionPosture,
} from "constitute-ui/runtime-stream-session";
import { preparedServiceRegistryServices } from "constitute-ui";
import {
  MEDIA_RENDER_BLOCKED_GRACE_MS,
  MEDIA_RENDER_WAITING_GRACE_MS,
  type BrowserStreamAdapterState,
  type BrowserStreamSession,
  type RuntimeMediaTransportProfile,
} from "./browser-stream-adapter";
import {
  NVR_AUTO_PREVIEW_SOURCE_ID,
  type GrantedScope,
  type RuntimeCameraAccessDisplay,
  type RuntimeServiceDisplay,
} from "./nvr-projection-model";
import {
  STREAM_SESSION_LIFECYCLE_PHASE,
  SWARM,
  streamSessionLifecycleRecordFromCarrier,
  type MediaFulfillmentEvidence,
  type MediaTransportObservation,
} from "constitute-protocol";

const {
  applyBrowserStreamAnswer,
  applyBrowserStreamCandidate,
  bindBrowserMediaStream,
  browserStreamAvailable,
  candidateKey,
  collectBrowserMediaFulfillmentEvidence,
  closeBrowserStreamSession,
  createBrowserStreamOffer,
  isRuntimeMediaTransportProfileFailure,
  mediaFulfillmentEvidenceFromAdapterState,
  mediaFulfillmentEvidenceFromRender,
  mediaFulfillmentEvidenceFromTrack,
  mediaFulfillmentReleaseEvidence,
  mediaTransportObservationFromFulfillmentEvidence,
  runtimeMediaIceServers,
  runtimeMediaTransportBlockedDetail,
  runtimeMediaTransportContract,
  shouldReportMediaFulfillmentEvidence,
} = nvrPlatformAdapterModule;

const {
  cameraCountForContext,
  humanizeSourceId,
  normalizeRuntimeCameraEntries,
  normalizeSourceIds,
  nvrDisplayFromRecord,
} = nvrProjectionModelModule;

const { createNvrAdminAdapter, normalizeNvrAdminAdapterError } = nvrServiceSurfaceAdapterModule;
const { renderShell } = nvrProductViewModule;

const nvrRuntimeAttachContext = Object.freeze({
  ...nvrSurfaceAttachContext,
  activeRuntimeClientModuleRef: nvrSurfaceModules.runtimeClient.moduleRef,
  materializationBudgetRefs: Object.freeze(Object.values(nvrSurfaceBudgets).map((budget) => String(budget.budgetId || ""))),
});

const LEGACY_DISCOVERY_SCOPE_FIELD = ["zone", "Scope"].join("");
const LEGACY_DISCOVERY_SCOPE_SNAKE_FIELD = ["zone", "_scope"].join("");

type RuntimeDiscoveryScope = {
  zoneId: string;
  privacy?: string;
  ttl?: number;
  maxHops?: number;
};

type RuntimeServiceContext = {
  contextId: string;
  app: string;
  repo: string;
  identityId: string;
  devicePk: string;
  gatewayPk: string;
  servicePk: string;
  service: string;
  discoveryScope?: RuntimeDiscoveryScope;
  hostFabric?: Record<string, unknown>;
  legacyPathFallback?: {
    state: "legacyPathFallback";
    reason: string;
    sourceRefs: string[];
  };
  display?: RuntimeServiceDisplay;
  createdAt: number;
  expiresAt: number;
};

type SwarmEdgeAttachOptions = {
  force?: boolean;
};

type RuntimePreparedStage =
  | "surface_load"
  | "runtime_context"
  | "runtime_directory"
  | "runtime_intent"
  | "stream_projection"
  | "stream_adapter";

type RuntimeAuthorityPosture = {
  state?: string;
  ready?: boolean;
  reason?: string;
  blockedAuthorityDomain?: string;
  devicePk?: string;
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
  streamStatus: HTMLDivElement;
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
  serviceCatalog?: unknown;
  edge?: Record<string, unknown>;
  swarmQueue?: Record<string, unknown>;
  projections?: Record<string, unknown> | unknown[];
  projectionCoverage?: Record<string, unknown>;
  projectionPolicies?: Record<string, unknown>;
  activationResolutions?: Record<string, Record<string, unknown>>;
  mediaFulfillment?: Record<string, Record<string, unknown>>;
  streamRecovery?: Record<string, Record<string, unknown>>;
  managedAppliances?: {
    owned?: Array<Record<string, unknown>>;
    granted?: Array<Record<string, unknown>>;
    discoverable?: Array<Record<string, unknown>>;
  };
  resourceNames?: Record<string, unknown>;
  managedServiceIssue?: Record<string, unknown> | null;
  runtimeContextCount?: number;
};

type ManagedApplianceRecord = Record<string, unknown> & {
  __scope?: string;
};

type RuntimeProjectionRecord = Record<string, unknown> & {
  channelId?: string;
  service?: string;
  servicePk?: string;
  policyId?: string;
  revision?: number | string;
  retainedAt?: number;
  payload?: Record<string, unknown>;
  freshness?: Record<string, unknown>;
};

type RuntimeIntentResult = {
  ok?: boolean;
  state?: string;
  pendingAuthority?: boolean;
  authorityLifecycleState?: string;
  blockedAuthorityDomain?: string;
  authoritySummary?: Record<string, unknown>;
  frameId?: string;
  activationId?: string;
  interactionId?: string;
  routePromiseId?: string;
  correlationId?: string;
  pendingRoute?: boolean;
  frame?: Record<string, unknown>;
  result?: {
    state?: string;
    pendingAuthority?: boolean;
    authorityLifecycleState?: string;
    blockedAuthorityDomain?: string;
    frameId?: string;
    activationId?: string;
    interactionId?: string;
    routePromiseId?: string;
    correlationId?: string;
    pendingRoute?: boolean;
    frame?: Record<string, unknown>;
  };
  error?: string;
};

type RuntimeStreamSession = BrowserStreamSession & {
  serviceAdmissionTimedOut?: boolean;
  runtimeBlockedReason?: string;
  mediaPathState?: string;
  mediaBlockedReason?: string;
  mediaVisibleFrame?: boolean;
  mediaTrackLive?: boolean;
  mediaTransportUsable?: boolean;
};

type NvrProjectionState = {
  health: Record<string, unknown> | null;
  cameras: MountedCameraRecord[];
  cameraNetwork: CameraNetworkSummaryRecord | null;
  streamSources: string[];
  streamStatusRecords: Array<Record<string, unknown>>;
  storagePinIntents: Array<Record<string, unknown>>;
  projectionRecords: Record<string, RuntimeProjectionRecord>;
  updatedAt: number;
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
const ACCOUNT_IDENTITY_CACHE_KEY = "swarm.identityCache";
const ACCOUNT_DEVICE_CACHE_KEY = "swarm.deviceCache";
const ACCOUNT_GATEWAY_HOSTED_SNAPSHOTS_KEY = "constitute.gatewayHostedSnapshots";
const ACCOUNT_GATEWAY_EXTRA_ZONES_KEY = "constitute.gateway.extraZones";
const RUNTIME_STREAM_INTENT_TIMEOUT_MS = 30_000;
const RUNTIME_STREAM_LIVE_WATCHDOG_MS = 8_000;
const RUNTIME_STREAM_MEDIA_STATS_POLL_MS = 5_000;
const RUNTIME_STREAM_RECONNECT_BASE_MS = 3_000;
const RUNTIME_STREAM_RECONNECT_MAX_MS = 90_000;
const RUNTIME_STREAM_RECOVERY_PARENT_INTENT_ID = "nvr-live-preview";
const RUNTIME_AUTHORITY_RECONNECT_BASE_MS = 1_500;
const RUNTIME_AUTHORITY_RECONNECT_MAX_MS = 30_000;
const RUNTIME_SWARM_EDGE_ATTACH_REPAIR_RETRY_MS = 30_000;
const RUNTIME_SWARM_EDGE_ATTACH_REPAIR_MAX_BACKOFF_MS = 120_000;
const ADMIN_INTENT_TIMEOUT_MS = 135_000;
const CAMERA_APPLY_REQUEST_TIMEOUT_MS = 135_000;
const GRANT_REQUEST_TIMEOUT_MS = 30_000;
const RUNTIME_ATTACH_TIMEOUT_MS = 12_000;
const RUNTIME_WRITE_TIMEOUT_MS = 10_000;
const RUNTIME_AUTHORITY_WAIT_TIMEOUT_MS = 15_000;
const RUNTIME_AUTHORITY_POLL_MS = 350;
const DIRECT_ENTRY_ACCOUNT_HYDRATION_TIMEOUT_MS = 15_000;
const DIRECT_ENTRY_ACCOUNT_HYDRATION_POLL_MS = 350;
const DIRECT_ENTRY_ACCOUNT_HYDRATED_SETTLE_MS = 2_000;
const DIRECT_ENTRY_REPAIR_DELAY_MS = 1_500;
const DIRECT_ENTRY_REPAIR_MAX_DELAY_MS = 5_000;
const DIRECT_ENTRY_REPAIR_MAX_ATTEMPTS = 30;
const PTZ_STEP_DEGREES = 10;
const PTZ_STEP_NORMALIZED = PTZ_STEP_DEGREES / 180;
// Keep PTZ hidden until the driver reports a verified control surface.
// The current Reolink control path is not reliable enough to expose generically.
const PTZ_UI_ENABLED = false;
const NVR_PROJECTION_CHANNELS = Object.freeze([
  "nvr.surface",
  "nvr.health",
  "nvr.cameras",
  "nvr.cameraNetwork",
  "nvr.streams",
]);

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
const runtimeCameraInfoBySourceId = new Map<string, RuntimeCameraAccessDisplay>();
const notifications: NotificationEntry[] = [];

let runtimeClient: ReturnType<typeof nvrRuntimeClientModule.createRuntimeSurfaceClient> | null = null;
let runtimePort: MessagePort | null = null;
let runtimeAttached = false;
let runtimeDiagnosticsAgent: ReturnType<typeof attachRuntimeDiagnostics> | null = null;
let runtimeMaterializationBudget: Record<string, unknown> | null = null;
let runtimeConsumerFloor: Record<string, unknown> | null = null;
let runtimeReadModel = prepareRuntimeReadModel(null, runtimeReadModelOptions());
let runtimeMaterializationPosture: ReturnType<typeof deriveRuntimeMaterializationPosture> = deriveRuntimeMaterializationPosture(null);
let runtimeServiceContext: RuntimeServiceContext | null = null;
let directEntryRepairTimer = 0;
let directEntryRepairInFlight: Promise<void> | null = null;
let directEntryRepairAttemptCount = 0;
let diagnosticsEnabled = false;
let bootSplashDismissed = false;
let grantInventory: GrantInventory | null = null;
let currentActivity: NvrActivity = "live";
let currentSettingsTab: NvrSettingsTab = "nvr";
let selectedCameraId = "";
let ptzActiveSourceId = "";
let selectedLiveCameraId = "";
let runtimeBaseline: RuntimeSnapshot | null = null;
const resolvedResourceNames = new Map<string, string>();
const cameraSettingsDrafts = new Map<string, CameraSettingsDraft>();
const dirtyCameraSettings = new Set<string>();
const cameraApplyPending = new Set<string>();
const candidateMountDrafts = new Map<string, CandidateMountDraft>();
const cameraProbeResults = new Map<string, ProbeResultRecord>();
const currentPoseBySourceId = new Map<string, CameraPoseView>();
const desiredPoseBySourceId = new Map<string, CameraPoseView>();
const poseStatusBySourceId = new Map<string, string>();
const runtimeStreamSessionsByFrameId = new Map<string, RuntimeStreamSession>();
const runtimeStreamSessionsBySessionId = new Map<string, RuntimeStreamSession>();
const runtimeStreamSessionsByCorrelationKey = new Map<string, RuntimeStreamSession>();
const knownCandidateIds = new Set<string>();
const unboundRuntimeStreamFrameKeys = new Set<string>();
let nvrProjectionState: NvrProjectionState = {
  health: null,
  cameras: [],
  cameraNetwork: null,
  streamSources: [],
  streamStatusRecords: [],
  storagePinIntents: [],
  projectionRecords: {},
  updatedAt: 0,
};
let cameraInventory: CameraInventoryRecord | null = null;
let cameraInventoryLoading = false;
let cameraInventoryError = "";
let cameraInventoryRefreshPromise: Promise<void> | null = null;
let expandedCandidateId = "";
let notificationMenuOpen = false;
let accountCenterOpen = false;
let scheduledReconnectTimer = 0;
let streamLiveWatchdogTimer = 0;
let reconnectInFlight: Promise<void> | null = null;
let reconnectScheduleInFlight = false;
let routeBaselineNoticeAt = 0;
let swarmEdgeAttachRepairTarget = "";
let swarmEdgeAttachRepairAttemptedAt = 0;
let swarmEdgeAttachRepairBackoffUntil = 0;
let swarmEdgeAttachRepairFailureCount = 0;
let swarmEdgeAttachRepairInFlight: Promise<boolean> | null = null;
let swarmEdgeAttachRepairInFlightTarget = "";
let reconnectAttemptCount = 0;
let accountBridgeFrame: HTMLIFrameElement | null = null;
let accountBridgePromise: Promise<void> | null = null;

function ptzUiCapable(camera: RuntimeCameraAccessDisplay | null | undefined): boolean {
  return PTZ_UI_ENABLED && camera?.ptzCapable === true;
}

function ptzUiInteractive(camera: RuntimeCameraAccessDisplay | null | undefined): boolean {
  return PTZ_UI_ENABLED && camera?.ptzCapable === true && camera?.controlGranted === true;
}

class RuntimeContextError extends Error {
  stage: RuntimePreparedStage;
  detail: string;

  constructor(stage: RuntimePreparedStage, detail: string) {
    super(`${stage}: ${detail}`);
    this.name = "RuntimeContextError";
    this.stage = stage;
    this.detail = detail;
  }
}

function runtimeContextError(stage: RuntimePreparedStage, detail: string): RuntimeContextError {
  return new RuntimeContextError(stage, String(detail || "Unknown error").trim() || "Unknown error");
}

function asRuntimeContextError(error: unknown, fallbackStage: RuntimePreparedStage): RuntimeContextError {
  if (error instanceof RuntimeContextError) return error;
  return runtimeContextError(fallbackStage, String((error as Error)?.message || error || "Unknown error"));
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
  runtimeBaseline = (snapshot && typeof snapshot === "object") ? snapshot as RuntimeSnapshot : null;
  refreshRuntimeReadModel(runtimeBaseline);
  const names = runtimeBaseline?.resourceNames;
  if (names && typeof names === "object") {
    for (const [pk, label] of Object.entries(names)) {
      rememberResolvedResourceName(pk, label);
    }
  }
  applyRuntimeActivationPostureFromSnapshot();
  applyRuntimeMediaFulfillmentPostureFromSnapshot();
  applyNvrRuntimeProjections();
  if (!runtimeServiceContext && directEntryNvrServiceRecord(runtimeBaseline)) {
    scheduleDirectEntryRuntimeRepair("runtime snapshot advertised Security Cameras");
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

function serviceLabelForContext(context: RuntimeServiceContext | null): string {
  if (!context) return "Constitute NVR";
  const explicit = String(context.display?.serviceLabel || "").trim();
  if (explicit) return explicit;
  return resolvedResourceName(context.servicePk, shortPk(context.servicePk));
}

function gatewayLabelForContext(context: RuntimeServiceContext | null): string {
  if (!context) return "—";
  return resolvedResourceName(context.gatewayPk, shortPk(context.gatewayPk));
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
  const base = runtimeCameraInfoBySourceId.get(key);
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
    contextId: String(params.get("context") || "").trim(),
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
  if (current.contextId) params.set("context", current.contextId);
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

function parseRuntimeContextId(): string {
  return readUiState().contextId;
}

function readDiagnosticsPreference(): boolean {
  const hash = hashParams();
  const query = new URLSearchParams(window.location.search || "");
  const requested = String(
    query.get("diagnostics") ||
    query.get("diag") ||
    query.get("debug") ||
    hash.get("diagnostics") ||
    hash.get("diag") ||
    hash.get("debug") ||
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

function shellDeriveContext(context: RuntimeServiceContext | null = runtimeServiceContext): Record<string, unknown> {
  return context || browserStorageShellContext();
}

function runtimeReadModelOptions(context: RuntimeServiceContext | null = null): Record<string, unknown> {
  return {
    context: shellDeriveContext(context),
    adapterLive: hasAllExpectedLiveTiles(context),
    materializationBudget: runtimeMaterializationBudget || undefined,
    consumerFloor: runtimeConsumerFloor || undefined,
    now: Date.now(),
    clientId: "nvr-ui",
    surface: "constitute-nvr-ui",
  };
}

function refreshRuntimeReadModel(snapshot: RuntimeSnapshot | null = runtimeBaseline): void {
  runtimeReadModel = prepareRuntimeReadModel((snapshot || {}) as Record<string, unknown>, runtimeReadModelOptions(runtimeServiceContext));
}

function identityHandleForContext(context: RuntimeServiceContext | null): string {
  const shellState = runtimeReadModel.shell as Record<string, any>;
  if (!shellState.identity.linked) return "@unlinked";
  const runtimeHandle = shellState.identity.handle;
  if (runtimeHandle !== "@linked") return runtimeHandle;
  const identityId = shellState.identity.identityId || String(context?.identityId || "").trim();
  const label = String(resolvedResourceNames.get(identityId) || "").trim().replace(/^@+/, "");
  return label ? `@${label}` : runtimeHandle;
}

function refreshIdentityHandle(): void {
  const shellState = runtimeReadModel.shell as Record<string, any>;
  identityHandleEl.textContent = identityHandleForContext(runtimeServiceContext);
  identityHandleEl.classList.toggle("identityHandle-linked", shellState.identity.linked);
  identityHandleEl.classList.toggle("identityHandle-unlinked", !shellState.identity.linked);
  identityHandleEl.title = shellState.identity.title;
  identityHandleEl.setAttribute("aria-label", shellState.identity.ariaLabel);
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
  accountCenterSummaryEl.replaceChildren();
  renderActionList(accountCenterActionsEl, [
    {
      id: "account.open_center",
      label: "Open Account Center",
      description: "Open constitute-account.",
      onSelect: () => openAccountCenterApp("activity=home"),
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
  return accountRuntimeWorkerScriptUrl(window.location.origin);
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

function handleRuntimeMessage(message: unknown): boolean {
  if (!message || typeof message !== "object") return false;
  const payload = message as Record<string, unknown>;
  if (runtimeDiagnosticsAgent?.handleMessage(payload)) return true;
  const type = String(payload.type || "").trim();
  if (type === "runtime.attached" || type === "runtime.snapshot") {
    return false;
  }
  if (type === "runtime.ack") {
    return true;
  }
  if (type === "swarm.edge.ack") {
    return true;
  }
  if (type === "swarm.edge.reject") {
    const rejection = payload.rejection && typeof payload.rejection === "object" ? payload.rejection as Record<string, unknown> : {};
    const error = rejection.error && typeof rejection.error === "object" ? rejection.error as Record<string, unknown> : {};
    const detail = String(error.message || error.code || "runtime route rejected").trim();
    setConnectionState("unavailable", "bad");
    setDrawerStatus(detail);
    if (cameraTiles.size > 0) markAllTiles("unavailable", detail);
    return true;
  }
  if (type === "swarm.edge.routeObservation") {
    handleRuntimeRouteObservation(payload.observation as Record<string, unknown> | undefined);
    return true;
  }
  if (type === "swarm.edge.frame") {
    handleRuntimeStreamFrame(payload.frame as Record<string, unknown> | undefined);
    return true;
  }
  return false;
}

function handleRuntimeRouteObservation(observation: Record<string, unknown> | undefined): void {
  if (!observation || typeof observation !== "object") return;
  const posture = runtimeRouteObservationPosture(observation) as {
    routeDelivered?: boolean;
    routeDegraded?: boolean;
    routeReleased?: boolean;
    routeRejected?: boolean;
    routeState?: string;
    detail?: string;
  };
  const session = streamSessionForRuntimeKeys(collectRuntimeObservationKeys(observation));
  if (session) applyRuntimeRouteObservationToStreamSession(session, observation);
  const detail = String(posture.detail || "route observation").trim();
  if (posture.routeDelivered) {
    if (hasAllExpectedLiveTiles()) {
      setConnectionState("live", "good");
      setDrawerStatus("Live preview connected.");
      return;
    }
    setConnectionState("connecting", "warn");
    const routeStatus = posture.routeState === "routeAccepted"
      ? "Stream route carrier acknowledged."
      : "Stream route delivered.";
    setDrawerStatus(routeStatus);
    return;
  }
  if (posture.routeDegraded) {
    setConnectionState("degraded", "warn");
    setDrawerStatus(detail || "Stream route degraded.");
    if (cameraTiles.size > 0) markAllTiles("connecting", detail || "Stream route degraded.");
    return;
  }
  if (posture.routeReleased) {
    setConnectionState("unavailable", "warn");
    setDrawerStatus(detail || "Stream route closed.");
    if (cameraTiles.size > 0) markAllTiles("unavailable", detail || "Stream route closed.");
    return;
  }
  if (posture.routeRejected) {
    setConnectionState("unavailable", "bad");
    setDrawerStatus(detail || "Stream route unreachable.");
    if (cameraTiles.size > 0) markAllTiles("unavailable", detail || "Stream route unreachable.");
  }
}

function streamSessionForFrame(frame: Record<string, unknown>, record: Record<string, unknown>): RuntimeStreamSession | null {
  return streamSessionForRuntimeKeys(collectRuntimeStreamFrameKeys(frame, record));
}

function streamSessionForRuntimeKeys(keys: Set<string>): RuntimeStreamSession | null {
  for (const key of keys) {
    if (runtimeStreamSessionsBySessionId.has(key)) return runtimeStreamSessionsBySessionId.get(key) || null;
    if (runtimeStreamSessionsByFrameId.has(key)) return runtimeStreamSessionsByFrameId.get(key) || null;
    if (runtimeStreamSessionsByCorrelationKey.has(key)) return runtimeStreamSessionsByCorrelationKey.get(key) || null;
  }
  return null;
}

function applyRuntimeActivationPostureFromSnapshot(): void {
  const activations = runtimeBaseline?.activationResolutions;
  if (!activations || typeof activations !== "object") return;
  for (const activation of Object.values(activations)) {
    if (!activation || typeof activation !== "object") continue;
    const keys = collectRuntimeActivationKeys(activation);
    const session = streamSessionForRuntimeKeys(keys);
    if (!session) continue;
    applyRuntimeActivationPostureToStreamSession(session, activation);
  }
}

function applyRuntimeMediaFulfillmentPostureFromSnapshot(): void {
  const fulfillments = runtimeBaseline?.mediaFulfillment;
  if (!fulfillments || typeof fulfillments !== "object") return;
  for (const posture of Object.values(fulfillments)) {
    if (!posture || typeof posture !== "object") continue;
    const keys = collectRuntimeMediaFulfillmentKeys(posture);
    const session = streamSessionForRuntimeKeys(keys);
    if (!session) continue;
    const state = applyRuntimeMediaFulfillmentPostureToStreamSession(session, posture);
    if (state === "blocked") {
      handleRuntimeStreamStaleMedia(session, session.mediaBlockedReason || "mediaTransportBlocked");
    }
  }
}

function noteUnboundRuntimeStreamFrame(recordKind: string, keys: Set<string>): void {
  if (!recordKind.startsWith("stream.")) return;
  const displayKeys = Array.from(keys).slice(0, 4);
  const marker = `${recordKind}:${displayKeys.join("|") || "no-key"}`;
  if (unboundRuntimeStreamFrameKeys.has(marker)) return;
  if (unboundRuntimeStreamFrameKeys.size > 32) unboundRuntimeStreamFrameKeys.clear();
  unboundRuntimeStreamFrameKeys.add(marker);
  appendLog(`stream frame unbound: ${recordKind}${displayKeys.length ? ` (${displayKeys.join(", ")})` : ""}`);
}

async function applyRuntimeStreamFrame(frame: Record<string, unknown>): Promise<void> {
  const lifecycle = streamSessionLifecycleRecordFromCarrier(frame);
  if (!lifecycle) return;
  const { recordKind, phase } = lifecycle;
  const record = lifecycle.record as Record<string, unknown>;
  const frameKeys = collectRuntimeStreamFrameKeys(frame, record);
  const session = streamSessionForFrame(frame, record);
  if (!session) {
    noteUnboundRuntimeStreamFrame(recordKind, frameKeys);
    return;
  }
  if (phase === STREAM_SESSION_LIFECYCLE_PHASE.ADMISSION) {
    applyRuntimeStreamLifecycleToStreamSession(session, lifecycle as unknown as Record<string, unknown>);
    setTileState(session.sourceId, "connecting", "Stream service accepted.");
    setDrawerStatus("Stream service accepted; waiting for answer.");
    void reportServiceStatus("connecting", "Stream service accepted; waiting for answer.", "stream_projection");
    return;
  }
  if (phase === STREAM_SESSION_LIFECYCLE_PHASE.REJECT) {
    const reason = String(record.reasonCode || record.reason || "service rejected").trim();
    applyRuntimeStreamLifecycleToStreamSession(session, lifecycle as unknown as Record<string, unknown>);
    setTileState(session.sourceId, "unavailable", `Stream service rejected: ${reason}.`);
    setDrawerStatus(`Stream service rejected: ${reason}.`);
    void reportServiceStatus("unavailable", `Stream service rejected: ${reason}.`, "stream_projection");
    return;
  }
  if (phase === STREAM_SESSION_LIFECYCLE_PHASE.ANSWER) {
    const answerPayload = record.payload && typeof record.payload === "object" ? record.payload as Record<string, unknown> : {};
    const description = answerPayload.description && typeof answerPayload.description === "object"
      ? answerPayload.description as RTCSessionDescriptionInit
      : null;
    if (!description) throw new Error("stream answer missing description");
    await applyBrowserStreamAnswer(session, description);
    applyRuntimeStreamLifecycleToStreamSession(session, lifecycle as unknown as Record<string, unknown>);
    setTileState(session.sourceId, "connecting", "Live preview answer received.");
    setDrawerStatus("Stream answer received; waiting for media track.");
    void reportServiceStatus("connecting", "Stream answer received; waiting for media track.", "stream_projection");
    return;
  }
  if (phase === STREAM_SESSION_LIFECYCLE_PHASE.CANDIDATE) {
    const candidatePayload = record.payload && typeof record.payload === "object" ? record.payload as Record<string, unknown> : {};
    const candidate = candidatePayload.candidate && typeof candidatePayload.candidate === "object"
      ? candidatePayload.candidate as RTCIceCandidateInit
      : null;
    if (candidate) {
      await applyBrowserStreamCandidate(session, candidate);
    }
    return;
  }
  if (phase === STREAM_SESSION_LIFECYCLE_PHASE.HEALTH) {
    const status = String(record.status || "").trim();
    applyRuntimeStreamLifecycleToStreamSession(session, lifecycle as unknown as Record<string, unknown>);
    if (status) setTileState(session.sourceId, status === "closed" ? "unavailable" : "connecting", `Stream ${status}.`);
  }
}

function handleRuntimeStreamFrame(frame: Record<string, unknown> | undefined): void {
  if (!frame || typeof frame !== "object") return;
  void applyRuntimeStreamFrame(frame).catch((error) => {
    appendLog(`stream frame apply failed: ${String((error as Error)?.message || error)}`);
  });
}

async function ensureRuntimePort(): Promise<MessagePort | null> {
  if (runtimeClient?.attached && runtimeClient.port) return runtimeClient.port as MessagePort;
  if (typeof SharedWorker === "undefined") return null;
  if (!runtimeClient) {
    runtimeClient = nvrRuntimeClientModule.createRuntimeSurfaceClient({
      clientId: randomOpaqueId("runtime-nvr"),
      surface: "constitute-nvr-ui",
      workerUrl: runtimeWorkerUrl(),
      workerName: runtimeSharedWorkerName(),
      attachTimeoutMs: RUNTIME_ATTACH_TIMEOUT_MS,
      callTimeoutMs: RUNTIME_WRITE_TIMEOUT_MS,
      debug: diagnosticsEnabled,
      debugInfo: runtimeAttachDebugInfo(window.location.origin),
      logPrefix: "nvr-ui",
      attachContext: nvrRuntimeAttachContext,
      readModelOptions: runtimeReadModelOptions(),
      onPort: (port) => {
        runtimePort = port as MessagePort;
        runtimeAttached = false;
        runtimeDiagnosticsAgent = attachRuntimeDiagnostics({
          port: runtimePort,
          surface: "constitute-nvr-ui",
          clientId: "nvr-ui",
          enabled: diagnosticsEnabled,
          planes: [...RUNTIME_DIAGNOSTIC_OPERATOR_PLANES],
          minLevelByPlane: { diagnostic: "warn" },
          denyKinds: ["projection.applied", "projection.ignored"],
        });
      },
      onMessage: (msg) => handleRuntimeMessage(msg),
      onSnapshot: (snapshot) => {
        runtimePort = runtimeClient?.port as MessagePort | null;
        runtimeAttached = Boolean(runtimePort);
        absorbRuntimeSnapshot(snapshot);
        runtimeMaterializationPosture = deriveRuntimeMaterializationPosture(runtimeBaseline || {}, {
          materializationBudget: runtimeMaterializationBudget || undefined,
          consumerFloor: runtimeConsumerFloor || undefined,
        });
        refreshRuntimeProjectionLabels();
      },
      onReadModel: (readModel) => {
        runtimeReadModel = readModel;
        refreshIdentityHandle();
        renderNvrSettingsSummary();
      },
      onMaterializationBudget: (budget) => {
        runtimeMaterializationBudget = (budget && typeof budget === "object") ? budget as Record<string, unknown> : null;
        refreshRuntimeReadModel();
      },
      onConsumerFloor: (floor) => {
        runtimeConsumerFloor = (floor && typeof floor === "object") ? floor as Record<string, unknown> : null;
        refreshRuntimeReadModel();
      },
      onMaterializationPosture: (posture) => {
        runtimeMaterializationPosture = posture;
      },
      onAttachPosture: (posture: Record<string, unknown>) => {
        if (!posture || posture.severity === "info") return;
        appendLog(`runtime attach ${String(posture.state || "degraded")}`);
      },
      onAttachTimeout: () => {
        runtimeAttached = false;
        appendLog("runtime attach unavailable");
      },
      onAttachError: (error) => {
        runtimePort = null;
        runtimeAttached = false;
        appendLog(`runtime attach unavailable (${String((error as Error)?.message || error)})`);
      },
      onWorkerError: (event) => {
        runtimeAttached = false;
        appendLog(`runtime worker error: ${String((event as ErrorEvent)?.message || "worker failure")}`);
      },
    });
  }
  runtimePort = runtimeClient.attach() as MessagePort | null;
  const attachedPort = await runtimeClient.waitUntilAttached(RUNTIME_ATTACH_TIMEOUT_MS) as MessagePort | null;
  runtimeAttached = Boolean(attachedPort);
  return attachedPort;
}

async function runtimeCall<T = unknown>(type: string, payload: Record<string, unknown>, timeoutMs: number): Promise<T> {
  const port = await ensureRuntimePort();
  if (!port || !runtimeClient) throw new Error("shared browser runtime unavailable");
  return await runtimeClient.call(type, payload, timeoutMs) as T;
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

async function reportServiceStatus(state: string, reason: string, stage: RuntimePreparedStage | "" = ""): Promise<void> {
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

function runtimeAuthorityIsReady(posture: RuntimeAuthorityPosture | null | undefined): boolean {
  return posture?.ready === true || String(posture?.state || "").trim() === "ready";
}

function runtimeAuthorityBlockedDetail(posture: RuntimeAuthorityPosture | null | undefined): string {
  const state = String(posture?.state || "waitingAuthority").trim() || "waitingAuthority";
  const reason = String(posture?.reason || "").trim();
  const domain = String(posture?.blockedAuthorityDomain || "runtime").trim();
  return reason || `Runtime authority is ${state} for ${domain}.`;
}

function isRuntimeSwarmEdgeAuthorityWait(error: unknown): boolean {
  const detail = String((error as Error)?.message || error || "").toLowerCase();
  return detail.includes("missingruntimeauthoritymemberref")
    || (detail.includes("runtime authority") && detail.includes("waitingauthority"));
}

function markRuntimeAuthorityWaiting(posture: RuntimeAuthorityPosture | null | undefined): void {
  const detail = runtimeAuthorityBlockedDetail(posture);
  appendLog(`waiting for runtime authority: ${detail}`);
  setConnectionState("waiting authority", "warn");
  setDrawerStatus("Waiting for runtime authority.");
  for (const sourceId of cameraTiles.keys()) {
    setTileState(sourceId, "waiting", detail);
  }
  void reportServiceStatus("waitingAuthority", detail, "runtime_intent");
}

async function runtimeAuthorityPosture(): Promise<RuntimeAuthorityPosture | null> {
  return await runtimeCall<RuntimeAuthorityPosture>(RUNTIME_AUTHORITY_POSTURE_GET, {}, RUNTIME_WRITE_TIMEOUT_MS);
}

async function runtimeMediaTransportProfile(): Promise<RuntimeMediaTransportProfile> {
  try {
    const profile = await runtimeCall<RuntimeMediaTransportProfile>(RUNTIME_MEDIA_TRANSPORT_PROFILE_GET, {}, RUNTIME_WRITE_TIMEOUT_MS);
    if (!profile || typeof profile !== "object") {
      throw new Error("runtime returned no media transport profile");
    }
    return profile;
  } catch (error) {
    throw runtimeContextError("runtime_intent", runtimeMediaTransportBlockedDetail(error));
  }
}

async function waitForRuntimeAuthorityActionable(timeoutMs = RUNTIME_AUTHORITY_WAIT_TIMEOUT_MS): Promise<RuntimeAuthorityPosture | null> {
  const deadline = Date.now() + Math.max(0, timeoutMs);
  let lastPosture: RuntimeAuthorityPosture | null = null;
  let reportedWaiting = false;
  while (Date.now() <= deadline) {
    const posture = await runtimeAuthorityPosture();
    lastPosture = posture;
    if (runtimeAuthorityIsReady(posture)) return posture;
    if (!reportedWaiting) {
      reportedWaiting = true;
      markRuntimeAuthorityWaiting(posture);
      void ensureAccountBridge("runtime authority").catch(() => {});
    }
    const state = String(posture?.state || "").trim();
    if (state === "expired" || state === "revoked" || state === "ambiguous" || state === "unavailable") break;
    await delay(RUNTIME_AUTHORITY_POLL_MS);
  }
  return lastPosture;
}

function runtimeShellIdentityFromSnapshot(snapshot: RuntimeSnapshot | null): Record<string, unknown> {
  const readModel = prepareRuntimeReadModel((snapshot || {}) as Record<string, unknown>, runtimeReadModelOptions(runtimeServiceContext));
  const shell = readModel.shell && typeof readModel.shell === "object"
    ? readModel.shell as Record<string, unknown>
    : {};
  return shell.identity && typeof shell.identity === "object"
    ? shell.identity as Record<string, unknown>
    : {};
}

function rawSnapshotNeedsIdentity(snapshot: RuntimeSnapshot | null): boolean {
  const shell = snapshot?.shell && typeof snapshot.shell === "object"
    ? snapshot.shell as Record<string, unknown>
    : null;
  const identity = shell?.identity && typeof shell.identity === "object"
    ? shell.identity as Record<string, unknown>
    : null;
  return identity?.linked === false;
}

function accountRuntimeNeedsIdentity(snapshot: RuntimeSnapshot | null): boolean {
  const preparedIdentity = runtimeShellIdentityFromSnapshot(snapshot);
  if (preparedIdentity.linked === true) return false;
  return rawSnapshotNeedsIdentity(snapshot);
}

function accountRuntimeIdentityResolved(snapshot: RuntimeSnapshot | null): boolean {
  const preparedIdentity = runtimeShellIdentityFromSnapshot(snapshot);
  if (typeof preparedIdentity.linked === "boolean") return true;
  const shell = snapshot?.shell && typeof snapshot.shell === "object"
    ? snapshot.shell as Record<string, unknown>
    : null;
  const identity = shell?.identity && typeof shell.identity === "object"
    ? shell.identity as Record<string, unknown>
    : null;
  return typeof identity?.linked === "boolean";
}

function parseLocalJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function localStorageRecordList(key: string): Record<string, unknown>[] {
  const value = parseLocalJson(window.localStorage.getItem(key));
  const records = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>).records
    : value;
  return Array.isArray(records)
    ? records.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry))
    : [];
}

function localGatewayHostedSnapshots(): Record<string, unknown>[] {
  const value = parseLocalJson(window.localStorage.getItem(ACCOUNT_GATEWAY_HOSTED_SNAPSHOTS_KEY));
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const out: Record<string, unknown>[] = [];
  for (const [gatewayPk, snapshot] of Object.entries(value as Record<string, unknown>)) {
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) continue;
    const source = snapshot as Record<string, unknown>;
    out.push({
      ...source,
      devicePk: String(source.devicePk || source.gatewayPk || gatewayPk).trim(),
      hostGatewayPk: String(source.hostGatewayPk || source.gatewayPk || gatewayPk).trim(),
      role: "gateway",
      service: "gateway",
      deviceKind: "gateway",
    });
    for (const service of Array.isArray(source.hostedServices) ? source.hostedServices : []) {
      if (!service || typeof service !== "object" || Array.isArray(service)) continue;
      const record = service as Record<string, unknown>;
      out.push({
        ...record,
        devicePk: String(record.devicePk || record.servicePk || record.pk || "").trim(),
        pk: String(record.devicePk || record.servicePk || record.pk || "").trim(),
        hostGatewayPk: String(record.hostGatewayPk || record.gatewayPk || gatewayPk).trim(),
        service: String(record.service || "nvr").trim(),
        role: String(record.role || record.service || "nvr").trim(),
        deviceKind: String(record.deviceKind || "service").trim(),
      });
    }
  }
  return out;
}

function localHostedServiceRecordsFrom(records: Record<string, unknown>[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const source of records) {
    const gatewayPk = String(source.devicePk || source.pk || source.gatewayPk || "").trim();
    const hosted = Array.isArray(source.hostedServices || source.hosted_services)
      ? source.hostedServices || source.hosted_services
      : [];
    for (const service of hosted) {
      if (!service || typeof service !== "object" || Array.isArray(service)) continue;
      const record = service as Record<string, unknown>;
      const servicePk = String(record.devicePk || record.device_pk || record.servicePk || record.service_pk || record.pk || "").trim();
      if (!servicePk) continue;
      out.push({
        ...record,
        devicePk: servicePk,
        pk: servicePk,
        hostGatewayPk: String(record.hostGatewayPk || record.host_gateway_pk || gatewayPk).trim(),
        service: String(record.service || record.slug || record.name || "nvr").trim(),
        role: String(record.role || record.service || record.slug || record.name || "nvr").trim(),
        deviceKind: String(record.deviceKind || record.device_kind || "service").trim(),
      });
    }
  }
  return out;
}

function localGatewayExtraDiscoveryScope(gatewayPk: string): RuntimeDiscoveryScope | null {
  const value = parseLocalJson(window.localStorage.getItem(ACCOUNT_GATEWAY_EXTRA_ZONES_KEY));
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const zones = (value as Record<string, unknown>)[gatewayPk];
  const zoneId = Array.isArray(zones) ? String(zones[0] || "").trim() : "";
  return isRoutableRuntimeZoneId(zoneId) ? { zoneId, privacy: "rawIds", ttl: 30, maxHops: 2 } : null;
}

function endpointHost(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `ws://${raw}`;
  try {
    const parsed = new URL(candidate);
    const host = String(parsed.hostname || "").trim();
    return host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
  } catch {}
  const withoutScheme = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  const hostPort = withoutScheme.split("/")[0] || "";
  if (hostPort.startsWith("[")) {
    const close = hostPort.indexOf("]");
    return close >= 0 ? hostPort.slice(0, close + 1) : "";
  }
  return hostPort.split(":")[0] || "";
}

function edgeEndpointFromGatewayEndpoint(value: unknown): string {
  const host = endpointHost(value);
  if (!host) return "";
  return `ws://${host}:7448`;
}

function derivedGatewayEdgeEndpoint(record: Record<string, unknown>): string {
  for (const value of Array.isArray(record.relays) ? record.relays : []) {
    const endpoint = edgeEndpointFromGatewayEndpoint(value);
    if (endpoint) return endpoint;
  }
  for (const key of ["swarmEndpoint", "swarm_endpoint", "swarm", "meshEndpoint", "mesh_endpoint"]) {
    const endpoint = edgeEndpointFromGatewayEndpoint(record[key]);
    if (endpoint) return endpoint;
  }
  return "";
}

function localGatewayEdgeEndpoint(gatewayPk: string): string {
  const target = String(gatewayPk || "").trim();
  if (!target) return "";
  const records = [...localStorageRecordList(ACCOUNT_DEVICE_CACHE_KEY), ...localGatewayHostedSnapshots()];
  for (const record of records) {
    const pk = String(record.devicePk || record.pk || record.gatewayPk || "").trim();
    if (pk !== target) continue;
    const edge = record.swarmEdge && typeof record.swarmEdge === "object"
      ? record.swarmEdge as Record<string, unknown>
      : {};
    const endpoint = String(
      record.swarmEdgeEndpoint
      || record.swarm_edge_endpoint
      || record.edgeStreamEndpoint
      || record.edge_stream_endpoint
      || edge.endpoint
      || "",
    ).trim() || derivedGatewayEdgeEndpoint(record);
    if (endpoint) return endpoint;
  }
  return "";
}

function localAccountIdentity(): Record<string, unknown> | null {
  const identities = localStorageRecordList(ACCOUNT_IDENTITY_CACHE_KEY);
  return identities.find((entry) => String(entry.identityId || entry.id || "").trim()) || null;
}

function localBrowserDevicePk(identity: Record<string, unknown> | null, deviceRecords: Record<string, unknown>[]): string {
  const browserRecord = deviceRecords.find((entry) => {
    const role = normalizeRole(entry.role || entry.deviceKind || "");
    const service = normalizeRole(entry.service || "");
    return role === "browser" && !service && String(entry.devicePk || entry.pk || "").trim();
  });
  const identityDevicePks = Array.isArray(identity?.devicePks)
    ? identity?.devicePks
    : Array.isArray(identity?.devices)
      ? (identity?.devices as Array<Record<string, unknown>>).map((entry) => entry?.pk || entry?.devicePk)
      : [];
  return String(
    browserRecord?.devicePk
    || browserRecord?.pk
    || identityDevicePks.find((value) => String(value || "").trim())
    || "",
  ).trim();
}

function localCachedNvrRuntimeContext(snapshot: RuntimeSnapshot | null): RuntimeServiceContext | null {
  const identity = localAccountIdentity();
  const snapshotIdentity = runtimeIdentityFromSnapshot(snapshot);
  const identityId = String(identity?.identityId || identity?.id || snapshotIdentity.identityId || snapshotIdentity.id || "").trim();
  if (!identityId) return null;
  const deviceRecords = localStorageRecordList(ACCOUNT_DEVICE_CACHE_KEY);
  const candidates = [...deviceRecords, ...localHostedServiceRecordsFrom(deviceRecords), ...localGatewayHostedSnapshots()]
    .filter((record) => isNvrApplianceRecord(record) && applianceDevicePk(record) && applianceGatewayPk(record))
    .sort((left, right) => {
      const sourceDelta = nvrRecordPreparedSourceCount(right) - nvrRecordPreparedSourceCount(left);
      return sourceDelta || applianceUpdatedAt(right) - applianceUpdatedAt(left);
    });
  if (candidates.length === 0) return null;
  let record = candidates[0] as ManagedApplianceRecord;
  for (const candidate of candidates.slice(1)) {
    record = mergeNvrDirectoryRecords(record, candidate as ManagedApplianceRecord);
  }
  const gatewayPk = applianceGatewayPk(record);
  const browserDevicePk = localBrowserDevicePk(identity, deviceRecords)
    || String(snapshotIdentity.devicePk || snapshotIdentity.device_pk || snapshotIdentity.browserDevicePk || "").trim();
  const discoveryScope = runtimeDiscoveryScopeFromRecord(record, snapshot, gatewayPk) || localGatewayExtraDiscoveryScope(gatewayPk);
  return {
    contextId: parseRuntimeContextId() || randomOpaqueId("nvr-context"),
    app: "nvr",
    repo: "constitute-nvr-ui",
    identityId,
    devicePk: browserDevicePk,
    gatewayPk,
    servicePk: applianceDevicePk(record),
    service: "nvr",
    ...(discoveryScope ? { discoveryScope } : {}),
    legacyPathFallback: {
      state: "legacyPathFallback",
      reason: "account runtime snapshot unavailable; retained account cache selected service context",
      sourceRefs: ["localStorage:swarm.deviceCache", "localStorage:constitute.gatewayHostedSnapshots"],
    },
    display: nvrDisplayFromRecord(record),
    createdAt: Date.now(),
    expiresAt: Date.now() + (10 * 60_000),
  };
}

async function waitForDirectEntryNvrServiceRecord(): Promise<{
  snapshot: RuntimeSnapshot | null;
  record: ManagedApplianceRecord | null;
}> {
  await ensureAccountBridge("direct app entry");
  let snapshot = await currentRuntimeSnapshot();
  let record = directEntryNvrServiceRecord(snapshot);
  if (record) return { snapshot, record };
  if (localCachedNvrRuntimeContext(snapshot)) return { snapshot, record: null };

  const deadline = Date.now() + DIRECT_ENTRY_ACCOUNT_HYDRATION_TIMEOUT_MS;
  let identityResolvedAt = 0;
  while (Date.now() < deadline) {
    snapshot = await currentRuntimeSnapshot();
    record = directEntryNvrServiceRecord(snapshot);
    if (record) return { snapshot, record };
    if (localCachedNvrRuntimeContext(snapshot)) return { snapshot, record: null };
    if (accountRuntimeIdentityResolved(snapshot)) {
      identityResolvedAt ||= Date.now();
      if (Date.now() - identityResolvedAt >= DIRECT_ENTRY_ACCOUNT_HYDRATED_SETTLE_MS) {
        setDrawerStatus("Waiting for Security Cameras service from the account runtime.");
      }
    }
    await delay(DIRECT_ENTRY_ACCOUNT_HYDRATION_POLL_MS);
  }

  return { snapshot, record: null };
}

function runtimeIdentityFromSnapshot(snapshot: RuntimeSnapshot | null): Record<string, unknown> {
  const preparedIdentity = runtimeShellIdentityFromSnapshot(snapshot);
  if (preparedIdentity.linked === true) return preparedIdentity;
  const shell = snapshot?.shell && typeof snapshot.shell === "object"
    ? snapshot.shell as Record<string, unknown>
    : {};
  return shell.identity && typeof shell.identity === "object"
    ? shell.identity as Record<string, unknown>
    : {};
}

function legacyDiscoveryScopeField(record: Record<string, unknown>, snake = false): unknown {
  return record[snake ? LEGACY_DISCOVERY_SCOPE_SNAKE_FIELD : LEGACY_DISCOVERY_SCOPE_FIELD];
}

function normalizeRuntimeDiscoveryScope(value: unknown): RuntimeDiscoveryScope | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const zoneId = String(source.zoneId || source.zone_id || source.key || source.zone || "").trim();
  if (!isRoutableRuntimeZoneId(zoneId)) return null;
  const out: RuntimeDiscoveryScope = { zoneId };
  const privacy = String(source.privacy || "").trim();
  if (privacy) out.privacy = privacy;
  const ttl = Number(source.ttl);
  if (Number.isFinite(ttl) && ttl > 0) out.ttl = ttl;
  const maxHops = Number(source.maxHops ?? source.max_hops);
  if (Number.isFinite(maxHops) && maxHops >= 0) out.maxHops = maxHops;
  return out;
}

function isRoutableRuntimeZoneId(zoneId: string): boolean {
  const id = String(zoneId || "").trim();
  return Boolean(id) && !id.startsWith("identity:") && id !== "runtime.local" && id !== "local";
}

function firstDiscoveryScopeFromList(value: unknown): RuntimeDiscoveryScope | null {
  if (!Array.isArray(value)) return null;
  for (const entry of value) {
    const scope = normalizeRuntimeDiscoveryScope(entry);
    if (scope) return scope;
    if (typeof entry === "string" && isRoutableRuntimeZoneId(entry)) return { zoneId: entry.trim() };
  }
  return null;
}

function discoveryScopeFromRecord(record: Record<string, unknown> | null | undefined): RuntimeDiscoveryScope | null {
  if (!record) return null;
  const facts = record.facts && typeof record.facts === "object" && !Array.isArray(record.facts)
    ? record.facts as Record<string, unknown>
    : {};
  const health = record.health && typeof record.health === "object" && !Array.isArray(record.health)
    ? record.health as Record<string, unknown>
    : {};
  return normalizeRuntimeDiscoveryScope(record.discoveryScope || record.discovery_scope || legacyDiscoveryScopeField(record) || legacyDiscoveryScopeField(record, true))
    || normalizeRuntimeDiscoveryScope(facts.discoveryScope || facts.discovery_scope || legacyDiscoveryScopeField(facts) || legacyDiscoveryScopeField(facts, true))
    || normalizeRuntimeDiscoveryScope(health.discoveryScope || health.discovery_scope || legacyDiscoveryScopeField(health) || legacyDiscoveryScopeField(health, true))
    || normalizeRuntimeDiscoveryScope({
      zoneId: record.zoneId || record.zone_id || record.zoneKey || record.zone_key || record.zone,
      privacy: record.zonePrivacy || record.zone_privacy,
    })
    || normalizeRuntimeDiscoveryScope({
      zoneId: facts.zoneId || facts.zone_id || facts.zoneKey || facts.zone_key || facts.zone,
      privacy: facts.zonePrivacy || facts.zone_privacy,
    })
    || firstDiscoveryScopeFromList(record.zones)
    || firstDiscoveryScopeFromList(facts.zones)
    || firstDiscoveryScopeFromList(health.zones);
}

function runtimeGatewayRecord(snapshot: RuntimeSnapshot | null, gatewayPk: string): Record<string, unknown> | null {
  const target = String(gatewayPk || "").trim();
  if (!target) return null;
  const groups = [
    snapshot?.managedAppliances?.owned,
    snapshot?.managedAppliances?.granted,
    snapshot?.managedAppliances?.discoverable,
  ];
  for (const group of groups) {
    for (const record of Array.isArray(group) ? group : []) {
      const pk = String(record?.devicePk || record?.device_pk || record?.pk || "").trim();
      if (pk === target) return record;
    }
  }
  return null;
}

function runtimeDiscoveryScopeFromBaseline(snapshot: RuntimeSnapshot | null): RuntimeDiscoveryScope | null {
  const edge = snapshot?.edge && typeof snapshot.edge === "object" && !Array.isArray(snapshot.edge)
    ? snapshot.edge as Record<string, unknown>
    : {};
  const shell = snapshot?.shell && typeof snapshot.shell === "object" && !Array.isArray(snapshot.shell)
    ? snapshot.shell as Record<string, unknown>
    : {};
  const zones = shell.zones && typeof shell.zones === "object" && !Array.isArray(shell.zones)
    ? shell.zones as Record<string, unknown>
    : {};
  return normalizeRuntimeDiscoveryScope(edge.discoveryScope || edge.discovery_scope || legacyDiscoveryScopeField(edge) || legacyDiscoveryScopeField(edge, true))
    || normalizeRuntimeDiscoveryScope({
      zoneId: zones.activeZoneKey || zones.active_zone_key,
      privacy: "rawIds",
    })
    || firstDiscoveryScopeFromList(zones.joined)
    || firstDiscoveryScopeFromList(zones.zoneKeys || zones.zone_keys);
}

function runtimeDiscoveryScopeFromRecord(
  record: ManagedApplianceRecord,
  snapshot: RuntimeSnapshot | null,
  gatewayPk: string,
): RuntimeDiscoveryScope | null {
  return discoveryScopeFromRecord(record)
    || discoveryScopeFromRecord(runtimeGatewayRecord(snapshot, gatewayPk))
    || runtimeDiscoveryScopeFromBaseline(snapshot);
}

function contextFromRuntimeRecord(record: ManagedApplianceRecord, snapshot: RuntimeSnapshot | null): RuntimeServiceContext {
  const servicePk = applianceDevicePk(record);
  const gatewayPk = applianceGatewayPk(record);
  const identity = runtimeIdentityFromSnapshot(snapshot);
  const contextId = parseRuntimeContextId() || randomOpaqueId("nvr-context");
  const browserDevicePk = String(identity.devicePk || identity.device_pk || identity.browserDevicePk || "").trim();
  const discoveryScope = runtimeDiscoveryScopeFromRecord(record, snapshot, gatewayPk);
  const hostFabric = record.hostFabric && typeof record.hostFabric === "object" && !Array.isArray(record.hostFabric)
    ? record.hostFabric as Record<string, unknown>
    : null;
  return {
    contextId,
    app: "nvr",
    repo: "constitute-nvr-ui",
    identityId: String(identity.identityId || "").trim(),
    devicePk: browserDevicePk,
    gatewayPk,
    servicePk,
    service: "nvr",
    ...(discoveryScope ? { discoveryScope } : {}),
    ...(hostFabric ? { hostFabric } : {
      legacyPathFallback: {
        state: "legacyPathFallback",
        reason: "runtime service catalog is missing host-fabric posture; using transition service directory",
        sourceRefs: ["runtime.serviceCatalog", "runtime.managedAppliances"],
      },
    }),
    display: nvrDisplayFromRecord(record),
    createdAt: Date.now(),
    expiresAt: Date.now() + (10 * 60_000),
  };
}

async function requestDirectEntryRuntimeContext(): Promise<RuntimeServiceContext> {
  setConnectionState("opening", "warn");
  setDrawerStatus("Opening Security Cameras through your account runtime.");
  setGridEmpty("Opening Security Cameras", "Resolving account-authorized camera projections.");
  dismissBootSplash();
  void reportServiceStatus("opening", "Resolving account-authorized camera projections.", "runtime_directory");

  const { snapshot, record } = await waitForDirectEntryNvrServiceRecord();
  if (!record) {
    const cachedContext = localCachedNvrRuntimeContext(snapshot);
    if (cachedContext) {
      appendLog("runtime context loaded from retained account cache while account worker repairs");
      scheduleDirectEntryRuntimeRepair("account runtime unavailable; retained Security Cameras cache used");
      return cachedContext;
    }
    if (accountRuntimeNeedsIdentity(snapshot)) {
      throw runtimeContextError(
        "runtime_context",
        "link an identity before opening Security Cameras",
      );
    }
    throw runtimeContextError(
      "runtime_context",
      "no Security Cameras service is available from this account runtime",
    );
  }

  const servicePk = applianceDevicePk(record);
  const gatewayPk = applianceGatewayPk(record);
  if (!servicePk || !gatewayPk) {
    throw runtimeContextError("runtime_directory", "Security Cameras runtime record did not include service and gateway identity");
  }
  const catalogBlockedReason = nvrServiceCatalogBlockedReason(record);
  if (catalogBlockedReason) {
    throw runtimeContextError("runtime_directory", catalogBlockedReason);
  }
  return contextFromRuntimeRecord(record, snapshot);
}

async function persistRuntimeServiceContext(context: RuntimeServiceContext): Promise<RuntimeServiceContext> {
  runtimeServiceContext = context;
  refreshRuntimeReadModel();
  refreshSummary(context);
  return context;
}

function runtimeDiscoveryScope(): RuntimeDiscoveryScope {
  const runtimeScope = runtimeDiscoveryScopeFromBaseline(runtimeBaseline) || runtimeServiceContext?.discoveryScope || null;
  if (runtimeScope?.zoneId) {
    const ttl = Number(runtimeScope.ttl);
    const maxHops = Number(runtimeScope.maxHops);
    return {
      zoneId: runtimeScope.zoneId,
      privacy: runtimeScope.privacy || "rawIds",
      ttl: Number.isFinite(ttl) && ttl > 0 ? ttl : 30,
      maxHops: Number.isFinite(maxHops) && maxHops > 0 ? maxHops : 2,
    };
  }
  throw new Error("runtime swarm edge zone is unavailable");
}

function runtimeGrantedScope(): GrantedScope {
  return runtimeServiceContext?.display?.grantedScope || {};
}

function baseRuntimeAuthorityPayload(): Record<string, unknown> {
  return runtimeAuthorityPayloadFromContext(runtimeServiceContext || {});
}

async function ensureRuntimeSwarmEdgeForContext(
  context: RuntimeServiceContext,
  options: SwarmEdgeAttachOptions = {},
): Promise<boolean> {
  const edgeEndpoint = localGatewayEdgeEndpoint(context.gatewayPk);
  const rawDiscoveryScope = context.discoveryScope || localGatewayExtraDiscoveryScope(context.gatewayPk);
  if (!edgeEndpoint || !rawDiscoveryScope?.zoneId) return false;
  const discoveryScope: RuntimeDiscoveryScope = {
    zoneId: rawDiscoveryScope.zoneId,
    privacy: rawDiscoveryScope.privacy || "rawIds",
    ttl: Number.isFinite(Number(rawDiscoveryScope.ttl)) && Number(rawDiscoveryScope.ttl) > 0 ? Number(rawDiscoveryScope.ttl) : 30,
    maxHops: Number.isFinite(Number(rawDiscoveryScope.maxHops)) && Number(rawDiscoveryScope.maxHops) > 0 ? Number(rawDiscoveryScope.maxHops) : 2,
  };
  const target = [
    edgeEndpoint,
    "runtime-authority",
    discoveryScope.zoneId,
    discoveryScope.privacy || "",
    String(discoveryScope.ttl || ""),
    String(discoveryScope.maxHops || ""),
  ].join("|");
  if (swarmEdgeAttachRepairInFlight && swarmEdgeAttachRepairInFlightTarget === target) {
    return await swarmEdgeAttachRepairInFlight;
  }
  swarmEdgeAttachRepairInFlightTarget = target;
  swarmEdgeAttachRepairInFlight = (async () => {
    const now = Date.now();
    const edge = runtimeReadModel.edge || {};
    const edgeDisconnected = Boolean(edge.state !== "unknown" && edge.connected !== true);
    if (swarmEdgeAttachRepairTarget !== target) {
      swarmEdgeAttachRepairTarget = target;
      swarmEdgeAttachRepairFailureCount = 0;
      swarmEdgeAttachRepairBackoffUntil = 0;
    } else {
      if (swarmEdgeAttachRepairBackoffUntil > now) return false;
      if (!options.force && !edgeDisconnected && now - swarmEdgeAttachRepairAttemptedAt < RUNTIME_SWARM_EDGE_ATTACH_REPAIR_RETRY_MS) {
        return false;
      }
    }
    swarmEdgeAttachRepairAttemptedAt = now;
    try {
      await runtimeCall("swarm.edge.attach", {
        payload: {
          swarmEdgeEndpoint: edgeEndpoint,
          [LEGACY_DISCOVERY_SCOPE_FIELD]: discoveryScope,
        },
      }, RUNTIME_WRITE_TIMEOUT_MS);
      swarmEdgeAttachRepairFailureCount = 0;
      swarmEdgeAttachRepairBackoffUntil = 0;
      appendLog(`runtime swarm edge attach requested for ${edgeEndpoint}`);
      return true;
    } catch (error) {
      if (isRuntimeSwarmEdgeAuthorityWait(error)) {
        swarmEdgeAttachRepairFailureCount = 0;
        swarmEdgeAttachRepairBackoffUntil = 0;
        scheduleRuntimeAuthorityReconnect(String((error as Error)?.message || error));
        return false;
      }
      swarmEdgeAttachRepairFailureCount += 1;
      swarmEdgeAttachRepairBackoffUntil = Date.now() + Math.min(
        RUNTIME_SWARM_EDGE_ATTACH_REPAIR_MAX_BACKOFF_MS,
        RUNTIME_SWARM_EDGE_ATTACH_REPAIR_RETRY_MS * swarmEdgeAttachRepairFailureCount,
      );
      throw error;
    }
  })();
  try {
    return await swarmEdgeAttachRepairInFlight;
  } finally {
    if (swarmEdgeAttachRepairInFlightTarget === target) {
      swarmEdgeAttachRepairInFlight = null;
      swarmEdgeAttachRepairInFlightTarget = "";
    }
  }
}

async function queueRuntimeAppIntent({
  method,
  intent,
  timeoutMs,
}: {
  method: string;
  intent: Record<string, unknown>;
  timeoutMs: number;
}): Promise<RuntimeIntentResult> {
  const payload = {
    ...baseRuntimeAuthorityPayload(),
    ...intent,
  };
  const result = await runtimeCall<RuntimeIntentResult>(method, { payload }, timeoutMs);
  appendLog(`queued ${method} runtime intent ${runtimeIntentFrameId(result).slice(0, 12)}`);
  return result;
}

function registerRuntimeStreamSessionKey(session: RuntimeStreamSession, value: unknown): void {
  const key = String(value || "").trim();
  if (!key) return;
  session.correlationKeys.add(key);
  runtimeStreamSessionsByCorrelationKey.set(key, session);
}

function registerRuntimeStreamSessionKeys(session: RuntimeStreamSession, keys: Iterable<unknown>): void {
  for (const key of keys) registerRuntimeStreamSessionKey(session, key);
}

function registerRuntimeStreamSession(session: RuntimeStreamSession): void {
  runtimeStreamSessionsBySessionId.set(session.sessionId, session);
  registerRuntimeStreamSessionKey(session, session.sessionId);
  if (session.frameId) {
    runtimeStreamSessionsByFrameId.set(session.frameId, session);
    registerRuntimeStreamSessionKey(session, session.frameId);
  }
  registerRuntimeStreamSessionKeys(session, session.correlationKeys);
}

function unregisterRuntimeStreamSession(session: RuntimeStreamSession): void {
  runtimeStreamSessionsBySessionId.delete(session.sessionId);
  if (session.frameId) runtimeStreamSessionsByFrameId.delete(session.frameId);
  for (const key of session.correlationKeys) {
    runtimeStreamSessionsByCorrelationKey.delete(key);
  }
  session.correlationKeys.clear();
}

function reportMediaTransportObservation(observation: MediaTransportObservation): void {
  void runtimeCall(RUNTIME_MEDIA_TRANSPORT_OBSERVATION_PUT, { payload: observation }, RUNTIME_WRITE_TIMEOUT_MS).catch((error) => {
    appendLog(`media transport observation report failed: ${String((error as Error)?.message || error)}`);
  });
}

function reportMediaFulfillmentEvidence(evidence: MediaFulfillmentEvidence): void {
  const sessionId = String(evidence.sessionId || "").trim();
  const session = sessionId ? runtimeStreamSessionsBySessionId.get(sessionId) : null;
  if (session) {
    if (!shouldReportMediaFulfillmentEvidence(session, evidence)) return;
    try {
      const observation = mediaTransportObservationFromFulfillmentEvidence(session, evidence);
      if (observation) reportMediaTransportObservation(observation);
    } catch (error) {
      appendLog(`media transport observation build failed: ${String((error as Error)?.message || error)}`);
    }
  }
  void runtimeCall(RUNTIME_MEDIA_FULFILLMENT_EVIDENCE_PUT, { payload: evidence }, RUNTIME_WRITE_TIMEOUT_MS).catch((error) => {
    appendLog(`media fulfillment evidence report failed: ${String((error as Error)?.message || error)}`);
  });
}

function reportMediaFulfillmentEvidenceBatch(evidence: MediaFulfillmentEvidence[]): void {
  for (const entry of evidence) reportMediaFulfillmentEvidence(entry);
}

function mediaEvidenceBlockedReason(evidence: MediaFulfillmentEvidence): string {
  return String((evidence as MediaFulfillmentEvidence & { blockedReason?: string }).blockedReason || "").trim();
}

function mediaEvidenceReadinessState(evidence: MediaFulfillmentEvidence): string {
  const safeFacts = evidence.safeFacts && typeof evidence.safeFacts === "object"
    ? evidence.safeFacts as Record<string, unknown>
    : {};
  return String(safeFacts.readinessState || "").trim();
}

function handleRuntimeStreamStaleMedia(session: RuntimeStreamSession, reason: string): void {
  if (session.adapterFailureNotified) return;
  session.adapterFailureNotified = true;
  session.routePending = false;
  session.routeState = "mediaStalled";
  const detail = `Live media path stalled: ${reason}.`;
  appendLog(`stream adapter stalled: ${detail}`);
  setTileState(session.sourceId, "connecting", "Reconnecting stalled live preview.");
  setConnectionState("reconnecting", "warn");
  setDrawerStatus("Live preview stalled. Reconnecting automatically.");
  void reportServiceStatus("reconnecting", detail, "stream_adapter");
  cancelStreamLiveWatchdog();
  scheduleAutomaticReconnect(detail);
}

function reportRenderReadiness(session: RuntimeStreamSession, video: HTMLVideoElement): MediaFulfillmentEvidence {
  const evidence = mediaFulfillmentEvidenceFromRender(session, video);
  reportMediaFulfillmentEvidence(evidence);
  const blockedReason = mediaEvidenceBlockedReason(evidence);
  if (evidence.state === SWARM.MEDIA_FULFILLMENT_STATE.BLOCKED && blockedReason) {
    handleRuntimeStreamStaleMedia(session, blockedReason);
  }
  return evidence;
}

function reportBrowserMediaStats(session: RuntimeStreamSession, video?: HTMLVideoElement): void {
  if (video) reportRenderReadiness(session, video);
  void collectBrowserMediaFulfillmentEvidence(session).then((evidence) => {
    reportMediaFulfillmentEvidenceBatch(evidence);
    const stalled = evidence.find((entry) => (
      entry.evidenceKind === SWARM.MEDIA_FULFILLMENT_EVIDENCE_KIND.INBOUND_STATS
      && entry.state === SWARM.MEDIA_FULFILLMENT_STATE.BLOCKED
      && mediaEvidenceBlockedReason(entry) === "inboundRtpStalled"
    ));
    if (stalled) handleRuntimeStreamStaleMedia(session, mediaEvidenceBlockedReason(stalled));
  }).catch(() => {});
}

function startRuntimeStreamStatsMonitor(session: RuntimeStreamSession, video?: HTMLVideoElement): void {
  if (session.mediaStatsTimer) return;
  reportBrowserMediaStats(session, video);
  session.mediaStatsTimer = window.setInterval(() => {
    reportBrowserMediaStats(session, video);
  }, RUNTIME_STREAM_MEDIA_STATS_POLL_MS);
}

function bindRuntimeStreamTrack(sourceId: string, stream: unknown, track: MediaStreamTrack, session: RuntimeStreamSession): void {
  const tile = ensureCameraTile(sourceId);
  const mediaStream = stream as MediaStream;
  const markRenderLive = (evidence = reportRenderReadiness(session, tile.video)) => {
    if (evidence.state !== SWARM.MEDIA_FULFILLMENT_STATE.USABLE) {
      const readiness = mediaEvidenceReadinessState(evidence) || "waitingRender";
      setTileState(sourceId, "connecting", `Waiting for render readiness (${readiness}).`);
      setConnectionState("connecting", "warn");
      setDrawerStatus(`Live media track attached; waiting for render readiness (${MEDIA_RENDER_WAITING_GRACE_MS / 1000}-${MEDIA_RENDER_BLOCKED_GRACE_MS / 1000}s).`);
      scheduleStreamLiveWatchdog("stream answer received without render readiness");
      return;
    }
    reportMediaFulfillmentEvidence(mediaFulfillmentEvidenceFromTrack(session, track));
    reportBrowserMediaStats(session);
    setTileState(sourceId, "live", "Live preview stream attached.");
    if (hasAllExpectedLiveTiles()) {
      cancelStreamLiveWatchdog();
      reconnectAttemptCount = 0;
      resetRuntimeStreamRecovery("adapterLive");
      setConnectionState("live", "good");
      setDrawerStatus("Live preview connected.");
    } else {
      const missing = missingLiveSourceIds();
      setConnectionState("partial", "warn");
      setDrawerStatus(`Live preview connected for ${cameraLabelForSource(sourceId)}; waiting for ${formatCameraScope(missing)}.`);
      for (const missingSourceId of missing) {
        setTileState(missingSourceId, "connecting", "Waiting for live preview stream.");
      }
      scheduleStreamLiveWatchdog("waiting for remaining live preview streams");
    }
  };
  const markPendingRender = () => {
    const evidence = reportRenderReadiness(session, tile.video);
    if (evidence.state === SWARM.MEDIA_FULFILLMENT_STATE.USABLE) markRenderLive(evidence);
  };
  track.addEventListener("mute", () => reportMediaFulfillmentEvidence(mediaFulfillmentEvidenceFromTrack(session, track)));
  track.addEventListener("ended", () => reportMediaFulfillmentEvidence(mediaFulfillmentEvidenceFromTrack(session, track)), { once: true });
  track.addEventListener("unmute", markPendingRender, { once: true });
  tile.video.addEventListener("loadedmetadata", markPendingRender, { once: true });
  tile.video.addEventListener("resize", markPendingRender);
  tile.video.addEventListener("playing", markRenderLive, { once: true });
  reportMediaFulfillmentEvidence(mediaFulfillmentEvidenceFromTrack(session, track));
  startRuntimeStreamStatsMonitor(session, tile.video);
  void bindBrowserMediaStream(tile.video, mediaStream).then((result) => {
    if (!result.ok) {
      const detail = result.reason || "browser media playback request failed";
      appendLog(`stream render bind failed: ${detail}`);
      setTileState(sourceId, "connecting", "Waiting for browser media playback.");
      setDrawerStatus(`Live media track attached; browser playback is pending (${detail}).`);
      scheduleStreamLiveWatchdog("stream render bind failed");
    }
    if (track.readyState === "live") {
      markPendingRender();
      window.setTimeout(markRenderLive, 1_000);
    }
  }).catch((error) => {
    appendLog(`stream render bind failed: ${String((error as Error)?.message || error)}`);
    scheduleStreamLiveWatchdog("stream render bind failed");
  });
}

function handleRuntimeStreamAdapterState(session: RuntimeStreamSession, state: BrowserStreamAdapterState): void {
  reportMediaFulfillmentEvidence(mediaFulfillmentEvidenceFromAdapterState(session, state));
  reportBrowserMediaStats(session);
  if (!state.failed || session.adapterFailureNotified) return;
  session.adapterFailureNotified = true;
  session.routePending = false;
  session.routeState = "adapterFailed";
  const detail = `${state.reason} (${state.kind}: ${state.state}; iceServers=${session.selectedIceServerCount}; localCandidates=${session.localCandidateCount}; remoteCandidates=${session.remoteCandidateCount})`;
  appendLog(`stream adapter failed: ${detail}`);
  setTileState(session.sourceId, "unavailable", detail);
  setConnectionState("media failed", "bad");
  setDrawerStatus(detail);
  void reportServiceStatus("degraded", detail, "stream_adapter");
  cancelStreamLiveWatchdog();
  scheduleAutomaticReconnect(detail);
}

async function publishRuntimeStreamCandidate({
  nonce,
  sessionId,
  sourceId,
  candidate,
}: {
  nonce: string;
  sessionId: string;
  sourceId: string;
  candidate: RTCIceCandidateInit;
}): Promise<void> {
  const issuedAt = Date.now();
  await queueRuntimeAppIntent({
    method: RUNTIME_STREAM_CONTROL,
    intent: {
      nonce,
      sessionId,
      candidateId: `candidate-${sessionId}-${issuedAt}-${randomOpaqueId("ice")}`,
      transport: "webrtc",
      sourceId,
      payload: {
        direction: "remote",
        candidate,
      },
      issuedAt,
    },
    timeoutMs: RUNTIME_WRITE_TIMEOUT_MS,
  });
}

async function publishRuntimeStreamIntent(sourceIds: string[], timeoutMs = RUNTIME_STREAM_INTENT_TIMEOUT_MS): Promise<RuntimeIntentResult> {
  if (!browserStreamAvailable()) {
    throw new Error("browser stream transport is unavailable in this context");
  }
  const mediaTransportProfile = await runtimeMediaTransportProfile();
  const mediaIceServers = runtimeMediaIceServers(mediaTransportProfile);
  let lastResult: RuntimeIntentResult = {};
  for (const sourceId of sourceIds) {
    const autoPreview = sourceId === NVR_AUTO_PREVIEW_SOURCE_ID;
    const requestedSourceIds = autoPreview ? [] : [sourceId];
    const sentInitialCandidateKeys = new Set<string>();
    let streamOpenQueued = false;
    const nonce = randomOpaqueId("stream");
    const expectedSessionId = `nvr-preview-${nonce}`;
    const offer = await createBrowserStreamOffer({
      sourceId,
      sessionId: expectedSessionId,
      nonce,
      moduleRef: nvrSurfaceModules.platformAdapter.moduleRef,
      adapterBindingPosture: nvrPlatformAdapterBindingPosture,
      iceServers: mediaIceServers,
      onCandidate: (candidate) => {
        if (!streamOpenQueued) return;
        if (sentInitialCandidateKeys.has(candidateKey(candidate))) return;
        void publishRuntimeStreamCandidate({
          nonce,
          sessionId: expectedSessionId,
          sourceId,
          candidate,
        }).catch((error) => {
          appendLog(`queued stream candidate failed: ${String((error as Error)?.message || error)}`);
        });
      },
      onStateChange: (state, activeSession) => handleRuntimeStreamAdapterState(activeSession, state),
      onTrack: (stream, track, activeSession) => bindRuntimeStreamTrack(sourceId, stream, track, activeSession),
    });
    const session = offer.session;
    const offerCandidates = offer.candidates.slice();
    const issuedAt = Date.now();
    const expiresAt = issuedAt + (2 * 60_000);
    const intentId = randomOpaqueId("stream-intent");
    session.issuedAt = issuedAt;
    session.expiresAt = expiresAt;
    registerRuntimeStreamSessionKeys(session, [
      expectedSessionId,
      nonce,
      intentId,
      `route:${intentId}`,
    ]);
    registerRuntimeStreamSession(session);
    const record = {
      sessionId: expectedSessionId,
      nonce,
      intentId,
      nodeRef: "nvr.streams",
      capabilityRef: SWARM.CORE_CAPABILITY.MEDIA_STREAM_PREVIEW,
      transport: "webrtc",
      sourceIds: requestedSourceIds,
      offer: {
        description: offer.description,
        sourceIds: requestedSourceIds,
        localCandidateCount: offerCandidates.length,
      },
      candidates: offerCandidates,
      mediaTransportProfile: runtimeMediaTransportContract(mediaTransportProfile),
      materializationBudgetRef: String(nvrSurfaceBudgets.preview.budgetId || "nvr-ui.preview"),
      evidenceBudgetRef: String(nvrSurfaceBudgets.streamEvents.budgetId || "nvr-ui.stream-events"),
      issuedAt,
      expiresAt,
    };
    let result: RuntimeIntentResult;
    try {
      result = await queueRuntimeAppIntent({
        method: RUNTIME_STREAM_OPEN,
        intent: record,
        timeoutMs,
      });
    } catch (error) {
      unregisterRuntimeStreamSession(session);
      reportMediaFulfillmentEvidence(mediaFulfillmentReleaseEvidence(session, "streamOpenFailed"));
      closeBrowserStreamSession(session);
      throw error;
    }
    if (runtimeIntentWaitingAuthority(result)) {
      unregisterRuntimeStreamSession(session);
      reportMediaFulfillmentEvidence(mediaFulfillmentReleaseEvidence(session, "waitingAuthority"));
      closeBrowserStreamSession(session);
      lastResult = result;
      break;
    }
    session.routePending = runtimeIntentPendingRoute(result);
    session.routeState = session.routePending ? (runtimeIntentState(result) || "waitingRouteBaseline") : "";
    if (session.routePending) {
      markRouteBaselineWaiting();
      noteRouteBaselinePending("stream route baseline pending after activation");
    }
    for (const candidate of offerCandidates) {
      sentInitialCandidateKeys.add(candidateKey(candidate));
    }
    streamOpenQueued = true;
    for (const candidate of offer.candidates) {
      if (sentInitialCandidateKeys.has(candidateKey(candidate))) continue;
      void publishRuntimeStreamCandidate({
        nonce,
        sessionId: expectedSessionId,
        sourceId,
        candidate,
      }).catch((error) => {
        appendLog(`queued stream candidate failed: ${String((error as Error)?.message || error)}`);
      });
    }
    const frameId = runtimeIntentFrameId(result);
    session.frameId = frameId;
    if (frameId) runtimeStreamSessionsByFrameId.set(frameId, session);
    registerRuntimeStreamSessionKeys(session, collectRuntimeIntentResultKeys(result));
    lastResult = result;
  }
  return lastResult;
}

async function publishRuntimeStreamControl(command: string, params: Record<string, unknown> = {}): Promise<RuntimeIntentResult> {
  const record = {
    controlId: randomOpaqueId("stream-control"),
    sessionId: String(params.sessionId || "nvr-preview").trim(),
    command,
    params: {
      ...params,
      sourceIds: normalizeSourceIds(params.sourceIds || []),
    },
    issuedAt: Date.now(),
  };
  return await queueRuntimeAppIntent({
    method: command === "close" ? RUNTIME_STREAM_CLOSE : RUNTIME_STREAM_CONTROL,
    intent: {
      nodeRef: normalizeSourceIds(params.sourceIds || (params.sourceId ? [params.sourceId] : []))[0] || undefined,
      capabilityRef: SWARM.CORE_CAPABILITY.MEDIA_STREAM_PREVIEW,
      ...record,
    },
    timeoutMs: RUNTIME_WRITE_TIMEOUT_MS,
  });
}

async function publishRuntimeServiceIntent(
  action: string,
  payload: Record<string, unknown> = {},
  timeoutMs = ADMIN_INTENT_TIMEOUT_MS,
): Promise<RuntimeIntentResult> {
  const record = {
    kind: "service.intent",
    intentId: randomOpaqueId("nvr-intent"),
    service: "nvr",
    action,
    payloadShape: Object.keys(payload).sort(),
    issuedAt: Date.now(),
  };
  return await queueRuntimeAppIntent({
    method: "runtime.capability.resolve",
    intent: {
      nodeRef: "surface",
      capabilityRef: SWARM.CORE_CAPABILITY.SERVICE_INTENT_INVOKE,
      ...record,
    },
    timeoutMs,
  });
}

function projectedCameraInventoryFallback(): CameraInventoryRecord {
  return {
    mountedDevices: nvrProjectionState.cameras.length > 0
      ? nvrProjectionState.cameras
      : (cameraInventory?.mountedDevices || []),
    candidateDevices: cameraInventory?.candidateDevices || [],
    cameraNetwork: nvrProjectionState.cameraNetwork || cameraInventory?.cameraNetwork || {},
  };
}

function mountedCameraFallback(sourceId: string, desired: Record<string, unknown>): MountedCameraRecord | null {
  const key = String(sourceId || "").trim();
  if (!key) return null;
  const existing = mountedCameraRecord(key);
  const displayName = String(desired.displayName || existing?.displayName || existing?.observed?.displayName || cameraDisplayName(key)).trim() || key;
  return {
    ...(existing || {}),
    sourceId: key,
    displayName,
    desired: {
      ...(existing?.desired || {}),
      displayName,
      overlayText: String(desired.overlayText || displayName).trim(),
      overlayTimestamp: desired.overlayTimestamp !== false,
      hardening: desired.hardening && typeof desired.hardening === "object"
        ? desired.hardening as Record<string, boolean>
        : existing?.desired?.hardening,
    },
    observed: {
      ...(existing?.observed || {}),
      displayName,
      overlayText: String(desired.overlayText || displayName).trim(),
      overlayTimestamp: desired.overlayTimestamp !== false,
    },
    verification: {
      status: "pending",
      message: "Runtime intent queued; projection update pending.",
    },
    credentialSafety: {
      status: "pending",
      pending: true,
    },
  };
}

function adminProjectionFallback(action: string, payload: Record<string, unknown> = {}): Record<string, unknown> {
  if (action === "list_camera_device_inventory") {
    return { inventory: projectedCameraInventoryFallback() };
  }
  if (action === "apply_camera_device_config") {
    const desired = payload.desired && typeof payload.desired === "object"
      ? payload.desired as Record<string, unknown>
      : {};
    return {
      action,
      mounted: mountedCameraFallback(String(payload.sourceId || ""), desired),
    };
  }
  if (action === "mount_camera_device") {
    return {
      action,
      mounted: null,
      accepted: true,
    };
  }
  if (action === "probe_camera_device") {
    return {
      action,
      result: {
        status: "queued",
        verification: {
          status: "pending",
          message: "Runtime intent queued; projection update pending.",
        },
      },
    };
  }
  return { action, accepted: true };
}

const nvrAdminAdapter = createNvrAdminAdapter({
  moduleRef: nvrSurfaceModules.serviceSurfaceAdapter.moduleRef,
  bindingPosture: nvrServiceSurfaceAdapterBindingPosture,
  defaultTimeoutMs: ADMIN_INTENT_TIMEOUT_MS,
  applyCameraDeviceConfigTimeoutMs: CAMERA_APPLY_REQUEST_TIMEOUT_MS,
  publishRuntimeServiceIntent,
  projectionFallback: adminProjectionFallback,
});


function normalizeRecords(value: unknown): ManagedApplianceRecord[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is ManagedApplianceRecord => Boolean(entry) && typeof entry === "object")
    : [];
}

function recordFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function runtimeProjectionRecords(snapshot: RuntimeSnapshot | null): RuntimeProjectionRecord[] {
  const projections = snapshot?.projections;
  const values = Array.isArray(projections)
    ? projections
    : projections && typeof projections === "object"
      ? Object.values(projections)
      : [];
  return values.filter((entry): entry is RuntimeProjectionRecord => Boolean(entry) && typeof entry === "object");
}

function projectionPayload(record: RuntimeProjectionRecord | null | undefined): Record<string, unknown> {
  return record?.payload && typeof record.payload === "object" && !Array.isArray(record.payload)
    ? record.payload
    : {};
}

function projectionFields(record: RuntimeProjectionRecord | null | undefined): Record<string, unknown> {
  const payload = projectionPayload(record);
  return recordFrom(payload.fields);
}

function projectionSortValue(record: RuntimeProjectionRecord): number {
  const freshness = record.freshness && typeof record.freshness === "object" ? record.freshness : {};
  return Number(record.retainedAt || freshness.updatedAt || record.updatedAt || record.issuedAt || 0);
}

function nvrRuntimeProjectionRecord(channelId: string): RuntimeProjectionRecord | null {
  const servicePk = String(runtimeServiceContext?.servicePk || "").trim();
  const records = runtimeProjectionRecords(runtimeBaseline)
    .filter((record) => String(record.channelId || "").trim() === channelId)
    .filter((record) => {
      const recordService = String(record.service || "").trim().toLowerCase();
      const recordServicePk = String(record.servicePk || record.service_pk || "").trim();
      return (!recordService || recordService === "nvr") && (!servicePk || !recordServicePk || recordServicePk === servicePk);
    })
    .sort((left, right) => projectionSortValue(right) - projectionSortValue(left));
  return records[0] || null;
}

function collectStoragePinIntentsFromProjection(record: RuntimeProjectionRecord | null): Array<Record<string, unknown>> {
  const payload = projectionPayload(record);
  const fields = projectionFields(record);
  const candidates = [
    payload.storagePinIntent,
    payload.storagePinIntents,
    payload.pinIntents,
    payload.segmentPinIntents,
    fields.storagePinIntent,
    fields.storagePinIntents,
    fields.pinIntents,
    fields.segmentPinIntents,
  ];
  const out: Array<Record<string, unknown>> = [];
  for (const candidate of candidates) {
    const entries = Array.isArray(candidate) ? candidate : candidate ? [candidate] : [];
    for (const entry of entries) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      const intent = entry as Record<string, unknown>;
      const intentId = String(intent.intentId || "").trim();
      if (!intentId || out.some((existing) => String(existing.intentId || "").trim() === intentId)) continue;
      out.push(intent);
    }
  }
  return out;
}

function nextNvrProjectionState(): NvrProjectionState {
  const healthProjection = nvrRuntimeProjectionRecord("nvr.health");
  const camerasProjection = nvrRuntimeProjectionRecord("nvr.cameras");
  const cameraNetworkProjection = nvrRuntimeProjectionRecord("nvr.cameraNetwork");
  const streamsProjection = nvrRuntimeProjectionRecord("nvr.streams");

  const healthPayload = projectionPayload(healthProjection);
  const healthFields = projectionFields(healthProjection);
  const health = recordFrom(healthPayload.health);
  const cameraDevices = projectionPayload(camerasProjection).cameraDevices ?? projectionFields(camerasProjection).cameraDevices;
  const cameraNetworkPayload = projectionPayload(cameraNetworkProjection);
  const cameraNetworkFields = projectionFields(cameraNetworkProjection);
  const cameraNetwork = cameraNetworkProjection
    ? cameraNetworkPayload.cameraNetwork ?? (Object.keys(cameraNetworkFields).length > 0 ? cameraNetworkFields : null)
    : null;
  const streamPayload = projectionPayload(streamsProjection);
  const streamFields = projectionFields(streamsProjection);
  const streamSources = normalizeSourceIds(streamPayload.sources ?? streamFields.sources);
  const streamStatusRecords = Array.isArray(streamPayload.mediaProjectionStatusRecords)
    ? streamPayload.mediaProjectionStatusRecords.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry))
    : [];

  const projectionRecords: Record<string, RuntimeProjectionRecord> = {};
  for (const channelId of NVR_PROJECTION_CHANNELS) {
    const record = nvrRuntimeProjectionRecord(channelId);
    if (record) projectionRecords[channelId] = record;
  }

  return {
    health: Object.keys(health).length > 0 ? health : Object.keys(healthFields).length > 0 ? healthFields : null,
    cameras: Array.isArray(cameraDevices)
      ? cameraDevices.filter((entry): entry is MountedCameraRecord => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry))
      : [],
    cameraNetwork: cameraNetwork && typeof cameraNetwork === "object" && !Array.isArray(cameraNetwork)
      ? cameraNetwork as CameraNetworkSummaryRecord
      : null,
    streamSources,
    streamStatusRecords,
    storagePinIntents: [
      ...collectStoragePinIntentsFromProjection(healthProjection),
      ...collectStoragePinIntentsFromProjection(camerasProjection),
      ...collectStoragePinIntentsFromProjection(streamsProjection),
    ],
    projectionRecords,
    updatedAt: Math.max(0, ...Object.values(projectionRecords).map(projectionSortValue)),
  };
}

function hasNvrRuntimeProjectionState(state = nvrProjectionState): boolean {
  return Boolean(
    state.health ||
    state.cameras.length > 0 ||
    state.cameraNetwork ||
    state.streamSources.length > 0 ||
    state.streamStatusRecords.length > 0 ||
    state.storagePinIntents.length > 0
  );
}

function applyNvrRuntimeProjections(): boolean {
  const next = nextNvrProjectionState();
  nvrProjectionState = next;
  if (!hasNvrRuntimeProjectionState(next)) {
    renderHistoryProjectionStatus();
    return false;
  }

  const projectedSources = next.streamSources.length > 0
    ? next.streamSources
    : next.cameras.map((camera) => String(camera.sourceId || "").trim()).filter(Boolean);

  if (runtimeServiceContext) {
    const display = runtimeServiceContext.display || {};
    const healthStatus = typeof next.health?.ok === "boolean"
      ? (next.health.ok ? "online" : "degraded")
      : String(display.status || "ready");
    runtimeServiceContext = {
      ...runtimeServiceContext,
      display: {
        ...display,
        status: healthStatus,
        configuredSources: Number(next.health?.configuredSources || projectedSources.length || display.configuredSources || 0),
        cameraCount: Number(projectedSources.length || display.cameraCount || 0),
        sources: projectedSources.length > 0 ? projectedSources : display.sources,
        cameras: projectedSources.length > 0
          ? projectedSources.map((sourceId) => {
            const existing = runtimeCameraInfoBySourceId.get(sourceId);
            const mounted = next.cameras.find((camera) => String(camera.sourceId || "").trim() === sourceId);
            return {
              sourceId,
              name: String(mounted?.observed?.displayName || mounted?.displayName || mounted?.desired?.displayName || existing?.name || humanizeSourceId(sourceId)),
              viewGranted: existing?.viewGranted !== false,
              controlGranted: existing?.controlGranted === true || viewerIsOwner(),
              ptzCapable: mounted?.observed?.ptzCapable === true || mounted?.capabilities?.ptz === true || existing?.ptzCapable === true,
            };
          })
          : display.cameras,
      },
    };
    refreshSummary(runtimeServiceContext);
  }

  if (next.cameras.length > 0 || next.cameraNetwork) {
    cameraInventory = {
      mountedDevices: next.cameras.length > 0 ? next.cameras : (cameraInventory?.mountedDevices || []),
      candidateDevices: cameraInventory?.candidateDevices || [],
      cameraNetwork: next.cameraNetwork || cameraInventory?.cameraNetwork || {},
    };
    cameraInventoryError = "";
    seedCameraDraftsFromInventory();
  }

  if (projectedSources.length > 0) {
    const currentSources = Array.from(cameraTiles.keys());
    if (cameraTiles.size === 0 || currentSources.join("\n") !== projectedSources.join("\n")) {
      cameraGridEl.innerHTML = "";
      cameraTiles.clear();
      for (const sourceId of projectedSources) ensureCameraTile(sourceId);
    }
    for (const sourceId of projectedSources) {
      updateLiveTileMetadata(sourceId);
      renderTileStreamStatus(sourceId);
    }
  } else {
    for (const sourceId of cameraTiles.keys()) renderTileStreamStatus(sourceId);
  }

  renderNvrSettingsSummary();
  renderCameraList();
  renderHistoryProjectionStatus();
  return true;
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

function nvrRecordPreparedSourceCount(record: ManagedApplianceRecord | null): number {
  if (!record) return 0;
  const display = nvrDisplayFromRecord(record);
  return normalizeSourceIds(display.sources).length || normalizeRuntimeCameraEntries(display).length;
}

function mergeNvrDirectoryRecords(
  richerRecord: ManagedApplianceRecord,
  catalogRecord: ManagedApplianceRecord | null,
): ManagedApplianceRecord {
  if (!catalogRecord) return richerRecord;
  return {
    ...catalogRecord,
    ...richerRecord,
    label: String(catalogRecord.label || catalogRecord.deviceLabel || richerRecord.label || richerRecord.deviceLabel || "Security Cameras"),
    displayName: String(catalogRecord.displayName || catalogRecord.label || richerRecord.displayName || richerRecord.deviceLabel || "Security Cameras"),
    hostGatewayPk: String(richerRecord.hostGatewayPk || catalogRecord.hostGatewayPk || catalogRecord.gatewayPk || ""),
    hostFabric: catalogRecord.hostFabric || richerRecord.hostFabric,
    updatedAt: Math.max(applianceUpdatedAt(catalogRecord), applianceUpdatedAt(richerRecord)),
  };
}

function directEntryNvrServiceRecord(snapshot: RuntimeSnapshot | null): ManagedApplianceRecord | null {
  const catalogRecord = directEntryNvrServiceCatalogRecord(snapshot);
  if (!catalogRecord) return null;
  const records = snapshotManagedApplianceRecords(snapshot);
  const services = records
    .filter((record) => isNvrApplianceRecord(record) && applianceDevicePk(record) && applianceGatewayPk(record))
    .sort((left, right) => applianceUpdatedAt(right) - applianceUpdatedAt(left));
  const hostedRecords: ManagedApplianceRecord[] = [];
  for (const gateway of records.filter(isGatewayApplianceRecord)) {
    const hosted = directEntryNvrRecordFromGateway(gateway);
    if (hosted) hostedRecords.push(hosted);
  }
  const richerRecord = [...services, ...hostedRecords]
    .sort((left, right) => {
      const sourceDelta = nvrRecordPreparedSourceCount(right) - nvrRecordPreparedSourceCount(left);
      return sourceDelta || applianceUpdatedAt(right) - applianceUpdatedAt(left);
    })[0] || null;
  if (!richerRecord) return catalogRecord;
  if (nvrRecordPreparedSourceCount(richerRecord) > nvrRecordPreparedSourceCount(catalogRecord)) {
    return mergeNvrDirectoryRecords(richerRecord, catalogRecord);
  }
  return catalogRecord;
}

function directEntryNvrServiceCatalogRecord(snapshot: RuntimeSnapshot | null): ManagedApplianceRecord | null {
  const services = preparedServiceRegistryServices((snapshot || {}) as Record<string, unknown>);
  const match = services.find((entry) => {
    if (!entry || typeof entry !== "object") return false;
    return normalizeRole((entry as Record<string, unknown>).service) === "nvr";
  });
  if (!match || typeof match !== "object") return null;
  const record = match as Record<string, unknown>;
  const servicePk = String(record.servicePk || record.devicePk || record.pk || "").trim();
  const gatewayPk = String(record.hostGatewayPk || record.gatewayPk || "").trim();
  if (!servicePk || !gatewayPk) return null;
  return {
    ...record,
    devicePk: servicePk,
    pk: servicePk,
    hostGatewayPk: gatewayPk,
    role: "nvr",
    service: "nvr",
    deviceKind: "service",
    serviceVersion: String(record.serviceVersion || record.version || ""),
    updatedAt: Number(record.updatedAt || snapshot?.updatedAt || Date.now()),
  };
}

function nvrServiceCatalogBlockedReason(record: ManagedApplianceRecord): string {
  const legacyFallback = record.legacyPathFallback && typeof record.legacyPathFallback === "object" && !Array.isArray(record.legacyPathFallback)
    ? record.legacyPathFallback as Record<string, unknown>
    : null;
  if (legacyFallback) {
    return String(legacyFallback.reason || "Security Cameras service is projected from a quarantined legacy path.").trim();
  }
  const fabric = record.hostFabric && typeof record.hostFabric === "object" && !Array.isArray(record.hostFabric)
    ? record.hostFabric as Record<string, unknown>
    : null;
  if (!fabric) return "";
  const state = String(fabric.state || fabric.fulfillmentState || fabric.lifecycleState || "").trim().toLowerCase();
  const blockedReasons = Array.isArray(fabric.blockedReasons)
    ? fabric.blockedReasons.map((reason) => String(reason || "").trim()).filter(Boolean)
    : [];
  if (blockedReasons.length > 0) return `Security Cameras host fabric blocked: ${blockedReasons.slice(0, 2).join(", ")}`;
  if (!state || state === "ready" || state === "available" || state === "live") return "";
  return `Security Cameras host fabric is ${state}.`;
}

async function currentRuntimeSnapshot(): Promise<RuntimeSnapshot | null> {
  try {
    const snapshot = await runtimeCall<RuntimeSnapshot>("runtime.snapshot.get", {}, RUNTIME_WRITE_TIMEOUT_MS);
    absorbRuntimeSnapshot(snapshot);
  } catch {}
  return runtimeBaseline;
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

function availableCameraInfo(sourceId: string): CameraGrantView | null {
  const target = String(sourceId || "").trim();
  if (!target || !grantInventory?.availableCameras?.length) return null;
  return grantInventory.availableCameras.find((camera) => String(camera.sourceId || "").trim() === target) || null;
}

function runtimeCameraInfo(sourceId: string): RuntimeCameraAccessDisplay | null {
  const key = String(sourceId || "").trim();
  if (!key) return null;
  const base = runtimeCameraInfoBySourceId.get(key) || null;
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
  return runtimeServiceContext?.display?.grantedScope?.owner === true;
}

function ownerCanAdmin(): boolean {
  return viewerIsOwner();
}

function defaultCameraSettingsDraft(sourceId: string): CameraSettingsDraft {
  const camera = runtimeCameraInfo(sourceId);
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
  const runtimeRows = normalizeRuntimeCameraEntries(runtimeServiceContext?.display || {}).map((camera) => {
    const merged = runtimeCameraInfo(String(camera.sourceId || "").trim()) || camera;
    return {
      sourceId: merged.sourceId,
      name: merged.name,
      ptzCapable: merged.ptzCapable,
    };
  });
  if (runtimeRows.length > 0) return runtimeRows;
  const liveSourceIds = liveSourceIdsForInventoryDiagnostic();
  return liveSourceIds.map((sourceId) => ({
    sourceId,
    name: cameraDisplayName(sourceId),
    ptzCapable: false,
  }));
}

function liveSourceIdsForInventoryDiagnostic(): string[] {
  const sources = [
    ...nvrProjectionState.streamSources,
    ...Array.from(cameraTiles.keys()),
  ].map((sourceId) => String(sourceId || "").trim()).filter(Boolean);
  return Array.from(new Set(sources));
}

function inventoryProjectionMissingWithLiveSources(): boolean {
  return liveSourceIdsForInventoryDiagnostic().length > 0
    && nvrProjectionState.cameras.length === 0
    && !(cameraInventory?.mountedDevices?.length);
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
    if (applyNvrRuntimeProjections() && (nvrProjectionState.cameras.length > 0 || nvrProjectionState.cameraNetwork)) {
      cameraInventoryLoading = false;
      cameraInventoryError = "";
      renderCameraRefreshStatus();
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
      const payload = await nvrAdminAdapter.request("list_camera_device_inventory");
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
      cameraInventoryError = normalizeNvrAdminAdapterError(error);
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
    const payload = await nvrAdminAdapter.request("apply_camera_device_config", {
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
  const payload = await nvrAdminAdapter.request("mount_camera_device", {
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
  const payload = await nvrAdminAdapter.request("probe_camera_device", { sourceId });
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
  const payload = await nvrAdminAdapter.request("probe_camera_device", {
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
  const info = runtimeCameraInfo(sourceId);
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
  const streamStatus = document.createElement("div");
  streamStatus.className = "cameraStreamStatus";
  streamStatus.hidden = true;
  card.appendChild(streamStatus);
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
    streamStatus,
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
  renderTileStreamStatus(sourceId);
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
  const info = runtimeCameraInfo(sourceId);
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
  const info = runtimeCameraInfo(sourceId);
  if (!ptzUiInteractive(info)) return;
  appendLog(`PTZ send ${cameraLabelForSource(sourceId)} ${debugJson(payload)}`);
  try {
    await publishRuntimeStreamControl("ptz.step", {
      sourceId,
      ptz: payload,
    });
    const ack = {
      preempted: false,
      currentPose: payload.targetPose && typeof payload.targetPose === "object"
        ? payload.targetPose as CameraPoseView
        : undefined,
      desiredPose: payload.targetPose && typeof payload.targetPose === "object"
        ? payload.targetPose as CameraPoseView
        : undefined,
      poseStatus: "queued",
      managementPlane: "runtime",
      ptzDiagnostics: null,
    };
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

function liveTileSourceIds(): string[] {
  return Array.from(cameraTiles.entries())
    .filter(([, tile]) => tile.card.dataset.state === "live")
    .map(([sourceId]) => sourceId);
}

function expectedLiveSourceIds(context: RuntimeServiceContext | null = runtimeServiceContext): string[] {
  return context ? runtimePreviewSourceIds(context) : Array.from(cameraTiles.keys());
}

function missingLiveSourceIds(context: RuntimeServiceContext | null = runtimeServiceContext): string[] {
  const live = new Set(liveTileSourceIds());
  return expectedLiveSourceIds(context).filter((sourceId) => !live.has(sourceId));
}

function hasAllExpectedLiveTiles(context: RuntimeServiceContext | null = runtimeServiceContext): boolean {
  const expected = expectedLiveSourceIds(context);
  if (expected.length === 0) return false;
  const live = new Set(liveTileSourceIds());
  return expected.every((sourceId) => live.has(sourceId));
}

function staleMissingLiveSourceIds(context: RuntimeServiceContext | null = runtimeServiceContext): string[] {
  const now = Date.now();
  return missingLiveSourceIds(context).filter((sourceId) => {
    const sourceSessions = activeRuntimeStreamSessions()
      .filter((session) => session.sourceId === sourceId);
    if (sourceSessions.length === 0) return true;
    return sourceSessions.every((session) => {
      const ageMs = Math.max(0, now - Number(session.issuedAt || 0));
      return ageMs >= MEDIA_RENDER_BLOCKED_GRACE_MS
        && session.mediaTransportUsable !== true
        && session.mediaTrackLive !== true
        && session.routeState !== "mediaUsable";
    });
  });
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

function renderKeyValueGridMarkup(rows: Array<[string, unknown]>): string {
  return createKeyValueGrid(rows).outerHTML;
}

function compactTimestamp(value: unknown): string {
  const numeric = Number(value || 0);
  if (!numeric) return "";
  const ms = numeric < 9_999_999_999 ? numeric * 1000 : numeric;
  try {
    return new Date(ms).toLocaleTimeString();
  } catch {
    return "";
  }
}

function sourceIdFromStreamStatus(record: Record<string, unknown>): string {
  const recovery = recordFrom(record.recovery);
  return String(recovery.sourceId || record.sourceId || "").trim();
}

function streamStatusForSource(sourceId: string): Record<string, unknown> | null {
  const target = String(sourceId || "").trim();
  if (!target) return null;
  const records = nvrProjectionState.streamStatusRecords
    .filter((record) => sourceIdFromStreamStatus(record) === target)
    .sort((left, right) => Number(right.issuedAt || 0) - Number(left.issuedAt || 0));
  return records[0] || null;
}

function preparedStreamStatus(record: Record<string, unknown> | null): {
  sessionId: string;
  state: string;
  health: string;
  transport: string;
  recovering: boolean;
  backoff: string;
  updatedAt: string;
} | null {
  if (!record) return null;
  const recovery = recordFrom(record.recovery);
  const status = String(record.status || "unknown").trim() || "unknown";
  const codec = String(recovery.codec || "").trim();
  const selectedStream = String(recovery.selectedStream || "").trim();
  const repairNeeded = recovery.repairNeeded === true;
  return {
    sessionId: String(record.sessionId || recovery.sessionId || "").trim(),
    state: status,
    health: repairNeeded ? "repair" : status,
    transport: ["webrtc", codec, selectedStream].filter(Boolean).join(" / "),
    recovering: repairNeeded || status === "backoff",
    backoff: status === "backoff" ? "pending" : "",
    updatedAt: compactTimestamp(record.issuedAt || recovery.issuedAt),
  };
}

function streamTileState(record: Record<string, unknown> | null): "waiting" | "connecting" | "live" | "unavailable" {
  if (!record) return "connecting";
  const status = String(record.status || "").trim().toLowerCase();
  const recovery = recordFrom(record.recovery);
  if (["ready", "live", "connected", "open"].includes(status) && recovery.repairNeeded !== true) return "live";
  if (["failed", "error", "unavailable"].includes(status)) return "unavailable";
  return "connecting";
}

function renderPreparedStreamStatus(container: HTMLElement, prepared: NonNullable<ReturnType<typeof preparedStreamStatus>>): void {
  container.innerHTML = `
    <section class="streamStatus" aria-label="Stream status">
      <div class="streamStatusHeader">
        <span>Stream</span>
        <strong>${escapeHtml(prepared.health || prepared.state)}</strong>
      </div>
      <div class="streamStatusMeta">
        ${prepared.transport ? `<span>${escapeHtml(prepared.transport)}</span>` : ""}
        ${prepared.recovering ? "<span>recovering</span>" : ""}
        ${prepared.backoff ? `<span>${escapeHtml(prepared.backoff)}</span>` : ""}
        ${prepared.updatedAt ? `<span>${escapeHtml(prepared.updatedAt)}</span>` : ""}
      </div>
    </section>
  `;
}

function renderTileStreamStatus(sourceId: string): void {
  const tile = cameraTiles.get(sourceId);
  if (!tile) return;
  const record = streamStatusForSource(sourceId);
  const prepared = preparedStreamStatus(record);
  tile.streamStatus.hidden = !prepared;
  tile.streamStatus.classList.toggle("warn", recordFrom(record?.recovery).repairNeeded === true);
  if (!prepared) {
    tile.streamStatus.replaceChildren();
    return;
  }
  renderPreparedStreamStatus(tile.streamStatus, prepared);
  const state = streamTileState(record);
  setTileState(
    sourceId,
    state,
    state === "live"
      ? "Preview stream is ready from runtime projection."
      : state === "unavailable"
        ? "Preview stream is unavailable in runtime projection."
        : "Preview stream intent is pending.",
  );
}

function renderProjectionSyncSummary(): string {
  const records = Object.entries(nvrProjectionState.projectionRecords);
  const rows = records.map(([channelId, record]) => {
    const freshness = record.freshness && typeof record.freshness === "object" ? record.freshness : {};
    const state = String(freshness.state || "fresh").trim() || "fresh";
    const revision = String(record.revision || "").trim();
    const updated = compactTimestamp(freshness.updatedAt || record.retainedAt || record.updatedAt);
    return [channelId, [state, revision ? `rev ${revision}` : "", updated].filter(Boolean).join(" / ")];
  });
  if (runtimeConsumerFloor) {
    rows.push([
      "runtime.floor",
      [
        String(runtimeConsumerFloor.lagState || "unknown").trim() || "unknown",
        runtimeConsumerFloor.ackFloor ? `ack ${runtimeConsumerFloor.ackFloor}` : "",
        runtimeConsumerFloor.witnessFloor ? `witness ${runtimeConsumerFloor.witnessFloor}` : "",
      ].filter(Boolean).join(" / "),
    ]);
  }
  if (runtimeMaterializationPosture) {
    rows.push([
      "runtime.materialization",
      [
        String(runtimeMaterializationPosture.state || "unknown").trim() || "unknown",
        runtimeMaterializationPosture.budgetId ? `budget ${runtimeMaterializationPosture.budgetId}` : "",
        runtimeMaterializationPosture.estimatedSnapshotBytes ? `${runtimeMaterializationPosture.estimatedSnapshotBytes} bytes` : "",
      ].filter(Boolean).join(" / "),
    ]);
  }
  if (rows.length === 0) return "";
  return `
    <section class="nestedPanel runtimeProjectionPanel">
      <div class="summaryLabel">Runtime Projection</div>
      ${renderKeyValueGridMarkup(rows)}
    </section>
  `;
}

function renderStoragePinIntentSummary(): string {
  const intents = nvrProjectionState.storagePinIntents;
  if (intents.length === 0) return "";
  return `
    <section class="nestedPanel storagePinPanel">
      <div class="summaryLabel">Storage Pin Intents</div>
      <p class="panelHint">Control records only; media bytes stay outside runtime projection state.</p>
      ${renderKeyValueGridMarkup(intents.map((intent) => {
        const objectCount = Array.isArray(intent.objectRefs) ? intent.objectRefs.length : 0;
        const status = String(intent.status || "pending").trim() || "pending";
        return [
          String(intent.intentId || "pin intent"),
          `${status} / ${objectCount} object ref${objectCount === 1 ? "" : "s"} / ${Number(intent.desiredReplicas || 0) || 1} replica${Number(intent.desiredReplicas || 0) === 1 ? "" : "s"}`,
        ];
      }))}
    </section>
  `;
}

function renderRuntimePostureSummary(): string {
  const shellState = runtimeReadModel.shell as Record<string, any>;
  const resource = shellState.resource || {};
  const retention = shellState.retention || {};
  return `
    <section class="nestedPanel runtimePosturePanel">
      <div class="summaryLabel">Runtime Posture</div>
      ${renderKeyValueGridMarkup([
        ["Resource", String(resource.state || "unknown")],
        ["Cleanup", resource.cleanupAllowed ? "allowed" : String(resource.cleanupReason || "blocked")],
        ["Retention", String(retention.state || "unknown")],
        ["Release", retention.releaseRequired ? String(retention.reason || "blocked") : "ready"],
      ])}
    </section>
  `;
}

function renderHistoryProjectionStatus(): void {
  const pinSummary = renderStoragePinIntentSummary();
  const statusSummary = renderProjectionSyncSummary();
  const existing = historyViewEl.querySelector<HTMLElement>("[data-role='history-projection-status']");
  if (!pinSummary && !statusSummary) {
    existing?.remove();
    return;
  }
  let wrap = existing;
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.dataset.role = "history-projection-status";
    wrap.className = "historyProjectionStatus";
    historyHintEl.insertAdjacentElement("afterend", wrap);
  }
  wrap.innerHTML = `${pinSummary}${statusSummary}`;
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
    ${renderKeyValueGridMarkup([
      ["Managed", network.managed ? "yes" : "no"],
      ["Interface", String(network.interface || "not configured")],
      ["Subnet", String(network.subnetCidr || "not configured")],
      ["Host IP", String(network.hostIp || "not configured")],
      ["DHCP", network.dhcpEnabled ? `${String(network.dhcpRangeStart || "—")} → ${String(network.dhcpRangeEnd || "—")}` : "disabled"],
      ["NTP", network.ntpEnabled ? String(network.ntpServer || "enabled") : "disabled"],
      ["Timezone", String(network.timezone || "UTC")],
      ["DNS", String(network.dnsServer || "not configured")],
    ])}
    ${cameraInventoryError ? `<p class="panelHint warnText">${escapeHtml(cameraInventoryError)}</p>` : ""}
  `;
}

function renderNvrSettingsSummary(): void {
  if (!nvrSettingsSummaryEl || !runtimeServiceContext) return;
  const display = runtimeServiceContext.display || {};
  const grantedScope = display.grantedScope || {};
  const network = cameraInventory?.cameraNetwork || {};
  const accessSummary = nvrAccessSummary();
  const projectionSummary = renderProjectionSyncSummary();
  const storageSummary = renderStoragePinIntentSummary();
  const runtimePostureSummary = renderRuntimePostureSummary();
  nvrSettingsSummaryEl.innerHTML = `
    <section class="nestedPanel">
      <div class="summaryLabel">Service</div>
      ${renderKeyValueGridMarkup([
        ["Label", serviceLabelForContext(runtimeServiceContext)],
        ["Service", String(display.service || runtimeServiceContext.service || "nvr")],
        ["Version", String(display.serviceVersion || "unknown")],
        ["Health", String(display.status || "online")],
        ["Admin", viewerIsOwner() ? (cameraInventoryError ? "gateway update required" : "available") : ""],
      ])}
    </section>
    <section class="nestedPanel">
      <div class="summaryLabel">Gateway</div>
      ${renderKeyValueGridMarkup([
        ["Gateway", gatewayLabelForContext(runtimeServiceContext)],
        ["Access scope", viewerIsOwner() ? "owner" : "granted"],
        ["Access", accessSummary],
        ["Live scope", !viewerIsOwner() ? formatCameraScope(grantedScope.viewSources || []) || "granted cameras" : ""],
        ["PTZ scope", !viewerIsOwner() && PTZ_UI_ENABLED ? formatCameraScope(grantedScope.controlSources || []) || "none" : ""],
      ])}
    </section>
    ${projectionSummary}
    ${storageSummary}
    ${runtimePostureSummary}
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
    await publishRuntimeServiceIntent("list_grants", {}, GRANT_REQUEST_TIMEOUT_MS);
    grantInventory = {
      grants: [],
      availableCameras: settingsCameraRows(),
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
  const grantedScope = runtimeServiceContext?.display?.grantedScope || {};
  const live = formatCameraScope(grantedScope.viewSources || []) || "granted cameras";
  if (!PTZ_UI_ENABLED) {
    return `Granted access • live ${live}`;
  }
  const ptz = formatCameraScope(grantedScope.controlSources || []) || "none";
  return `Granted access • live ${live} • PTZ ${ptz}`;
}

function cameraAccessSummary(camera: RuntimeCameraAccessDisplay | null): string {
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
  if (!runtimeServiceContext) return;
  if (viewerIsOwner() && cameraInventoryError) {
    const warning = document.createElement("section");
    warning.className = "nestedPanel";
    warning.innerHTML = `
      <div class="summaryLabel">Camera Administration</div>
      <p class="panelHint warnText">${escapeHtml(cameraInventoryError)}</p>
    `;
    cameraListEl.appendChild(warning);
  }
  const liveInventoryGap = inventoryProjectionMissingWithLiveSources();
  if (liveInventoryGap) {
    const warning = document.createElement("section");
    warning.className = "nestedPanel";
    warning.innerHTML = `
      <div class="summaryLabel">Inventory Projection</div>
      <p class="panelHint warnText">Live source present; camera inventory projection is missing.</p>
    `;
    cameraListEl.appendChild(warning);
  }
  const cameras = settingsCameraRows()
    .map((row) => runtimeCameraInfo(String(row.sourceId || "").trim()) || {
      sourceId: row.sourceId,
      name: row.name,
      viewGranted: true,
      controlGranted: false,
      ptzCapable: row.ptzCapable,
    })
    .sort((left, right) => String(left.name || left.sourceId || "").localeCompare(String(right.name || right.sourceId || "")));
  if (cameras.length === 0) {
    cameraListEl.innerHTML = liveInventoryGap
      ? `<article class="emptyState emptyStateTight"><strong>Inventory projection missing</strong><p>Live source is present, but retained camera inventory has not materialized yet.</p></article>`
      : `<article class="emptyState emptyStateTight"><strong>No cameras</strong><p>Camera inventory appears here once the service reports sources.</p></article>`;
  } else {
    for (const camera of cameras) {
      const sourceId = String(camera.sourceId || "").trim();
      if (!sourceId) continue;
      const info = runtimeCameraInfo(sourceId) || camera;
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
  const camera = runtimeCameraInfo(sourceId);
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
    ${renderKeyValueGridMarkup([
      ["Driver", driverId],
      ["Vendor", vendor],
      ["Model", model],
      ["Access", cameraAccessSummary(camera)],
      ["PTZ", showPtzSummary ? (camera.controlGranted ? "owner control ready" : "available") : ""],
      ["Pose", showPtzSummary ? formatPose(currentPose, poseStatus) : ""],
    ])}
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

function refreshSummary(context: RuntimeServiceContext): void {
  const display = context.display || {};
  rememberResolvedResourceName(context.servicePk, display.serviceLabel);
  runtimeCameraInfoBySourceId.clear();
  for (const camera of normalizeRuntimeCameraEntries(display)) {
    runtimeCameraInfoBySourceId.set(String(camera.sourceId || "").trim(), camera);
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
  if (!runtimeServiceContext) return;
  popGatewayEl.textContent = gatewayLabelForContext(runtimeServiceContext);
  popGatewayEl.title = runtimeServiceContext.gatewayPk;
  const cameraCount = cameraCountForContext(runtimeServiceContext);
  popServicesEl.textContent = `${serviceLabelForContext(runtimeServiceContext)} (${cameraCount} camera${cameraCount === 1 ? "" : "s"})`;
  popServicesEl.title = runtimeServiceContext.servicePk;
  refreshIdentityHandle();
}

function renderRuntimeProjectionTiles(context: RuntimeServiceContext): boolean {
  const requestedSources = runtimePreviewSourceIds(context);
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

async function loadRuntimeServiceContext(): Promise<RuntimeServiceContext> {
  return await requestDirectEntryRuntimeContext();
}

function isDirectEntryIdleRuntimeFailure(error: RuntimeContextError): boolean {
  const detail = String(error.detail || "").toLowerCase();
  return detail.includes("no security cameras service is available")
    || detail.includes("msa host-fabric posture")
    || detail.includes("host fabric blocked")
    || detail.includes("host fabric is")
    || detail.includes("shared browser runtime unavailable")
    || detail.includes("runtime broker unavailable")
    || detail.includes("runtime broker missing")
    || detail.includes("link an identity")
    || detail.includes("device key is not ready");
}

async function connectLiveGrid(context: RuntimeServiceContext): Promise<void> {
  app.dataset.runtimeStage = "runtime_intent";
  const requestedSources = runtimePreviewSourceIds(context);
  if (requestedSources.length === 0) {
    cancelScheduledReconnect();
    setGridEmpty("No Cameras", "The managed NVR service has not reported any enabled sources yet.");
    setConnectionState("no cameras", "warn");
    setDrawerStatus("No enabled camera sources were advertised by the NVR service.");
    void reportServiceStatus("no cameras", "The managed NVR service did not advertise any enabled sources.", "runtime_directory");
    return;
  }

  renderRuntimeProjectionTiles(context);

  const authority = await waitForRuntimeAuthorityActionable();
  if (!runtimeAuthorityIsReady(authority)) {
    closePeerConnection();
    markRuntimeAuthorityWaiting(authority);
    scheduleRuntimeAuthorityReconnect(runtimeAuthorityBlockedDetail(authority));
    return;
  }

  const edgePosture = runtimeReadModel.edge || {};
  const needsEdgeAttach = edgePosture.connected !== true || edgePosture.mode === "pendingAuthority";
  const edgeAttached = needsEdgeAttach
    ? await ensureRuntimeSwarmEdgeForContext(context, { force: true }).catch((error) => {
      const detail = String((error as Error)?.message || error);
      if (isRuntimeSwarmEdgeAuthorityWait(error)) {
        appendLog(`runtime swarm edge waiting for authority: ${detail}`);
        scheduleRuntimeAuthorityReconnect(detail);
        return false;
      }
      appendLog(`runtime swarm edge attach unavailable: ${detail}`);
      return false;
    })
    : true;
  if (!edgeAttached && edgePosture.mode === "pendingAuthority") {
    markRuntimeAuthorityWaiting({ state: "waitingAuthority", ready: false, reason: "Runtime authority is required before swarm edge attach." });
    scheduleRuntimeAuthorityReconnect("runtime edge attach is waiting for authority");
    return;
  }

  closePeerConnection();
  for (const sourceId of requestedSources) {
    setTileState(sourceId, "connecting", "Runtime stream intent queued.");
  }

  setConnectionState("connecting", "warn");
  setDrawerStatus("Requesting live preview through runtime.");
  void reportServiceStatus("connecting", "Requesting live preview through runtime.", "runtime_intent");
  const streamIntent = await publishRuntimeStreamIntent(requestedSources).catch((error) => {
    throw runtimeContextError("runtime_intent", String((error as Error)?.message || error || "runtime stream intent failed"));
  });
  if (runtimeIntentWaitingAuthority(streamIntent)) {
    closePeerConnection();
    markRuntimeAuthorityWaiting({
      state: streamIntent.authorityLifecycleState || streamIntent.result?.authorityLifecycleState || streamIntent.state || streamIntent.result?.state || "waitingAuthority",
      ready: false,
      blockedAuthorityDomain: streamIntent.blockedAuthorityDomain || streamIntent.result?.blockedAuthorityDomain || "runtime",
      reason: String(streamIntent.authoritySummary?.reason || "Runtime authority became unavailable while opening the preview.").trim(),
    });
    scheduleRuntimeAuthorityReconnect("runtime authority became unavailable");
    return;
  }
  markStartupStage("nvr.stream-intent.queued");
  applyNvrRuntimeProjections();
  if (!hasAllExpectedLiveTiles()) {
    const posture = runtimeStreamSessionPosture();
    if (posture.waitingRouteCount > 0) {
      markRouteBaselineWaiting();
      noteRouteBaselinePending("stream route baseline pending after activation");
    } else {
      setConnectionState("connecting", "warn");
      setDrawerStatus("Waiting for stream projection.");
    }
    scheduleStreamLiveWatchdog("runtime stream intent queued without live track");
  }
}

function runtimePreviewSourceIds(context: RuntimeServiceContext): string[] {
  const display = context.display || {};
  const sources = normalizeSourceIds(display.sources);
  if (sources.length > 0) return sources.slice(0, NVR_PREVIEW_SOURCE_LIMIT);
  return cameraCountForContext(context) > 0 ? [NVR_AUTO_PREVIEW_SOURCE_ID] : [];
}

function cancelScheduledReconnect(): void {
  if (scheduledReconnectTimer) {
    window.clearTimeout(scheduledReconnectTimer);
    scheduledReconnectTimer = 0;
  }
}

function cancelStreamLiveWatchdog(): void {
  if (streamLiveWatchdogTimer) {
    window.clearTimeout(streamLiveWatchdogTimer);
    streamLiveWatchdogTimer = 0;
  }
}

function reconnectDelayMs(attempt: number, baseMs: number, maxMs: number): number {
  return adapterReconnectDelayMs(
    attempt,
    baseMs,
    maxMs,
    adapterReconnectJitterMs(baseMs),
  );
}

type RuntimeStreamRecoveryPosture = {
  state?: string;
  parentIntentId?: string;
  attempt?: number;
  delayMs?: number;
  nextRetryAt?: number;
  reason?: string;
};

function runtimeStreamRecoveryParentIntentId(context: RuntimeServiceContext | null = runtimeServiceContext): string {
  if (!context) return RUNTIME_STREAM_RECOVERY_PARENT_INTENT_ID;
  const sourceKey = runtimePreviewSourceIds(context).join(",");
  return sourceKey ? `${RUNTIME_STREAM_RECOVERY_PARENT_INTENT_ID}:${sourceKey}` : RUNTIME_STREAM_RECOVERY_PARENT_INTENT_ID;
}

function platformAdapterLifecycleRef(): string {
  return String(nvrPlatformAdapterBindingPosture.implementationRef || nvrSurfaceModules.platformAdapter.moduleRef || "adapter:media-webrtc:browser");
}

function adapterReconnectLifecycle(
  reason: string,
  attempt: number,
  delayMs: number,
  context: RuntimeServiceContext | null = runtimeServiceContext,
): Record<string, unknown> {
  return adapterReconnectLifecyclePosture({
    adapterRef: platformAdapterLifecycleRef(),
    moduleRef: nvrSurfaceModules.platformAdapter.moduleRef,
    surfaceRef: nvrSurfaceApp.surfaceRef || nvrSurfaceApp.contractId,
    subjectRef: runtimeStreamRecoveryParentIntentId(context),
    intentRefs: [runtimeStreamRecoveryParentIntentId(context)],
    sessionRefs: activeRuntimeStreamSessions().map((session) => session.sessionId),
    releaseRefs: nvrPlatformAdapterBindingPosture.releaseRefs,
    resourceRefs: nvrPlatformAdapterBindingPosture.materializationBudgetRefs,
    attempt,
    delayMs,
    reason,
    openResourceCount: activeRuntimeStreamSessions().length,
    safeFacts: {
      sourceCount: context ? runtimePreviewSourceIds(context).length : 0,
      adapterRole: nvrPlatformAdapterBindingPosture.role,
    },
  });
}

function adapterReleaseLifecycle(session: RuntimeStreamSession, reasonCode: string): Record<string, unknown> {
  return adapterReleaseLifecyclePosture({
    adapterRef: session.adapterModuleRef || platformAdapterLifecycleRef(),
    moduleRef: nvrSurfaceModules.platformAdapter.moduleRef,
    surfaceRef: nvrSurfaceApp.surfaceRef || nvrSurfaceApp.contractId,
    subjectRef: session.sessionId,
    sessionRefs: [session.sessionId],
    releaseRefs: session.releaseRefs.length ? session.releaseRefs : nvrPlatformAdapterBindingPosture.releaseRefs,
    resourceRefs: nvrPlatformAdapterBindingPosture.materializationBudgetRefs,
    safeFacts: {
      reasonCode,
      sourceRef: session.sourceId,
      iceConnectionState: session.iceConnectionState,
      connectionState: session.connectionState,
    },
  });
}

async function runtimeStreamRecoveryPosture(
  reason: string,
  attempt: number,
  fallbackDelayMs: number,
): Promise<RuntimeStreamRecoveryPosture> {
  const context = runtimeServiceContext;
  if (!context) {
    return { state: "localFallback", attempt, delayMs: fallbackDelayMs, reason };
  }
  try {
    const posture = await runtimeCall<RuntimeStreamRecoveryPosture>(RUNTIME_STREAM_RECOVERY_REQUEST, {
      payload: {
        action: "schedule",
        parentIntentId: runtimeStreamRecoveryParentIntentId(context),
        reason,
        attemptHint: attempt,
        baseMs: RUNTIME_STREAM_RECONNECT_BASE_MS,
        maxMs: RUNTIME_STREAM_RECONNECT_MAX_MS,
        fallbackDelayMs,
        sourceIds: runtimePreviewSourceIds(context),
        sessionCount: activeRuntimeStreamSessions().length,
        adapterLifecycle: adapterReconnectLifecycle(reason, attempt, fallbackDelayMs, context),
      },
    }, RUNTIME_WRITE_TIMEOUT_MS);
    return (posture && typeof posture === "object") ? posture : { state: "localFallback", attempt, delayMs: fallbackDelayMs, reason };
  } catch (error) {
    appendLog(`runtime stream recovery posture unavailable: ${String((error as Error)?.message || error)}`);
    return { state: "localFallback", attempt, delayMs: fallbackDelayMs, reason };
  }
}

function resetRuntimeStreamRecovery(reason: string): void {
  const context = runtimeServiceContext;
  if (!context) return;
  void runtimeCall(RUNTIME_STREAM_RECOVERY_REQUEST, {
    payload: {
      action: "reset",
      parentIntentId: runtimeStreamRecoveryParentIntentId(context),
      reason,
      sourceIds: runtimePreviewSourceIds(context),
      sessionCount: activeRuntimeStreamSessions().length,
    },
  }, RUNTIME_WRITE_TIMEOUT_MS).catch((error) => {
    appendLog(`runtime stream recovery reset failed: ${String((error as Error)?.message || error)}`);
  });
}

function activeRuntimeStreamSessions(): RuntimeStreamSession[] {
  return Array.from(new Set(runtimeStreamSessionsBySessionId.values())).slice(-NVR_STREAM_EVENT_LIMIT);
}

function runtimeStreamSessionPosture(): {
  sessionCount: number;
  waitingRouteCount: number;
  waitingServiceAcceptanceCount: number;
  serviceAdmissionTimedOutCount: number;
  waitingAnswerCount: number;
  rejectedCount: number;
  answerReceivedCount: number;
  expiresAt: number;
} {
  return summarizeRuntimeStreamSessionPosture(activeRuntimeStreamSessions());
}

function noteRouteBaselinePending(_reason: string): void {
  const now = Date.now();
  if (now - routeBaselineNoticeAt < 30_000) return;
  routeBaselineNoticeAt = now;
}

function markRouteBaselineWaiting(): void {
  setConnectionState("connecting", "warn");
  setDrawerStatus("Stream activation is waiting for route baseline.");
  for (const sourceId of cameraTiles.keys()) {
    setTileState(sourceId, "connecting", "Waiting for route baseline.");
  }
  void reportServiceStatus("connecting", "Stream activation is waiting for route baseline.", "stream_projection");
}

function scheduleStreamLiveWatchdog(reason: string): void {
  cancelStreamLiveWatchdog();
  if (!runtimeServiceContext) return;
  streamLiveWatchdogTimer = window.setTimeout(() => {
    streamLiveWatchdogTimer = 0;
    if (hasAllExpectedLiveTiles()) return;
    const posture = runtimeStreamSessionPosture();
    const missingSources = missingLiveSourceIds();
    const staleMissingSources = staleMissingLiveSourceIds();
    if (hasLiveTiles() && missingSources.length > 0) {
      const missingLabel = formatCameraScope(missingSources);
      setConnectionState("partial", "warn");
      setDrawerStatus(`Live preview partially connected; waiting for ${missingLabel}.`);
      for (const sourceId of missingSources) {
        setTileState(sourceId, "connecting", "Waiting for live preview stream.");
      }
      if (staleMissingSources.length > 0) {
        scheduleMissingSourceReconnect(staleMissingSources, `missing live preview stream: ${formatCameraScope(staleMissingSources)}`);
      } else {
        scheduleStreamLiveWatchdog("waiting for remaining live preview streams");
      }
      return;
    }
    const activationStillOpen = posture.sessionCount > 0
      && (!posture.expiresAt || posture.expiresAt > Date.now());
    if (activationStillOpen && posture.waitingRouteCount > 0) {
      noteRouteBaselinePending(`${posture.waitingRouteCount} active stream session(s) awaiting route baseline`);
      markRouteBaselineWaiting();
      scheduleStreamLiveWatchdog("stream route baseline still pending");
      return;
    }
    if (activationStillOpen && posture.serviceAdmissionTimedOutCount > 0) {
      appendLog(`stream live watchdog holding ${posture.serviceAdmissionTimedOutCount} timed-out service admission session(s)`);
      setConnectionState("unavailable", "bad");
      setDrawerStatus("Stream route delivered, but the service did not admit the request.");
      for (const sourceId of cameraTiles.keys()) {
        setTileState(sourceId, "unavailable", "Stream service did not admit the request.");
      }
      void reportServiceStatus("unavailable", "Stream route delivered, but the service did not admit the request.", "stream_projection");
      return;
    }
    if (activationStillOpen && posture.waitingServiceAcceptanceCount > 0) {
      appendLog(`stream live watchdog holding ${posture.waitingServiceAcceptanceCount} active session(s) awaiting service acceptance`);
      setConnectionState("connecting", "warn");
      setDrawerStatus("Stream route delivered; waiting for service acceptance.");
      for (const sourceId of cameraTiles.keys()) {
        setTileState(sourceId, "connecting", "Waiting for stream service acceptance.");
      }
      void reportServiceStatus("connecting", "Stream route delivered; waiting for service acceptance.", "stream_projection");
      scheduleStreamLiveWatchdog("stream service acceptance still pending");
      return;
    }
    if (activationStillOpen && posture.waitingAnswerCount > 0) {
      appendLog(`stream live watchdog holding ${posture.waitingAnswerCount} accepted session(s) awaiting stream answer`);
      setConnectionState("connecting", "warn");
      setDrawerStatus("Stream service accepted; waiting for answer.");
      for (const sourceId of cameraTiles.keys()) {
        setTileState(sourceId, "connecting", "Waiting for stream answer.");
      }
      void reportServiceStatus("connecting", "Stream service accepted; waiting for answer.", "stream_projection");
      scheduleStreamLiveWatchdog("stream service answer still pending");
      return;
    }
    if (activationStillOpen && posture.rejectedCount > 0) {
      appendLog(`stream live watchdog holding ${posture.rejectedCount} rejected session(s)`);
      setConnectionState("unavailable", "bad");
      setDrawerStatus("Stream service rejected.");
      void reportServiceStatus("unavailable", "Stream service rejected.", "stream_projection");
      return;
    }
    if (activationStillOpen && posture.answerReceivedCount > 0) {
      appendLog(`stream live watchdog holding ${posture.answerReceivedCount} answered session(s) awaiting media track`);
      setConnectionState("connecting", "warn");
      setDrawerStatus("Stream answer received; waiting for media track.");
      for (const sourceId of cameraTiles.keys()) {
        setTileState(sourceId, "connecting", "Waiting for live media track.");
      }
      void reportServiceStatus("connecting", "Stream answer received; waiting for media track.", "stream_projection");
      scheduleStreamLiveWatchdog("stream answer received without live track");
      return;
    }
    appendLog(`stream live watchdog fired: ${reason}`);
    setConnectionState("reconnecting", "warn");
    setDrawerStatus("Stream route delivered; retrying live adapter.");
    for (const sourceId of cameraTiles.keys()) {
      setTileState(sourceId, "connecting", "Retrying live preview adapter...");
    }
    void reportServiceStatus("reconnecting", "Stream route delivered but no live media track attached; retrying.", "stream_adapter");
    scheduleAutomaticReconnect("stream adapter did not become live");
  }, RUNTIME_STREAM_LIVE_WATCHDOG_MS);
}

function scheduleMissingSourceReconnect(sourceIds: string[], reason: string): void {
  const missing = normalizeSourceIds(sourceIds);
  if (!runtimeServiceContext || missing.length === 0 || scheduledReconnectTimer || reconnectInFlight || reconnectScheduleInFlight) return;
  reconnectAttemptCount += 1;
  const attempt = reconnectAttemptCount;
  const fallbackDelayMs = reconnectDelayMs(
    reconnectAttemptCount,
    RUNTIME_STREAM_RECONNECT_BASE_MS,
    RUNTIME_STREAM_RECONNECT_MAX_MS,
  );
  reconnectScheduleInFlight = true;
  void (async () => {
    try {
      const posture = await runtimeStreamRecoveryPosture(reason, attempt, fallbackDelayMs);
      if (!runtimeServiceContext || scheduledReconnectTimer || reconnectInFlight) return;
      const delayMs = Math.max(0, Number(posture.delayMs || fallbackDelayMs) || fallbackDelayMs);
      appendLog(`scheduling missing stream retry in ${delayMs}ms (${reason})`);
      setConnectionState("partial", "warn");
      setDrawerStatus(`Retrying missing live preview stream${missing.length === 1 ? "" : "s"}.`);
      for (const sourceId of missing) {
        setTileState(sourceId, "connecting", "Retrying missing live preview stream.");
      }
      void reportServiceStatus("reconnecting", `Retrying missing live preview stream (${reason}).`, "stream_projection");
      scheduledReconnectTimer = window.setTimeout(() => {
        scheduledReconnectTimer = 0;
        reconnectInFlight = (async () => {
          let retryReason = "";
          try {
            await publishRuntimeStreamIntent(missing);
            scheduleStreamLiveWatchdog("missing stream retry queued");
          } catch (error) {
            retryReason = String((error as Error)?.message || error || "missing stream retry failed");
            appendLog(`missing stream retry failed: ${retryReason}`);
            for (const sourceId of missing) {
              setTileState(sourceId, "unavailable", retryReason);
            }
          } finally {
            reconnectInFlight = null;
            if (retryReason) scheduleMissingSourceReconnect(missing, retryReason);
          }
        })();
      }, delayMs);
    } finally {
      reconnectScheduleInFlight = false;
    }
  })();
}

function scheduleAutomaticReconnect(reason: string): void {
  if (!runtimeServiceContext || scheduledReconnectTimer || reconnectInFlight || reconnectScheduleInFlight) return;
  reconnectAttemptCount += 1;
  const attempt = reconnectAttemptCount;
  const fallbackDelayMs = reconnectDelayMs(
    reconnectAttemptCount,
    RUNTIME_STREAM_RECONNECT_BASE_MS,
    RUNTIME_STREAM_RECONNECT_MAX_MS,
  );
  reconnectScheduleInFlight = true;
  void (async () => {
    try {
      const posture = await runtimeStreamRecoveryPosture(reason, attempt, fallbackDelayMs);
      if (!runtimeServiceContext || scheduledReconnectTimer || reconnectInFlight) return;
      const delayMs = Math.max(0, Number(posture.delayMs || fallbackDelayMs) || fallbackDelayMs);
      appendLog(`scheduling automatic reconnect in ${delayMs}ms (${reason})`);
      setConnectionState("reconnecting", "warn");
      setDrawerStatus("Live preview interrupted. Reconnecting automatically.");
      for (const sourceId of cameraTiles.keys()) {
        setTileState(sourceId, "connecting", "Reconnecting live preview...");
      }
      void reportServiceStatus("reconnecting", `Live preview interrupted; reconnecting automatically (${reason}).`, "stream_projection");
      scheduledReconnectTimer = window.setTimeout(() => {
        scheduledReconnectTimer = 0;
        reconnectInFlight = (async () => {
          let retryReason = "";
          try {
            await reconnect({ force: true });
          } catch (error) {
            const detail = String((error as Error)?.message || error || "automatic reconnect failed");
            appendLog(`automatic reconnect failed: ${detail}`);
            setConnectionState("reconnect failed", "bad");
            setDrawerStatus(detail);
            markAllTiles("unavailable", "Live preview unavailable.");
            void reportServiceStatus("degraded", detail, "stream_projection");
            retryReason = detail;
          } finally {
            reconnectInFlight = null;
            if (retryReason) scheduleAutomaticReconnect(retryReason);
          }
        })();
      }, delayMs);
    } finally {
      reconnectScheduleInFlight = false;
    }
  })();
}

function scheduleRuntimeAuthorityReconnect(reason: string): void {
  if (!runtimeServiceContext || scheduledReconnectTimer || reconnectInFlight) return;
  reconnectAttemptCount += 1;
  const delayMs = reconnectDelayMs(
    reconnectAttemptCount,
    RUNTIME_AUTHORITY_RECONNECT_BASE_MS,
    RUNTIME_AUTHORITY_RECONNECT_MAX_MS,
  );
  appendLog(`scheduling runtime authority reconnect in ${delayMs}ms (${reason})`);
  setConnectionState("waiting authority", "warn");
  setDrawerStatus("Waiting for runtime authority.");
  scheduledReconnectTimer = window.setTimeout(() => {
    scheduledReconnectTimer = 0;
    reconnectInFlight = (async () => {
      let retryReason = "";
      try {
        await reconnect();
      } catch (error) {
        const detail = String((error as Error)?.message || error || "runtime authority reconnect failed");
        appendLog(`runtime authority reconnect failed: ${detail}`);
        markRuntimeAuthorityWaiting({ state: "waitingAuthority", ready: false, reason: detail });
        retryReason = detail;
      } finally {
        reconnectInFlight = null;
        if (retryReason) scheduleRuntimeAuthorityReconnect(retryReason);
      }
    })();
  }, delayMs);
}

async function reconnect(options: SwarmEdgeAttachOptions = {}): Promise<void> {
  cancelScheduledReconnect();
  if (!runtimeServiceContext) {
    runtimeServiceContext = await loadRuntimeServiceContext();
  }
  refreshSummary(runtimeServiceContext);
  await ensureRuntimeSwarmEdgeForContext(runtimeServiceContext, options).catch((error) => {
    appendLog(`runtime swarm edge attach unavailable: ${String((error as Error)?.message || error)}`);
  });
  await connectLiveGrid(runtimeServiceContext);
}

function cancelDirectEntryRuntimeRepair(): void {
  if (directEntryRepairTimer) {
    window.clearTimeout(directEntryRepairTimer);
    directEntryRepairTimer = 0;
  }
}

async function activateRuntimeServiceContext(context: RuntimeServiceContext, source: string): Promise<void> {
  cancelDirectEntryRuntimeRepair();
  directEntryRepairAttemptCount = 0;
  runtimeServiceContext = await persistRuntimeServiceContext(context);
  appendLog(`runtime context loaded for service ${pkLabel(runtimeServiceContext.servicePk)}${source ? ` (${source})` : ""}`);
  if (runtimeServiceContext.legacyPathFallback) {
    appendLog(`legacyPathFallback ${runtimeServiceContext.legacyPathFallback.reason}`);
    void reportServiceStatus("degraded", runtimeServiceContext.legacyPathFallback.reason, "legacyPathFallback");
  }
  markStartupStage("nvr.runtime-context.loaded");
  refreshSummary(runtimeServiceContext);
  applyNvrRuntimeProjections();
  renderRuntimeProjectionTiles(runtimeServiceContext);
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

async function repairDirectEntryRuntimeContext(): Promise<boolean> {
  const snapshot = await currentRuntimeSnapshot();
  const record = directEntryNvrServiceRecord(snapshot);
  if (!record) return false;
  const servicePk = applianceDevicePk(record);
  const gatewayPk = applianceGatewayPk(record);
  if (!servicePk || !gatewayPk) return false;
  await activateRuntimeServiceContext(contextFromRuntimeRecord(record, snapshot), "runtime repair");
  return true;
}

function scheduleDirectEntryRuntimeRepair(reason: string): void {
  if (runtimeServiceContext || directEntryRepairTimer || directEntryRepairInFlight) return;
  if (directEntryRepairAttemptCount >= DIRECT_ENTRY_REPAIR_MAX_ATTEMPTS) {
    setConnectionState("idle", "neutral");
    setDrawerStatus("No Security Cameras service is currently available from this account runtime.");
    setGridEmpty(
      "No Security Cameras Service",
      "Connect an account with access to an NVR service, then this app will open it directly.",
    );
    return;
  }
  directEntryRepairAttemptCount += 1;
  const delayMs = Math.min(
    DIRECT_ENTRY_REPAIR_MAX_DELAY_MS,
    DIRECT_ENTRY_REPAIR_DELAY_MS + ((directEntryRepairAttemptCount - 1) * 500),
  );
  appendLog(`scheduling runtime service repair in ${delayMs}ms (${reason})`);
  setConnectionState("loading", "neutral");
  setDrawerStatus("Waiting for Security Cameras service from the account runtime.");
  directEntryRepairTimer = window.setTimeout(() => {
    directEntryRepairTimer = 0;
    directEntryRepairInFlight = (async () => {
      let activated = false;
      try {
        activated = await repairDirectEntryRuntimeContext();
      } catch (error) {
        appendLog(`runtime service repair failed: ${String((error as Error)?.message || error)}`);
      } finally {
        directEntryRepairInFlight = null;
        if (!activated && !runtimeServiceContext) {
          scheduleDirectEntryRuntimeRepair("Security Cameras service still absent");
        }
      }
    })();
  }, delayMs);
}

function handleNonFatalLiveFailure(error: unknown): void {
  const runtimeFailure = asRuntimeContextError(error, "stream_projection");
  const retryable = !isRuntimeMediaTransportProfileFailure(runtimeFailure);
  console.error(runtimeFailure);
  closePeerConnection();
  app.dataset.runtimeStage = runtimeFailure.stage;
  setConnectionState("unavailable", "bad");
  setDrawerStatus(runtimeFailure.detail);
  if (cameraTiles.size > 0) {
    markAllTiles("unavailable", retryable ? "Live preview unavailable." : runtimeFailure.detail);
  } else {
    setGridEmpty("Live Preview Unavailable", runtimeFailure.detail);
  }
  addNotification("bad", "Live preview unavailable", runtimeFailure.detail, "app");
  appendLog(`degraded [${runtimeFailure.stage}] ${runtimeFailure.detail}`);
  void reportServiceStatus(retryable ? "degraded" : "blocked", runtimeFailure.detail, runtimeFailure.stage);
  if (retryable) scheduleAutomaticReconnect(runtimeFailure.detail);
}

function publishRuntimeStreamSessionClose(session: RuntimeStreamSession, reasonCode: string): void {
  if (!runtimeServiceContext || !runtimePort) return;
  void publishRuntimeStreamControl("close", {
    sessionId: session.sessionId,
    sourceId: session.sourceId,
    reasonCode,
    adapterLifecycle: adapterReleaseLifecycle(session, reasonCode),
  }).catch((error) => {
    appendLog(`queued stream close failed: ${String((error as Error)?.message || error)}`);
  });
}

function closePeerConnection(reasonCode = "peerConnectionClosed", publishClose = true): void {
  cancelScheduledReconnect();
  cancelStreamLiveWatchdog();
  for (const session of runtimeStreamSessionsBySessionId.values()) {
    try {
      if (publishClose) publishRuntimeStreamSessionClose(session, reasonCode);
      reportMediaFulfillmentEvidence(mediaFulfillmentReleaseEvidence(session, reasonCode));
      closeBrowserStreamSession(session);
    } catch {}
  }
  runtimeStreamSessionsByFrameId.clear();
  runtimeStreamSessionsBySessionId.clear();
  runtimeStreamSessionsByCorrelationKey.clear();
  unboundRuntimeStreamFrameKeys.clear();
  for (const tile of cameraTiles.values()) {
    try {
      tile.video.srcObject = null;
    } catch {}
  }
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
  void reportServiceStatus("idle", "Constitute NVR window closed.", "runtime_intent");
  closePeerConnection("page_unload");
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
  app.dataset.runtimeStage = "runtime_context";
  appendLog("bootstrapping managed NVR app surface");
  markStartupStage("nvr.boot.start");
  void reportServiceStatus("loading", "Bootstrapping managed NVR app surface.", "runtime_context");

  await activateRuntimeServiceContext(await loadRuntimeServiceContext(), "bootstrap");
}

void bootstrap().catch((error) => {
  const runtimeFailure = asRuntimeContextError(error, "runtime_context");
  closePeerConnection();
  dismissBootSplash();
  app.dataset.runtimeStage = runtimeFailure.stage;
  const message = runtimeFailure.detail;
  if (isDirectEntryIdleRuntimeFailure(runtimeFailure)) {
    console.warn(runtimeFailure);
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
      : "Waiting for Security Cameras service from the account runtime.");
    setGridEmpty(accountRequired ? title : "Finding Security Cameras Service", body);
    addNotification("warn", "Security Cameras unavailable", message, "app");
    appendLog(`idle [${runtimeFailure.stage}] ${message}`);
    void reportServiceStatus("idle", message, runtimeFailure.stage);
    if (!accountRequired) scheduleDirectEntryRuntimeRepair(message);
    return;
  }
  console.error(runtimeFailure);
  setConnectionState("error", "bad");
  setDrawerStatus(runtimeFailure.detail);
  setGridEmpty("Runtime Context Failed", `${runtimeFailure.stage}: ${message}`);
  addNotification("bad", "Runtime context failed", message, "app");
  appendLog(`fatal [${runtimeFailure.stage}] ${message}`);
  void reportServiceStatus("error", message, runtimeFailure.stage);
});
