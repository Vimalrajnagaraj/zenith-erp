/* ZE-DASH-0402 — stop the stock Moqui "Browser notifications disabled, if you want them use browser
   notification settings to allow" toast from nagging on EVERY page load / route change, on EVERY screen.

   Root cause (framework, not app): WebrootVue's Vue `mounted()` hook (both /apps WebrootVue.js and
   /qapps WebrootVue.qvt.js) fires on every mount:
       window.Notification && "granted"!==permission && "denied"!==permission
           && Notification.requestPermission(b => "denied"===b && moqui.notifyMessages("...disabled..."))
   On Safari, a requestPermission() called WITHOUT a user gesture rejects to "denied" in the callback
   while Notification.permission itself stays "default" — so the guard never trips and the info toast
   reappears on every refresh. Dismissal is not persisted anywhere. This ERP wires no notification
   feature to this permission, so the nag has zero value and should only ever appear in context.

   Fix (app-side, framework-update-proof — no minified framework files touched):
     (1) neutralise the auto (non-gesture) requestPermission so it neither prompts nor reports "denied";
     (2) swallow the two permission-status toasts as a belt-and-suspenders backstop.
   A future in-app feature can still prompt from a real user gesture via moqui._realNotifRequest. */
(function () {
  'use strict';
  // (2) Backstop: drop the framework's permission-status toasts if they ever fire.
  try {
    if (window.moqui && typeof window.moqui.notifyMessages === 'function') {
      var _nm = window.moqui.notifyMessages;
      window.moqui.notifyMessages = function (message) {
        try {
          if (typeof message === 'string' && /browser notifications? (are )?(dis|en)abled/i.test(message)) return;
        } catch (e) {}
        return _nm.apply(this, arguments);
      };
    }
  } catch (e) {}
  // (1) Root cause: make an auto (non-gesture) permission request report the current state without
  // prompting, so neither the native prompt nor the "denied" callback (and its toast) fire on load.
  try {
    if (window.Notification && typeof window.Notification.requestPermission === 'function') {
      var _orig = window.Notification.requestPermission.bind(window.Notification);
      window.Notification.requestPermission = function (cb) {
        var perm = 'default';
        try { perm = window.Notification.permission || 'default'; } catch (e) {}
        try { if (typeof cb === 'function') cb(perm); } catch (e) {}
        return (typeof Promise !== 'undefined') ? Promise.resolve(perm) : undefined;
      };
      try { window.moqui = window.moqui || {}; window.moqui._realNotifRequest = _orig; } catch (e) {}
    }
  } catch (e) {}
})();
