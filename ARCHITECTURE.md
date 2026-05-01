# constitute-nvr-ui Architecture

## Role
`constitute-nvr-ui` is the presentation/control client for `constitute-nvr`.

It is a Pages-hosted managed app surface.
It is not a transport/gateway replacement and does not host identity authority.
It is also not the future Physical Security product app; `constitute-physec` should consume NVR projections later for broader Security workflows.

## Boundaries
- Identity/session/grant authority: `constitute-account`
- Same-origin launch/runtime coordination: `constitute-account/runtime.worker.js`
- Shared first-party chrome/primitives: `constitute-ui`
- Browser control/signaling boundary: `constitute-gateway`
- Hosted media/service endpoint: `constitute-nvr`

## Managed Launch Flow
1. User opens `tld/constitute-nvr-ui/` directly or a first-party surface opens it with a non-secret `launchId`.
2. Shared runtime exposes short-lived launch context through same-origin worker state.
3. NVR UI redeems launch context and learns target gateway/service metadata.
4. UI requests or receives gateway-mediated launch authorization.
5. UI uses gateway-mediated signaling to establish WebRTC with the hosted NVR service.
6. UI renders the live camera grid from WebRTC preview tracks.

Direct entry is the primary flow. The user should not need to visit `constitute-account` manually first. If retained runtime projection is insufficient, NVR UI should keep resolving account/session/grant state through the shared runtime and present scoped account-required state instead of treating a single timed launch attempt as final product truth.

## UI Scope
Current managed surface:
- no-camera state
- connecting state
- live camera tiles
- unavailable/error state
- shared footer account-state rail with mini account center
- diagnostics stay in console/debug side channels; the primary UI does not expose a session-log panel
- the shared account rail opens account actions only; app-specific opener-return controls are not part of the current shared contract

Advanced configuration remains out of scope for this slice except navigation placeholders.

Future Physical Security scope belongs in `constitute-physec`, including locations, armed modes, incidents, sensor fusion, and response views. NVR UI may continue to expose camera/service administration and live camera operation.

## Media Direction
- WebRTC
- H.264 preview
- substream / low-resolution feed where available for multi-camera grid
- WebRTC media is encrypted in transit through DTLS-SRTP
- future NVR media projection should let this app attach to a warm browser-safe preview stream instead of always paying cold camera/ffmpeg startup cost

## Debug Surface
Manual protocol helpers may exist for lab verification, but the browser app's canonical launch path is direct app entry through `constitute-account` shared runtime and gateway-mediated signaling.
