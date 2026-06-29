/* Renders the AI Copilot widget in the qapps Quasar SPA.
   The markup in ZenithApp.xml lives in a <render-mode type="html"> block which
   the qapps (qvt) renderer ignores, and there is no base positioning CSS for the
   widget in any stylesheet qapps loads. So this injects BOTH the DOM and a
   self-contained <style> via plain JS (works in /apps and /qapps). It skips if
   the classic html-mode widget is already present, to avoid a double-render.
   The theme's mobile/print "#ai-copilot-container{display:none!important}" rules
   still apply (so it stays hidden on phones/print). */
(function() {
    if (window._zenithCopilotLoaded) return;

    var CSS =
        '#ai-copilot-container{position:fixed;bottom:24px;right:24px;z-index:9999;font-family:inherit;}' +
        '#ai-copilot-toggle{background:#1a237e;color:#fff;border:none;border-radius:24px;padding:10px 18px;cursor:pointer;box-shadow:0 3px 12px rgba(0,0,0,.3);font-size:14px;font-weight:600;display:inline-flex;align-items:center;gap:6px;}' +
        '#ai-copilot-toggle:hover{background:#283593;}' +
        '#ai-copilot-window{position:absolute;bottom:56px;right:0;width:340px;max-width:90vw;height:460px;background:#fff;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.28);flex-direction:column;overflow:hidden;}' +
        '#ai-copilot-window .chat-header{background:#1a237e;color:#fff;padding:12px 16px;font-weight:bold;flex:0 0 auto;}' +
        '#ai-copilot-window .chat-history{flex:1 1 auto;overflow-y:auto;padding:12px;background:#f6f7fb;}' +
        '#ai-copilot-window .msg{margin-bottom:8px;padding:8px 11px;border-radius:9px;font-size:13px;line-height:1.45;max-width:85%;word-wrap:break-word;}' +
        '#ai-copilot-window .msg.ai{background:#eceffc;}' +
        '#ai-copilot-window .msg.user{background:#1a237e;color:#fff;margin-left:auto;}' +
        '#ai-copilot-window .msg.error{background:#fdecea;color:#b71c1c;}' +
        '#ai-copilot-window .chat-input-area{display:flex;gap:6px;padding:8px;border-top:1px solid #eee;background:#fff;flex:0 0 auto;}' +
        '#ai-copilot-window #copilot-input{flex:1;border:1px solid #ccc;border-radius:6px;padding:9px;font-size:13px;}' +
        '#ai-copilot-window #copilot-send{background:#1a237e;color:#fff;border:none;border-radius:6px;padding:9px 16px;cursor:pointer;font-weight:600;}' +
        'body.body--dark #ai-copilot-window{background:#1e1e2a;}' +
        'body.body--dark #ai-copilot-window .chat-history{background:#161620;}' +
        'body.body--dark #ai-copilot-window .msg.ai{background:#2a2a3a;color:#eee;}' +
        'body.body--dark #ai-copilot-window .chat-input-area{background:#1e1e2a;border-top-color:#333;}' +
        'body.body--dark #ai-copilot-window #copilot-input{background:#161620;color:#eee;border-color:#444;}';

    function injectStyle() {
        if (document.getElementById("zenith-copilot-style")) return;
        var st = document.createElement("style");
        st.id = "zenith-copilot-style";
        st.textContent = CSS;
        document.head.appendChild(st);
    }

    function wire() {
        var toggle = document.getElementById("ai-copilot-toggle");
        var win = document.getElementById("ai-copilot-window");
        var input = document.getElementById("copilot-input");
        var send = document.getElementById("copilot-send");
        var hist = document.getElementById("copilot-history");
        if (!toggle || !win || !input || !send || !hist) return;

        toggle.addEventListener("click", function() {
            var shown = win.style.display === "flex";
            win.style.display = shown ? "none" : "flex";
            if (!shown) input.focus();
        });

        function fmt(text) {
            var e = String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            e = e.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
            e = e.replace(/(^|\n)\s*[\*\-]\s+/g, "$1\u2022 ");
            e = e.replace(/\n/g, "<br>");
            return e;
        }
        function append(cls, who, text, color) {
            var d = document.createElement("div");
            d.className = "msg " + cls;
            if (color) d.style.color = color;
            var b = document.createElement("b"); b.textContent = who + ": ";
            d.appendChild(b);
            var span = document.createElement("span");
            span.innerHTML = fmt(text);
            d.appendChild(span);
            hist.appendChild(d);
            hist.scrollTop = hist.scrollHeight;
        }

        function ask() {
            var q = input.value;
            if (!q) return;
            append("user", "You", q);
            input.value = "";
            var appRoot = (window.moqui && window.moqui.webrootVue && window.moqui.webrootVue.appRootPath) || "";
            fetch(appRoot + "/apps/zenith/askCopilot?query=" + encodeURIComponent(q), {
                method: "GET",
                headers: { "Accept": "application/json" },
                credentials: "same-origin"
            })
            .then(function(r) { return r.json(); })
            .then(function(res) { append("ai", "Copilot", res.response || res.errors || "(no response)"); })
            .catch(function() { append("error", "Error", "Could not reach AI service.", "red"); });
        }

        send.addEventListener("click", ask);
        input.addEventListener("keypress", function(e) {
            if (e.which === 13 || e.keyCode === 13) { ask(); e.preventDefault(); }
        });
    }

    /* Make the Copilot FAB draggable by its toggle button, remembering the spot.
       Click still opens the panel (a real drag is suppressed so it doesn't toggle).
       Works for mouse + touch, in both /apps and /qapps. */
    function makeDraggable(container, handle) {
        if (!container || !handle || container._copilotDrag) return;
        container._copilotDrag = true;
        var KEY = "zenithCopilotPos";
        var dragging = false, moved = false, startX = 0, startY = 0, origLeft = 0, origTop = 0;
        function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
        function positionWindow(top) {
            var win = document.getElementById("ai-copilot-window");
            if (!win) return;
            // Open the panel downward when the FAB is in the top half, upward otherwise.
            if (top < window.innerHeight / 2) { win.style.top = "56px"; win.style.bottom = "auto"; }
            else { win.style.bottom = "56px"; win.style.top = "auto"; }
        }
        function applyPos(left, top) {
            var w = container.offsetWidth || 140, h = container.offsetHeight || 44;
            left = clamp(left, 4, window.innerWidth - w - 4);
            top = clamp(top, 4, window.innerHeight - h - 4);
            container.style.left = left + "px"; container.style.top = top + "px";
            container.style.right = "auto"; container.style.bottom = "auto";
            positionWindow(top);
        }
        function restore() {
            try { var s = JSON.parse(localStorage.getItem(KEY) || "null");
                if (s && typeof s.left === "number" && typeof s.top === "number") applyPos(s.left, s.top); } catch (e) {}
        }
        // Pointer Events + setPointerCapture: once captured, every move/up goes to the handle
        // regardless of what's under the cursor — robust across mouse + touch, /apps + /qapps.
        function endDrag(e) {
            if (!dragging) return;
            dragging = false;
            try { if (e && e.pointerId != null) handle.releasePointerCapture(e.pointerId); } catch (err) {}
            if (moved) {
                var r = container.getBoundingClientRect();
                try { localStorage.setItem(KEY, JSON.stringify({ left: r.left, top: r.top })); } catch (err) {}
                // Swallow the click that follows a real drag so the panel doesn't toggle open.
                var suppress = function(ev) { ev.stopPropagation(); ev.preventDefault(); handle.removeEventListener("click", suppress, true); };
                handle.addEventListener("click", suppress, true);
                setTimeout(function() { handle.removeEventListener("click", suppress, true); }, 60);
            }
        }
        handle.addEventListener("pointerdown", function(e) {
            if (e.button != null && e.button !== 0) return;   // left button / touch / pen only
            dragging = true; moved = false;
            startX = e.clientX; startY = e.clientY;
            var r = container.getBoundingClientRect();
            origLeft = r.left; origTop = r.top;
            try { handle.setPointerCapture(e.pointerId); } catch (err) {}
        });
        // Listen on document (events bubble here) so the drag tracks even when the FAB
        // slides out from under the cursor — more robust than handle-only + capture.
        document.addEventListener("pointermove", function(e) {
            if (!dragging) return;
            var dx = e.clientX - startX, dy = e.clientY - startY;
            if (!moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) moved = true;
            if (moved) applyPos(origLeft + dx, origTop + dy);
        });
        document.addEventListener("pointerup", endDrag);
        document.addEventListener("pointercancel", endDrag);
        handle.style.touchAction = "none";
        if (!handle.title) handle.title = "Click to open · drag to move";
        restore();
        window.addEventListener("resize", function() {
            // keep it on-screen after a viewport change (only if it was moved)
            if (container.style.left) { var r = container.getBoundingClientRect(); applyPos(r.left, r.top); }
        });
    }

    function inject() {
        if (!document.body) return false;
        if (document.getElementById("ai-copilot-container")) {  // classic /apps already rendered it
            window._zenithCopilotLoaded = true;
            injectStyle();  // ensure the fixed bottom-right positioning CSS is present in /apps too
            makeDraggable(document.getElementById("ai-copilot-container"), document.getElementById("ai-copilot-toggle"));
            return true;
        }
        injectStyle();
        var c = document.createElement("div");
        c.id = "ai-copilot-container";
        c.innerHTML =
            '<button id="ai-copilot-toggle"><i class="glyphicon glyphicon-comment"></i> AI Copilot</button>' +
            '<div id="ai-copilot-window" style="display:none;">' +
            '<div class="chat-header">ZetaERP Copilot</div>' +
            '<div class="chat-history" id="copilot-history"><div class="msg ai"><b>Copilot:</b> Hi! I\'m your ERP assistant.</div></div>' +
            '<div class="chat-input-area"><input type="text" id="copilot-input" placeholder="Ask anything..."/>' +
            '<button id="copilot-send">Ask</button></div>' +
            '</div>';
        document.body.appendChild(c);
        wire();
        makeDraggable(c, document.getElementById("ai-copilot-toggle"));
        window._zenithCopilotLoaded = true;
        return true;
    }

    function ready() {
        // qapps: wait until the Vue app is mounted, otherwise the mount wipes
        // our injected node. Classic /apps (no Vue root) is ready once body exists.
        var app = document.getElementById("apps-root");
        if (app) return !!app.__vue__;
        return !!document.body;
    }

    var t = setInterval(function() { if (ready() && inject()) clearInterval(t); }, 300);
})();
