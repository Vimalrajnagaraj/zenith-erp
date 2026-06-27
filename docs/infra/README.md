# Server infrastructure (reference copies — NOT auto-deployed)

These are **captured copies** of live host config on `root@167.233.117.229`. Moqui/Postgres run in
Docker (`deploy-moqui-1`, `deploy-db-1`, `deploy-opensearch-1`); **nginx runs on the host** (not a
container) and terminates TLS, with Cloudflare in front. Editing a file here changes nothing until you
copy it back to the server and reload. Keep these in sync when you change server config.

## nginx (`/etc/nginx/`)
| Repo path | Server path |
|---|---|
| `nginx/nginx.conf` | `/etc/nginx/nginx.conf` (has `upstream moqui_backend { server 127.0.0.1:8080; }`) |
| `nginx/sites-enabled/erp.zetaclantech.com` | `/etc/nginx/sites-enabled/erp.zetaclantech.com` (real file, the main vhost) |
| `nginx/sites-enabled/zenith_erp.conf` | `/etc/nginx/sites-available/zenith_erp.conf` (symlinked into sites-enabled) |
| `nginx/conf.d/cloudflare-realip.conf` | `/etc/nginx/conf.d/cloudflare-realip.conf` |

Re-apply: `scp` the file to its server path, then `nginx -t && nginx -s reload` (zero downtime).

### KEY perf fix baked into `erp.zetaclantech.com` (2026-06-27)
The 3 static-asset `location` blocks (`= /zenithstatic/css/zenith-theme-v4.css`,
`~* \.(js|css|woff2?|ttf|eot|otf)$`, `~* \.(png|jpg|...|webp)$`) each have **`proxy_hide_header Set-Cookie;`**.
Moqui sets `Set-Cookie: JSESSIONID`/`moqui.visitor` on every response incl. static assets, and
**Cloudflare refuses to cache any response with `Set-Cookie`** → all assets were `Cf-Cache-Status: BYPASS`
(pulled from the Germany origin every load). Stripping Set-Cookie ONLY on these asset blocks makes
Cloudflare cache them (`MISS`→`HIT`, served from the India edge). **Never** add this to the `/Login`,
`/signup`, or `location /` blocks — those must set the session cookie. See [[project_site-performance]].

## systemd (`/etc/systemd/system/`)
`systemd/moqui-port-guard.service` — defense-in-depth firewall: re-adds a `DOCKER-USER` iptables (v4+v6)
DROP for external `eth0:8080` on boot, so Moqui's Docker-published `:8080` can't be reached from the
internet bypassing Cloudflare/nginx/TLS (nginx→`127.0.0.1:8080` over loopback is unaffected). Install:
`cp` to `/etc/systemd/system/`, then `systemctl daemon-reload && systemctl enable --now moqui-port-guard.service`.
The permanent fix would be binding `127.0.0.1:8080:8080` in docker-compose, but that needs a container
recreate (avoided — see CLAUDE.md rule #5).
