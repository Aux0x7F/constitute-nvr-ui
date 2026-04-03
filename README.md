# constitute-nvr-ui

`constitute-nvr-ui` is the browser app module for `constitute-nvr`.

Current scope is managed-app MVP support:
- load as a Pages-hosted app surface at `tld/constitute-nvr-ui/`
- redeem short-lived launch context from `constitute`
- establish gateway-mediated signaling/auth for `constitute-nvr`
- render a simple live camera grid over WebRTC H.264 preview tracks

## Security Position
- UI does not receive executable code from NVR transport.
- Identity/wallet ownership remains in `constitute` shell.
- Managed launch must not require long-lived identity secrets in URL parameters.
- Direct/manual debug mode may still use explicit operator-supplied secrets outside the canonical flow.

## Run
```bash
npm install
npm run dev
npm run build
```

## Manifest + Launch
- App manifest: `app.manifest.json`
- Default manifest entry: `dist/index.html`
- Build output is committed for static hosting under the site domain.

## Managed Launch Bootstrap
Canonical launch direction:
- shell opens this app with a short-lived `launchId`
- shell exposes matching launch context through same-origin ephemeral bootstrap
- app redeems that context and then negotiates signaling/auth through the owned gateway

Long-lived identity secrets should not be passed in query parameters.

## Legacy Debug Mode
Manual direct `/session` attachment remains available for lab work while the managed path is under active implementation.

## Status
MVP/manual-test ready. Not production-ready.
