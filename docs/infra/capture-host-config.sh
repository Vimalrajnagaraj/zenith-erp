#!/usr/bin/env bash
# Pull the LIVE host config from the server INTO this repo, to keep the mirror in sync after
# editing on the box directly (e.g. a certbot renewal that rewrote the vhost, or a hand-tweak).
#
# Read-only on the server. Review `git diff docs/infra` afterwards, then commit. This is the
# reverse of apply-host-config.sh — together they make the repo the source of truth for host
# config without full IaC.
#
# Usage:  bash docs/infra/capture-host-config.sh [user@host]   (default root@167.233.117.229)
set -euo pipefail
HOST="${1:-root@167.233.117.229}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSH=(ssh -o StrictHostKeyChecking=no "$HOST")

pull(){ "${SSH[@]}" "cat '$1'" > "$HERE/$2"; echo "   $1 -> $2"; }

echo "==> Capturing nginx + systemd config from $HOST"
pull /etc/nginx/nginx.conf                          nginx/nginx.conf
pull /etc/nginx/conf.d/cloudflare-realip.conf       nginx/conf.d/cloudflare-realip.conf
pull /etc/nginx/sites-enabled/erp.zetaclantech.com  nginx/sites-enabled/erp.zetaclantech.com
pull /etc/nginx/sites-available/zenith_erp.conf     nginx/sites-enabled/zenith_erp.conf
pull /etc/systemd/system/moqui-port-guard.service   systemd/moqui-port-guard.service
echo "==> Capturing moqui image build inputs (Dockerfile + framework patches)"
"${SSH[@]}" "mkdir -p /opt/deploy/deploy/framework-patches" >/dev/null 2>&1 || true
pull /opt/deploy/deploy/Dockerfile                          deploy/Dockerfile
pull /opt/deploy/deploy/framework-patches/patch-webroot-nav.sh  framework-patches/patch-webroot-nav.sh
echo "==> Done. Review 'git diff docs/infra' and commit."
