# constitute-nvr-ui

`constitute-nvr-ui` is the browser client module for the `constitute-nvr` service.

Current scope is MVP/manual-test support:
- establish identity-bound encrypted websocket session with `constitute-nvr`
- issue NVR control commands (`list_sources`, `discover_onvif`, `list_segments`, `get_segment`)
- reconstruct segment chunks and expose downloadable media files

## Security Position
- UI does not receive executable code from NVR transport.
- Session channel encryption is negotiated client-side.
- Identity/wallet ownership is intended to remain in `constitute` shell.

## Run
```bash
npm install
npm run dev
```

Default target endpoint in UI:
- `ws://127.0.0.1:8456/session`

## Contract Inputs
To connect, provide:
- `identityId`
- `devicePk`
- `identitySecretHex`

These must match NVR config (`/etc/constitute-nvr/config.json`).

## Integration Direction
This repo is intended to be consumed by `constitute` as an app module (same-origin subroute first).

## Status
MVP/manual-test ready. Not production-ready.
