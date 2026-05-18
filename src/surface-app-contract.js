import {
  SURFACE_APP,
  SWARM,
  assertSurfaceAppManifest,
  assertSurfaceAppContract,
} from "../../constitute-protocol/src/index.js";
import {
  defineSurfaceAppContract,
} from "../../constitute-ui/src/surface-app-contract.js";
import { surfaceAppSelectionReadModel } from "../../constitute-ui/src/surface-selection-read-model.js";

const ISSUED_AT = 1700000000;

export const nvrSurfaceAppContract = assertSurfaceAppContract({
  contractId: "surface-app:constitute-nvr-ui",
  schemaVersion: SURFACE_APP.SCHEMA_VERSION,
  appId: "constitute-nvr-ui",
  appRef: "app:nvr-ui",
  serviceRef: "service:nvr",
  surfaceRef: "surface:nvr-ui",
  version: "0.2.0",
  displayName: "Security Cameras",
  requiredPrimitives: [
    "runtime.attach",
    "projection.materialization",
    "stream.intent",
    "media.transport.path",
  ],
  requiredModuleRoles: [
    SURFACE_APP.MODULE_ROLE.RUNTIME_CLIENT,
    SURFACE_APP.MODULE_ROLE.PROJECTION_MODEL,
    SURFACE_APP.MODULE_ROLE.PLATFORM_ADAPTER,
    SURFACE_APP.MODULE_ROLE.SERVICE_SURFACE_ADAPTER,
    SURFACE_APP.MODULE_ROLE.PRODUCT_VIEW,
  ],
  modules: [
    {
      moduleRef: "constitute-ui/runtime-surface-client@0.1.0",
      role: SURFACE_APP.MODULE_ROLE.RUNTIME_CLIENT,
      participantSide: SURFACE_APP.PARTICIPANT_SIDE.WINDOW,
      fulfillmentMode: SURFACE_APP.FULFILLMENT_MODE.BUNDLED,
      version: "0.1.0",
      primitiveRefs: ["runtime.attach", "runtime.stream.open", "runtime.stream.control"],
      inputs: ["runtime.snapshot", "runtime.stream.answer"],
      outputs: ["runtime.intent", "media.fulfillment.evidence"],
      issuedAt: ISSUED_AT,
    },
    {
      moduleRef: "constitute-nvr-ui/nvr-projection-model@0.2.0",
      role: SURFACE_APP.MODULE_ROLE.PROJECTION_MODEL,
      participantSide: SURFACE_APP.PARTICIPANT_SIDE.WINDOW,
      fulfillmentMode: SURFACE_APP.FULFILLMENT_MODE.BUNDLED,
      version: "0.2.0",
      primitiveRefs: ["projection.materialization", "camera.inventory"],
      inputs: ["runtime.snapshot", "nvr.inventory"],
      outputs: ["camera.read-model"],
      issuedAt: ISSUED_AT,
    },
    {
      moduleRef: "constitute-ui/media-webrtc-adapter@0.1.0",
      role: SURFACE_APP.MODULE_ROLE.PLATFORM_ADAPTER,
      participantSide: SURFACE_APP.PARTICIPANT_SIDE.WINDOW,
      fulfillmentMode: SURFACE_APP.FULFILLMENT_MODE.BUNDLED,
      version: "0.1.0",
      primitiveRefs: ["media.transport.path"],
      inputs: ["runtime.stream.answer", "media.transport.profile"],
      outputs: ["media.transport.observation", "media.fulfillment.evidence"],
      issuedAt: ISSUED_AT,
    },
    {
      moduleRef: "constitute-nvr-ui/service-surface-adapter@0.2.0",
      role: SURFACE_APP.MODULE_ROLE.SERVICE_SURFACE_ADAPTER,
      participantSide: SURFACE_APP.PARTICIPANT_SIDE.WINDOW,
      fulfillmentMode: SURFACE_APP.FULFILLMENT_MODE.BUNDLED,
      version: "0.2.0",
      primitiveRefs: ["stream.intent", "service.surface.admin"],
      inputs: ["camera.selection", "camera.admin.intent"],
      outputs: ["runtime.intent"],
      issuedAt: ISSUED_AT,
    },
    {
      moduleRef: "constitute-nvr-ui/product-view@0.2.0",
      role: SURFACE_APP.MODULE_ROLE.PRODUCT_VIEW,
      participantSide: SURFACE_APP.PARTICIPANT_SIDE.WINDOW,
      fulfillmentMode: SURFACE_APP.FULFILLMENT_MODE.BUNDLED,
      version: "0.2.0",
      primitiveRefs: ["runtime.posture.render", "media.render.bind"],
      inputs: ["camera.read-model", "media.render.posture"],
      outputs: ["user.intent"],
      issuedAt: ISSUED_AT,
    },
  ],
  projectionSubscriptions: [
    { projectionId: "nvr.inventory", channelId: "nvr.inventory" },
    { projectionId: "nvr.streams", channelId: "nvr.streams" },
  ],
  materializationBudgets: [
    {
      kind: SWARM.RECORD_KIND.MATERIALIZATION_BUDGET,
      budgetId: "nvr-ui.preview",
      sourceAuthority: "runtime.media.transport.path",
      consumerRef: "nvr-ui.preview",
      payloadClass: SWARM.MATERIALIZATION_PAYLOAD_CLASS.MEDIA,
      copyRole: SWARM.MATERIALIZATION_COPY_ROLE.TRANSPORT,
      transferMode: SWARM.MATERIALIZATION_TRANSFER_MODE.NATIVE,
      privacyTier: SWARM.MATERIALIZATION_PRIVACY_TIER.UI_PROJECTION,
      state: SWARM.RESOURCE_POSTURE_STATE.WITHIN_BUDGET,
      limits: { maxItems: 2, maxActivePreviews: 2 },
      snapshotPolicy: { mode: "none" },
      deltaPolicy: { mode: "media-evidence" },
      coalescing: { key: "sourceId" },
      cardinality: { maxSourceIds: 2 },
      schema: { state: SWARM.MATERIALIZATION_SCHEMA_STATE.CURRENT, version: "nvr-ui.preview.v1" },
      issuedAt: ISSUED_AT,
    },
    {
      kind: SWARM.RECORD_KIND.MATERIALIZATION_BUDGET,
      budgetId: "nvr-ui.stream-events",
      sourceAuthority: "runtime.media.fulfillment",
      consumerRef: "nvr-ui.stream-events",
      payloadClass: SWARM.MATERIALIZATION_PAYLOAD_CLASS.EVIDENCE,
      copyRole: SWARM.MATERIALIZATION_COPY_ROLE.BUFFER,
      transferMode: SWARM.MATERIALIZATION_TRANSFER_MODE.REFERENCE_ONLY,
      privacyTier: SWARM.MATERIALIZATION_PRIVACY_TIER.SAFE_FACTS,
      state: SWARM.RESOURCE_POSTURE_STATE.WITHIN_BUDGET,
      limits: { maxItems: 240 },
      snapshotPolicy: { mode: "bounded-session-buffer" },
      deltaPolicy: { mode: "coalesced-by-session" },
      coalescing: { key: "sessionId" },
      cardinality: { maxSessionRefs: 240 },
      schema: { state: SWARM.MATERIALIZATION_SCHEMA_STATE.CURRENT, version: "nvr-ui.stream-events.v1" },
      referenceRefs: ["runtime.media.fulfillment"],
      retentionClass: "ephemeral.ui-evidence",
      issuedAt: ISSUED_AT,
    },
  ],
  updatePosture: {
    state: SURFACE_APP.UPDATE_POSTURE.STATIC,
    checkedAt: ISSUED_AT,
  },
  serviceManagerPosture: {
    managerId: "manager:manual:nvr-ui",
    subjectRef: "service:nvr",
    managerRef: "manager:manual:nvr-ui",
    state: SURFACE_APP.SERVICE_MANAGER_POSTURE.MANUAL,
    serviceRefs: ["service:nvr"],
    capabilityRefs: ["service.manage"],
    evidenceRefs: ["build:nvr-ui:local"],
    issuedAt: ISSUED_AT,
  },
  secretBoundary: {
    state: SURFACE_APP.SECRET_BOUNDARY.NOT_REQUIRED,
  },
  releasePosture: {
    state: SURFACE_APP.RELEASE_POSTURE.STATIC,
    evidenceRefs: ["build:nvr-ui:local"],
  },
  issuedAt: ISSUED_AT,
});

