export type NvrAdminAdapterPayload = Record<string, unknown>;
export type NvrAdminAdapterResult = Record<string, unknown>;

export type NvrAdminAdapterOptions = {
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
  ) => NvrAdminAdapterResult;
};

export type NvrAdminAdapter = {
  timeoutMs(action: string): number;
  request(action: string, payload?: NvrAdminAdapterPayload): Promise<NvrAdminAdapterResult>;
};

export function normalizeNvrAdminAdapterError(error: unknown): string {
  const message = String((error as Error)?.message || error || "Camera administration is unavailable.").trim();
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
  return action === "apply_camera_device_config"
    ? options.applyCameraDeviceConfigTimeoutMs
    : options.defaultTimeoutMs;
}

export function createNvrAdminAdapter(options: NvrAdminAdapterOptions): NvrAdminAdapter {
  return {
    timeoutMs(action: string): number {
      return nvrAdminActionTimeoutMs(action, options);
    },
    async request(action: string, payload: NvrAdminAdapterPayload = {}): Promise<NvrAdminAdapterResult> {
      try {
        await options.publishRuntimeServiceIntent(action, payload, nvrAdminActionTimeoutMs(action, options));
        return options.projectionFallback(action, payload);
      } catch (error) {
        throw new Error(normalizeNvrAdminAdapterError(error));
      }
    },
  };
}
