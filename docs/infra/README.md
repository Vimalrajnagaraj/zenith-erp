# Server infrastructure (repo = source of truth; sync both ways with the scripts)

These mirror the live host config on `root@167.233.117.229`. Moqui/Postgres run in Docker
(`deploy-moqui-1`, `deploy-db-1`, `deploy-opensearch-1`); **nginx runs on the host** (not a
container) and terminates TLS, with Cloudflare in front — so host config is NOT carried by the
`moqui-deploy` image pipeline.

## One-command sync (no more manual scp)
- **Push repo → server** (rebuild recovery, or to ship a repo-side change):
  `bash docs/infra/apply-host-config.sh [user@host]`
  Idempotent; runs `nginx -t` and only reloads if valid (a bad config can't take the site down).
  On a **fresh box, issue TLS certs first** (`certbot --nginx -d erp.zetaclantech.com`) — the vhost
  references `/etc/letsencrypt/live/.../*.pem`, so without them `nginx -t` fails and apply aborts.
- **Pull server → repo** (after a certbot renewal or a hand-edit on the box):
  `bash docs/infra/capture-host-config.sh [user@host]` → review `git diff docs/infra` → commit.

⚠️ **Never leave a `.bak`/copy inside `/etc/nginx/sites-enabled/`** — nginx includes that dir by glob
(`include /etc/nginx/sites-enabled/*;`), so a stray full-vhost copy loads a duplicate `server` block
("conflicting server name … ignored"). Put backups in `/etc/nginx/backups/` (outside the glob).

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

### POS terminal /qapps→/apps redirect baked into `erp.zetaclantech.com` (2026-06-29)
A `location ^~ /qapps/zenith/pos/Terminal { rewrite ^/qapps(/.*)$ https://$host/apps$1 permanent; }`
block (just after the `^/qapp$` rewrite) **301-redirects any /qapps POS-terminal URL to the identical
/apps URL** (path + query preserved). The terminal's optimistic cart engine (`pos-terminal.js`) is
/apps-only — the /qapps Quasar SPA strips it, so every product tap round-trips a ~2MB screen reload.
This bounces a kiosk bookmarked to /qapps **before** the slow SPA shell even loads (no client-side hop).
Only the terminal path is matched; other /qapps screens are untouched. There is ALSO a client-side
`<img onload>` fallback inside `Terminal.xml` (covers any path that bypasses nginx). See
[[project_pos-qapps-terminal-redirect]].

## systemd (`/etc/systemd/system/`)
`systemd/moqui-port-guard.service` — defense-in-depth firewall: re-adds a `DOCKER-USER` iptables (v4+v6)
DROP for external `eth0:8080` on boot, so Moqui's Docker-published `:8080` can't be reached from the
internet bypassing Cloudflare/nginx/TLS (nginx→`127.0.0.1:8080` over loopback is unaffected). Install:
`cp` to `/etc/systemd/system/`, then `systemctl daemon-reload && systemctl enable --now moqui-port-guard.service`.
The permanent fix would be binding `127.0.0.1:8080:8080` in docker-compose, but that needs a container
recreate (avoided — see CLAUDE.md rule #5).

## moqui image build inputs (`/opt/deploy/deploy/`)
The moqui image is built from `/opt/deploy/deploy/Dockerfile` (`FROM moqui/moqui:latest` + `COPY ./zenith-erp/`).
Framework overrides that must survive an image rebuild live here (the running image is otherwise a `docker commit`
of runtime edits, which a from-scratch rebuild would discard).

| Repo path | Server path |
|---|---|
| `deploy/Dockerfile` | `/opt/deploy/deploy/Dockerfile` |
| `framework-patches/patch-webroot-nav.sh` | `/opt/deploy/deploy/framework-patches/patch-webroot-nav.sh` |

### `framework-patches/patch-webroot-nav.sh` — ZE-INV-012 / IV-113 (2026-07-09)
The Moqui /qapps left-nav **module submenus wouldn't collapse**: the framework component `m-menu-nav-item` rendered
each active-trail module as `<q-expansion-item :value="true" … @input="go">` — `:value="true"` is a frozen constant
(expand state = active route, not a toggle) and `@input="go"` makes the chevron NAVIGATE, so an open submenu could
never be collapsed. The patch swaps `:value="true"` + `@input="go"` for **`default-opened expand-separate-toggle-icon`**
(keeping `:to`): the chevron becomes an independent real toggle, the label still navigates via `:to`. It edits the
SERVED, minified `base-component/webroot/screen/webroot/js/WebrootVue.qvt.min.js` (prod serves `*.min.js`), is
**idempotent** (no-ops if already patched) and **self-verifying** (fails the build if it doesn't match exactly 3 menu
items — so a Moqui upgrade that changes the template can't silently ship the bug). The Dockerfile `RUN`s it, so a
rebuild keeps the fix. Verified: byte-identical (md5) to the hand-verified fix, and the build step patches 3 items.
See [[project_qapps-nav-menu-collapse]].

> Static-asset delivery note: the min.js is cache-busted by a single global `?v=<hash>` (`immutable`, 1yr). Moqui
> RECOMPUTES that hash on RESTART, so after any change to a served static asset you must **restart moqui** (not just
> reload the file) for returning users to refetch it.

> ⚠️ The host `Dockerfile`'s `FROM moqui/moqui:latest` does not currently resolve locally or via pull (the base is
> tagged `ghcr.io/moqui/moqui-framework:latest` on the box). A from-scratch rebuild needs a resolvable base first;
> the nav patch step itself is verified against `ghcr.io/moqui/moqui-framework:latest`. Not fixed here (pre-existing,
> and the running image is already patched).
