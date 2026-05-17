export const NVR_AUTO_PREVIEW_SOURCE_ID = "camera:auto-preview-source";

export type RuntimeCameraAccessDisplay = {
  sourceId?: string;
  name?: string;
  viewGranted?: boolean;
  controlGranted?: boolean;
  ptzCapable?: boolean;
};

export type GrantedScope = {
  owner?: boolean;
  viewSources?: string[];
  controlSources?: string[];
  grantIds?: string[];
};

export type RuntimeServiceDisplay = {
  serviceLabel?: string;
  serviceVersion?: string;
  service?: string;
  status?: string;
  cameraCount?: number;
  configuredSources?: number;
  sources?: string[];
  cameras?: RuntimeCameraAccessDisplay[];
  grantedScope?: GrantedScope;
};

export type RuntimeServiceContextLike = {
  display?: RuntimeServiceDisplay | null;
};

export function normalizeSourceIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    const next = String(entry || "").trim();
    if (next && !out.includes(next)) out.push(next);
  }
  return out;
}

export function humanizeSourceId(sourceId: string): string {
  const raw = String(sourceId || "").trim();
  if (raw === NVR_AUTO_PREVIEW_SOURCE_ID) return "Live Preview";
  if (!raw) return "Camera";
  if (raw.startsWith("reolink-")) return "Reolink Camera";
  return raw
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function cameraFactRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry))
    : [];
}

function cameraSourceIdFromFact(camera: Record<string, unknown>): string {
  return String(camera.sourceId || camera.source_id || camera.id || "").trim();
}

function cameraNameFromFact(camera: Record<string, unknown>, sourceId: string): string {
  const observed = camera.observed && typeof camera.observed === "object" && !Array.isArray(camera.observed)
    ? camera.observed as Record<string, unknown>
    : {};
  const desired = camera.desired && typeof camera.desired === "object" && !Array.isArray(camera.desired)
    ? camera.desired as Record<string, unknown>
    : {};
  return String(
    camera.name
    || camera.displayName
    || camera.display_name
    || camera.label
    || observed.displayName
    || desired.displayName
    || humanizeSourceId(sourceId),
  ).trim() || humanizeSourceId(sourceId);
}

function cameraPtzCapableFromFact(camera: Record<string, unknown>): boolean {
  const capabilities = camera.capabilities && typeof camera.capabilities === "object" && !Array.isArray(camera.capabilities)
    ? camera.capabilities as Record<string, unknown>
    : {};
  const observed = camera.observed && typeof camera.observed === "object" && !Array.isArray(camera.observed)
    ? camera.observed as Record<string, unknown>
    : {};
  return camera.ptzCapable === true
    || camera.ptz_capable === true
    || capabilities.ptz === true
    || observed.ptzCapable === true;
}

function displayCameraEntriesFromFacts(cameraFacts: Record<string, unknown>[]): RuntimeCameraAccessDisplay[] {
  const out: RuntimeCameraAccessDisplay[] = [];
  for (const camera of cameraFacts) {
    const sourceId = cameraSourceIdFromFact(camera);
    if (!sourceId || out.some((entry) => entry.sourceId === sourceId)) continue;
    out.push({
      sourceId,
      name: cameraNameFromFact(camera, sourceId),
      viewGranted: camera.enabled !== false,
      controlGranted: camera.controlGranted === true || camera.control_granted === true,
      ptzCapable: cameraPtzCapableFromFact(camera),
    });
  }
  return out;
}

function firstFiniteNumber(...values: unknown[]): number {
  for (const value of values) {
    const next = Number(value);
    if (Number.isFinite(next) && next > 0) return next;
  }
  return 0;
}

function appendSources(out: string[], candidate: unknown): void {
  for (const sourceId of normalizeSourceIds(candidate)) {
    if (!out.includes(sourceId)) out.push(sourceId);
  }
}

export function normalizeRuntimeCameraEntries(display: RuntimeServiceDisplay | null | undefined): RuntimeCameraAccessDisplay[] {
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
    .filter((entry): entry is RuntimeCameraAccessDisplay => !!entry);
  if (normalized.length > 0) return normalized;
  return normalizeSourceIds(display?.sources || []).map((sourceId) => ({
    sourceId,
    name: humanizeSourceId(sourceId),
    viewGranted: true,
    controlGranted: false,
    ptzCapable: false,
  }));
}

export function nvrDisplayFromRecord(record: Record<string, unknown>): RuntimeServiceDisplay {
  const facts = record.facts && typeof record.facts === "object" ? record.facts as Record<string, unknown> : {};
  const metrics = record.metrics && typeof record.metrics === "object" ? record.metrics as Record<string, unknown> : {};
  const recordHealth = record.health && typeof record.health === "object" && !Array.isArray(record.health)
    ? record.health as Record<string, unknown>
    : {};
  const factsHealth = facts.health && typeof facts.health === "object" && !Array.isArray(facts.health)
    ? facts.health as Record<string, unknown>
    : {};
  const health = { ...recordHealth, ...factsHealth };
  const cameraFacts = [
    ...cameraFactRecords(record.cameraDevices),
    ...cameraFactRecords(record.cameras),
    ...cameraFactRecords(facts.cameraDevices),
    ...cameraFactRecords(facts.cameras),
    ...cameraFactRecords(health.cameraDevices),
    ...cameraFactRecords(health.cameras),
  ];
  const cameraEntries = displayCameraEntriesFromFacts(cameraFacts);
  const sources: string[] = [];
  appendSources(sources, record.sources || record.sourceIds);
  appendSources(sources, facts.sources || facts.sourceIds);
  appendSources(sources, health.sources || health.sourceIds);
  for (const camera of cameraEntries) {
    const sourceId = String(camera.sourceId || "").trim();
    if (sourceId && !sources.includes(sourceId)) sources.push(sourceId);
  }
  const cameraCount = firstFiniteNumber(
    record.cameraCount,
    record.camera_count,
    facts.cameraCount,
    facts.configuredSources,
    health.cameraCount,
    health.configuredSources,
    metrics.camerasEnabled,
    metrics.camerasTotal,
    cameraEntries.length,
    sources.length,
  );
  return {
    serviceLabel: String(record.label || record.deviceLabel || record.displayName || "Security Cameras").trim(),
    serviceVersion: String(record.serviceVersion || record.service_version || record.version || "").trim(),
    service: "nvr",
    status: String(health.status || record.status || "ready").trim(),
    cameraCount,
    configuredSources: firstFiniteNumber(facts.configuredSources, health.configuredSources, metrics.camerasEnabled, metrics.camerasTotal, cameraCount, sources.length),
    sources,
    cameras: cameraEntries.length > 0 ? cameraEntries : sources.map((sourceId) => ({
      sourceId,
      name: humanizeSourceId(sourceId),
      viewGranted: true,
      controlGranted: false,
      ptzCapable: false,
    })),
    grantedScope: {
      owner: String(record.__scope || "owned") === "owned",
      viewSources: sources,
      controlSources: [],
    },
  };
}

export function cameraCountForContext(context: RuntimeServiceContextLike | null | undefined): number {
  const display = context?.display || {};
  return Number(
    display.cameraCount
    || normalizeRuntimeCameraEntries(display).length
    || display.configuredSources
    || normalizeSourceIds(display.sources).length
    || 0,
  );
}
