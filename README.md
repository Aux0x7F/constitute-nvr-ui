# constitute-nvr-ui

`constitute-nvr-ui` is the browser app surface for NVR operation.

It presents camera grids, live preview, camera management, recording/history
entry points, and NVR-specific operator state while relying on the shared
browser runtime for identity, retained projections, and stream intents.

It renders camera inventory and stream posture from runtime/NVR projections and
reports browser adapter evidence. It does not own route truth, service
admission, stream answer, or inventory truth.
