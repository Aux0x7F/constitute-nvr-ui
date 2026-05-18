import { createRuntimeSurfaceClient } from "../../constitute-ui/src/runtime-surface-client.js";
import {
  materializationBudgetLimit,
  requireSurfaceMaterializationBudget,
} from "../../constitute-ui/src/surface-app-contract.js";
import {
  createSurfaceModuleRegistry,
  requireSurfaceModuleBinding,
  surfaceAppModuleBindings,
  surfaceModuleRegistryPosture,
} from "../../constitute-ui/src/surface-module-registry.js";
import { SURFACE_APP, SWARM } from "../../constitute-protocol/src/index.js";
import { renderShell } from "./shell";
import { nvrSurfaceApp, nvrSurfaceRuntimeSelectionPosture } from "./surface-app-contract.js";
import {
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
  runtimeMediaIceServerUrls,
  runtimeMediaIceServers,
  runtimeMediaTransportBlockedDetail,
  runtimeMediaTransportContract,
  shouldReportMediaFulfillmentEvidence,
} from "./browser-stream-adapter";
import { createNvrAdminAdapter, normalizeNvrAdminAdapterError } from "./nvr-admin-adapter";
import {
  cameraCountForContext,
  humanizeSourceId,
  normalizeRuntimeCameraEntries,
  normalizeSourceIds,
  nvrDisplayFromRecord,
} from "./nvr-projection-model";

export const nvrSurfaceModuleRegistry = createSurfaceModuleRegistry([
  {
    moduleRef: "constitute-ui/runtime-surface-client@0.1.0",
    role: SURFACE_APP.MODULE_ROLE.RUNTIME_CLIENT,
    version: "0.1.0",
    implementation: { createRuntimeSurfaceClient },
  },
  {
    moduleRef: "constitute-nvr-ui/nvr-projection-model@0.2.0",
    role: SURFACE_APP.MODULE_ROLE.PROJECTION_MODEL,
    version: "0.2.0",
    implementation: {
      cameraCountForContext,
      humanizeSourceId,
      normalizeRuntimeCameraEntries,
      normalizeSourceIds,
      nvrDisplayFromRecord,
    },
  },
  {
    moduleRef: "constitute-ui/media-webrtc-adapter@0.1.0",
    role: SURFACE_APP.MODULE_ROLE.PLATFORM_ADAPTER,
    version: "0.1.0",
    implementation: {
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
      runtimeMediaIceServerUrls,
      runtimeMediaIceServers,
      runtimeMediaTransportBlockedDetail,
      runtimeMediaTransportContract,
      shouldReportMediaFulfillmentEvidence,
    },
  },
  {
    moduleRef: "constitute-nvr-ui/service-surface-adapter@0.2.0",
    role: SURFACE_APP.MODULE_ROLE.SERVICE_SURFACE_ADAPTER,
    version: "0.2.0",
    implementation: { createNvrAdminAdapter, normalizeNvrAdminAdapterError },
  },
  {
    moduleRef: "constitute-nvr-ui/product-view@0.2.0",
    role: SURFACE_APP.MODULE_ROLE.PRODUCT_VIEW,
    version: "0.2.0",
    implementation: { renderShell },
  },
]);

export function requireNvrSurfaceModuleClaim(role: string, options: { moduleRef: string; primitiveRef?: string }) {
  const posture = surfaceModuleRegistryPosture(nvrSurfaceModuleRegistry, nvrSurfaceRuntimeSelectionPosture, role, options);
  if (posture.state !== "ready" || !posture.claim) {
    throw new Error(`NVR surface module unavailable: ${posture.blockedReason} ${role} ${options.moduleRef}`.trim());
  }
  return posture.claim;
}

export function requireNvrSurfaceModuleBinding(role: string, options: { moduleRef: string; primitiveRef?: string }) {
  return requireSurfaceModuleBinding(nvrSurfaceModuleRegistry, nvrSurfaceRuntimeSelectionPosture, role, options);
}

