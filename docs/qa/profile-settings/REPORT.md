# Restore Settings in the account menu

Dependency: PR #160 provides the shared account menu and Logout. This follow-up reuses it, rather than introducing a second account control. Merge #160 first; the remaining follow-up diff is the Settings entry, its cache versions, scoped touch spacing and regression checks.

The initials avatar had become a direct account link, hiding the framework account menu. PR #160 restores that menu but did not include Settings. The custom sidebar also has no Settings entry, leaving tenant administrators unable to discover user-role management.

The menu now includes **Settings**, linked directly to the existing Users & Role Assignment screen. It is shown only when the server-rendered `data-is-admin` flag is true. It retains `/apps` or `/qapps` for the current shell. Tenant administrators still cannot edit the shared platform role catalogue; no security grants, authentication rules or user records change. Account and subscription links plus the existing logout route remain intact.

## Verification

- `node docs/qa/profile-settings/check-menu.cjs`: six cases across both shells; admin true/false/missing; account/logout destinations retained.
- Disposable local browser: platform and tenant administrators can open the menu and follow Settings to Users & Role Assignment on both shells.
- Logout returns to Login; visiting protected Settings after logout redirects to Login.
- Escape dismisses the menu and restores focus; menu geometry checked at 390, 1440 and 1728px, with no viewport overflow. Menu rows are at least 44px high for touch.
- No production changes, customer records, passwords, or private migration data are included.
- JavaScript syntax, XML parsing and the four repository lint guards pass locally.

CI, final cashier checks and disposal of the local runtime are recorded in the PR. This follow-up must not merge independently of #160. Deployment is a separate maintainer action.
