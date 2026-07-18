/* ZE-SUB-007 (MS-040): "Pay Now" on My Subscription (TenantDashboard). Loaded on BOTH /apps and the tenant's
 * /vapps|/qapps Quasar shell via an <img onload> bootstrap, because those shells strip <script> from screen
 * content (so the old inline handler was undefined there -> the button did nothing). Fixes two bugs at once:
 *   1. /vapps|/qapps: no handler at all -> bind via DELEGATED click on .saas-pay-btn (native clicks bubble to
 *      document even inside a Quasar q-btn, so no dependency on Vue @click or a rendered <script>).
 *   2. /apps: the old relative URL 'initiatePayment' resolved against /apps/zenith/ (not .../my-subscription/)
 *      -> wrong endpoint. Build the transition URL from the current path so it is correct on every surface and
 *      regardless of a trailing slash.
 * Razorpay checkout.js is injected on demand (also stripped from screen content on the Quasar shells). */
(function () {
  if (window.__saasPayInit) return;
  window.__saasPayInit = true;

  function txnUrl(name, qs) {
    var p = window.location.pathname;
    var marker = '/my-subscription';
    var i = p.indexOf(marker);
    var base = i >= 0 ? p.substring(0, i + marker.length) : p.replace(/\/+$/, '');
    // ALWAYS call the transition on the /apps mount. A transition GET/POST under /vapps|/qapps returns the
    // Vue SPA shell (text/html), not the sendJsonResponse JSON; /apps returns the raw JSON and shares the
    // session, so this works from any surface. (Also fixes the old bug where a relative 'initiatePayment'
    // resolved against /apps/zenith/ instead of .../my-subscription/.)
    base = base.replace(/^\/(vapps|qapps)\//, '/apps/');
    return base + '/' + name + (qs ? ('?' + qs) : '');
  }
  function sessionToken() {
    var el = document.querySelector('[name=moquiSessionToken]');
    return el ? el.value : '';
  }
  function ensureRazorpay(cb) {
    if (window.Razorpay) { cb(); return; }
    var s = document.getElementById('rzp-checkout-js');
    if (s) { s.addEventListener('load', cb); return; }
    s = document.createElement('script');
    s.id = 'rzp-checkout-js';
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = cb;
    s.onerror = function () { window.alert('Could not load the payment gateway. Check your connection and try again.'); };
    document.head.appendChild(s);
  }

  window.initiateSaasPayment = function (invoiceId) {
    if (!invoiceId) return;
    fetch(txnUrl('initiatePayment', 'saasInvoiceId=' + encodeURIComponent(invoiceId)), {
      headers: { 'Accept': 'application/json' }, credentials: 'same-origin'
    }).then(function (r) { return r.json(); }).then(function (data) {
      if (!data || !data.razorpayOrderId) {
        window.alert('Could not start the payment.\n' + ((data && data.errors) || 'Please try again later.'));
        return;
      }
      ensureRazorpay(function () {
        var rzp = new Razorpay({
          key: data.razorpayKeyId,
          amount: data.amount,
          currency: data.currency || 'INR',
          name: 'ZetaERP',
          description: 'Subscription Payment',
          order_id: data.razorpayOrderId,
          prefill: { email: data.adminEmail || '', contact: '' },
          theme: { color: '#1a237e' },
          handler: function (response) {
            var f = document.createElement('form');
            f.method = 'POST';
            f.action = txnUrl('verifyPayment');
            var fields = {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              saasInvoiceId: invoiceId,
              moquiSessionToken: sessionToken()
            };
            Object.keys(fields).forEach(function (k) {
              var inp = document.createElement('input');
              inp.type = 'hidden'; inp.name = k; inp.value = fields[k]; f.appendChild(inp);
            });
            document.body.appendChild(f); f.submit();
          }
        });
        rzp.open();
      });
    }).catch(function () { window.alert('Error connecting to the payment gateway. Please try again.'); });
  };

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('.saas-pay-btn') : null;
    if (!btn) return;
    e.preventDefault();
    window.initiateSaasPayment(btn.getAttribute('data-invoice-id'));
  });
})();
