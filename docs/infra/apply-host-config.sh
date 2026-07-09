#!/usr/bin/env bash
# Re-apply ALL host config (nginx + systemd + moqui image build inputs) from this repo to the server.
#
# nginx runs on the HOST (not Docker) and terminates TLS with Cloudflare in front, so host
# config is NOT carried by the moqui-deploy image pipeline. This script is the one-command
# recovery after a server rebuild, and the way to push a repo-side config change live.
#
# Idempotent — safe to re-run. Validates with `nginx -t` and only reloads if valid, so a bad
# config can never take the site down (the running config stays active on failure).
#
# Fresh box ordering: the vhost references /etc/letsencrypt/live/.../*.pem, so issue certs FIRST
# (`certbot --nginx -d erp.zetaclantech.com`) — otherwise `nginx -t` fails here and aborts.
#
# Usage:  bash docs/infra/apply-host-config.sh [user@host]   (default root@167.233.117.229)
set -euo pipefail
HOST="${1:-root@167.233.117.229}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSH=(ssh -o StrictHostKeyChecking=no "$HOST")

# upload a repo file to a server path (cat|ssh — the proven moqui-deploy transport)
put(){ cat "$HERE/$1" | "${SSH[@]}" "cat > '$2'"; echo "   $1 -> $2"; }
say(){ printf '\n==> %s\n' "$1"; }

say "nginx core + Cloudflare real-ip"
put nginx/nginx.conf                         /etc/nginx/nginx.conf
put nginx/conf.d/cloudflare-realip.conf      /etc/nginx/conf.d/cloudflare-realip.conf

say "vhosts (erp.* is a real file in sites-enabled; zenith_erp.conf is symlinked from sites-available)"
put nginx/sites-enabled/erp.zetaclantech.com /etc/nginx/sites-enabled/erp.zetaclantech.com
put nginx/sites-enabled/zenith_erp.conf      /etc/nginx/sites-available/zenith_erp.conf
"${SSH[@]}" "ln -sf /etc/nginx/sites-available/zenith_erp.conf /etc/nginx/sites-enabled/zenith_erp.conf"

say "validate + reload nginx (aborts WITHOUT reload if the config is bad — site stays up)"
"${SSH[@]}" "nginx -t && systemctl reload nginx && echo '   nginx reloaded OK'"

say "systemd: moqui :8080 port guard (re-blocks external access on boot)"
put systemd/moqui-port-guard.service         /etc/systemd/system/moqui-port-guard.service
"${SSH[@]}" "systemctl daemon-reload && systemctl enable --now moqui-port-guard.service && echo '   moqui-port-guard active'"

say "moqui image build inputs (Dockerfile + framework patches). Placed on the host; applied on the NEXT"
say "image build (does NOT rebuild here — a rebuild is a deliberate deploy step, not a config sync)."
"${SSH[@]}" "mkdir -p /opt/deploy/deploy/framework-patches"
put deploy/Dockerfile                        /opt/deploy/deploy/Dockerfile
put framework-patches/patch-webroot-nav.sh   /opt/deploy/deploy/framework-patches/patch-webroot-nav.sh
"${SSH[@]}" "chmod +x /opt/deploy/deploy/framework-patches/patch-webroot-nav.sh"

say "Done — host config now matches the repo."
