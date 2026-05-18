import {
  createServiceSurfaceAdapter,
  normalizeServiceSurfaceAdapterError,
  serviceSurfaceActionTimeoutMs,
  type ServiceSurfaceAdapterPosture,
} from "constitute-ui/service-surface-adapter";

export type NvrAdminAdapterPayload = Record<string, unknown>;
export type NvrAdminAdapterResult = Record<string, unknown>;

export type NvrAdminAdapterOptions = {
  moduleRef?: string;
  bindingPosture?: Record<string, unknown>;
  defaultTimeoutMs: number;
  applyCameraDeviceConfigTimeoutMs: number;
  publishRuntimeServiceIntent: (
    action: string,
    payload: NvrAdminAdapterPayload,
    timeoutMs: number,
  ) => Promise<unknown>;
  projectionFallback: (
    action: string,
    payload: NvrAdminAdapterPayload,
    posture?: ServiceSurfaceAdapterPosture,
  ) => NvrAdminAdapterResult;
};

export type NvrAdminAdapter = {
  moduleRef: string;
  timeoutMs(action: string): number;
  request(action: string, payload?: NvrAdminAdapterPayload): Promise<NvrAdminAdapterResult>;
};

export function normalizeNvrAdminAdapterError(error: unknown): string {
  const message = normalizeServiceSurfaceAdapterError(error, "Camera administration is unavailable.");
  const lowered = message.toLowerCase();
  if (lowered.includes("unsupported_signal") || lowered.includes("only offer and session_close are supported")) {
    return "Gateway update required before camera administration is available from this NVR surface.";
  }
  if (lowered.includes("admin_requires_owner")) {
    return "Owner runtime access is required before camera administration is available.";
  }
  return message || "Camera administration is unavailable.";
}

export function nvrAdminActionTimeoutMs(
  action: string,
  options: Pick<NvrAdminAdapterOptions, "defaultTimeoutMs" | "applyCameraDeviceConfigTimeoutMs">,
): number {
  return serviceSurfaceActionTimeoutMs(action, {
    defaultTimeoutMs: options.defaultTimeoutMs,
    actionTimeoutMs: {
      apply_camera_device_config: options.applyCameraDeviceConfigTimeoutMs,
    },
  });
}

export function createNvrAdminAdapter(options: NvrAdminAdapterOptions): NvrAdminAdapter {
  const adapter = createServiceSurfaceAdapter({
    moduleRef: options.moduleRef,
    bindingPosture: options.bindingPosture,
    defaultTimeoutMs: options.defaultTimeoutMs,
    actionTimeoutMs: {
      apply_camera_device_config: options.applyCameraDeviceConfigTimeoutMs,
    },
    primitiveRefs: ["stream.intent", "service.surface.admin"],
    actionRefs: [
      "list_camera_device_inventory",
      "apply_camera_device_config",
      "mount_camera_device",
      "probe_camera_device",
    ],
    projectionRefs: ["nvr.inventory", "nvr.streams"],
    publishRuntimeIntent: options.publishRuntimeServiceIntent,
    projectionFallback: options.projectionFallback,
    normalizeError: normalizeNvrAdminAdapterError,
  });

  return {
    moduleRef: adapter.moduleRef,
    timeoutMs(action: string): number {
      return adapter.timeoutMs(action);
    },
    async request(action: string, payload: NvrAdminAdapterPayload = {}): Promise<NvrAdminAdapterResult> {
      return adapter.request(action, payload);
    },
  };
}
