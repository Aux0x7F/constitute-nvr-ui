# constitute-nvr-ui

`constitute-nvr-ui` is the browser app module for `constitute-nvr`.

Current scope is the first-party Security Cameras surface:
- load as a Pages-hosted app surface at `tld/constitute-nvr-ui/`
- redeem short-lived launch context from the shared runtime in `constitute-account`
- establish gateway-mediated signaling/auth for `constitute-nvr`
- render live camera tiles over WebRTC H.264 preview tracks

## Security Position
- UI does not receive executable code from NVR transport.
- Identity/session/grant authority remains in `constitute-account`.
- Managed launch must not require long-lived identity secrets in URL parameters.
- Manual protocol/debug helpers are not part of the canonical browser launch path.

## Run
```bash
npm install
npm run dev
npm run build
npm run test:e2e
```

## Manifest + Launch
- App manifest: `app.manifest.json`
- Default manifest entry: `dist/index.html`
- Build output is committed for static hosting under the site domain.
- Static hosting should serve the app at `/constitute-nvr-ui/` without exposing `/dist/` in the canonical URL.

## Managed Launch Bootstrap
Canonical launch direction:
- direct app entry or another first-party surface opens this app with a short-lived `launchId`
- shared runtime exposes matching launch context
- app redeems that context and then negotiates signaling/auth through the owned gateway

Shared first-party chrome comes from `constitute-ui`, including the footer account rail and mini account center entrypoint.

Long-lived identity secrets should not be passed in query parameters.

## Status
Ready for managed browser-surface convergence testing against the shared runtime and gateway-mediated launch path.
