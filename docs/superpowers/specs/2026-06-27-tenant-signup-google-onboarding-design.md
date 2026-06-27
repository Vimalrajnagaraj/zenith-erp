# Branded Login + Google Sign-up/Sign-in + Tenant Onboarding Wizard — Design

**Date:** 2026-06-27
**Module:** `zenith-erp-saas` (with one additive touch to `provision#Tenant`)
**Status:** Approved design, pending spec review → implementation plan

---

## 1. Goal

Give Zenith a real product front door:

1. A **branded login/landing page** we own (replaces Moqui's stock `/Login` as the entry point).
2. **"Continue with Google"** for both **sign-up** (new tenants) and **sign-in** (returning users) — passwordless.
3. A guided **multi-step onboarding wizard** that provisions a new tenant.

Email + password login and the existing `/signup` mechanics must keep working throughout (non-destructive on a live system).

## 2. What already exists (do NOT rebuild)

Confirmed in the codebase during brainstorming:

- **Self-service provisioning** already works: `zenith.saas.SaasServices.provision#Tenant`
  (`component/zenith-erp-saas/service/zenith/saas/SaasServices.xml:6-175`, `authenticate="anonymous-all"`).
  It creates: Organization party (`OrgInternal`), org code (`pseudoId` + `PtidOrgCode`), admin `UserAccount`
  (username = email), Person party + `Manager` role, the Person→Org `PartyRelationship`
  (`fromRoleTypeId=Manager`, `toRoleTypeId=OrgInternal`, `relationshipTypeEnumId=PrtEmployee`), the
  `ACTIVE_ORGANIZATION` UserPreference, UserGroups (`TENANT_<SUB>` + `ZENITH_ALL`), CompanySettings,
  optional India GST config/IndiaGstin, sequences, a default Facility ("Main Store"), a PosReceiptTemplate,
  and the `SaasTenant` + `SaasSubscription` + `SaasAuditLog(SIGNUP)` rows.
- **Anonymous sign-up page** `saas-public/Signup.xml` (`require-authentication="false"`, mounted under webroot
  at `/signup` via `zenith-erp-saas/MoquiConf.xml:13-20`) with a `register` transition (calls `provision#Tenant`
  with `disableAuthz().requireNewTransaction(true)`) and a live `checkSubdomain` AJAX transition.
- **Plan/subscription model**: `SaasPlan`, `SaasPlanModule` (module allowlist; `moduleId="ALL"` for Enterprise),
  `SaasTenant`, `SaasSubscription` (`SaasEntities.xml`). Module gating lives in
  `component/zenith-erp-app/screen/zenith/ZenithApp.xml` (`pre-actions` compute `saasAllowedModules`,
  `SaasModuleGateCheck` blocks out-of-plan modules; subdomain auto-resolves `ACTIVE_ORGANIZATION` at
  `ZenithApp.xml:64-82`).
- **Login** is Moqui's **stock** framework `/Login` (Organization ID + email + password) — it lives in
  `moqui-runtime` webroot, **outside** the component mirror. `SignupSuccess.xml` tells users to save the
  uppercased subdomain as their Organization ID.
- **No OAuth/Google/SSO anywhere.** Auth is 100% `moqui.security.UserAccount` (email + password). Google is greenfield.

**Implication:** the new work is (a) a branded login surface, (b) the Google identity path + passwordless
session establishment, (c) a wizard wrapper over the *existing* provisioning service. Provisioning itself is reused.

## 3. Decisions (from brainstorming)

| # | Decision |
|---|----------|
| Login surface | **Custom branded login + signup landing** that replaces stock `/Login` as the entry point. |
| Google scope | **Both sign-up AND sign-in**, passwordless. |
| Onboarding | **3-step wizard.** |
| Google flow | **Google Identity Services "ID token" flow** — needs only a public **Client ID**, **no client secret**. |
| Auth → session | **Approach A**: server-side verify the `id_token` (Google `tokeninfo`), then `internalLoginUser` for known users; new users → wizard. (Approach B, local JWT signature verification, noted as a future hardening step.) |
| Client ID provisioning | User creates a Google Cloud **Web OAuth Client ID**; design includes step-by-step setup; build/test with a placeholder. |

## 4. Architecture

### 4.1 Screens (all public, `require-authentication="false"`, mounted under webroot like `Signup.xml`)

- **`saas-public/Welcome.xml`** → `/signin` — the login entry point:
  - Zenith branding.
  - Email + password form that posts to Moqui's **existing** framework login transition (current users unaffected).
  - **"Continue with Google"** button (Google Identity Services, configured with the platform Client ID).
  - **"Create account"** link → `/get-started`.
  - Organization ID becomes **optional**: auto-resolved from the tenant subdomain or from the user's account.
- **`saas-public/Onboarding.xml`** → `/get-started` — the **3-step wizard** (client-side step show/hide; a
  **single final POST** so a tenant is never half-created):
  1. **Company basics** — business name, subdomain (live availability via the existing `checkSubdomain`),
     industry, country/currency.
  2. **Tax** — GSTIN (optional) with live state detection from the first 2 digits.
  3. **Plan** — choose `SaasPlan` (Starter/Growth/Professional/Enterprise) + trial info.
  - If the user arrived via **email signup** (not Google), step 1 also collects admin first/last name, email, password.
  - If the user arrived via **Google**, name/email are pre-filled from the verified identity and locked.
- **`SignupSuccess.xml`** reused as the completion screen.

### 4.2 Services (`zenith-erp-saas/service/zenith/saas/SaasServices.xml`, `authenticate="anonymous-all"`)

- **`verify#GoogleIdToken`** — in: `idToken`. Calls Google `https://oauth2.googleapis.com/tokeninfo?id_token=...`
  via `HttpURLConnection` (Groovy). Validates: `aud == <platform Client ID>`, `iss ∈ {accounts.google.com,
  https://accounts.google.com}`, `exp` not passed, `email_verified == true`. Out: `{email, firstName, lastName,
  googleSub}`. Errors on anything invalid.
- **`authenticate#GoogleUser`** — in: `idToken`. Calls `verify#GoogleIdToken`, then looks up `UserAccount` by
  `username == email`:
  - **Found** → `ec.user.internalLoginUser(email)` (Moqui passwordless SSO login) → out: `{action:'login',
    redirectUrl}`.
  - **Not found** → store verified identity in session → out: `{action:'signup'}` (the page redirects to `/get-started`).
- **`provision#Tenant` (extend — additive only)** — new optional inputs `googleSub` (String) and passwordless
  mode: when `adminPassword` is blank **and** `googleSub` is present, create the `UserAccount` with a generated
  random, unguessable password (never surfaced/logged) and record `GOOGLE_SUB`. All existing callers and the
  email/password path are unchanged.

### 4.3 Transitions on the public screens

- `Welcome.xml` `googleAuth` transition (`require-authentication="false"`) — receives `credential` (the id_token
  from the GIS callback, posted by page JS with the `moquiSessionToken`), calls `authenticate#GoogleUser`,
  returns JSON `{action, redirectUrl}`; the page JS routes to the app or to `/get-started`.
- `Onboarding.xml` `register` transition — same shape as the existing `Signup.xml:register`, calling
  `provision#Tenant` (with `googleSub` when present) inside `disableAuthz().requireNewTransaction(true)`,
  then `internalLoginUser` and redirect to the app (or to `SignupSuccess`).
- Reuse `checkSubdomain` (live availability).

### 4.4 Data / config

- **Google Client ID** — one platform-global config value (public-safe; embedded in the page for GIS). Stored as a
  **single platform-scoped config row** keyed `GOOGLE_CLIENT_ID` (reuse `SaasTenantConfig` with the platform org
  `ZETAERP`, or a tiny `SaasPlatformConfig` entity if cleaner), **editable from the existing super-admin SaaS
  `Settings.xml` screen** so it can be changed without a redeploy. Read once at `/signin` render and injected into
  the GIS button init. Placeholder until the real value is provided; the actual value is not committed to source.
- **Google `sub` binding** — `moqui.security.UserPreference` key `GOOGLE_SUB` on the user. Primary account match
  stays the globally-unique `UserAccount.username` (= email); `sub` is the durable binding + audit value.

### 4.5 Login-destination override (the one framework integration point to verify)

Stock `/Login` is in the framework (outside the mirror). To make `/signin` the real login destination, verify the
cleanest of, in order of preference:
1. Configure Moqui's login-screen path so unauthenticated redirects land on `/signin`.
2. Shadow the `Login` subscreen via a `screen-facade` `subscreens-item` (like `zenith-erp-app/MoquiConf.xml` does).
3. **Fallback (always works):** keep stock `/Login` reachable but add a `/Login → /signin` redirect and link
   every entry point to `/signin`.

## 5. Security & live-system constraints

- **Server-side verification is mandatory.** The browser-supplied `id_token` is never trusted; `aud` must equal our
  Client ID (blocks tokens minted for other apps), `email_verified` must be true, `exp` must be valid.
- **Secrets:** no client secret stored (ID-token flow). Google-account passwords are random and never displayed or
  logged (constraint #1).
- **No fabricated business/legal data:** GSTIN optional and format-validated only; no invented GSTIN/HSN/PAN
  (constraint #2).
- **No-op-safe for MARUTHI:** `provision#Tenant` changes are additive optional params; billing/plan logic unchanged.
  Verified before/after on a **throwaway tenant**, never on org `100000` (constraint #3).
- **Cleanup:** all throwaway tenant/user/org/subscription rows deleted after verification (constraint #4).
- **Deploy:** via `moqui-deploy` (`docker compose restart moqui`, never `up -d`) (constraint #5).
- Sign-up is already anonymous today; existing subdomain + email uniqueness guards are retained.

## 6. Error handling

| Situation | Behavior |
|-----------|----------|
| Invalid/expired Google token | "Google sign-in failed, please try again" on `/signin`; email/password still available. |
| `tokeninfo` network failure | Graceful error; email/password fallback unaffected. |
| Google email already has an account | That's **sign-in** — log them in via `internalLoginUser`, not an error. |
| Subdomain already taken | Inline live error from `checkSubdomain` before submit. |
| Provisioning failure | Full rollback (`requireNewTransaction`), error shown, **no partial tenant**. |

## 7. Verification plan (per the `verify` discipline — drive the running app)

1. **Throwaway tenant, email path** — complete the wizard end-to-end; confirm the new org is created, admin can log
   in with email/password, `ACTIVE_ORGANIZATION` is set, and the tenant sees only its own data (ties to the
   org-isolation work).
2. **Throwaway tenant, Google path** — sign up with a real Google account; confirm `internalLoginUser` lands in the
   correct org; confirm returning sign-in with the same Google account logs straight in (no password).
3. **MARUTHI regression** — confirm existing email/password login to org `100000` still works and nothing in its
   provisioning/billing changed.
4. **Render checks** — `/signin` and `/get-started` render unauthenticated (HTTP 200, no screen errors).
5. **Cleanup** — delete every test tenant/user/org/subscription row created; verify 0 leftover.

## 8. Out of scope (YAGNI)

- Inviting a Google user into an **existing** tenant (Google sign-up always creates a *new* tenant; in-app user
  invites remain the existing `Settings/Users` flow).
- Other social providers (Microsoft/Apple).
- Google `refresh`/offline access and any Google API calls beyond identity (that would require Approach C + a secret).
- Local JWT signature verification (Approach B) — recorded as a future hardening step, not built for launch.

## 9. Prerequisite — Google Cloud setup (user action, one-time)

1. Google Cloud Console → create/select a project.
2. **APIs & Services → OAuth consent screen** → External → fill app name, support email, authorized domain
   `zetaclantech.com`.
3. **Credentials → Create credentials → OAuth client ID → Web application.**
4. **Authorized JavaScript origins:** `https://erp.zetaclantech.com` (add the tenant/apex domains used).
5. Copy the **Client ID** (ends in `.apps.googleusercontent.com`) into the platform config setting. No client
   secret is needed for the ID-token flow.
