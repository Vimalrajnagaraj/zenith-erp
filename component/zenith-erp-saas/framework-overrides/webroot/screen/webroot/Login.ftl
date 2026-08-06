<style>
/* Zenith Login Page Inline Overrides */
body.Login {
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%) !important;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
    min-height: 100vh;
    min-height: -webkit-fill-available;
    margin: 0;
    padding: 0;
    overflow-x: hidden;
    -webkit-text-size-adjust: 100%;
}

#content.Login {
    background: transparent !important;
    display: flex !important;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 100vh;
    min-height: -webkit-fill-available;
    padding: 20px;
    box-sizing: border-box;
}

.login-card {
    background: #ffffff;
    width: 100%;
    max-width: 440px;
    border-radius: 16px;
    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
    padding: 40px;
    position: relative;
    z-index: 10;
    box-sizing: border-box;
}

.Login .form-signin {
    max-width: none !important;
    margin: 0 !important;
    background: transparent !important;
    padding: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    backdrop-filter: none !important;
}

/* Tabs */
.login-card .nav-tabs {
    list-style: none !important;
    padding: 0 !important;
    border-bottom: 2px solid #f1f5f9;
    margin-bottom: 30px;
    display: flex;
    justify-content: space-between;
    gap: 0;
}
.login-card .nav-tabs > li {
    flex: 1;
    text-align: center;
    min-width: 0;
}
.login-card .nav-tabs > li > a {
    display: block;
    text-decoration: none;
    border: none;
    color: #64748b;
    font-weight: 600;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 12px 5px;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    border-radius: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color 0.2s ease;
    -webkit-tap-highlight-color: transparent;
}
.login-card .nav-tabs > li > a:hover {
    background: transparent !important;
    color: #3b82f6 !important;
    box-shadow: none !important;
}
.login-card .nav-tabs > li.active > a {
    background: transparent !important;
    color: #0E63D6 !important;
    border-bottom: 2px solid #0E63D6 !important;
    box-shadow: none !important;
}

/* Tab Panes */
.tab-content > .tab-pane { display: none; }
.tab-content > .active { display: block; }
.hidden { display: none !important; }

/* Inputs */
.login-card input:not([type="checkbox"]), .login-card .form-control {
    display: block !important;
    width: 100% !important;
    box-sizing: border-box !important;
    border-radius: 10px !important;
    border: 1px solid #cbd5e1 !important;
    padding: 14px 18px !important;
    font-size: 16px !important;
    margin-bottom: 16px !important;
    height: auto !important;
    background: #f8fafc !important;
    color: #334155 !important;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    box-shadow: inset 0 1px 2px rgba(0,0,0,0.02) !important;
    -webkit-appearance: none;
    appearance: none;
}
.login-card input:not([type="checkbox"]):focus, .login-card .form-control:focus {
    border-color: #3b82f6 !important;
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15) !important;
    background: #ffffff !important;
    outline: none !important;
}

