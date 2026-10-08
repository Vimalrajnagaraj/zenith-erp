# Tax reference UI and control repairs

Base: freshly fetched `master` (`ba5143a3d1d5e97d2182ff7ba535f36862690a2f`). Scope: Tax content on `/apps` and `/qapps`.

References: [Tax reports](https://drive.google.com/drive/folders/12rh2AstPHWVo25lKT_69KJyDxUgYcqt0) and [fixed Tax samples](https://drive.google.com/drive/folders/1fOPcbN6SNUWtZM54yex1xVZm787bnyIK). Reviewed all 20 Markdown reports and 10 fixed samples. Existing matching list markup and working shared shell controls are retained.

| Reproduction / root cause | Repair |
| --- | --- |
| Live MARUTHI registration edit: fixed-width date controls wrap away from their labels at desktop/intermediate widths. The Region field uses the filled lavender style despite an empty selection. | Fluid paired dates, white Region control, aligned detail columns and responsive stacking. |
| Registration/exemption create and edit: invisible native dates overlay readonly text proxies; clear controls are clickable spans without keyboard semantics. | Visible labelled native dates, real non-submit clear buttons, scoped focus outline. ISO date field names and POST payloads are preserved. |
| Custom modal open/close only changes display; Escape, focus restoration and Tab containment are missing. | Accessible dialog semantics and keyboard lifecycle; no service invocation added. |
| Exemption list: filtering to zero rows leaves a blank table; status/export/pagination controls have inconsistent styling. | Explicit no-match message, compact aligned controls and clear export-all scope. |
| Dashboard activity export downloads tax lines; tax-line ellipsis is a static label styled as an action. Rate help points at a nonexistent Tax Categories destination. | Remove misleading export and static action; describe the existing administrator-managed configuration accurately. Exemption help now opens an on-page explanation rather than navigating to GST filing. |
| Stat cards wrap unevenly; GST return columns wrap according to fixed flex bases. | Content-scoped grids and consistent responsive spacing; existing values, chart series and table rows preserved. |
| GST filing pagination uses unnamed glyph buttons; automatically derived financial year appears unexplained. | Named pagination controls/current-page semantics and an explanation of the existing derived value. |

## Functional boundaries

No service, entity definition, tax slab, seed business value, authorization, billing calculation or server transition/action changes. The eight changed XML screens' non-widget trees were compared with `origin/master` after XML parsing and matched. Existing tenant predicates, record-access guards, POST transitions and Moqui CSRF fields remain intact. Currency values and tax aggregates are not mocked to match sample screenshots. The shared ERP header/sidebar are outside this change.

## Verification

- Live verification is read-only: navigation, visual inspection and form inspection. No customer record, statutory filing or issued invoice was modified.
- Baseline and candidate Tax service acceptance: 70/70 cases each, using a guarded disposable loopback runtime and synthetic tenants. This includes rounding, CESS, RCM, registration checks, foreign access denials and Sales/Purchase caller totals.
- Extended the existing Tax browser suite with keyboard clearing, Escape/focus restoration, modal and edit-form overflow at 1366/800/390/320px, visible labelled dates, no-match feedback and native date create/edit persistence on both surfaces.
- Independent PostgreSQL assertions require both UI-created registrations to retain the expected effective dates. Existing foreign-row, CSRF, issued-document and mathematical assertions remain mandatory.
- Run the trusted `staging-acceptance` workflow from `master` with the exact candidate SHA and `contacts_profile=tax`. It runs the clean pinned image, browser/service cases, SQL assertions and disposable-stack teardown. Inspect the PR checks and the associated Tax run before approval.
- Local static verification: Tax XML parsing, JavaScript syntax, source-action parity and all four pre-commit repo guards.

Native dates display according to browser locale; they submit ISO `yyyy-MM-dd`. Optional dates remain optional. Platform-admin-only global controls remain permission-gated. The synthetic organization code in the QA fixture enables normal browser login and is never installed into a production component.

The disposable native runtime is a public framework rebuild, not a byte-identical production image. The pinned clean CI runtime supplies the review evidence. Passing these cases demonstrates the tested boundaries; it does not certify every statutory scenario or approve a production deployment. Amal reviews, merges and deploys separately.
