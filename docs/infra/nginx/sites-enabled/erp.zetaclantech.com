server {
    server_name erp.zetaclantech.com;
    http2 on;

    rewrite ^/qapp$ /qapps permanent;

    # POS terminal is /apps-only (optimistic pos-terminal.js); the /qapps Quasar SPA strips that
    # JS and round-trips every product tap. Bounce any /qapps POS-terminal URL to the identical
    # /apps URL at the proxy, so a kiosk bookmarked to /qapps never even loads the slow SPA shell
    # (no client-side hop). Path + query string are preserved; /apps is unaffected.
    location ^~ /qapps/zenith/pos/Terminal {
        rewrite ^/qapps(/.*)$ https://$host/apps$1 permanent;
    }

    # Security headers (defined once, included in all locations via snippets)
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(self)" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # File upload limit
    client_max_body_size 50m;

    # Login rate limiting
    location = /Login {
        limit_req zone=login burst=3 nodelay;

        proxy_pass http://moqui_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";

        # Repeat security headers
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "camera=(), microphone=(), geolocation=(self)" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    }

    # Signup rate limiting
    location = /signup {
        limit_req zone=login burst=3 nodelay;

        proxy_pass http://moqui_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";

        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "camera=(), microphone=(), geolocation=(self)" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    }

    # Zenith theme CSS - short cache for updates
    location = /zenithstatic/css/zenith-theme-v4.css {
        proxy_pass http://moqui_backend;
        proxy_hide_header Set-Cookie;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";

        expires 1h;
        add_header Cache-Control "public, must-revalidate";
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "camera=(), microphone=(), geolocation=(self)" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    }

    # Static asset caching - versioned assets
    location ~* \.(js|css|woff2?|ttf|eot|otf)$ {
        proxy_pass http://moqui_backend;
        proxy_hide_header Set-Cookie;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";

        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "camera=(), microphone=(), geolocation=(self)" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        access_log off;
    }

    # Image and icon caching
    location ~* \.(png|jpg|jpeg|gif|ico|svg|webp)$ {
        proxy_pass http://moqui_backend;
        proxy_hide_header Set-Cookie;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";

        expires 30d;
        add_header Cache-Control "public";
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "camera=(), microphone=(), geolocation=(self)" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        access_log off;
    }

    # Manifest - short cache
    location = /manifest.json {
        proxy_pass http://moqui_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";

        expires 1h;
        add_header Cache-Control "public";
        add_header X-Content-Type-Options "nosniff" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    }

    # Service worker - never cache. The POS SW is served by Moqui at /apps/zenith/pos/sw.js;
    # WITHOUT this exact-match block it falls into the `~* \.(js|...)$` regex above and gets
    # `Cache-Control: immutable, max-age=1y` -> Cloudflare + browsers pin a stale sw.js for a
    # YEAR and SW updates can never ship. An exact (`=`) match outranks the regex. A SW script
    # MUST revalidate every load; no-store also keeps Cloudflare from edge-caching it.
    # (Old speculative path was /static/sw.js, which Moqui never served.)
    location = /apps/zenith/pos/sw.js {
        proxy_pass http://moqui_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";

        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Service-Worker-Allowed "/";
        add_header X-Content-Type-Options "nosniff" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    }

    # Back-office screens — drop `no-store` ONLY here so Chrome can prerender them
    # (Speculation-Rules instant nav). Scoped to /apps/zenith/ so /rest, /apps/tools,
    # /qapps, /Login and everything else keep `no-store`. Still `private` + revalidated
    # (no shared/CF cache, never serves stale); the only delta is the browser MAY
    # disk-cache these authed pages, which prerender requires. `^~` so it wins over the
    # static-asset regex; the exact `= /apps/zenith/pos/sw.js` block still wins over this.
    # Mirrors `location /` exactly except the Cache-Control override.
    location ^~ /apps/zenith/ {
        limit_req zone=general burst=50 nodelay;

        proxy_pass http://moqui_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;

        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;

        proxy_buffering on;
        proxy_buffer_size 16k;
        proxy_buffers 8 16k;
        proxy_busy_buffers_size 32k;

        # Strip Moqui's `no-store` and re-set without it (still private + revalidate).
        proxy_hide_header Cache-Control;
        add_header Cache-Control "no-cache, must-revalidate, private" always;

        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "camera=(), microphone=(), geolocation=(self)" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    }

    # Main application
    location / {
        limit_req zone=general burst=50 nodelay;

        proxy_pass http://moqui_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;

        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;

        # Proxy buffering
        proxy_buffering on;
        proxy_buffer_size 16k;
        proxy_buffers 8 16k;
        proxy_busy_buffers_size 32k;

        # Security headers
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "camera=(), microphone=(), geolocation=(self)" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    }

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/erp.zetaclantech.com/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/erp.zetaclantech.com/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if ($host = erp.zetaclantech.com) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    listen 80;
    server_name erp.zetaclantech.com;
    return 404; # managed by Certbot
}
