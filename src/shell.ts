export type NvrShell = {
  btnBellEl: HTMLButtonElement;
  notifMenuEl: HTMLElement;
  btnNotifClearEl: HTMLButtonElement;
  notifListEl: HTMLDivElement;
  closeAppButtonEl: HTMLButtonElement;
  btnMenuEl: HTMLButtonElement;
  drawerEl: HTMLElement;
  drawerBackdropEl: HTMLElement;
  btnDrawerCloseEl: HTMLButtonElement;
  navButtons: HTMLButtonElement[];
  identityHandleEl: HTMLSpanElement;
  connWrapEl: HTMLSpanElement;
  connStateTextEl: HTMLSpanElement;
  connPopoverEl: HTMLDivElement;
  popConnectionEl: HTMLSpanElement;
  popRelayEl: HTMLSpanElement;
  popGatewayEl: HTMLSpanElement;
  popServicesEl: HTMLSpanElement;
  popConnectionReasonEl: HTMLDivElement;
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
  logPanelEl: HTMLElement;
  logEl: HTMLPreElement;
};

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element #${id}`);
  return el as T;
}

export function renderShell(app: HTMLDivElement): NvrShell {
  app.innerHTML = `
    <header class="topbar">
      <div class="left">
        <h1 class="appname">Constitute NVR</h1>
      </div>
      <div class="right">
        <button id="btnBell" class="iconbtn" type="button" aria-label="Notifications">
          <svg class="bellIcon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 21a2.5 2.5 0 0 0 2.4-1.8h-4.8A2.5 2.5 0 0 0 12 21Zm7-5.2H5c1.4-1.3 2.2-3.2 2.2-5.2V9.3c0-2.7 1.7-5 4.2-5.8V3a.6.6 0 1 1 1.2 0v.5c2.5.8 4.2 3.1 4.2 5.8v1.3c0 2 .8 3.9 2.2 5.2Z"/>
          </svg>
        </button>
        <button id="btnMenu" class="iconbtn" type="button" aria-label="Open navigation">☰</button>
      </div>
    </header>

    <div id="notifMenu" class="menu hidden" aria-label="Notifications menu">
      <div class="menuHeader">
        <div class="menuTitle">Notifications</div>
        <button id="btnNotifClear" class="smallbtn" type="button">Clear</button>
      </div>
      <div id="notifList" class="menuList"></div>
    </div>

    <div id="drawerBackdrop" class="backdrop hidden"></div>
    <aside id="drawer" class="drawer hidden" aria-label="Navigation drawer">
      <div class="drawerHeader">
        <div class="drawerTitle">Menu</div>
        <button id="btnDrawerClose" class="iconbtn" type="button" aria-label="Close navigation">×</button>
      </div>
      <nav class="drawerNav">
        <button class="navbtn" type="button" data-activity="live">Live</button>
        <button class="navbtn" type="button" data-activity="history">History</button>
        <button class="navbtn" type="button" data-activity="settings">Settings</button>
        <button id="closeAppButton" type="button" class="navbtn" hidden>Return To Constitute</button>
      </nav>
      <div class="drawerFooter small muted">
        <div class="drawerStatusRail">
          <div class="drawerStatusInline">
            <span id="identityHandle" class="identityHandle identityHandle-unlinked" title="Identity not linked yet">@unlinked</span>
            <span id="connWrap" class="connWrap">
              <span id="connStateText" class="connStateText connStateText-error">Offline</span>
              <div id="connPopover" class="popover hidden" role="status" aria-live="polite">
                <div class="popoverTitle">Connection Status</div>
                <div class="popoverRow"><span class="muted">Overall</span><span id="popConnection">offline</span></div>
                <div class="popoverRow"><span class="muted">Relay</span><span id="popRelay">offline</span></div>
                <div class="popoverRow"><span class="muted">Gateway</span><span id="popGateway">unknown</span></div>
                <div class="popoverRow"><span class="muted">Services</span><span id="popServices">unknown</span></div>
                <div id="popConnectionReason" class="popoverDetails muted">Waiting for managed launch context.</div>
              </div>
            </span>
          </div>
        </div>
      </div>
    </aside>

    <main class="appMain">
      <section id="liveView" class="activityPanel">
        <section class="panel">
          <div class="panelHeader">
            <h2>Cameras</h2>
          </div>
          <div id="cameraGrid" class="cameraGrid">
            <article class="emptyState">
              <strong>No Cameras</strong>
              <p>Launch the app from Constitute after the NVR service is available.</p>
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
          <div id="logPanel" class="panel nestedPanel diagnostics-hidden">
            <div class="panelHeader compactHeader">
              <div>
                <h2>Session Log</h2>
                <p class="panelHint">Managed launch and media negotiation details.</p>
              </div>
            </div>
            <pre id="log" class="log"></pre>
          </div>
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
    </main>
  `;

  return {
    btnBellEl: byId<HTMLButtonElement>("btnBell"),
    notifMenuEl: byId<HTMLElement>("notifMenu"),
    btnNotifClearEl: byId<HTMLButtonElement>("btnNotifClear"),
    notifListEl: byId<HTMLDivElement>("notifList"),
    closeAppButtonEl: byId<HTMLButtonElement>("closeAppButton"),
    btnMenuEl: byId<HTMLButtonElement>("btnMenu"),
    drawerEl: byId<HTMLElement>("drawer"),
    drawerBackdropEl: byId<HTMLElement>("drawerBackdrop"),
    btnDrawerCloseEl: byId<HTMLButtonElement>("btnDrawerClose"),
    navButtons: Array.from(app.querySelectorAll<HTMLButtonElement>(".navbtn")),
    identityHandleEl: byId<HTMLSpanElement>("identityHandle"),
    connWrapEl: byId<HTMLSpanElement>("connWrap"),
    connStateTextEl: byId<HTMLSpanElement>("connStateText"),
    connPopoverEl: byId<HTMLDivElement>("connPopover"),
    popConnectionEl: byId<HTMLSpanElement>("popConnection"),
    popRelayEl: byId<HTMLSpanElement>("popRelay"),
    popGatewayEl: byId<HTMLSpanElement>("popGateway"),
    popServicesEl: byId<HTMLSpanElement>("popServices"),
    popConnectionReasonEl: byId<HTMLDivElement>("popConnectionReason"),
    liveViewEl: byId<HTMLElement>("liveView"),
    historyViewEl: byId<HTMLElement>("historyView"),
    settingsViewEl: byId<HTMLElement>("settingsView"),
    cameraGridEl: byId<HTMLDivElement>("cameraGrid"),
    historyHintEl: byId<HTMLParagraphElement>("historyHint"),
    settingsTabButtons: Array.from(app.querySelectorAll<HTMLButtonElement>(".settingsTab")),
    nvrSettingsPanelEl: byId<HTMLElement>("settingsNvrPanel"),
    camerasPanelEl: byId<HTMLElement>("settingsCamerasPanel"),
    cameraListEl: byId<HTMLDivElement>("cameraList"),
    addCameraButtonEl: byId<HTMLButtonElement>("btnAddCamera"),
    cameraRefreshStatusEl: byId<HTMLSpanElement>("cameraRefreshStatus"),
    logPanelEl: byId<HTMLElement>("logPanel"),
    logEl: byId<HTMLPreElement>("log"),
  };
}
