# CLAUDE.md — working in the ZetaERP / Zenith repo

This repo backs a **live, proprietary, multi-tenant SaaS with real customer data**
(https://erp.zetaclantech.com). Read `CONTRIBUTING.md` and `SECURITY.md` once per session. Where
they and this file disagree, they win.

## Non-negotiables

1. **No secrets.** Never write passwords, API keys, tokens, private keys or real `.env` values
   into code, commits, PRs, issues or comments. Use placeholders (`rzp_live_xxxx`).
2. **No customer / user / security data** in code, commits, PR bodies, issue comments or
   screenshots. The flagship tenant (MARUTHI, org `100000`) is real. Never use its data as
   examples or test fixtures.
3. **Never fabricate** business or legal data: GSTIN, HSN, PAN, prices, stock, tax rates. If a
   task needs a real value, stop and ask for it in the issue or PR.
4. **Billing paths must stay no-op-safe for live tenants.** Never alter or renumber an issued
   bill or invoice.
5. **Org isolation is mandatory.** Every list, detail and JSON transition scopes by
   `organizationPartyId` explicitly, because screen transitions run outside the active-org
   entity filter. Detail and edit screens assert access on the requested id (IDOR guard). Use
   the org-scoped `PartyPicker` include, never the stock `searchPartyList`.
6. **Stage explicit paths only.** Never use `git add -A`, `git add .` or `git add --all`.
7. **Never push to `master` and never force-push.** All changes go through a PR against
   `master`.
8. **Never bypass the lint guards** (`--no-verify`). If a guard fails, fix the cause.

## Architecture essentials

- **Moqui Framework 4.0.** Screens, entities and services are XML. Groovy lives inside
  `<script>` CDATA; there are no loose `.java`/`.groovy` files. Templates are FreeMarker.
  Components are in `component/zenith-erp-<module>/{screen,service,entity,data,template}`.
- **Two surfaces, one source.** The same screen XML renders on **/apps** (Bootstrap 3) and
  **/qapps** (Quasar/Vue SPA). They share no utility classes. **/qapps strips `<script>` and
  `<style>`**, so bootstrap client JS there through an `<img onload>` attribute.
- **Shared theme:** `component/zenith-erp-app/screen/zenithstatic/css/zenith-theme-v4.css`. If
  you change anything under `zenithstatic/`, **bump the `?v=N` cache-bust** in
  `component/zenith-erp-app/screen/zenith/ZenithApp.xml`.
- **Moqui gotchas:**
  - `<else-if>` must nest its actions.
  - `type="date"` is day-granular, so add a `-lastUpdatedStamp` tiebreaker to orderings.
  - Inside `<![CDATA[ ]]>` Groovy use literal `&&` and `<`. In plain XML attributes use
    `&amp;&amp;` and `&lt;`.

## Lint guards (run before every commit)

```sh
sh docs/infra/lint-css-comments.sh
sh docs/infra/lint-party-picker.sh
sh docs/infra/lint-cross-module-transitions.sh
sh docs/infra/lint-form-dom-collisions.sh
```

The same four run in CI (`.github/workflows/repo-guards.yml`), and a red check blocks the merge.

## Commit style

A `type: subject` summary line (`fix:`, `feat:`, `chore:`, `infra:`, `docs:`), then a body with
bullets naming the files changed, **why**, and **how it was verified**. End with the
`Co-Authored-By:` trailer for the model that wrote it, matching `git log`.

## Running as the GitHub agent (claude-code-action)

When you are triggered from an issue or PR (`@claude`, or the `claude` label):

1. **Scope.** Do exactly one logical change, the one the issue asks for. If the request is
   ambiguous, touches billing, auth or org isolation in a way the issue doesn't spell out, or
   needs real business data, **stop and ask in a comment** instead of guessing.
2. **Branch.** Work only on the `claude/...` branch the action created from `master`.
3. **Implement.** Follow the architecture rules above. You may delegate Moqui XML work to the
   `moqui-developer` subagent.
4. **Guards.** Run all four lint guards. They must pass.
5. **Safety review.** Before opening or updating a PR, run the **`pr-safety-reviewer`**
   subagent on the diff against `master`. Fix every FAIL, then re-run it. Never open a PR while
   a FAIL remains.
6. **Commit and push.** Stage explicit paths and commit in the house style. Push the `claude/`
   branch only.
7. **Open a draft PR** against `master` with `gh pr create --draft --base master`. The body
   must fill **every section of `.github/PULL_REQUEST_TEMPLATE.md`**:
   - *What & why*: link the issue (`Closes #N`).
   - *Screens / modules touched*: paths, and whether /apps, /qapps or both are affected.
   - *How it was verified*: be honest. CI has **no Moqui runtime, database or tenant**, so you
     can only verify statically (guards, XML well-formedness, code reading). Say exactly that,
     and list what a maintainer must still check at runtime (throwaway tenant, both surfaces).
   - *Safety checklist*: tick only the boxes you actually verified. Leave runtime-only boxes
     (both-surfaces render, billing no-op on a throwaway tenant, test-data purge) **unticked**
     and note "needs maintainer verification".
8. **Never merge, approve or mark ready your own PR**, and never deploy. Deployment needs SSH
   and Docker access that only the owner has (`docs/SOP-commit-and-deploy.md` Part B).
9. Finish with a short comment on the issue or PR: what changed, the PR link, and the runtime
   checks the maintainer still needs to do.

**Out of scope for the agent:** SSH, Docker, `curl` to production, database access,
`docs/infra/purge-tenant.*`, `sync-from-live.sh`, deploy scripts, and editing
`.github/workflows/*`. If a task needs any of these, say so in a comment and stop.
