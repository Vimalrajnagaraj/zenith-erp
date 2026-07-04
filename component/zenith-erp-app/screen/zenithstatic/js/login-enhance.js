// ZetaERP /Login enhancements — moved out of Login.xml's inline <img onload> blocks so the JS
// no longer has to avoid double-quotes / '<' (the onload-attribute footgun). Loaded via
// html_scripts.add('/zenithstatic/js/login-enhance.js') from the Login.xml override; the /Login
// page is server-rendered webroot and /zenithstatic resolves there unauthenticated (200, correct
// MIME). Three behaviors: (1) ZE-AUTH-008 double-submit guard, (2) BUG-001 password reveal,
// (3) the Continue-with-Google bootstrap. Each is wrapped in try/catch so one failing can't take
// down the others on this critical page.
(function () {
  'use strict';

  // (1) ZE-AUTH-008 / LOGIN-085 — prevent double-submit + show a working state on slow networks.
  // The login/reset/change forms POST via full-page navigation; on a slow link the user can click
  // Sign in repeatedly, firing a stack of (canceled) requests. First submit wins; the rest are
  // blocked (covers repeated clicks AND Enter). pageshow re-enables after a bfcache Back.
  function initSubmitGuard() {
    function guard(form) {
      if (form.dataset.subGuard) return; form.dataset.subGuard = '1';
      form.addEventListener('submit', function (e) {
        if (form.dataset.submitting) { e.preventDefault(); e.stopPropagation(); return false; }
        form.dataset.submitting = '1';
        var btn = form.querySelector('button[type=submit]');
        if (btn) {
          var label = form.id === 'login_form' ? 'Signing in…' : 'Please wait…';
          if (btn.dataset.orig == null) btn.dataset.orig = btn.innerHTML;
          while (btn.firstChild) btn.removeChild(btn.firstChild);
          var sp = document.createElement('i'); sp.className = 'fa fa-spinner fa-spin'; sp.setAttribute('aria-hidden', 'true');
          btn.appendChild(sp); btn.appendChild(document.createTextNode(' ' + label));
          btn.setAttribute('aria-busy', 'true');
          setTimeout(function () { btn.disabled = true; btn.style.opacity = '0.85'; btn.style.cursor = 'default'; }, 0);
        }
      });
    }
    function reset() {
      [].forEach.call(document.querySelectorAll('form.form-signin'), function (f) {
        f.dataset.submitting = ''; var b = f.querySelector('button[type=submit]');
        if (b) { b.disabled = false; b.style.opacity = ''; b.style.cursor = ''; b.removeAttribute('aria-busy'); if (b.dataset.orig != null) { b.innerHTML = b.dataset.orig; } }
      });
    }
    [].forEach.call(document.querySelectorAll('form.form-signin'), guard);
    window.addEventListener('pageshow', reset);
  }

  // (2) BUG-001 / LOGIN-003 — one consistent app-level show/hide eye on every password field
  // (Chrome shows no native reveal; Edge injects ::-ms-reveal which the inline <style> suppresses).
  function initPwToggle() {
    function add(inp) {
      if (inp.dataset.pwToggle) return; inp.dataset.pwToggle = '1';
      var cm = getComputedStyle(inp).marginBottom;
      var w = document.createElement('div'); w.className = 'pw-toggle-wrap'; w.style.marginBottom = cm;
      inp.parentNode.insertBefore(w, inp); w.appendChild(inp);
      inp.style.setProperty('margin-bottom', '0', 'important');
      inp.style.setProperty('padding-right', '46px', 'important');
      var b = document.createElement('button'); b.type = 'button'; b.className = 'pw-toggle-btn';
      b.setAttribute('aria-label', 'Show password'); b.setAttribute('tabindex', '-1');
      var ic = document.createElement('i'); ic.className = 'fa fa-eye'; b.appendChild(ic); w.appendChild(b);
      b.onclick = function (e) {
        e.preventDefault();
        var show = inp.getAttribute('type') === 'password';
        inp.setAttribute('type', show ? 'text' : 'password');
        ic.className = show ? 'fa fa-eye-slash' : 'fa fa-eye';
        b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      };
    }
    var l = document.querySelectorAll('input[type=password]');
    for (var i = 0; i < l.length; i++) add(l[i]);
  }

  // (3) Continue with Google — only initializes when the GoogleSignInSection actually rendered
  // (a real Client ID is configured). Loads the GSI client and defines the callback that posts the
  // id_token to /Login/googleAuth. zenithGoogleCb is defined BEFORE the GSI script so it exists when
  // GSI (data-callback="zenithGoogleCb") fires. ZE-ONB-001 fallback hint is in the rendered section.
  function initGoogle() {
    if (!document.getElementById('g_id_onload')) return;
    window.zenithGoogleCb = function (resp) {
      fetch('/Login/googleAuth', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'credential=' + encodeURIComponent(resp.credential) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.action === 'login') { location.href = d.redirectUrl; }
          else if (d.action === 'signup') { location.href = '/get-started'; }
          else { alert(d.error || 'Google sign-in failed'); }
        })
        .catch(function () { alert('Google sign-in failed. Please try again.'); });
    };
    if (!document.getElementById('gsiScript')) {
      var s = document.createElement('script'); s.id = 'gsiScript'; s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.defer = true;
      s.onerror = function () { var h = document.getElementById('zenithGoogleHint'); if (h) h.style.color = '#c62828'; };
      document.head.appendChild(s);
    }
  }

  function run() {
    try { initSubmitGuard(); } catch (e) { }
    try { initPwToggle(); } catch (e) { }
    try { initGoogle(); } catch (e) { }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
