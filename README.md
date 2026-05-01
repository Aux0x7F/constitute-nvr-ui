# constitute-nvr-ui

`constitute-nvr-ui` is the browser app module for `constitute-nvr`.

Current scope is the first-party Security Cameras surface:
- load as a Pages-hosted app surface at `tld/constitute-nvr-ui/`
- redeem short-lived service access context from the shared runtime in `constitute-account`
- establish gateway-mediated signaling/auth for `constitute-nvr`
- render live camera tiles over WebRTC H.264 preview tracks

## Security Position
- UI does not receive executable code from NVR transport.
- Identity/session/grant authority remains in `constitute-account`.
- Service access must not require long-lived identity secrets in URL parameters.
- Shared service-access names and CAAC envelope primitives come from `constitute-protocol`.
- Manual protocol/debug helpers are not part of the canonical browser service access path.

## Run
```bash
npm install
npm run dev
npm run build
npm run test:e2e
```

## Manifest + Service Access
- App manifest: `app.manifest.json`
- Default manifest entry: `dist/index.html`
- Build output is committed for static hosting under the site domain.
- Static hosting should serve the app at `/constitute-nvr-ui/` without exposing `/dist/` in the canonical URL.

## Service Access Bootstrap
Canonical service access direction:
- direct app entry or another first-party surface opens this app with a short-lived `contextId`
- shared runtime exposes matching service access context
- app redeems that context and then negotiates signaling/auth through the owned gateway

Shared first-party chrome comes from `constitute-ui`, including the footer account rail and mini account center entrypoint.

Long-lived identity secrets should not be passed in query parameters.

## Status
Ready for managed browser-surface convergence testing against the shared runtime and gateway-mediated service access path.
