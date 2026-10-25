# Normal billing layout regression

Reference: Google Drive `Sample images(Fixed UI)/POS/Normal_billing.jpeg`,
file `1QRk9gselpcAeMyzLndUML_PBvWucR4S8`. The reference was inspected together
with `Advanced_billing.jpeg`; neither private reference image is committed.

Before the fix, choosing Normal changed the selected menu item but retained
the catalog grid and hid the customer/summary sidebar. The new regression
fails on that visibility assertion. Normal now shows the cart on the left,
the existing customer and live bill summary on the right, and a full-width
scanner with pastel payment actions below. Advanced keeps the catalog layout.

55 focused loopback checks passed: both entry points, real scanner add,
persisted layout selection, unchanged saved items across switches/reloads,
customer-picker action, five viewport sizes and reachable scanner/summary/
payment controls. Quasar's registered Billing entry correctly opens the native
terminal; this is not a claim that billing runs inside the Quasar renderer.
Screenshots contain only synthetic fixture data. Unavailable loyalty/balance
statistics display a dash rather than a fabricated zero.

The owned JVM was stopped, its memory database destroyed and both loopback
listeners confirmed absent. No live data or billing rules were changed.
