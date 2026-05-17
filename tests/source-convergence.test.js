import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(here, "../..");

function source(path) {
  return readFileSync(resolve(workspaceRoot, path), "utf8");
}

test("nvr ui activates runtime stream intents without owning browser transport setup", () => {
  const main = source("constitute-nvr-ui/src/main.ts");
  const nvrAdapter = source("constitute-nvr-ui/src/browser-stream-adapter.ts");
  const adapter = source("constitute-ui/src/media-webrtc-adapter.ts");
  const streamSession = source("constitute-ui/src/runtime-stream-session.js");
  const runtimeContract = source("constitute-account/runtime-contract.js");
  const retiredSignal = ["SERVICE", "SIGNAL", "REQUEST"].join("_");
  const retiredSignalRpc = ["gateway.service", "Signal.request"].join("");
  const retiredCapability = ["service", "Capability"].join("");
  const retiredContext = ["service", "Access"].join("");
  const retiredRoute = ["service", "-access"].join("");

  assert.match(main, /RUNTIME_STREAM_OPEN/);
  assert.match(main, /RUNTIME_STREAM_RECOVERY_REQUEST/);
  assert.match(runtimeContract, /RUNTIME_STREAM_OPEN = "runtime\.stream\.open"/);
  assert.match(runtimeContract, /RUNTIME_STREAM_RECOVERY_REQUEST = "runtime\.stream\.recovery\.request"/);
  assert.match(main, /publishRuntimeStreamIntent/);
  assert.match(main, /preparedStreamStatus/);
  assert.match(main, /runtime-stream-session\.js/);
  assert.match(main, /streamSessionLifecycleRecordFromCarrier/);
  assert.match(main, /STREAM_SESSION_LIFECYCLE_PHASE/);
  assert.doesNotMatch(main, /recordKind\.endsWith\("\.(admission|reject|answer|candidate|health)"\)/);
  assert.doesNotMatch(main, /const SWARM = Object\.freeze/);
  assert.doesNotMatch(main, /BODY_ENCODING: Object\.freeze/);
  assert.doesNotMatch(main, /FRAME_KIND: Object\.freeze/);
  assert.doesNotMatch(main, /CORE_CAPABILITY: Object\.freeze/);
  assert.doesNotMatch(main, /function collectRuntimeIntentResultKeys/);
  assert.doesNotMatch(main, /function collectRuntimeStreamFrameKeys/);
  assert.doesNotMatch(main, /function collectRuntimeObservationKeys/);
  assert.doesNotMatch(main, /function runtimeIntentPendingRoute/);
  assert.match(streamSession, /export function collectRuntimeIntentResultKeys/);
  assert.match(streamSession, /export function collectRuntimeStreamFrameKeys/);
  assert.match(streamSession, /export function runtimeRouteObservationPosture/);
  assert.match(streamSession, /export function applyRuntimeRouteObservationToStreamSession/);
  assert.match(streamSession, /export function applyRuntimeActivationPostureToStreamSession/);
  assert.match(streamSession, /export function runtimeStreamSessionPosture/);
  assert.doesNotMatch(main, /new RTCPeerConnection/);
  assert.doesNotMatch(main, /pc\.createOffer/);
  assert.doesNotMatch(main, /pc\.onicecandidate/);
  assert.doesNotMatch(nvrAdapter, /new RTCPeerConnection/);
  assert.match(nvrAdapter, /constitute-ui\/src\/media-webrtc-adapter/);
  assert.match(adapter, /new RTCPeerConnection/);
  assert.match(adapter, /createBrowserStreamOffer/);
  assert.match(adapter, /adapter:media-webrtc:browser/);
  assert.match(adapter, /DEFAULT_BROWSER_STREAM_ICE_SERVERS/);
  assert.match(adapter, /DEFAULT_BROWSER_STREAM_ICE_SERVERS: RTCIceServer\[\] = \[\]/);
  assert.match(adapter, /candidate\.candidate/);
  assert.match(adapter, /onStateChange/);
  assert.match(adapter, /mediaFulfillmentEvidenceFromAdapterState/);
  assert.match(adapter, /mediaFulfillmentEvidenceFromRender/);
  assert.match(adapter, /collectBrowserMediaFulfillmentEvidence/);
  assert.match(adapter, /bindBrowserMediaStream/);
  assert.match(nvrAdapter, /bindBrowserMediaStream/);
  assert.match(main, /bindBrowserMediaStream\(tile\.video, mediaStream\)/);
  assert.match(main, /reconnect\(\{ force: true \}\)/);
  assert.match(adapter, /inboundRtpStalled/);
  assert.match(adapter, /export type RuntimeMediaTransportProfile/);
  assert.match(adapter, /export function runtimeMediaIceServers/);
  assert.match(adapter, /export function runtimeMediaIceServerUrls/);
  assert.match(adapter, /export function runtimeMediaTransportContract/);
  assert.match(adapter, /export function runtimeMediaTransportBlockedDetail/);
  assert.match(adapter, /export function isRuntimeMediaTransportProfileFailure/);
  assert.match(main, /moduleRef: nvrSurfaceModules\.platformAdapter\.moduleRef/);
  assert.doesNotMatch(main, /function runtimeMediaIceServers/);
  assert.doesNotMatch(main, /function runtimeMediaIceServerUrls/);
  assert.doesNotMatch(main, /function runtimeMediaTransportContract/);
  assert.doesNotMatch(main, /function runtimeMediaTransportBlockedDetail/);
  assert.doesNotMatch(main, /function isRuntimeMediaTransportContractFailure/);
  assert.match(main, /handleRuntimeStreamAdapterState/);
  assert.match(main, /startRuntimeStreamStatsMonitor/);
  assert.match(main, /handleRuntimeStreamStaleMedia/);
  assert.match(main, /runtimeStreamRecoveryPosture/);
  assert.match(main, /resetRuntimeStreamRecovery/);
  assert.match(main, /runtimeStreamRecoveryParentIntentId/);
  assert.doesNotMatch(main, /tile\.video\.srcObject = stream/);
  assert.match(main, /applyRuntimeRouteObservationToStreamSession/);
  assert.match(streamSession, /memberWritten/);
  assert.match(streamSession, /memberRead/);
  assert.match(streamSession, /routeAccepted/);
  assert.doesNotMatch(main, /state === "accepted" \? "serviceAccepted" : state/);
  assert.match(main, /applyRuntimeActivationPostureFromSnapshot/);
  assert.match(main, /activationResolutions/);
  assert.match(main, /serviceAdmissionTimedOut/);
  assert.match(main, /Stream route delivered, but the service did not admit the request/);
  assert.match(main, /RUNTIME_MEDIA_FULFILLMENT_EVIDENCE_PUT/);
  assert.match(main, /reportMediaFulfillmentEvidence/);
  assert.match(main, /"stream_adapter"/);
  assert.match(main, /RUNTIME_MEDIA_TRANSPORT_PROFILE_GET/);
  assert.match(main, /runtimeMediaTransportProfile/);
  assert.doesNotMatch(main, /stun\.l\.google/);
  assert.match(main, /iceServers:\s*\{/);
  assert.equal(main.includes(retiredSignal), false);
  assert.equal(main.includes(retiredSignalRpc), false);
  assert.equal(main.includes(retiredCapability), false);
  assert.equal(main.includes(retiredContext), false);
  assert.equal(main.includes(retiredRoute), false);
  const retiredOwnedGatewayCopy = ["Negotiating live preview through the owned ", "gateway"].join("");
  const retiredAnswerCopy = ["Waiting for answer from the ", "gateway"].join("");
  assert.equal(main.includes(retiredOwnedGatewayCopy), false);
  assert.equal(main.includes(retiredAnswerCopy), false);
});

test("nvr ui attaches to the account-owned runtime worker contract", () => {
  const main = source("constitute-nvr-ui/src/main.ts");

  assert.match(main, /createRuntimeSurfaceClient/);
  assert.match(main, /createSurfaceModuleRegistry/);
  assert.match(main, /surfaceModuleRegistryPosture/);
  assert.match(main, /from "\.\.\/\.\.\/constitute-ui\/src\/runtime-surface-client\.js"/);
  assert.match(main, /from "\.\.\/\.\.\/constitute-ui\/src\/surface-module-registry\.js"/);
  assert.match(main, /from "\.\/surface-app-contract\.js"/);
  assert.match(main, /nvrSurfaceModules/);
  assert.match(main, /nvrSurfaceModuleRegistry/);
  assert.match(main, /requireNvrSurfaceModuleClaim/);
  assert.match(main, /activeRuntimeClientModuleRef/);
  assert.match(main, /attachContext: nvrRuntimeAttachContext/);
  assert.match(main, /from "\.\.\/\.\.\/constitute-account\/runtime-contract\.js"/);
  assert.match(main, /PLATFORM_RUNTIME_BUILD_ID as RUNTIME_WORKER_BUILD_ID/);
  assert.match(main, /RUNTIME_STREAM_OPEN/);
  assert.match(main, /RUNTIME_STREAM_CONTROL/);
  assert.match(main, /RUNTIME_STREAM_CLOSE/);
  assert.match(main, /RUNTIME_AUTHORITY_POSTURE_GET/);
  assert.doesNotMatch(main, /const RUNTIME_STREAM_OPEN =/);
  assert.doesNotMatch(main, /const RUNTIME_AUTHORITY_POSTURE_GET =/);
  assert.match(main, /runtimeSharedWorkerName/);
  assert.match(main, /accountRuntimeWorkerScriptUrl\(window\.location\.origin\)/);
  assert.match(main, /runtimeAttachDebugInfo\(window\.location\.origin\)/);
  assert.match(main, /const RUNTIME_ATTACH_TIMEOUT_MS = 12_000/);
  assert.match(main, /let runtimeClient: ReturnType<typeof createRuntimeSurfaceClient> \| null = null/);
  assert.match(main, /runtimeClient\.waitUntilAttached\(RUNTIME_ATTACH_TIMEOUT_MS\)/);
  assert.match(main, /runtimeClient\.call\(type, payload, timeoutMs\)/);
  assert.doesNotMatch(main, /pendingRuntimeResponses/);
  assert.doesNotMatch(main, /runtimeReadyPromise/);
  assert.doesNotMatch(main, /RUNTIME_WORKER_VERSION = Object\.freeze/);
  assert.doesNotMatch(main, /constitute-account-runtime-\$\{RUNTIME_WORKER_BUILD_ID\}/);
});

test("nvr ui declares a surface app contract", async () => {
  const { nvrSurfaceApp, nvrSurfaceAttachContext } = await import("../src/surface-app-contract.js");
  assert.equal(nvrSurfaceApp.posture.state, "ready");
  assert.equal(nvrSurfaceApp.hasRole("runtimeClient"), true);
  assert.equal(nvrSurfaceApp.hasRole("projectionModel"), true);
  assert.equal(nvrSurfaceApp.hasRole("platformAdapter"), true);
  assert.equal(nvrSurfaceApp.hasRole("serviceSurfaceAdapter"), true);
  assert.equal(nvrSurfaceApp.hasRole("productView"), true);
  assert.equal(nvrSurfaceAttachContext.kind, "surface.app.attachContext");
  assert.equal(nvrSurfaceAttachContext.appId, "constitute-nvr-ui");
});

test("nvr service administration uses a service-surface adapter boundary", () => {
  const main = source("constitute-nvr-ui/src/main.ts");
  const adminAdapter = source("constitute-nvr-ui/src/nvr-admin-adapter.ts");

  assert.match(main, /from "\.\/nvr-admin-adapter"/);
  assert.match(main, /createNvrAdminAdapter/);
  assert.match(main, /nvrAdminAdapter\.request\("list_camera_device_inventory"/);
  assert.match(main, /nvrAdminAdapter\.request\("apply_camera_device_config"/);
  assert.match(main, /nvrAdminAdapter\.request\("mount_camera_device"/);
  assert.match(main, /nvrAdminAdapter\.request\("probe_camera_device"/);
  assert.doesNotMatch(main, /function requestNvrAdminAdapterAction/);
  assert.doesNotMatch(main, /function normalizeAdminError/);
  assert.doesNotMatch(main, /action === "apply_camera_device_config"\s+\?\s+CAMERA_APPLY_REQUEST_TIMEOUT_MS/);
  assert.match(adminAdapter, /export function createNvrAdminAdapter/);
  assert.match(adminAdapter, /export function normalizeNvrAdminAdapterError/);
  assert.match(adminAdapter, /export function nvrAdminActionTimeoutMs/);
  assert.match(adminAdapter, /moduleRef: String\(options\.moduleRef \|\| ""\)/);
  assert.match(main, /moduleRef: nvrSurfaceModules\.serviceSurfaceAdapter\.moduleRef/);
  assert.match(adminAdapter, /action === "apply_camera_device_config"/);
  assert.match(adminAdapter, /Gateway update required before camera administration is available/);
  assert.match(adminAdapter, /Owner runtime access is required before camera administration is available/);
});

test("nvr projection model owns camera display normalization", () => {
  const main = source("constitute-nvr-ui/src/main.ts");
  const projectionModel = source("constitute-nvr-ui/src/nvr-projection-model.ts");

  assert.match(main, /from "\.\/nvr-projection-model"/);
  assert.match(projectionModel, /export const NVR_AUTO_PREVIEW_SOURCE_ID/);
  assert.match(projectionModel, /export function normalizeSourceIds/);
  assert.match(projectionModel, /export function humanizeSourceId/);
  assert.match(projectionModel, /export function normalizeRuntimeCameraEntries/);
  assert.match(projectionModel, /export function nvrDisplayFromRecord/);
  assert.match(projectionModel, /export function cameraCountForContext/);
  assert.doesNotMatch(main, /function nvrDisplayFromRecord/);
  assert.doesNotMatch(main, /function normalizeRuntimeCameraEntries/);
  assert.doesNotMatch(main, /function normalizeSourceIds/);
  assert.doesNotMatch(main, /function cameraFactRecords/);
  assert.doesNotMatch(main, /function cameraCountForContext/);
});

test("nvr ui honors query debug flags for runtime attach diagnostics", () => {
  const main = source("constitute-nvr-ui/src/main.ts");

  assert.match(main, /new URLSearchParams\(window\.location\.search \|\| ""\)/);
  assert.match(main, /query\.get\("debug"\)/);
  assert.match(main, /runtimeAttachDebugInfo\(window\.location\.origin\)/);
});

test("gateway ui opens first-party apps from runtime directories without minted app contexts", () => {
  const main = source("constitute-gateway-ui/src/main.js");
  const retiredCapability = ["service", "Capability"].join("");
  const retiredContext = ["service", "Access"].join("");

  assert.match(main, /buildManagedSurfaceUrl\("constitute-nvr-ui"/);
  assert.match(main, /buildManagedSurfaceUrl\("constitute-logging-ui"/);
  assert.doesNotMatch(main, /SERVICE_ACCESS_REQUEST/);
  assert.doesNotMatch(main, /SERVICE_ACCESS_CONTEXT_PUT/);
  const retiredGatewayAccessRequest = new RegExp(
    ['gateway', ['service', 'Access'].join(''), 'request'].join('\\.')
  );
  assert.doesNotMatch(main, retiredGatewayAccessRequest);
  assert.equal(main.includes(retiredCapability), false);
  assert.equal(main.includes(retiredContext), false);
});

test("logging ui and shared ui remain projection/prepared-state consumers", () => {
  const logging = source("constitute-logging-ui/src/main.js");
  const shared = source("constitute-ui/src/index.js");
  const retiredCapability = ["service", "Capability"].join("");

  assert.match(logging, /projectionForNode/);
  assert.match(logging, /projection\.observer\.update/);
  assert.equal(logging.includes(retiredCapability), false);
  assert.match(shared, /export function renderStreamStatus/);
  assert.match(shared, /export function renderProjectionSyncStatus/);
  assert.match(shared, /export function renderSwarmEdgeStatus/);
  assert.match(shared, /export function createKeyValueGrid/);
});

test("nvr ui uses shared summary row component instead of a local kv dialect", () => {
  const nvr = source("constitute-nvr-ui/src/main.ts");
  const styles = source("constitute-nvr-ui/src/styles.css");

  assert.match(nvr, /createKeyValueGrid/);
  assert.match(nvr, /renderKeyValueGridMarkup/);
  assert.doesNotMatch(nvr, /function renderKvRow/);
  assert.doesNotMatch(nvr, /class="kv"/);
  assert.doesNotMatch(styles, /\.kv\b/);
});

test("first-party account centers use shared shell state and account-only actions", () => {
  const account = source("constitute-account/app.js");
  const gateway = source("constitute-gateway-ui/src/main.js");
  const gatewayRuntimeModel = source("constitute-gateway-ui/src/runtime-model.js");
  const logging = source("constitute-logging-ui/src/main.js");
  const nvr = source("constitute-nvr-ui/src/main.ts");
  const all = [account, gateway, logging, nvr].join("\n");

  assert.match(account, /deriveRuntimeShellState/);
  assert.match(gateway, /deriveRuntimeShellState/);
  assert.match(logging, /deriveRuntimeShellState/);
  assert.match(nvr, /deriveRuntimeShellState/);
  assert.match(account, /runtimeResourceStatus/);
  assert.match(gatewayRuntimeModel, /Resource posture/);
  assert.match(logging, /shellState\.resource\?\.state/);
  assert.match(nvr, /Runtime Posture/);
  assert.doesNotMatch(all, /Copy Identity ID/);
  assert.doesNotMatch(all, /account\.copy_identity/);

  const gatewayAccountCenter = gateway.slice(
    gateway.indexOf("function renderAccountCenter()"),
    gateway.indexOf("function escapeHtml", gateway.indexOf("function renderAccountCenter()")),
  );
  assert.doesNotMatch(gatewayAccountCenter, /Open Gateways/);
  assert.doesNotMatch(gatewayAccountCenter, /Open Hosted Services/);
  assert.match(gateway, /\{ id: "gateways", label: "Gateways"/);
  assert.match(gateway, /\{ id: "services", label: "Hosted Services"/);
});

test("nvr ui keeps live media state distinct from route delivery and inventory gaps", () => {
  const nvr = source("constitute-nvr-ui/src/main.ts");

  assert.match(nvr, /if \(hasLiveTiles\(\)\) \{\s+setConnectionState\("live", "good"\);/s);
  assert.match(nvr, /const markRenderLive = \(evidence = reportRenderReadiness\(session, tile\.video\)\) => \{[\s\S]*?setTileState\(sourceId, "live"/);
  assert.match(nvr, /evidence\.state !== SWARM\.MEDIA_FULFILLMENT_STATE\.USABLE/);
  assert.match(nvr, /tile\.video\.addEventListener\("playing", markRenderLive, \{ once: true \}\)/);
  assert.match(nvr, /track\.readyState === "live"[\s\S]*?markPendingRender\(\);[\s\S]*?window\.setTimeout\(markRenderLive, 1_000\)/);
  assert.doesNotMatch(nvr, /track\.readyState === "live"[\s\S]*?markLive\(\)/);
  assert.match(nvr, /scheduleStreamLiveWatchdog\("runtime stream intent queued without live track"\)/);
  assert.match(nvr, /function inventoryProjectionMissingWithLiveSources\(/);
  assert.match(nvr, /Live source present; camera inventory projection is missing\./);
  assert.doesNotMatch(nvr, /Stream route delivered\."\);\s+return;\s+\}\s+if \(hasLiveTiles\(\)\)/s);
});