export const nvrSurfaceModuleBindings = surfaceAppModuleBindings(
  nvrSurfaceModuleRegistry,
  nvrSurfaceRuntimeSelectionPosture,
  {
    runtimeClient: {
      role: SURFACE_APP.MODULE_ROLE.RUNTIME_CLIENT,
      options: {
        moduleRef: "constitute-ui/runtime-surface-client@0.1.0",
        primitiveRef: "runtime.attach",
      },
    },
    projectionModel: {
      role: SURFACE_APP.MODULE_ROLE.PROJECTION_MODEL,
      options: {
        moduleRef: "constitute-nvr-ui/nvr-projection-model@0.2.0",
        primitiveRef: "projection.materialization",
      },
    },
    platformAdapter: {
      role: SURFACE_APP.MODULE_ROLE.PLATFORM_ADAPTER,
      options: {
        moduleRef: "constitute-ui/media-webrtc-adapter@0.1.0",
        primitiveRef: "media.transport.path",
      },
    },
    serviceSurfaceAdapter: {
      role: SURFACE_APP.MODULE_ROLE.SERVICE_SURFACE_ADAPTER,
      options: {
        moduleRef: "constitute-nvr-ui/service-surface-adapter@0.2.0",
        primitiveRef: "stream.intent",
      },
    },
    productView: {
      role: SURFACE_APP.MODULE_ROLE.PRODUCT_VIEW,
      options: {
        moduleRef: "constitute-nvr-ui/product-view@0.2.0",
        primitiveRef: "runtime.posture.render",
      },
    },
  },
);

export const nvrSurfaceModules = Object.freeze({
  runtimeClient: nvrSurfaceModuleBindings.byKey.runtimeClient,
  projectionModel: nvrSurfaceModuleBindings.byKey.projectionModel,
  platformAdapter: nvrSurfaceModuleBindings.byKey.platformAdapter,
  serviceSurfaceAdapter: nvrSurfaceModuleBindings.byKey.serviceSurfaceAdapter,
  productView: nvrSurfaceModuleBindings.byKey.productView,
});

export const nvrRuntimeClientModule = nvrSurfaceModules.runtimeClient.implementation;
export const nvrProjectionModelModule = nvrSurfaceModules.projectionModel.implementation;
export const nvrPlatformAdapterModule = nvrSurfaceModules.platformAdapter.implementation;
export const nvrServiceSurfaceAdapterModule = nvrSurfaceModules.serviceSurfaceAdapter.implementation;
export const nvrProductViewModule = nvrSurfaceModules.productView.implementation;

export const nvrSurfaceBudgets = Object.freeze({
  preview: requireSurfaceMaterializationBudget(nvrSurfaceApp, "nvr-ui.preview", {
    payloadClass: SWARM.MATERIALIZATION_PAYLOAD_CLASS.MEDIA,
    copyRole: SWARM.MATERIALIZATION_COPY_ROLE.TRANSPORT,
    transferMode: SWARM.MATERIALIZATION_TRANSFER_MODE.NATIVE,
  }),
  streamEvents: requireSurfaceMaterializationBudget(nvrSurfaceApp, "nvr-ui.stream-events", {
    payloadClass: SWARM.MATERIALIZATION_PAYLOAD_CLASS.EVIDENCE,
    copyRole: SWARM.MATERIALIZATION_COPY_ROLE.BUFFER,
    transferMode: SWARM.MATERIALIZATION_TRANSFER_MODE.REFERENCE_ONLY,
  }),
});

export const NVR_PREVIEW_SOURCE_LIMIT = Math.max(
  1,
  materializationBudgetLimit(
    nvrSurfaceBudgets.preview,
    "maxActivePreviews",
    materializationBudgetLimit(nvrSurfaceBudgets.preview, "maxItems", 2),
  ),
);

export const NVR_STREAM_EVENT_LIMIT = Math.max(
  1,
  materializationBudgetLimit(nvrSurfaceBudgets.streamEvents, "maxItems", 240),
);
