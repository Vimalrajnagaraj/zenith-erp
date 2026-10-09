# SOP-07 Barcode coverage

Statuses describe disposable software evidence; `PARTIAL` explicitly leaves the listed owner/hardware checks open. No claim of zero unknown bugs or production verification is made.

| Case | Status | Evidence / remaining check |
|---|---|---|
| BC-001 | SOFTWARE VERIFIED | Dashboard renders — actual runtime/API/DB or browser assertion in the suite. |
| BC-002 | SOFTWARE VERIFIED | Quick lookup — actual runtime/API/DB or browser assertion in the suite. |
| BC-003 | PARTIAL | No-org empty screens tested; a separate authorized empty tenant remains an owner check. |
| BC-010 | SOFTWARE VERIFIED | List barcodes — actual runtime/API/DB or browser assertion in the suite. |
| BC-011 | SOFTWARE VERIFIED | Add a Code128 barcode — actual runtime/API/DB or browser assertion in the suite. |
| BC-012 | SOFTWARE VERIFIED | **EAN-13 checksum accepted** — actual runtime/API/DB or browser assertion in the suite. |
| BC-013 | SOFTWARE VERIFIED | **EAN-13 checksum rejected** — actual runtime/API/DB or browser assertion in the suite. |
| BC-014 | SOFTWARE VERIFIED | EAN-8 / UPC-A checksum — actual runtime/API/DB or browser assertion in the suite. |
| BC-015 | SOFTWARE VERIFIED | Wrong length / non-numeric EAN — actual runtime/API/DB or browser assertion in the suite. |
| BC-016 | SOFTWARE VERIFIED | **Uniqueness within tenant** — actual runtime/API/DB or browser assertion in the suite. |
| BC-017 | SOFTWARE VERIFIED | Multiple barcodes / product — actual runtime/API/DB or browser assertion in the suite. |
| BC-018 | SOFTWARE VERIFIED | **Primary is exclusive** — actual runtime/API/DB or browser assertion in the suite. |
| BC-019 | SOFTWARE VERIFIED | Auto-generate internal — actual runtime/API/DB or browser assertion in the suite. |
| BC-020 | PARTIAL | Known/unknown/type/product checked. Price is null in mechanical fixtures; positive MRP requires approved data. |
| BC-021 | SOFTWARE VERIFIED | Deactivate barcode — actual runtime/API/DB or browser assertion in the suite. |
| BC-030 | SOFTWARE VERIFIED | Create template — actual runtime/API/DB or browser assertion in the suite. |
| BC-031 | SOFTWARE VERIFIED | Default template — actual runtime/API/DB or browser assertion in the suite. |
| BC-032 | PARTIAL | Flags and hidden fields verified. Positive monetary/currency output needs approved recorded amounts. |
| BC-033 | SOFTWARE VERIFIED | Silly dimensions — actual runtime/API/DB or browser assertion in the suite. |
| BC-034 | SOFTWARE VERIFIED | Create print job — actual runtime/API/DB or browser assertion in the suite. |
| BC-035 | SOFTWARE VERIFIED | Render labels — actual runtime/API/DB or browser assertion in the suite. |
| BC-036 | SOFTWARE VERIFIED | Type→format mapping — actual runtime/API/DB or browser assertion in the suite. |
| BC-037 | SOFTWARE VERIFIED | Mark printed — actual runtime/API/DB or browser assertion in the suite. |
| BC-038 | SOFTWARE VERIFIED | Product with no primary barcode — actual runtime/API/DB or browser assertion in the suite. |
| BC-040 | SOFTWARE VERIFIED | Assign a code — actual runtime/API/DB or browser assertion in the suite. |
| BC-041 | PARTIAL | New duplicate/GTIN assignments are rejected. Legacy duplicate warning appearance requires an approved legacy fixture. |
| BC-042 | SOFTWARE VERIFIED | Duplicate blocked on save? — actual runtime/API/DB or browser assertion in the suite. |
| BC-043 | SOFTWARE VERIFIED | Clear a code — actual runtime/API/DB or browser assertion in the suite. |
| BC-044 | PARTIAL | Save persistence, narrow views and search paths checked; arbitrary category/pagination combinations need owner pass. |
| BC-045 | SOFTWARE VERIFIED | Grid org-scoped — actual runtime/API/DB or browser assertion in the suite. |
| BC-050 | SOFTWARE VERIFIED | Only coded products selectable — actual runtime/API/DB or browser assertion in the suite. |
| BC-051 | PARTIAL | Two products x two copies verified. Monetary output needs approved recorded prices. |
| BC-052 | PARTIAL | Pixels decode independently, including standardized UPC/EAN aliases. Physical scanner/printer pass remains pending. |
| BC-053 | PARTIAL | Independent Code128 pixel decode passed; the vendor engine is reused rather than reimplemented. No byte-identical SVG-bar assertion. |
| BC-054 | PARTIAL | Millimetre geometry checked. Physical scans at 38x25/100x50 and printer calibration remain pending. |
| BC-055 | PARTIAL | Batch/copies/count/captured values checked. Actual printed pagination remains pending. |
| BC-056 | PARTIAL | Iframe readiness path checked. Real browser print-dialog/cancellation remains pending. |
| BC-057 | PARTIAL | Special-character Code128 pixels decoded; 256-character validation accepted and 257 rejected. Physical long-code readability remains pending. |
| BC-058 | PARTIAL | Actual Inventory update POST mirrors/clears codes atomically and rejects collisions. Owner should repeat the visual keyboard path in the Inventory editor. |
| BC-059 | SOFTWARE VERIFIED | No validation on pseudoId — actual runtime/API/DB or browser assertion in the suite. |
| BC-060 | PARTIAL | Rich-only exact resolution verified. A staged cart/billing exercise remains owner-gated. |
| BC-061 | PARTIAL | PseudoId exact resolution verified. A staged cart/billing exercise remains owner-gated. |
| BC-070 | PARTIAL | Exact resolution verified. A staged cart/billing exercise remains owner-gated. |
| BC-071 | PARTIAL | Enter-driven grid save verified; real handheld Enter at till remains pending. |
| BC-072 | SOFTWARE VERIFIED | Type-ahead by name/code — actual runtime/API/DB or browser assertion in the suite. |
| BC-073 | SOFTWARE VERIFIED | **Unknown barcode** — actual runtime/API/DB or browser assertion in the suite. |
| BC-074 | PARTIAL | Same-org aliases prevented, resolver denies ambiguity; staged cart behavior remains owner-gated. |
| BC-075 | SOFTWARE VERIFIED | Leading zeros — actual runtime/API/DB or browser assertion in the suite. |
| BC-076 | SOFTWARE VERIFIED | Large catalogue — actual runtime/API/DB or browser assertion in the suite. |
| BC-077 | SOFTWARE VERIFIED | Whitespace / case — actual runtime/API/DB or browser assertion in the suite. |
| BC-090 | SOFTWARE VERIFIED | Desktop layout — actual runtime/API/DB or browser assertion in the suite. |
| BC-091 | SOFTWARE VERIFIED | Mobile layout — actual runtime/API/DB or browser assertion in the suite. |
| BC-092 | PARTIAL | Enter-to-save and scoped focus implemented; full keyboard/assistive-technology pass remains pending. |
| BC-093 | SOFTWARE VERIFIED | XSS via product name/value — actual runtime/API/DB or browser assertion in the suite. |
| BC-094 | SOFTWARE VERIFIED | Save-barcode authz/CSRF — actual runtime/API/DB or browser assertion in the suite. |
