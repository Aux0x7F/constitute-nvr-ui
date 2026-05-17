import { SURFACE_APP, assertSurfaceAppContract } from "../../constitute-protocol/src/index.js";
import { defineSurfaceAppContract } from "../../constitute-ui/src/surface-app-contract.js";

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
    { budgetId: "nvr-ui.preview", maxItems: 2 },
    { budgetId: "nvr-ui.stream-events", maxItems: 240 },
  ],
  updatePosture: {
    state: SURFACE_APP.UPDATE_POSTURE.STATIC,
    checkedAt: ISSUED_AT,
  },
  issuedAt: ISSUED_AT,
});

export const nvrSurfaceApp = defineSurfaceAppContract(nvrSurfaceAppContract, {
  validate: assertSurfaceAppContract,
});

export const nvrSurfaceAttachContext = nvrSurfaceApp.attachContext({
  productSurface: "constitute-nvr-ui",
});
