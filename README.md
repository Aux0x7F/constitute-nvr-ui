# constitute-nvr-ui

`constitute-nvr-ui` is the browser app module for `constitute-nvr`.

Current scope is MVP/manual-test support:
- establish identity-bound encrypted websocket session with `constitute-nvr`
- issue NVR control commands (`list_sources`, `list_source_states`, `discover_onvif`, `list_segments`, `get_segment`)
- reconstruct segment chunks and expose downloadable media files

## Security Position
- UI does not receive executable code from NVR transport.
- Session channel encryption is negotiated client-side.
- Identity/wallet ownership remains in `constitute` shell; this UI consumes explicit operator-provided secrets for now.

## Run
```bash
npm install
npm run dev
npm run build
```

## Manifest + Launch
- App manifest: `app.manifest.json`
- Default manifest entry: `dist/index.html`
- Build output is committed for manifest-driven remote launch (CDN/GitHub static fetch).

## URL Parameters (Optional)
When launched from the web shell, these can pre-fill fields:
- `ws`
- `identityId`
- `devicePk`

Example:
`.../dist/index.html?ws=wss://gateway.example/session&identityId=<id>&devicePk=<pk>`

## Contract Inputs
To connect, provide:
- `identityId`
- `devicePk`
- `identitySecretHex`

These must match `constitute-nvr` config (`/etc/constitute-nvr/config.json`).

## Status
MVP/manual-test ready. Not production-ready.
