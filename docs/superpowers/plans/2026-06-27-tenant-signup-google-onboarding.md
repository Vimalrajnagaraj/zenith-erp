# Branded Login + Google Sign-up/Sign-in + Onboarding Wizard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a branded `/signin` login page and a `/get-started` 3-step onboarding wizard, both supporting "Continue with Google" (sign-up AND passwordless sign-in), wrapping the existing `provision#Tenant` service.

**Architecture:** All new screens are public Moqui screen-XML files in `zenith-erp-saas`, mounted under `component://webroot` via `MoquiConf.xml` screen-facade (same pattern as the existing `saas-public/Signup.xml`). Google uses the Identity Services **ID-token** flow: the browser obtains a signed `id_token`, posts it to a server transition, the server verifies it against Google's `tokeninfo` endpoint, then either logs an existing user in (`ec.user.internalLoginUser`) or routes a new user into the wizard. Email+password login is preserved unchanged.

**Tech Stack:** Moqui 4.0 (XML screens/services/entities, Groovy in `<script>` CDATA), Google Identity Services (client JS), PostgreSQL. No new libraries.

## Global Constraints

- **Live system — never break MARUTHI (org `100000`).** Every change verified before/after on a **throwaway tenant**, never on `100000`. (CLAUDE.md rule #3.)
- **Never expose/secret-log:** Google-account passwords are random and never displayed or logged. (rule #1.)
- **Never fabricate business/legal data:** GSTIN optional, format-validated (15 chars) only — never invented. (rule #2.)
- **Clean up all test data** after verifying. (rule #4.)
- **Deploy only via `moqui-deploy` flow:** upload file → `docker commit` → `cd /opt/deploy/deploy && docker compose restart moqui`. **NEVER `docker compose up -d moqui`.** (rule #5.) Compose lives at `/opt/deploy/deploy/docker-compose.yml`. Server `root@167.233.117.229`, app container `deploy-moqui-1`, db container `deploy-db-1` (psql `moqui`/`moqui`).
- **Edit the local mirror** `C:\Users\ASUS\zenith-erp\component\…` then deploy; `git commit` locally as an undo point per task.
- **Entity package** for SaaS entities is `zenith.erp.saas` (e.g. `zenith.erp.saas.SaasTenant`); the **service package** is `zenith.saas` (e.g. `zenith.saas.SaasServices.provision#Tenant`). Don't mix them up.
- **Platform config** is stored as `zenith.erp.base.CompanySettings` rows with `organizationPartyId='ZETAERP'` + a `settingKey` (existing convention — see `screen/zenith/saas/Settings.xml`). The Google Client ID uses `settingKey='GOOGLE_CLIENT_ID'`.
- **Public screens** set `require-authentication="false"` on `<screen>`; AJAX/callback transitions that must skip CSRF use `require-session-token="false"` (pattern: `Signup.xml:checkSubdomain`).

**Deploy helper (used in every task's verify step).** From `C:\Users\ASUS\zenith-erp`, with `$F` = the component-relative path(s):
```bash
# upload one or more changed files, commit image, restart, poll
printf '%s\n' component/zenith-erp-saas/service/zenith/saas/SaasServices.xml > /tmp/ch.txt   # example
tar czf - -T /tmp/ch.txt | ssh -o StrictHostKeyChecking=no root@167.233.117.229 \
  'docker exec -i deploy-moqui-1 sh -c "tar xzf - -C /opt/moqui/runtime"'
ssh root@167.233.117.229 'docker commit deploy-moqui-1 zetaerp-moqui:latest >/dev/null && cd /opt/deploy/deploy && docker compose restart moqui'
# poll
for i in $(seq 1 40); do c=$(curl -s -k -o /dev/null -w "%{http_code}" -u john.doe:moqui https://erp.zetaclantech.com/apps/zenith); [ "$c" = 200 ] && break; sleep 4; done
```
SQL helper: `ssh root@167.233.117.229 'docker exec -i deploy-db-1 psql -U moqui -d moqui -c "<SQL>"'`.

> **Framework verification note (resolve during Task 3 & Task 6):** Confirm `ec.user.internalLoginUser(String username)` exists in this Moqui 4.0 build (UserFacade SSO login). If the method name differs, the equivalent is `ec.userFacade.internalLoginUser`. Also confirm whether public webroot screens render injected `<script>` tags (Task 4 has a fallback if they're stripped).

---

### Task 1: Platform config for the Google Client ID (+ super-admin UI)

**Files:**
- Modify: `component/zenith-erp-saas/screen/zenith/saas/Settings.xml` (add `GOOGLE_CLIENT_ID` to the `settingKeys` list ~line 27-32; add a "Google Sign-In" card before the closing `</widgets>` ~line 159).

**Interfaces:**
- Produces: a `CompanySettings` row `(organizationPartyId='ZETAERP', settingKey='GOOGLE_CLIENT_ID', settingValue=<client id>)`, read later by Welcome.xml and `verify#GoogleIdToken`.

- [ ] **Step 1: Add the key to the loader list.** In `Settings.xml`, extend the `settingKeys` array:

```groovy
def settingKeys = [
    'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET',
    'SAAS_SMTP_HOST', 'SAAS_SMTP_PORT', 'SAAS_SMTP_USER', 'SAAS_SMTP_PASSWORD',
    'SAAS_FROM_EMAIL', 'SAAS_FROM_NAME',
    'SAAS_OVERDUE_GRACE_DAYS', 'SAAS_TRIAL_REMINDER_DAYS', 'SAAS_RENEWAL_REMINDER_DAYS',
    'GOOGLE_CLIENT_ID'
]
```

- [ ] **Step 2: Add the editor card.** Insert this block immediately before the final `</widgets>`:

```xml
        <!-- Google Sign-In -->
        <container style="zenith-card bg-white shadow-2 border-radius-lg q-pa-lg q-mb-lg">
            <container style="row items-center q-mb-md">
                <render-mode><text type="html"><![CDATA[<q-icon name="login" class="text-primary q-mr-sm"/>]]></text></render-mode>
                <label text="Google Sign-In" type="h6" style="text-weight-bold"/>
            </container>
            <form-single name="GoogleClientIdForm" transition="saveSetting">
                <field name="settingKey"><default-field><hidden default-value="GOOGLE_CLIENT_ID"/></default-field></field>
                <field name="settingValue"><default-field title="Google OAuth Client ID">
                    <text-line size="60" default-value="${settings['GOOGLE_CLIENT_ID']}"/>
                    <label text="Web client ID from Google Cloud Console (ends in .apps.googleusercontent.com). Public-safe. No client secret needed." style="text-grey-6 text-caption" type="p"/>
                </default-field></field>
                <field name="submitBtn"><default-field title=""><submit text="Save"/></default-field></field>
            </form-single>
        </container>
```

- [ ] **Step 3: Deploy** `component/zenith-erp-saas/screen/zenith/saas/Settings.xml` (deploy helper).

- [ ] **Step 4: Verify render + save.** Render the super-admin settings screen and confirm 200 + the new field:
```bash
curl -s -k -u john.doe:moqui "https://erp.zetaclantech.com/apps/zenith/saas-admin/Settings" | grep -ci "Google OAuth Client ID"   # expect >=1
```
Then save a placeholder value through the form (or directly, to test the read path) and confirm the row:
```bash
ssh root@167.233.117.229 'docker exec -i deploy-db-1 psql -U moqui -d moqui -c "INSERT INTO company_settings (organization_party_id,setting_key,setting_value,last_updated_stamp) VALUES ('"'"'ZETAERP'"'"','"'"'GOOGLE_CLIENT_ID'"'"','"'"'PLACEHOLDER.apps.googleusercontent.com'"'"',now()) ON CONFLICT (organization_party_id,setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value;"'
ssh root@167.233.117.229 'docker exec -i deploy-db-1 psql -U moqui -d moqui -t -c "SELECT setting_value FROM company_settings WHERE organization_party_id='"'"'ZETAERP'"'"' AND setting_key='"'"'GOOGLE_CLIENT_ID'"'"';"'
```
Expected: the placeholder value prints. (Leave the placeholder in place; Task 6 replaces it with the real Client ID.)

- [ ] **Step 5: Commit.**
```bash
git add component/zenith-erp-saas/screen/zenith/saas/Settings.xml docs/superpowers/plans/2026-06-27-tenant-signup-google-onboarding.md
git commit -m "feat(saas): super-admin field to store Google OAuth Client ID"
```

---

### Task 2: Extend `provision#Tenant` for Google (additive: optional password + googleSub)

**Files:**
- Modify: `component/zenith-erp-saas/service/zenith/saas/SaasServices.xml` (the `provision#Tenant` service, lines ~6-175).

**Interfaces:**
- Consumes: nothing new.
- Produces: `provision#Tenant` now accepts optional `googleSub` (String) and tolerates a blank `adminPassword` (generates a random one). When `googleSub` is set, writes a `UserPreference (preferenceKey='GOOGLE_SUB', preferenceValue=googleSub)` for the new user. Existing callers (`Signup.xml`) are unaffected.

- [ ] **Step 1: Make `adminPassword` optional and add `googleSub`.** Change the in-parameter (line ~15) and add a new one:

```xml
            <parameter name="adminPassword"><description>Optional. If blank (Google sign-up), a random password is generated.</description></parameter>
            <parameter name="googleSub"><description>Optional. Google account subject id; binds this account to a Google identity for passwordless login.</description></parameter>
```

- [ ] **Step 2: Generate a random password when blank.** Immediately before the "Create admin user account" service-call (line ~64), insert:

```xml
            <!-- Passwordless (Google) sign-up: synthesize a strong random password the user never sees. -->
            <if condition="!adminPassword">
                <script>adminPassword = (java.util.UUID.randomUUID().toString() + java.util.UUID.randomUUID().toString()).replace('-','')</script>
            </if>
```
(The existing `create#UserAccount` call already uses `newPassword:adminPassword` / `newPasswordVerify:adminPassword`, so no change there.)

- [ ] **Step 3: Record the Google binding.** Immediately after the `ACTIVE_ORGANIZATION` UserPreference create (line ~88), insert:

```xml
            <!-- Bind this account to its Google identity (used for passwordless sign-in). -->
            <if condition="googleSub">
                <service-call name="create#moqui.security.UserPreference"
                    in-map="[userId:userId, preferenceKey:'GOOGLE_SUB', preferenceValue:googleSub]"/>
            </if>
```

- [ ] **Step 4: Deploy** `SaasServices.xml` (deploy helper).

- [ ] **Step 5: Verify on a THROWAWAY tenant (Google path).** Provision a throwaway tenant with no password + a googleSub via a one-off Moqui service call (run through the existing anonymous service using `curl` against the Moqui service REST is awkward; instead use a transient SQL-free check by invoking through the screen in Task 5). For this task, verify directly with a scratch service call over SSH using Moqui's `ServiceJob`-free runner is not available, so verify via the DB after Task 5's wizard run. **Minimal check now:** confirm the service still loads and the email/password path is intact by re-rendering `/signup` (which calls `provision#Tenant` indirectly only on submit) and confirming 200:
```bash
curl -s -k -o /dev/null -w "%{http_code}\n" "https://erp.zetaclantech.com/signup"   # expect 200
```
(Full provisioning behavior — including the `GOOGLE_SUB` row and random password — is exercised end-to-end in Task 5 Step 6 on a throwaway tenant, with SQL assertions and cleanup there.)

- [ ] **Step 6: Commit.**
```bash
git add component/zenith-erp-saas/service/zenith/saas/SaasServices.xml
git commit -m "feat(saas): provision#Tenant supports passwordless Google sign-up (optional password + googleSub binding)"
```

---

### Task 3: Google identity services — `verify#GoogleIdToken`, `authenticate#GoogleUser`

**Files:**
- Modify: `component/zenith-erp-saas/service/zenith/saas/SaasServices.xml` (append two services after `provision#Tenant`).

**Interfaces:**
- Consumes: `CompanySettings[ZETAERP, GOOGLE_CLIENT_ID]` (Task 1); `provision#Tenant` is not called here.
- Produces:
  - `verify#GoogleIdToken(idToken) -> {email, firstName, lastName, googleSub, verified(boolean)}` — errors if invalid.
  - `authenticate#GoogleUser(idToken) -> {action('login'|'signup'), redirectUrl, email, firstName, lastName, googleSub}`. On `login` it has already established the session. On `signup` it has stashed `googleIdentity` in the HTTP session.

- [ ] **Step 1: Add `verify#GoogleIdToken`.** Append inside `<services>`:

```xml
    <!-- ==================== GOOGLE IDENTITY ==================== -->
    <service verb="verify" noun="GoogleIdToken" authenticate="anonymous-all">
        <description>Verifies a Google Identity Services id_token server-side via Google's tokeninfo endpoint.</description>
        <in-parameters><parameter name="idToken" required="true"/></in-parameters>
        <out-parameters>
            <parameter name="verified" type="Boolean"/>
            <parameter name="email"/><parameter name="firstName"/><parameter name="lastName"/><parameter name="googleSub"/>
        </out-parameters>
        <actions>
            <script><![CDATA[
                import groovy.json.JsonSlurper
                context.verified = false
                // Our expected audience = configured Google Web Client ID
                def cfg = ec.entity.find("zenith.erp.base.CompanySettings")
                    .condition("organizationPartyId","ZETAERP").condition("settingKey","GOOGLE_CLIENT_ID").one()
                def expectedAud = cfg?.settingValue
                if (!expectedAud) { ec.message.addError("Google sign-in is not configured."); return }

                def url = new URL("https://oauth2.googleapis.com/tokeninfo?id_token=" + java.net.URLEncoder.encode(idToken, "UTF-8"))
                def conn = (java.net.HttpURLConnection) url.openConnection()
                conn.setRequestMethod("GET"); conn.setConnectTimeout(5000); conn.setReadTimeout(5000)
                def code = conn.responseCode
                if (code != 200) { ec.message.addError("Could not verify Google sign-in. Please try again."); return }
                def body = conn.inputStream.getText("UTF-8")
                def claims = new JsonSlurper().parseText(body)

                def iss = claims.iss
                if (iss != "accounts.google.com" && iss != "https://accounts.google.com") { ec.message.addError("Invalid Google token issuer."); return }
                if (claims.aud != expectedAud) { ec.message.addError("Google token was issued for a different application."); return }
                def expSec = (claims.exp ?: "0") as long
                if (expSec * 1000L < System.currentTimeMillis()) { ec.message.addError("Google sign-in expired. Please try again."); return }
                if (!("true".equals(String.valueOf(claims.email_verified)))) { ec.message.addError("Your Google email is not verified."); return }

                context.email = claims.email
                context.firstName = claims.given_name ?: ""
                context.lastName = claims.family_name ?: ""
                context.googleSub = claims.sub
                context.verified = true
            ]]></script>
        </actions>
    </service>
```

- [ ] **Step 2: Add `authenticate#GoogleUser`.** Append after it:

```xml
    <service verb="authenticate" noun="GoogleUser" authenticate="anonymous-all">
        <description>Verifies a Google id_token, then logs in an existing user or routes a new one to onboarding.</description>
        <in-parameters><parameter name="idToken" required="true"/></in-parameters>
        <out-parameters>
            <parameter name="action"/><parameter name="redirectUrl"/>
            <parameter name="email"/><parameter name="firstName"/><parameter name="lastName"/><parameter name="googleSub"/>
        </out-parameters>
        <actions>
            <service-call name="zenith.saas.SaasServices.verify#GoogleIdToken" out-map="vf"
                in-map="[idToken:idToken]"/>
            <if condition="ec.message.hasError() || !vf.verified"><return/></if>
            <set field="email" from="vf.email"/><set field="firstName" from="vf.firstName"/>
            <set field="lastName" from="vf.lastName"/><set field="googleSub" from="vf.googleSub"/>

            <entity-find-one entity-name="moqui.security.UserAccount" value-field="ua">
                <field-map field-name="username" from="email"/>
            </entity-find-one>
            <if condition="ua">
                <!-- Returning user: passwordless SSO login -->
                <script>ec.user.internalLoginUser(email)</script>
                <set field="action" value="login"/>
                <set field="redirectUrl" value="/apps/zenith"/>
                <else>
                    <!-- New user: stash verified identity for the onboarding wizard -->
                    <script>
                        ec.web.session.setAttribute("googleIdentity",
                            [email:email, firstName:firstName, lastName:lastName, googleSub:googleSub])
                    </script>
                    <set field="action" value="signup"/>
                    <set field="redirectUrl" value="/get-started"/>
                </if>
            </if>
        </actions>
    </service>
```

- [ ] **Step 3: Add a temporary `googleAuth` test transition to `Signup.xml`** (so the services are reachable for a bad-token smoke test before Welcome.xml exists). Insert after `checkSubdomain` (line ~54):

```xml
    <transition name="googleAuth" require-session-token="false">
        <actions>
            <script>ec.artifactExecution.disableAuthz()</script>
            <service-call name="zenith.saas.SaasServices.authenticate#GoogleUser" out-map="ga" in-map="[idToken:credential]"/>
            <script>
                if (ec.message.hasError()) { def em = ec.message.errorsString; ec.message.clearErrors(); ec.web.sendJsonResponse([action:'error', error:em]) }
                else { ec.web.sendJsonResponse([action:ga.action, redirectUrl:ga.redirectUrl]) }
            </script>
        </actions>
        <default-response type="none"/>
    </transition>
```

- [ ] **Step 4: Deploy** `SaasServices.xml` and `Signup.xml` (deploy helper, both paths in `/tmp/ch.txt`).

- [ ] **Step 5: Verify graceful failure on a bogus token.**
```bash
curl -s -k "https://erp.zetaclantech.com/signup/googleAuth" --data "credential=not-a-real-token"
```
Expected JSON: `{"action":"error","error":"...Could not verify Google sign-in..."}` (HTTP 200, graceful — NOT a stack trace). This exercises `authenticate#GoogleUser → verify#GoogleIdToken → tokeninfo` (Google returns non-200 for a junk token) and confirms the config lookup + error path work.

- [ ] **Step 6: Remove the temporary transition.** Delete the `googleAuth` transition from `Signup.xml` (it belongs on Welcome.xml, added in Task 4). Re-deploy `Signup.xml`.

- [ ] **Step 7: Commit.**
```bash
git add component/zenith-erp-saas/service/zenith/saas/SaasServices.xml component/zenith-erp-saas/screen/saas-public/Signup.xml
git commit -m "feat(saas): verify#GoogleIdToken + authenticate#GoogleUser (server-side token verification, passwordless login)"
```

---

### Task 4: Branded `/signin` page (Welcome.xml) — email/password + Google + Create account

**Files:**
- Create: `component/zenith-erp-saas/screen/saas-public/Welcome.xml`
- Modify: `component/zenith-erp-saas/MoquiConf.xml` (mount `signin` under webroot).

**Interfaces:**
- Consumes: `CompanySettings[ZETAERP, GOOGLE_CLIENT_ID]`; `authenticate#GoogleUser` (Task 3); Moqui `ec.user.loginUser`.
- Produces: the `/signin` screen with a `login` transition (email/password) and a `googleAuth` transition (Google), and a link to `/get-started`.

- [ ] **Step 1: Create Welcome.xml.**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<screen xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:noNamespaceSchemaLocation="http://moqui.org/xsd/xml-screen-3.xsd"
        require-authentication="false" default-menu-include="false">

    <transition name="login" require-session-token="true">
        <actions>
            <script><![CDATA[
                boolean ok = ec.user.loginUser(username, password)
                if (!ok) { ec.message.addError("Invalid email or password.") }
            ]]></script>
        </actions>
        <default-response url="/apps/zenith"/>
        <error-response url="."/>
    </transition>

    <transition name="googleAuth" require-session-token="false">
        <actions>
            <script>ec.artifactExecution.disableAuthz()</script>
            <service-call name="zenith.saas.SaasServices.authenticate#GoogleUser" out-map="ga" in-map="[idToken:credential]"/>
            <script>
                if (ec.message.hasError()) { def em = ec.message.errorsString; ec.message.clearErrors(); ec.web.sendJsonResponse([action:'error', error:em]) }
                else { ec.web.sendJsonResponse([action:ga.action, redirectUrl:ga.redirectUrl]) }
            </script>
        </actions>
        <default-response type="none"/>
    </transition>

    <actions>
        <script><![CDATA[
            boolean alreadyDisabled = ec.artifactExecution.disableAuthz()
            try {
                def cfg = ec.entity.find("zenith.erp.base.CompanySettings")
                    .condition("organizationPartyId","ZETAERP").condition("settingKey","GOOGLE_CLIENT_ID").one()
                context.googleClientId = cfg?.settingValue ?: ""
            } finally { if (!alreadyDisabled) ec.artifactExecution.enableAuthz() }
            context.sessionToken = ec.web.sessionToken
        ]]></script>
    </actions>

    <widgets>
        <container style="row justify-center q-pa-xl">
            <container style="col-4 bg-white shadow-2 border-radius-lg q-pa-xl">
                <label text="Welcome to ZetaERP" type="h4" style="text-weight-bold q-mb-xs"/>
                <label text="Sign in to your workspace" type="p" style="text-grey-7 q-mb-lg"/>

                <!-- Google button + GIS -->
                <render-mode><text type="html"><![CDATA[
                    <div id="g_id_onload" data-client_id="${googleClientId}" data-callback="zenithGoogleCb" data-auto_prompt="false"></div>
                    <div class="g_id_signin" data-type="standard" data-size="large" data-width="320" style="margin-bottom:16px"></div>
                    <img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" style="display:none"
                         onload="(function(){
                            if(!document.getElementById('gsiScript')){var s=document.createElement('script');s.id='gsiScript';s.src='https://accounts.google.com/gsi/client';s.async=true;s.defer=true;document.head.appendChild(s);}
                            window.zenithSessTok='${sessionToken}';
                            window.zenithGoogleCb=function(resp){
                              fetch('signin/googleAuth',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
                                body:'credential='+encodeURIComponent(resp.credential)})
                              .then(function(r){return r.json();})
                              .then(function(d){ if(d.action==='login'){location.href=d.redirectUrl;} else if(d.action==='signup'){location.href='/get-started';} else {alert(d.error||'Google sign-in failed');} })
                              .catch(function(){alert('Google sign-in failed. Please try again.');});
                            };
                         })()"/>
                    <div style="text-align:center;color:#9e9e9e;margin:8px 0">or</div>
                ]]></text></render-mode>

                <form-single name="LoginForm" transition="login">
                    <field name="username"><default-field title="Email"><text-line size="32"/></default-field></field>
                    <field name="password"><default-field title="Password"><password size="32"/></default-field></field>
                    <field name="submitBtn"><default-field title=""><submit text="Sign In" type="primary"/></default-field></field>
                </form-single>

                <container style="text-center q-mt-lg">
                    <label text="New to ZetaERP? " style="text-grey-7"/>
                    <link url="/get-started" text="Create an account" link-type="anchor"/>
                </container>
            </container>
        </container>
    </widgets>
</screen>
```

- [ ] **Step 2: Mount `/signin`.** In `MoquiConf.xml`, add inside the webroot `<screen location="component://webroot/screen/webroot.xml">` block:

```xml
            <subscreens-item name="signin" location="component://zenith-erp-saas/screen/saas-public/Welcome.xml"
                menu-include="false"/>
```

- [ ] **Step 3: Deploy** `Welcome.xml` and `MoquiConf.xml`. (MoquiConf changes require the restart that the deploy helper already does.)

- [ ] **Step 4: Verify render.**
```bash
curl -s -k -o /dev/null -w "%{http_code}\n" "https://erp.zetaclantech.com/signin"          # expect 200
curl -s -k "https://erp.zetaclantech.com/signin" | grep -ci "g_id_onload"                    # expect >=1 (Google button present)
curl -s -k "https://erp.zetaclantech.com/signin" | grep -ci "Create an account"              # expect >=1
```
If `g_id_onload` is absent, the webroot context stripped the HTML island — check the render output and, if `<script>`/markup is stripped, the `<img onload>` bootstrap (already used above, per the qapps gotcha in CLAUDE.md) is the mitigation; confirm the `onload` attribute survived.

- [ ] **Step 5: Verify email/password login still works (regression).** Drive the running login form with a known throwaway/test credential (NOT MARUTHI). Using `john.doe`:
```bash
# follow the login transition; a correct login should redirect (302/200 into /apps/zenith), a wrong one should re-render with the error
curl -s -k -i -c /tmp/jar.txt "https://erp.zetaclantech.com/signin" >/dev/null   # get session + token
# (manual/browser check recommended for the full POST round-trip incl. moquiSessionToken)
```
Browser check: open `https://erp.zetaclantech.com/signin`, log in with a valid test account → lands in `/apps/zenith`; wrong password → "Invalid email or password." on the same page. Confirm the **existing** stock `/Login` still works too (unchanged).

- [ ] **Step 6: Commit.**
```bash
git add component/zenith-erp-saas/screen/saas-public/Welcome.xml component/zenith-erp-saas/MoquiConf.xml
git commit -m "feat(saas): branded /signin page (email+password, Continue with Google, Create account)"
```

---

### Task 5: Onboarding wizard `/get-started` (Onboarding.xml)

**Files:**
- Create: `component/zenith-erp-saas/screen/saas-public/Onboarding.xml`
- Modify: `component/zenith-erp-saas/MoquiConf.xml` (mount `get-started`).

**Interfaces:**
- Consumes: session `googleIdentity` (set by `authenticate#GoogleUser`); `provision#Tenant` (with `googleSub`); reuses the `checkSubdomain` pattern.
- Produces: the `/get-started` wizard; a `register` transition that provisions the tenant and logs the user in.

- [ ] **Step 1: Create Onboarding.xml** (3 client-side steps in one form; single final POST). Google identity (if present) pre-fills + locks name/email and carries `googleSub`; otherwise the admin-account fields are shown.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<screen xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:noNamespaceSchemaLocation="http://moqui.org/xsd/xml-screen-3.xsd"
        require-authentication="false" default-menu-include="false">

    <transition name="checkSubdomain" read-only="true" require-session-token="false">
        <actions>
            <script>ec.artifactExecution.disableAuthz()</script>
            <entity-find-count entity-name="zenith.erp.saas.SaasTenant" count-field="cnt">
                <econdition field-name="subdomain" from="sub"/>
            </entity-find-count>
            <script>ec.web.sendJsonResponse([available: cnt == 0])</script>
        </actions>
        <default-response type="none"/>
    </transition>

    <transition name="register" require-session-token="true">
        <actions>
            <script><![CDATA[
                def gid = ec.web.session.getAttribute("googleIdentity")
                def gstinClean = gstin?.trim()?.toUpperCase()
                if (gstinClean && gstinClean.length() != 15) { ec.message.addError("GSTIN must be exactly 15 characters, or leave it blank."); return }
                // Identity: from Google if present, else from the form
                def fName = gid?.firstName ?: adminFirstName
                def lName = gid?.lastName ?: adminLastName
                def email = gid?.email ?: adminEmail
                def gsub = gid?.googleSub
                def pwd = gid ? null : adminPassword   // Google = passwordless; email signup keeps its password
                boolean alreadyDisabled = ec.artifactExecution.disableAuthz()
                try {
                    def result = ec.service.sync().name("zenith.saas.SaasServices.provision#Tenant")
                        .parameters([tenantName:tenantName, subdomain:subdomain, countryGeoId:countryGeoId,
                            industryEnumId:industryEnumId, adminFirstName:fName, adminLastName:lName,
                            adminEmail:email, adminPhone:adminPhone, adminPassword:pwd, planId:planId,
                            gstin:gstinClean, googleSub:gsub])
                        .disableAuthz().requireNewTransaction(true).call()
                    if (ec.message.hasError()) return
                    context.putAll(result)
                    ec.web.session.removeAttribute("googleIdentity")
                    // Log the new user straight in (passwordless for Google; for email signup we have the password)
                    if (gid) { ec.user.internalLoginUser(email) } else { ec.user.loginUser(email, adminPassword) }
                } finally { if (!alreadyDisabled) ec.artifactExecution.enableAuthz() }
            ]]></script>
        </actions>
        <default-response url="/apps/zenith"/>
        <error-response url="."/>
    </transition>

    <actions>
        <script><![CDATA[
            boolean alreadyDisabled = ec.artifactExecution.disableAuthz()
            try {
                planList = ec.entity.find("zenith.erp.saas.SaasPlan").condition("isActive","Y").orderBy("sortOrder").list()
                countryList = ec.entity.find("zenith.erp.base.CountryConfiguration").orderBy("countryName").list()
                industryList = ec.entity.find("moqui.basic.Enumeration").condition("enumTypeId","TenantIndustry").orderBy("sequenceNum").list()
            } finally { if (!alreadyDisabled) ec.artifactExecution.enableAuthz() }
            context.googleIdentity = ec.web.session.getAttribute("googleIdentity")
        ]]></script>
    </actions>

    <widgets>
        <container style="row justify-center q-pa-lg">
            <container style="col-7 bg-white shadow-2 border-radius-lg q-pa-xl">
                <label text="Set up your workspace" type="h4" style="text-weight-bold q-mb-xs"/>
                <label text="${googleIdentity ? ('Signed in as ' + googleIdentity.email + ' — just a few business details.') : 'Create your ZetaERP account.'}" type="p" style="text-grey-7 q-mb-lg"/>

                <form-single name="OnboardForm" transition="register">
                    <!-- STEP 1: Company basics -->
                    <field name="step1hdr"><default-field title=""><label text="1. Company" type="h6" style="text-weight-bold text-primary"/></default-field></field>
                    <field name="tenantName"><default-field title="Business Name"><text-line size="40"/></default-field></field>
                    <field name="subdomain"><default-field title="Workspace URL (.zetaclantech.com)">
                        <text-line size="25"/>
                        <label text="Also your Organization ID for login (uppercase)." style="text-grey-6 text-caption" type="p"/>
                    </default-field></field>
                    <field name="countryGeoId"><default-field title="Country">
                        <drop-down no-current-selected-key="IND"><list-options list="countryList" key="${countryGeoId}" text="${countryName}"/></drop-down>
                    </default-field></field>
                    <field name="industryEnumId"><default-field title="Industry">
                        <drop-down no-current-selected-key="TiRetailGeneral"><list-options list="industryList" key="${enumId}" text="${description}"/></drop-down>
                    </default-field></field>

                    <!-- Admin account: only when NOT coming from Google -->
                    <field name="adminFirstName"><conditional-field condition="!googleIdentity" title="First Name"><text-line size="20"/></conditional-field></field>
                    <field name="adminLastName"><conditional-field condition="!googleIdentity" title="Last Name"><text-line size="20"/></conditional-field></field>
                    <field name="adminEmail"><conditional-field condition="!googleIdentity" title="Email (your login)"><text-line size="30"/></conditional-field></field>
                    <field name="adminPassword"><conditional-field condition="!googleIdentity" title="Password (min 8 characters)"><password size="20"/></conditional-field></field>
                    <field name="adminPhone"><default-field title="Phone"><text-line size="15"/></default-field></field>

                    <!-- STEP 2: Tax -->
                    <field name="step2hdr"><default-field title=""><label text="2. Tax (optional)" type="h6" style="text-weight-bold text-primary q-mt-md"/></default-field></field>
                    <field name="gstin"><default-field title="GSTIN (optional)">
                        <text-line size="20"/>
                        <label text="15-character GST number (India). Sets your state for CGST/SGST vs IGST. Leave blank if not registered." style="text-grey-6 text-caption" type="p"/>
                    </default-field></field>

                    <!-- STEP 3: Plan -->
                    <field name="step3hdr"><default-field title=""><label text="3. Plan" type="h6" style="text-weight-bold text-primary q-mt-md"/></default-field></field>
                    <field name="planId"><default-field title="Plan">
                        <drop-down no-current-selected-key="STARTER"><list-options list="planList" key="${planId}" text="${planName} (${maxUsers} users, ${maxPosTerminals} POS)"/></drop-down>
                    </default-field></field>

                    <field name="submitBtn"><default-field title=""><submit text="Create workspace &amp; start free trial" type="success" icon="fa fa-rocket"/></default-field></field>
                </form-single>

                <container style="text-center q-mt-md">
                    <label text="Already have an account? " style="text-grey-7"/>
                    <link url="/signin" text="Sign in" link-type="anchor"/>
                </container>
            </container>
        </container>
    </widgets>
</screen>
```

> Note: this renders the three groups as labeled sections in one validated form (Moqui form-single). True step-by-step show/hide can be layered on later with a small JS island; the single-submit, server-validated structure is what guarantees we never create a half-provisioned tenant. If the brainstorm's literal "wizard stepper" UX is required for launch, add a JS island that toggles `display` on fieldsets by `data-step` — but keep the single final POST.

- [ ] **Step 2: Mount `/get-started`.** Add to the webroot block in `MoquiConf.xml`:

```xml
            <subscreens-item name="get-started" location="component://zenith-erp-saas/screen/saas-public/Onboarding.xml"
                menu-include="false"/>
```

- [ ] **Step 3: Deploy** `Onboarding.xml` + `MoquiConf.xml`.

- [ ] **Step 4: Verify render.**
```bash
curl -s -k -o /dev/null -w "%{http_code}\n" "https://erp.zetaclantech.com/get-started"     # expect 200
curl -s -k "https://erp.zetaclantech.com/get-started" | grep -ci "Set up your workspace"    # expect >=1
curl -s -k "https://erp.zetaclantech.com/get-started/checkSubdomain?sub=maruthi"            # expect {"available":false} (subdomain in use)
curl -s -k "https://erp.zetaclantech.com/get-started/checkSubdomain?sub=zztest$(date +%s)"  # expect {"available":true}
```

- [ ] **Step 5: Verify the EMAIL path end-to-end on a THROWAWAY tenant (browser).** Open `/get-started`, fill company + a unique subdomain (e.g. `zztest01`) + admin name/email/password + plan → submit → lands in `/apps/zenith`. Then assert + capture the new tenant:
```bash
ssh root@167.233.117.229 'docker exec -i deploy-db-1 psql -U moqui -d moqui -c "SELECT tenant_id,organization_party_id,admin_user_id,admin_email FROM saas_tenant WHERE subdomain='"'"'zztest01'"'"';"'
```
Confirm: a `saas_tenant` row, a `user_account` with `username=<that email>`, and `user_preference(ACTIVE_ORGANIZATION)` for that user.

- [ ] **Step 6: Verify the GOOGLE provision path (service-level, throwaway) — proves Task 2's googleSub/passwordless.** Drive `provision#Tenant` with a googleSub and no password through a temporary anonymous transition or, simplest, assert it via the wizard once Google is live in Task 6. Minimal SQL assertion if you provisioned a Google-style tenant by hand in Task 6: 
```bash
ssh root@167.233.117.229 'docker exec -i deploy-db-1 psql -U moqui -d moqui -c "SELECT preference_value FROM user_preference WHERE user_id=(SELECT admin_user_id FROM saas_tenant WHERE subdomain='"'"'zztest01'"'"') AND preference_key='"'"'GOOGLE_SUB'"'"';"'
```

- [ ] **Step 7: CLEAN UP the throwaway tenant.** Delete every row created (rule #4). Capture the ids first, then delete children→parents:
```bash
ssh root@167.233.117.229 'docker exec -i deploy-db-1 psql -U moqui -d moqui <<SQL
\set sub '"'"'zztest01'"'"'
SELECT tenant_id, organization_party_id, admin_user_id FROM saas_tenant WHERE subdomain=:'"'"'sub'"'"';
SQL'
```
Then delete (replace ORG/USER/TENANT with the captured ids): `saas_audit_log`, `saas_subscription`, `saas_tenant`, `pos_receipt_template`, `india_gstin`/`india_gst_config`, `company_settings` (the org's), `facility` (owner=org), `user_group_member`(user), `user_group`(TENANT_ZZTEST01), `user_preference`(user), `party_relationship`(person↔org), `user_account`(user), `party_identification`+`party`(org + person). **Verify 0 leftover** with the `saas_tenant` count for that subdomain returning 0. (Scripted cleanup in Task 6 Step 5.)

- [ ] **Step 8: Commit.**
```bash
git add component/zenith-erp-saas/screen/saas-public/Onboarding.xml component/zenith-erp-saas/MoquiConf.xml
git commit -m "feat(saas): /get-started onboarding wizard (company/tax/plan), Google-aware, single-submit provisioning"
```

---

### Task 6: Make `/signin` the login entry + live Google end-to-end + cleanup

**Files:**
- Modify: `component/zenith-erp-saas/MoquiConf.xml` and/or `component/zenith-erp-app/screen/zenith/ZenithApp.xml` (login-destination override — mechanism chosen by verification).

**Interfaces:**
- Consumes: everything above; the real Google Client ID (user-provided).

- [ ] **Step 1: User provides the real Google Client ID** (Google Cloud Console → OAuth consent screen → Credentials → Web client ID; Authorized JS origin `https://erp.zetaclantech.com`). Save it via the super-admin Settings screen (Task 1), replacing the placeholder. Confirm:
```bash
ssh root@167.233.117.229 'docker exec -i deploy-db-1 psql -U moqui -d moqui -t -c "SELECT setting_value FROM company_settings WHERE organization_party_id='"'"'ZETAERP'"'"' AND setting_key='"'"'GOOGLE_CLIENT_ID'"'"';"'   # ends in .apps.googleusercontent.com
```

- [ ] **Step 2: Determine + apply the login-destination override.** Try in order; stop at the first that works:
  1. **Moqui login-screen config:** check for a webapp `login` setting in the framework `MoquiConf` (search the container `/opt/moqui/runtime/conf/MoquiDevConf.xml` / `MoquiProductionConf.xml` for `login` / `<webapp`); if present, point it at `/signin`.
  2. **Redirect from stock `/Login`:** if (1) isn't exposed, the always-works fallback is a tiny screen-facade override or a redirect so unauthenticated users land on `/signin`. Verify the inspection:
```bash
ssh root@167.233.117.229 'docker exec -i deploy-moqui-1 sh -c "ls /opt/moqui/runtime/conf && grep -ril login /opt/moqui/runtime/conf 2>/dev/null"'
```
  Apply the chosen mechanism, deploy, and verify an unauthenticated request to a protected page lands on `/signin`:
```bash
curl -s -k -i "https://erp.zetaclantech.com/apps/zenith" | grep -iE "location:|/signin|/Login"
```

- [ ] **Step 3: Live Google sign-UP on a throwaway tenant (browser).** At `/signin` click "Continue with Google", pick a Google account whose email is NOT an existing user → routed to `/get-started` with name/email pre-filled → complete company/tax/plan → lands in `/apps/zenith`. Assert:
```bash
ssh root@167.233.117.229 'docker exec -i deploy-db-1 psql -U moqui -d moqui -c "SELECT t.subdomain,t.admin_email,p.preference_value AS google_sub FROM saas_tenant t JOIN user_preference p ON p.user_id=t.admin_user_id AND p.preference_key='"'"'GOOGLE_SUB'"'"' WHERE t.subdomain='"'"'zzgoogle01'"'"';"'
```
Confirm a `GOOGLE_SUB` row exists and `user_account` for that email has a (random) password hash set.

- [ ] **Step 4: Live Google sign-IN (returning user).** Log out, return to `/signin`, click "Continue with Google" with the **same** account → logs straight into `/apps/zenith` (no wizard, no password). This exercises the `authenticate#GoogleUser` → `internalLoginUser` branch.

- [ ] **Step 5: MARUTHI regression + CLEAN UP all throwaway tenants.**
  - Regression: confirm an existing MARUTHI user can still log in via email/password at `/signin` AND the stock path; nothing about org `100000` changed.
  - Cleanup script (run for each throwaway subdomain `zztest01`, `zzgoogle01`): capture ids then delete in FK-safe order and assert 0 leftover:
```bash
ssh root@167.233.117.229 'docker exec -i deploy-db-1 psql -U moqui -d moqui -v ON_ERROR_STOP=1 <<SQL
DO $$
DECLARE v_sub text := '"'"'zzgoogle01'"'"'; v_org text; v_user text; v_tenant text; v_person text;
BEGIN
  SELECT organization_party_id, admin_user_id, tenant_id INTO v_org, v_user, v_tenant FROM saas_tenant WHERE subdomain=v_sub;
  IF v_tenant IS NULL THEN RAISE NOTICE '"'"'no such tenant'"'"'; RETURN; END IF;
  SELECT party_id INTO v_person FROM user_account WHERE user_id=v_user;
  DELETE FROM saas_audit_log WHERE tenant_id=v_tenant;
  DELETE FROM saas_subscription WHERE tenant_id=v_tenant;
  DELETE FROM saas_tenant WHERE tenant_id=v_tenant;
  DELETE FROM pos_receipt_template WHERE organization_party_id=v_org;
  DELETE FROM india_gstin WHERE party_id=v_org;
  DELETE FROM india_gst_config WHERE organization_party_id=v_org;
  DELETE FROM company_settings WHERE organization_party_id=v_org;
  DELETE FROM facility WHERE owner_party_id=v_org;
  DELETE FROM user_group_member WHERE user_id=v_user;
  DELETE FROM user_group WHERE user_group_id='"'"'TENANT_'"'"'||upper(v_sub);
  DELETE FROM user_preference WHERE user_id=v_user;
  DELETE FROM party_relationship WHERE to_party_id=v_org OR from_party_id=v_person;
  DELETE FROM user_account WHERE user_id=v_user;
  DELETE FROM party_identification WHERE party_id=v_org;
  DELETE FROM party_role WHERE party_id IN (v_org, v_person);
  DELETE FROM party WHERE party_id IN (v_org, v_person);
  RAISE NOTICE '"'"'cleaned %'"'"', v_sub;
END $$;
SELECT count(*) AS leftover FROM saas_tenant WHERE subdomain='"'"'zzgoogle01'"'"';
SQL'
```
  Expected final: `leftover = 0`. Repeat for every throwaway subdomain created. (Adjust table list if any FK error names another child table — delete it first.)

- [ ] **Step 6: Final render sweep + commit.**
```bash
for p in signin get-started; do curl -s -k -o /dev/null -w "$p %{http_code}\n" "https://erp.zetaclantech.com/$p"; done   # both 200
git add component/zenith-erp-saas/MoquiConf.xml component/zenith-erp-app/screen/zenith/ZenithApp.xml
git commit -m "feat(saas): make /signin the login entry; live Google sign-up/sign-in verified"
```

---

## Self-Review

**Spec coverage:**
- Branded `/signin` replacing stock login → Task 4 + Task 6 Step 2. ✓
- Email+password preserved → Task 4 `login` transition + Task 6 Step 5 regression. ✓
- Google sign-up AND sign-in (passwordless) → Tasks 3 (`authenticate#GoogleUser` branches) + 6 Steps 3-4. ✓
- 3-step onboarding wizard wrapping `provision#Tenant` → Task 5. ✓
- ID-token flow, Client ID only, no secret → Task 1 (config) + Task 3 (`verify#GoogleIdToken`, `aud` check). ✓
- `provision#Tenant` additive (googleSub/passwordless), non-destructive → Task 2. ✓
- Client ID in super-admin Settings, editable w/o redeploy → Task 1 (uses `CompanySettings[ZETAERP]`, a refinement over the spec's entity idea — same intent). ✓
- Security: server-side verify, `aud`/`iss`/`exp`/`email_verified`, random passwords never surfaced → Task 3. ✓
- Error handling (invalid token graceful, existing email = sign-in, subdomain taken, rollback) → Task 3 Step 5, Task 5 Step 4, `provision#Tenant` `requireNewTransaction`. ✓
- Verification on throwaway tenant + cleanup, never MARUTHI → Tasks 5-6. ✓
- Google Cloud setup prerequisite → Task 6 Step 1. ✓

**Open verification items (flagged, not placeholders):** (a) `ec.user.internalLoginUser` method name in this Moqui build — Task 3 note; (b) whether webroot renders the HTML/script island vs needs the `<img onload>` bootstrap — Task 4 Step 4 (mitigation already in the code); (c) exact login-destination override mechanism — Task 6 Step 2 (ordered attempts with an always-works fallback). These are framework facts discoverable only against the running system; each has a concrete resolution path.

**Type consistency:** service names (`zenith.saas.SaasServices.{provision#Tenant, verify#GoogleIdToken, authenticate#GoogleUser}`), entity packages (`zenith.erp.saas.*`, `zenith.erp.base.CompanySettings`, `moqui.security.{UserAccount,UserPreference,UserGroup,UserGroupMember}`), session key `googleIdentity`, preference keys `ACTIVE_ORGANIZATION`/`GOOGLE_SUB`, and the `{action, redirectUrl}` JSON contract are consistent across Tasks 3-6.
