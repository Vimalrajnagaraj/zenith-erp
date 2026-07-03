/* ZE-TAX-010 — never expose raw backend exception details to end users.
 *
 * Wraps Moqui's core client error handler (moqui.handleAjaxError). When a request
 * fails with a server error (HTTP status >= 500) whose response body has NO
 * structured user messages (messageInfos / errors / validationErrors), we show a
 * single generic message instead of the raw exception / stack / internal path.
 *
 * Everything else is delegated to the original handler untouched, so:
 *   - real validation & business messages (structured) still display normally,
 *   - 401 (re-login) and 0 (no connection) behaviour is preserved,
 *   - the server still logs the full technical detail.
 *
 * Loaded app-wide after WebrootVue(.qvt); works on both /apps and /qapps because
 * it wraps the shared global moqui.handleAjaxError.
 */
(function () {
    if (typeof moqui === 'undefined' || typeof moqui.handleAjaxError !== 'function') return;
    if (moqui._zenithErrorWrapped) return;
    moqui._zenithErrorWrapped = true;

    var GENERIC = "Something went wrong on our end. Please try again — if the problem continues, contact support.";
    var orig = moqui.handleAjaxError;

    moqui.handleAjaxError = function (jqXHR, textStatus, errorThrown, responseText) {
        try {
            // Let the original handle blob decoding (it re-invokes this with responseText set).
            var isBlobPending = jqXHR && jqXHR.responseType === 'blob' && !responseText;
            if (jqXHR && jqXHR.status >= 500 && !isBlobPending) {
                var resp = responseText || jqXHR.responseText;
                var respObj = null;
                try { respObj = JSON.parse(resp); } catch (e) { /* body is not JSON (e.g. a raw exception dump) */ }
                var hasStructured = respObj && moqui.isPlainObject && moqui.isPlainObject(respObj) &&
                    (respObj.messageInfos || respObj.errors || respObj.validationErrors);
                if (!hasStructured) {
                    // preserve the CSRF-token refresh the qvt client performs on error responses
                    if (moqui.webrootVue && moqui.webrootVue.getCsrfToken) {
                        try { moqui.webrootVue.getCsrfToken(jqXHR); } catch (e2) { /* ignore */ }
                    }
                    moqui.notifyMessages(null, GENERIC);
                    if (typeof console !== 'undefined' && console.warn) {
                        console.warn('server error ' + jqXHR.status + ' (' + textStatus + '): ' + errorThrown);
                    }
                    return;
                }
            }
        } catch (e) {
            /* on any wrapper failure, fall through to the original handler */
        }
        return orig.apply(this, arguments);
    };
})();