.login-card input[type="checkbox"] {    -webkit-appearance: checkbox !important;    appearance: checkbox !important;    width: 16px !important;    height: 16px !important;    margin: 0 8px 0 0 !important;    padding: 0 !important;    border-radius: 3px !important;    border: 1px solid #cbd5e1 !important;    background: #ffffff !important;    cursor: pointer;    accent-color: #0E63D6;    display: inline-block !important;    vertical-align: middle;    margin-bottom: 0 !important;    font-size: inherit !important;}
/* Buttons */
.login-card .btn-block { display: block !important; width: 100% !important; box-sizing: border-box !important; }
.login-card .btn-primary {
    background: #0E63D6 !important; color: #ffffff !important; border: none !important;
    border-radius: 10px !important; padding: 14px !important; font-weight: 600 !important;
    font-size: 16px !important; letter-spacing: 0.5px;
    transition: background 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease;
    margin-top: 10px; cursor: pointer;
    -webkit-appearance: none; appearance: none;
    -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
.login-card .btn-primary:hover {
    background: #0B4FB0 !important; transform: translateY(-2px);
    box-shadow: 0 8px 15px rgba(14, 99, 214, 0.3) !important;
}
.login-card .btn-primary:active {
    transform: translateY(0) !important; box-shadow: 0 2px 6px rgba(14, 99, 214, 0.2) !important;
}
.login-card .btn-danger {
    background: #ef4444 !important; color: #ffffff !important; border: none !important;
    border-radius: 10px !important; padding: 14px !important; font-weight: 600 !important;
    font-size: 16px !important; letter-spacing: 0.5px;
    transition: background 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease;
    margin-top: 10px; cursor: pointer;
    -webkit-appearance: none; appearance: none;
    -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
.login-card .btn-danger:hover {
    background: #dc2626 !important; transform: translateY(-2px);
    box-shadow: 0 8px 15px rgba(239, 68, 68, 0.3) !important;
}
.login-card .btn-danger:active {
    transform: translateY(0) !important; box-shadow: 0 2px 6px rgba(239, 68, 68, 0.2) !important;
}

/* Logo */
.login-logo { text-align: center; margin-bottom: 30px; }
.login-logo h1 { font-size: 28px; font-weight: 800; color: #0f172a; margin: 0; letter-spacing: -0.5px; }
.login-logo p { color: #64748b; font-size: 14px; margin-top: 5px; }

/* Test Login Button */
#TestLoginLink {
    position: fixed !important; bottom: 20px !important; left: 50% !important;
    transform: translateX(-50%) !important; z-index: 9999 !important;
}
.Login #TestLoginLink_button {
    background: rgba(255, 255, 255, 0.15) !important; backdrop-filter: blur(5px);
    border: 1px solid rgba(255, 255, 255, 0.3) !important; color: white !important;
    padding: 10px 24px !important; border-radius: 50px !important; font-weight: 500 !important;
    font-size: 14px !important; cursor: pointer !important;
    transition: background 0.2s ease !important; box-shadow: 0 4px 6px rgba(0,0,0,0.1) !important;
    -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
.Login #TestLoginLink_button:hover { background: rgba(255, 255, 255, 0.25) !important; }

/* ===== MOBILE: Tablets and below (600px) ===== */
@media screen and (max-width: 600px) {
    #content.Login { padding: 16px; align-items: flex-start; padding-top: max(16px, env(safe-area-inset-top, 16px)); }
    .login-card { padding: 28px 22px; border-radius: 14px; max-width: 100%; box-shadow: 0 15px 35px rgba(0,0,0,0.25); }
    .login-logo { margin-bottom: 22px; }
    .login-logo svg { height: 48px !important; }
    .login-logo p { font-size: 13px; }
    .login-card .nav-tabs { margin-bottom: 22px; }
    .login-card .nav-tabs > li > a { font-size: 11.5px; padding: 10px 4px; letter-spacing: 0.3px; }
    .login-card input:not([type="checkbox"]), .login-card .form-control { padding: 13px 14px !important; margin-bottom: 14px !important; border-radius: 8px !important; }
    .login-card .btn-primary, .login-card .btn-danger { padding: 13px !important; font-size: 15px !important; border-radius: 8px !important; }
    .login-card .btn-primary:hover, .login-card .btn-danger:hover { transform: none !important; box-shadow: none !important; }
    #TestLoginLink { bottom: max(12px, env(safe-area-inset-bottom, 12px)) !important; }
    .Login #TestLoginLink_button { padding: 8px 20px !important; font-size: 13px !important; }
    .login-card label { font-size: 13px !important; }
    .text-muted.text-center { font-size: 13px; }
    #browser-warning .row { flex-wrap: wrap; }
    #browser-warning .row .col-sm-2 { width: 25%; flex: 0 0 25%; }
}

/* ===== MOBILE: Very small phones (360px) ===== */
@media screen and (max-width: 360px) {
    #content.Login { padding: 12px; }
    .login-card { padding: 22px 16px; border-radius: 12px; }
    .login-logo svg { height: 40px !important; }
    .login-logo p { font-size: 12px; }
    .login-card .nav-tabs > li > a { font-size: 10px; padding: 8px 2px; letter-spacing: 0; }
    .login-card input:not([type="checkbox"]), .login-card .form-control { padding: 12px 12px !important; margin-bottom: 12px !important; }
    .login-card .btn-primary, .login-card .btn-danger { padding: 12px !important; font-size: 14px !important; }
}

/* ===== Landscape phones ===== */
@media screen and (max-height: 500px) and (orientation: landscape) {
    #content.Login { align-items: flex-start; padding-top: 8px; }
    .login-card { padding: 20px 24px; }
    .login-logo { margin-bottom: 12px; }
    .login-logo svg { height: 36px !important; }
    .login-logo p { display: none; }
    .login-card .nav-tabs { margin-bottom: 12px; }
    .login-card input:not([type="checkbox"]), .login-card .form-control { margin-bottom: 10px !important; padding: 10px 14px !important; }
    .login-card .btn-primary, .login-card .btn-danger { padding: 10px !important; margin-top: 6px; }
    #TestLoginLink { display: none !important; }
}

/* ===== PWA standalone mode ===== */
@media (display-mode: standalone) {
    #content.Login { padding-top: max(24px, env(safe-area-inset-top, 24px)); }
    #TestLoginLink { bottom: max(20px, env(safe-area-inset-bottom, 20px)) !important; }
}

/* ===== iOS safe areas ===== */
@supports (padding: max(0px)) {
    #content.Login {
        padding-left: max(16px, env(safe-area-inset-left, 16px));
        padding-right: max(16px, env(safe-area-inset-right, 16px));
    }
}

/* ===== Reduced motion ===== */
@media (prefers-reduced-motion: reduce) {
    .login-card input, .login-card .form-control,
    .login-card .btn-primary, .login-card .btn-danger,
    .login-card .nav-tabs > li > a { transition: none !important; }
}

/* ===== DARK MODE (system preference) ===== */
@media (prefers-color-scheme: dark) {
    body.Login { background: linear-gradient(135deg, #050510 0%, #0A0A1A 100%) !important; }
    .login-card {
        background: #1A1A28 !important;
        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.6) !important;
        border: 1px solid #2A2A3A;
    }
    .login-logo p { color: #8B8FA4 !important; }
    .login-logo svg text { fill: #E2E4EA !important; }
    .login-logo svg text tspan { fill: #4D9BF5 !important; }
    .login-card .nav-tabs { border-bottom-color: #2A2A3A !important; }
    .login-card .nav-tabs > li > a { color: #8B8FA4 !important; }
    .login-card .nav-tabs > li > a:hover { color: #4D9BF5 !important; }
    .login-card .nav-tabs > li.active > a { color: #4D9BF5 !important; border-bottom-color: #4D9BF5 !important; }
    .login-card input:not([type="checkbox"]), .login-card .form-control {
        background: #12121E !important;
        border-color: #2A2A3A !important;
        color: #E2E4EA !important;
    }
    .login-card input:not([type="checkbox"]):focus, .login-card .form-control:focus {
        border-color: #4D9BF5 !important;
        box-shadow: 0 0 0 4px rgba(77, 155, 245, 0.15) !important;
        background: #1A1A28 !important;
    }
    .login-card input::placeholder { color: #5A5A72 !important; }
    .login-card input[type="checkbox"] { background: #252532 !important; border-color: #3A3A4A !important; accent-color: #4D9BF5; }
    .login-card .btn-primary {
        background: #2E86EE !important;
    }
    .login-card .btn-primary:hover { background: #0B4FB0 !important; }
    .login-card .btn-danger { background: #DC2626 !important; }
    .login-card .btn-danger:hover { background: #B91C1C !important; }
    .login-card label { color: #8B8FA4 !important; }
    .login-card .text-muted { color: #6B6B82 !important; }
    .login-card .text-warning { color: #FBBF24 !important; }
    .login-card .btn-block:not(.btn-primary):not(.btn-danger) {
        background: #252532 !important; color: #E2E4EA !important; border-color: #2A2A3A !important;
    }
    #browser-warning h4 { color: #F87171 !important; }
    #browser-warning a { color: #4D9BF5 !important; }
}
</style>
<div id="browser-warning" class="hidden text-center" style="margin-bottom: 80px;">
    <h4 class="text-danger">Your browser is not supported, please use a recent version of one of the following:</h4>
    <div class="row" style="font-size: 4em;">
        <div class="col-sm-2"></div>
        <div class="col-sm-2"><a href="https://www.google.com/chrome/"><i class="fa fa-chrome"></i></a></div>
        <div class="col-sm-2"><a href="https://www.mozilla.org/firefox/"><i class="fa fa-firefox"></i></a></div>
        <div class="col-sm-2"><a href="https://www.apple.com/safari/"><i class="fa fa-safari"></i></a></div>
        <div class="col-sm-2"><a href="https://www.microsoft.com/windows/microsoft-edge"><i class="fa fa-edge"></i></a></div>
        <div class="col-sm-2"></div>
    </div>
</div>
<script>
    var UA = window.navigator.userAgent.toLowerCase();
    var isIE = UA && /msie|trident/.test(UA);
    if (isIE) $("#browser-warning").removeClass("hidden");
</script>

<div class="login-card">
    <div class="login-logo">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 56" style="height: 56px; margin-bottom: 10px;">
          <defs><linearGradient id="zg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#22B6F2"/><stop offset="52%" style="stop-color:#1663D8"/><stop offset="100%" style="stop-color:#0A2A7A"/></linearGradient></defs>
          <rect x="2" y="4" width="48" height="48" rx="12" fill="url(#zg)"/>
          <text x="26" y="37" font-family="'Segoe UI',Inter,-apple-system,sans-serif" font-size="22" font-weight="800" letter-spacing="-1.5" fill="#fff" text-anchor="middle">ZC</text>
          <text x="62" y="38" font-family="Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="32" font-weight="700" fill="#10233F">Zeta<tspan fill="#0E63D6">ERP</tspan></text>
        </svg>
        <p>Sign in to your enterprise account</p>
    </div>

    <ul class="nav nav-tabs" role="tablist">
        <li role="presentation"><a href="#login" aria-controls="login" role="tab" data-toggle="tab">${ec.l10n.localize("Login")}</a></li>
        <#if authFlowList?has_content && !authFlowList.isEmpty()><li role="presentation"><a href="#sso" aria-controls="sso" role="tab" data-toggle="tab">${ec.l10n.localize("SSO")}</a></li></#if>
        <li role="presentation"><a href="#reset" aria-controls="reset" role="tab" data-toggle="tab">${ec.l10n.localize("Reset")}</a></li>
        <li role="presentation"><a href="#change" aria-controls="change" role="tab" data-toggle="tab">${ec.l10n.localize("Change")}</a></li>
    </ul>
<div class="tab-content">
    <div id="login" class="tab-pane active">
        <form method="post" action="${sri.buildUrl("login").url}" class="form-signin" id="login_form">
            <input type="hidden" name="initialTab" value="login">
            <input id="login_form_organizationId" name="organizationId" type="text"
                    required="required" class="form-control top"
                    placeholder="${ec.l10n.localize("Organization ID")}" aria-label="${ec.l10n.localize("Organization ID")}">
            <input id="login_form_username" name="username" type="text" value="${(username!"")?html}"
                    <#if username?has_content && secondFactorRequired>disabled="disabled"</#if>
                    required="required" class="form-control middle"
                    placeholder="${ec.l10n.localize("Username")}" aria-label="${ec.l10n.localize("Username")}">
            <#if secondFactorRequired>
                <input id="login_form_code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code"
                       required="required" class="form-control bottom"
                       placeholder="${ec.l10n.localize("Authentication Code")}" aria-label="${ec.l10n.localize("Authentication Code")}">
            <#else>
                <input type="password" name="password" required="required" class="form-control bottom"
                       placeholder="${ec.l10n.localize("Password")}" aria-label="${ec.l10n.localize("Password")}">
            </#if>
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
                <label style="display:flex; align-items:center; cursor:pointer; font-size:14px; color:#64748b; margin:0; font-weight:400;">
                    <input type="checkbox" name="rememberMe" value="true" style="width:auto !important; margin:0 8px 0 0 !important; padding:0 !important; accent-color:#0E63D6;">
                    ${ec.l10n.localize("Remember me")}
                </label>
            </div>
            <button class="btn btn-lg btn-primary btn-block" type="submit">${ec.l10n.localize("Sign in")}</button>
            <#if expiredCredentials><p class="text-warning text-center">WARNING: Your password has expired</p></#if>
            <#if passwordChangeRequired><p class="text-warning text-center">WARNING: Password change required</p></#if>
        </form>
        <p style="text-align:center; margin-top:18px; font-size:14px; color:#64748b;">
            New to ZetaERP? <a href="/signup" style="color:#0E63D6; font-weight:600; text-decoration:none;">Create an account</a>
        </p>
    </div>
    <#if authFlowList?has_content && !authFlowList.isEmpty()>
        <div id="sso" class="tab-pane">
            <#list authFlowList as authFlow>
                <form method="post" action="/sso/login" class="form-signin">
                    <input type="hidden" name="authFlowId" value="${authFlow.authFlowId}">
                    <button class="btn btn-lg btn-primary btn-block" type="submit">${authFlow.description}</button>
                </form>
            </#list>
        </div>
    </#if>
    <div id="reset" class="tab-pane">
        <form method="post" action="${sri.buildUrl("resetPassword").url}" class="form-signin" id="reset_form">
            <p class="text-muted text-center">${ec.l10n.localize("Enter your username to email a reset password")}</p>
            <input type="hidden" name="moquiSessionToken" value="${ec.web.sessionToken}">
            <input type="hidden" name="initialTab" value="reset">
            <input id="reset_form_username" name="username" type="text" value="${(username!"")?html}"
                    <#if username?has_content && secondFactorRequired>disabled="disabled"</#if>
                    required="required" class="form-control"
                    placeholder="${ec.l10n.localize("Username")}" aria-label="${ec.l10n.localize("Username")}">
            <button class="btn btn-lg btn-danger btn-block" type="submit">${ec.l10n.localize("Email Reset Password")}</button>
        </form>
    </div>
    <div id="change" class="tab-pane">
        <form method="post" action="${sri.buildUrl("changePassword").url}" class="form-signin" id="change_form">
            <p class="text-muted text-center">${ec.l10n.localize("Enter details to change your password")}</p>
            <input type="hidden" name="moquiSessionToken" value="${ec.web.sessionToken}">
            <input type="hidden" name="initialTab" value="change">
            <input id="change_form_username" name="username" type="text" value="${(username!"")?html}"
                    <#if username?has_content && secondFactorRequired>disabled="disabled"</#if>
                    required="required" class="form-control top"
                    placeholder="${ec.l10n.localize("Username")}" aria-label="${ec.l10n.localize("Username")}">
            <#if secondFactorRequired>
                <input type="hidden" name="oldPassword" value="ignored">
                <input id="change_form_code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code"
                        required="required" class="form-control middle"
                        placeholder="${ec.l10n.localize("Authentication Code")}" aria-label="${ec.l10n.localize("Authentication Code")}">
            <#else>
                <input type="password" name="oldPassword" required="required" class="form-control middle"
                        placeholder="${ec.l10n.localize("Old Password")}" aria-label="${ec.l10n.localize("Old Password")}">
            </#if>
            <input type="password" name="newPassword" required="required" class="form-control middle"
                    placeholder="${ec.l10n.localize("New Password")}" aria-label="${ec.l10n.localize("New Password")}">
            <input type="password" name="newPasswordVerify" required="required" class="form-control bottom"
                    placeholder="${ec.l10n.localize("New Password Verify")}" aria-label="${ec.l10n.localize("New Password Verify")}">
            <button class="btn btn-lg btn-danger btn-block" type="submit">${ec.l10n.localize("Change Password")}</button>
            <p class="text-muted text-center">Password must be at least ${minLength} characters
                with at least <strong>${minDigits} number<#if (minDigits > 1)>s</#if></strong>
                <#if (minOthers > 0)> and at least <strong>${minOthers} punctuation character<#if (minOthers > 1)>s</#if></strong></#if></p>
        </form>
    </div>
</div>
</div>

<#if secondFactorRequired>
    <p class="text-center">${ec.l10n.localize("An authentication code is required for your account, you have these options:")}</p>
    <ul class="form-signin" style="padding-left:40px;">
        <#list factorTypeDescriptions as factorType>
            <li>${factorType}</li>
        </#list>
    </ul>
    <#list sendableFactors as userAuthcFactor>
        <div class="text-center">
            <form method="post" action="${sri.buildUrl("sendOtp").url}" class="form-signin">
                <input type="hidden" name="factorId" value="${userAuthcFactor.factorId}">
                <input type="hidden" name="moquiSessionToken" value="${ec.web.sessionToken}">
                <input type="hidden" name="initialTab" class="initial-tab">
                <button class="btn btn-lg btn-primary" type="submit">${ec.l10n.localize("Send code to")} ${userAuthcFactor.factorOption!}</button>
            </form>
        </div>
    </#list>
</#if>

<#if (ec.web.sessionAttributes.get("moquiPreAuthcUsername"))?has_content>
    <form method="post" action="${sri.buildUrl("removePreAuth").url}" class="form-signin" id="remove_preauth_form">
        <input type="hidden" name="moquiSessionToken" value="${ec.web.sessionToken}">
        <button class="btn btn-lg btn-block" type="submit">${ec.l10n.localize("Change User")}</button>
    </form>
</#if>

<script>
$(function () {
    $('.nav-tabs a').click(function(e) {
        e.preventDefault();
        $('.nav-tabs li').removeClass('active');
        $('.tab-pane').removeClass('active');
        var targetId = $(this).attr('href');
        $(this).closest('li').addClass('active');
        $(targetId).addClass('active');
        window.location.hash = targetId;
        var tabName = targetId.slice(1);
        $('.initial-tab').val(tabName);
        <#if username?has_content && secondFactorRequired>
            if (tabName === "login") { $("#login_form_code").focus(); }
            else if (tabName === "change") { $("#change_form_code").focus(); }
            else if (tabName === "reset") { $("#reset_form_username").focus(); }
        <#else>
            if (tabName === "login") { $("#login_form_username").focus(); }
            else if (tabName === "change") { $("#change_form_username").focus(); }
            else if (tabName === "reset") { $("#reset_form_username").focus(); }
        </#if>
    });
    var initialTabHash = location.hash || '${initialTab!"#login"}';
    if (!$('.nav-tabs a[href="' + initialTabHash + '"]').length) { initialTabHash = "#login"; }
    $('.nav-tabs a[href="' + initialTabHash + '"]').click();
});
</script>
