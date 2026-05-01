import { renderFirstPartyShell, type FirstPartyShell } from "constitute-ui";

export type NvrShell = FirstPartyShell & {
  liveViewEl: HTMLElement;
  historyViewEl: HTMLElement;
  settingsViewEl: HTMLElement;
  cameraGridEl: HTMLDivElement;
  historyHintEl: HTMLParagraphElement;
  settingsTabButtons: HTMLButtonElement[];
  nvrSettingsPanelEl: HTMLElement;
  camerasPanelEl: HTMLElement;
  cameraListEl: HTMLDivElement;
  addCameraButtonEl: HTMLButtonElement;
  cameraRefreshStatusEl: HTMLSpanElement;
};

const NVR_MAIN_HTML = `
  <section id="liveView" class="activityPanel">
    <section class="panel">
      <div class="panelHeader">
        <h2>Cameras</h2>
      </div>
      <div id="cameraGrid" class="cameraGrid">
        <article class="emptyState">
          <strong>No Cameras</strong>
          <p>Open the app directly or through the gateway once the NVR service is available.</p>
        </article>
      </div>
    </section>
  </section>

  <section id="historyView" class="activityPanel hidden">
    <section class="panel">
      <div class="panelHeader">
        <div>
          <h2>History</h2>
          <p id="historyHint" class="panelHint">Recordings and archive access will appear here when history is available.</p>
        </div>
      </div>
      <article class="historyEmptyState emptyStateTight">
        <strong>No History Yet</strong>
        <p>There are no recordings to show yet.</p>
      </article>
    </section>
  </section>

  <section id="settingsView" class="activityPanel hidden">
    <div class="settingsTabs">
      <button class="settingsTab" type="button" data-settings-tab="nvr">NVR</button>
      <button class="settingsTab" type="button" data-settings-tab="cameras">Cameras</button>
    </div>

    <section id="settingsNvrPanel" class="panel settingsPanel hidden">
      <div class="panelHeader compactHeader">
        <div>
          <h2>NVR</h2>
          <p class="panelHint">Service identity, host gateway, managed network, and current health.</p>
        </div>
      </div>
      <div id="nvrSettingsSummary" class="settingsSummary"></div>
    </section>

    <section id="settingsCamerasPanel" class="panel settingsPanel hidden">
      <div class="panelHeader">
        <div>
          <h2>Cameras</h2>
          <p class="panelHint">Mounted cameras, discovery candidates, and driver-backed settings.</p>
        </div>
        <div class="cameraHeaderActions">
          <button id="btnAddCamera" type="button" class="secondary">Refresh Cameras</button>
          <span id="cameraRefreshStatus" class="cameraRefreshStatus" hidden aria-live="polite"></span>
        </div>
      </div>
      <div id="cameraList" class="cameraList"></div>
    </section>
  </section>
`;

function byId<T extends HTMLElement>(root: ParentNode, id: string): T {
  const el = root.querySelector(`#${CSS.escape(id)}`);
  if (!el) throw new Error(`missing element #${id}`);
  return el as T;
}

export function renderShell(app: HTMLDivElement): NvrShell {
  const shell = renderFirstPartyShell(app, {
    appName: "Constitute NVR",
    navItems: [
      { id: "live", label: "Live", active: true },
      { id: "history", label: "History" },
      { id: "settings", label: "Settings" },
    ],
    mainHtml: NVR_MAIN_HTML,
  });

  return {
    ...shell,
    liveViewEl: byId<HTMLElement>(app, "liveView"),
    historyViewEl: byId<HTMLElement>(app, "historyView"),
    settingsViewEl: byId<HTMLElement>(app, "settingsView"),
    cameraGridEl: byId<HTMLDivElement>(app, "cameraGrid"),
    historyHintEl: byId<HTMLParagraphElement>(app, "historyHint"),
    settingsTabButtons: Array.from(app.querySelectorAll<HTMLButtonElement>(".settingsTab")),
    nvrSettingsPanelEl: byId<HTMLElement>(app, "settingsNvrPanel"),
    camerasPanelEl: byId<HTMLElement>(app, "settingsCamerasPanel"),
    cameraListEl: byId<HTMLDivElement>(app, "cameraList"),
    addCameraButtonEl: byId<HTMLButtonElement>(app, "btnAddCamera"),
    cameraRefreshStatusEl: byId<HTMLSpanElement>(app, "cameraRefreshStatus"),
  };
}
