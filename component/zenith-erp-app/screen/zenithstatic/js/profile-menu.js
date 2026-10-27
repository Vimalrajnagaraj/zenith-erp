(function () {
    'use strict';

    var menu;
    var activeAvatar;

    function closeMenu(restoreFocus) {
        if (!menu) return;
        menu.remove();
        menu = null;
        activeAvatar.setAttribute('aria-expanded', 'false');
        activeAvatar.removeAttribute('aria-controls');
        if (restoreFocus) activeAvatar.focus();
        activeAvatar = null;
    }

    function addLink(label, href) {
        var link = document.createElement('a');
        link.href = href;
        link.textContent = label;
        menu.appendChild(link);
    }

    function openMenu(avatar, focusFirst) {
        var cfg = document.getElementById('zenith-saas-cfg');
        menu = document.createElement('nav');
        menu.id = 'z-profile-menu';
        menu.setAttribute('aria-label', 'Account menu');
        addLink('My Account', avatar.href);
        if (cfg && cfg.getAttribute('data-tenant') === 'true') {
            addLink('My Subscription', '/vapps/zenith/my-subscription');
        }
        addLink('Logout', '/Login/logout');
        document.body.appendChild(menu);

        var rect = avatar.getBoundingClientRect();
        menu.style.right = Math.max(8, window.innerWidth - rect.right) + 'px';
        menu.style.top = Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - menu.offsetHeight - 8)) + 'px';
        activeAvatar = avatar;
        avatar.setAttribute('aria-controls', menu.id);
        avatar.setAttribute('aria-haspopup', 'true');
        avatar.setAttribute('aria-expanded', 'true');
        if (focusFirst) menu.querySelector('a').focus();
    }

    document.addEventListener('click', function (event) {
        var avatar = event.target.closest && event.target.closest('#z-avatar, .zqtb-avatar');
        if (avatar) {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            if (menu) {
                var wasOpen = activeAvatar === avatar;
                closeMenu(false);
                if (wasOpen) return;
            }
            openMenu(avatar, event.detail === 0);
        } else if (menu && !menu.contains(event.target)) {
            closeMenu(false);
        }
    }, true);

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && menu) {
            event.preventDefault();
            closeMenu(true);
        } else if (event.key === ' ' && event.target.matches && event.target.matches('#z-avatar, .zqtb-avatar')) {
            event.preventDefault();
            event.target.click();
        }
    });

    window.addEventListener('resize', function () { closeMenu(false); });
    window.addEventListener('scroll', function () { closeMenu(false); });
})();
