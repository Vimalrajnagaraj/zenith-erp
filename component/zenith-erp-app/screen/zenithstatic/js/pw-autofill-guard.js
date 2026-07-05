(function () {
    if (window._zpwGuardLoaded) return;
    window._zpwGuardLoaded = true;

    // ZE-AUTH-001: Moqui's <password> widget renders <input type="password"> with NO autocomplete
    // attribute. On the ERP's password-management forms (Settings > Users "Create User" and "Reset Pwd",
    // and other "choose a password / enter a secret" fields) browsers therefore autofill the field with the
    // signed-in admin's saved site credentials. The masked pre-fill looks like an existing value the admin
    // can neither read nor explain, and on submit it fails the password policy ("Password shorter than 8
    // characters", "needs 1 other character", "Found issues with password so not updating"). This is
    // especially visible for Google sign-up admins, who never set a site password of their own.
    //
    // Every <password> widget in this app is a "choose a NEW password / enter a secret" field — never a
    // login (the Login screen doesn't use this widget and doesn't load this script). So it is always correct
    // to (a) mark the field as a new-password field, which stops the browser offering saved credentials, and
    // (b) clear any value the browser injected before the user has typed, so the field starts empty and the
    // admin types exactly what they intend. Typed input is never touched.
    function harden(el) {
        if (el.__zpwDone) return;
        el.__zpwDone = true;
        el.setAttribute('autocomplete', 'new-password');
        el.setAttribute('autocapitalize', 'off');
        el.setAttribute('autocorrect', 'off');
        el.setAttribute('spellcheck', 'false');
        el.addEventListener('input', function () { el.__zpwTyped = true; });
    }
    function skip(el) {
        // Leave CURRENT-credential fields alone — the browser SHOULD autofill these. The framework's
        // session-expiry re-login modal uses name="password" (the user's current password) and name="code"
        // (a 2FA one-time code). Everything else that is type=password in this app is a "choose a new
        // password / enter a secret" field (newPassword, managerPin, apiSecret, ...), which we harden.
        var n = (el.getAttribute('name') || '').toLowerCase();
        return n === 'password' || n === 'code';
    }
    function clean(el) {
        if (skip(el)) return;
        harden(el);
        // Only clear a browser-injected value while the field is still untouched — never clobber what the
        // admin actually typed.
        if (!el.__zpwTyped && el.value) el.value = '';
    }
    function sweep() {
        var list = document.querySelectorAll('input[type="password"]');
        for (var i = 0; i < list.length; i++) clean(list[i]);
    }

    sweep();
    // Browsers autofill asynchronously and dialog forms mount lazily, so keep sweeping briefly after load.
    var n = 0, iv = setInterval(function () { sweep(); if (++n >= 20) clearInterval(iv); }, 150); // ~3s

    // Catch dialogs opened later (Create User / Reset Pwd) and any re-autofill on focus.
    document.addEventListener('focusin', function (e) {
        var t = e.target;
        if (t && t.tagName === 'INPUT' && t.type === 'password') clean(t);
    });
})();
