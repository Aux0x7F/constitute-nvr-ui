# constitute-nvr-ui Architecture

## Role
`constitute-nvr-ui` is the presentation/control client for `constitute-nvr`.

It is not a transport/gateway replacement and does not host identity authority.

## Boundaries
- Transport/session endpoint: `constitute-nvr` (`/session` websocket)
- Identity authority and wallet: `constitute` shell (target integration)
- Swarm/gateway backbone: `constitute-gateway`

## Session Flow
1. Client sends plaintext `hello` with identity + proof.
2. NVR responds with `hello_ack` and server key.
3. Client derives symmetric session key (ECDH + HKDF).
4. Command/data frames use encrypted `cipher` envelopes.

## MVP Commands
- `list_sources`
- `discover_onvif`
- `list_segments`
- `get_segment`

## Integration Target
Short-term: same-origin subroute consumption by `constitute` shell.
Long-term: permissioned app manifest + capability gating in shell.
