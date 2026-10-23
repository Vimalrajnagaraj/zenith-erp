# Sales Mode Delete: remove the entire card

## Confirmed defect

The red trash button opened `removeFromShops`, not `deleteMode`. That operation
correctly stored physical-shop exclusions but left the global definition active;
All Shops therefore still displayed its card with a "Removed from N shops" note.
The visible Delete action did not deliver the outcome its name promised.

## Repair

- Delete posts to a guarded organization-wide service after confirmation. Owned
  modes are archived; shared definitions get an organization-specific removal row.
- The entire card/icon, rules/options/assignment rows and terminal choices disappear
  for that organization, including future shops/terminals. Issued bills, prices and
  other organizations remain intact. Shop Restore cannot override a full Delete.
- Customize retains the explicit "Remove from selected shops" action for partial
  availability changes. Terminal assignment Remove still affects one terminal only.
- Default Retail, POS administrator/module access, POST/CSRF and mixed open/held
  cart safeguards are retained. Terminal locks coordinate deletion with cart edits.
- No payment, tax, pricing math, header, sidebar or unrelated styling changes.

## Evidence

`before-delete.jpg` and `after-delete.jpg` are actual disposable browser captures:
"Disposable Delete Preview" and its icon vanish after Delete and stay absent on
reload. Independent PostgreSQL state shows `is_active=N`, not a hard deletion.

`verify-mode-deletion.cjs` is integrated into the existing portable POS acceptance
suite. It covers both shells, confirmation cancel/accept, deletion after per-shop
removal, reload, management options, shared/owned mode isolation, default/role/CSRF/
GET rejection, open/held mixed carts, future terminals, forged manual prices,
idempotency, and preservation of prices/shared definitions/issued bill history.
Final results and teardown evidence are linked from the PR after CI completes.
Only the loopback tmpfs runtime contains synthetic fixtures; no live write tested.

## Deployment gate

Create the new empty `pos_sales_mode_org_removal` table via the normal Moqui schema
update before activating the complete entity/service/screen changes together.
Existing definitions and shop removals are not migrated or guessed into deletions:
a mode previously removed from shops needs one explicit Delete after deployment.
No default availability changes until an administrator explicitly deletes a mode.
Only maintainers merge/deploy after review and the MARUTHI no-op deploy gate.
No physical Safari or printer/scanner certification is claimed.