export const nvrSurfaceApp = defineSurfaceAppContract(nvrSurfaceAppContract, {
  validate: assertSurfaceAppContract,
});

export const nvrSurfaceAppManifest = assertSurfaceAppManifest({
  kind: "surface.app.manifest",
  manifestId: "manifest:nvr-ui",
  appId: "constitute-nvr-ui",
  state: SURFACE_APP.MANIFEST_VERSION_STATE.CURRENT,
  currentAppContractRef: "app:nvr-ui",
  currentVersion: "0.2.0",
  defaultSourceMode: SURFACE_APP.FULFILLMENT_MODE.BUNDLED,
  requiredModuleRoles: [
    SURFACE_APP.MODULE_ROLE.RUNTIME_CLIENT,
    SURFACE_APP.MODULE_ROLE.PROJECTION_MODEL,
    SURFACE_APP.MODULE_ROLE.PLATFORM_ADAPTER,
    SURFACE_APP.MODULE_ROLE.SERVICE_SURFACE_ADAPTER,
    SURFACE_APP.MODULE_ROLE.PRODUCT_VIEW,
  ],
  bundledSourceRefs: ["bundle:nvr-ui@0.2.0"],
  compatibilityWindow: {
    minVersion: "0.2.0",
    maxVersion: "0.2.x",
    protocolRef: "protocol:surface-app:v1",
  },
  versions: [
    {
      appContractRef: "app:nvr-ui",
      version: "0.2.0",
      state: SURFACE_APP.MANIFEST_VERSION_STATE.CURRENT,
      sourceMode: SURFACE_APP.FULFILLMENT_MODE.BUNDLED,
      requiredModuleRoles: [
        SURFACE_APP.MODULE_ROLE.RUNTIME_CLIENT,
        SURFACE_APP.MODULE_ROLE.PROJECTION_MODEL,
        SURFACE_APP.MODULE_ROLE.PLATFORM_ADAPTER,
        SURFACE_APP.MODULE_ROLE.SERVICE_SURFACE_ADAPTER,
        SURFACE_APP.MODULE_ROLE.PRODUCT_VIEW,
      ],
      compatibilityWindow: {
        minVersion: "0.2.0",
        maxVersion: "0.2.x",
        protocolRef: "protocol:surface-app:v1",
      },
      bundledSourceRefs: ["bundle:nvr-ui@0.2.0"],
      grantRefs: ["grant:app:nvr-ui:run"],
      runnerRequirementRefs: ["runner:req:nvr-ui"],
      serviceManagerRequirementRefs: ["service-manager:req:nvr-ui"],
      compatibilityRefs: ["protocol:surface-app:v1"],
      bootstrapContractRef: "bootstrap-contract:app:nvr-ui",
      releaseContractRef: "release:nvr-ui:local",
      issuedAt: ISSUED_AT,
    },
  ],
  appContractRefs: ["app:nvr-ui"],
  grantRefs: ["grant:app:nvr-ui:run"],
  runnerRequirementRefs: ["runner:req:nvr-ui"],
  serviceManagerRequirementRefs: ["service-manager:req:nvr-ui"],
  compatibilityRefs: ["protocol:surface-app:v1"],
  bootstrapContractRefs: ["bootstrap-contract:app:nvr-ui"],
  releaseContractRefs: ["release:nvr-ui:local"],
  authorityRefs: ["authority:nvr-ui:local"],
  evidenceRefs: ["build:nvr-ui:local"],
  issuedAt: ISSUED_AT,
});

