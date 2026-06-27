server {
    server_name erp.zetaclantech.com;
    http2 on;

    rewrite ^/qapp$ /qapps permanent;

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

    # Service worker - never cache
    location = /static/sw.js {
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
