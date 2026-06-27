# Framework overrides (drift-guard)

These files are deployed to FRAMEWORK paths inside the running container, NOT loaded from this
component. They live here only so the change is version-controlled and re-deployable (e.g. after a
Moqui upgrade that resets the stock files).

## webroot/screen/webroot/Login.xml
- Deploy target (container): `/opt/moqui/runtime/base-component/webroot/screen/webroot/Login.xml`
- Change: ADDITIVE "Continue with Google" on the stock /Login page — a `googleAuth` transition
  (calls `zenith.saas.SaasServices.authenticate#GoogleUser`), a `googleClientId` load from
  `CompanySettings[ZETAERP, GOOGLE_CLIENT_ID]`, and a `GoogleSignInSection` widget shown ONLY when a
  real Client ID is configured. Existing password/2FA/reset/org-id/remember-me flows are untouched.
- `Login.original.xml` is the pre-change stock file (instant rollback: deploy it to the same path).
- Redeploy: `cat Login.xml | ssh root@<server> 'docker exec -i deploy-moqui-1 sh -c "cat > /opt/moqui/runtime/base-component/webroot/screen/webroot/Login.xml"'` then commit image + restart.
