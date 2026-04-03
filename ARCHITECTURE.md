# constitute-nvr-ui Architecture

## Role
`constitute-nvr-ui` is the presentation/control client for `constitute-nvr`.

It is a Pages-hosted managed app surface.
It is not a transport/gateway replacement and does not host identity authority.

## Boundaries
- Identity authority and wallet: `constitute` shell
- Browser control/signaling boundary: `constitute-gateway`
- Hosted media/service endpoint: `constitute-nvr`

## Managed Launch Flow
1. `constitute` opens `tld/constitute-nvr-ui/` with a non-secret `launchId`.
2. Shell exposes short-lived launch context through same-origin ephemeral bootstrap (`BroadcastChannel` / storage).
3. NVR UI redeems launch context and learns target gateway/service metadata.
4. UI requests or receives gateway-mediated launch authorization.
5. UI uses gateway-mediated signaling to establish WebRTC with the hosted NVR service.
6. UI renders the live camera grid from WebRTC preview tracks.

## UI Scope
Current managed MVP:
- no-camera state
- connecting state
- live camera tiles
- unavailable/error state

Advanced configuration remains out of scope for this slice except navigation placeholders.

## Media Direction
- WebRTC
- H.264 preview
- substream / low-resolution feed where available for multi-camera grid

## Legacy Debug Mode
Standalone direct `/session` websocket attachment remains available for lab/debug, but it is not the canonical production launch path.