export const nvrSurfaceSelectionReadModel = surfaceAppSelectionReadModel({
  surfaceApp: nvrSurfaceApp,
  manifest: nvrSurfaceAppManifest,
  productSurface: "constitute-nvr-ui",
  runtimeVersion: "0.2.0",
  issuedAt: ISSUED_AT,
  serviceManagerOperationOptions: {
    operation: SURFACE_APP.SERVICE_MANAGER_OPERATION.HEALTH_CHECK,
    operationId: "operation:nvr-ui:bootstrap-health",
    requestedAt: ISSUED_AT,
  },
  serviceManagerProofDigestOptions: {
    digestId: "proof-digest:nvr-ui:bootstrap",
    observedAt: ISSUED_AT,
  },
});

export const nvrSurfaceRuntimeSelectionPosture = nvrSurfaceSelectionReadModel.runtimeSelectionPosture;
export const nvrSurfaceRunnerPlan = nvrSurfaceSelectionReadModel.runnerPlan;
export const nvrServiceManagerSecretBoundary = nvrSurfaceSelectionReadModel.serviceManagerSecretBoundary;
export const nvrSurfaceBootstrapContract = nvrSurfaceSelectionReadModel.bootstrapContract;
export const nvrSurfaceBootstrapPosture = nvrSurfaceSelectionReadModel.bootstrapPosture;
export const nvrServiceManagerOperationPosture = nvrSurfaceSelectionReadModel.serviceManagerOperationPosture;
export const nvrServiceManagerProofDigest = nvrSurfaceSelectionReadModel.serviceManagerProofDigest;
export const nvrSurfaceAppInstancePosture = nvrSurfaceSelectionReadModel.appInstancePosture;

export const nvrSurfaceAttachContext = nvrSurfaceSelectionReadModel.attachContext;
