/* One display-only clock per page, anchored to the server and the signed-in timezone. */
(function () {
    'use strict';
    if (window.__posClockStarted) return;
    window.__posClockStarted = true;
    var active, epoch, started, timeFormat, dateFormat;
    function tick() {
        var clock = document.getElementById('nb-clock');
        if (!clock) { active = null; return; }
        if (clock !== active) {
            var value = Number(clock.dataset.serverEpoch);
            if (!Number.isFinite(value)) return;
            try {
                timeFormat = new Intl.DateTimeFormat('en-US', {timeZone:clock.dataset.timeZone, hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true});
                dateFormat = new Intl.DateTimeFormat('en-GB', {timeZone:clock.dataset.timeZone, day:'2-digit', month:'2-digit', year:'numeric'});
            } catch (error) { return; }
            active = clock; epoch = value; started = performance.now();
        }
        var now = new Date(epoch + performance.now() - started);
        clock.textContent = timeFormat.format(now);
        var date = document.getElementById('nb-date');
        if (date) date.textContent = dateFormat.format(now).replaceAll('/', '-');
    }
    tick();
    setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
}());
