/* The Quasar mount loads its current URL through setUrl(), which normally pushes
 * a history entry. Replace that initial self-navigation so POS Back/Forward moves
 * between screens once. Restore the native method before subsequent navigation. */
(function () {
    'use strict';
    if (!/^\/qapps\/zenith\/pos(?:\/|$)/.test(location.pathname) || window.__posHistoryBootstrap) return;
    window.__posHistoryBootstrap = true;
    var original = history.pushState;
    history.pushState = function (state, title, url) {
        history.pushState = original;
        var target = new URL(url, location.href);
        if (target.href === location.href) return history.replaceState(state, title, url);
        return original.apply(history, arguments);
    };
})();
