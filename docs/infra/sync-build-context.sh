#!/usr/bin/env bash
# Refresh the moqui image build context (/opt/deploy/deploy/zenith-erp/) from the RUNNING container's
# component tree, so a from-scratch `docker build` reproduces the LIVE app's components exactly.
#
# WHY THIS EXISTS: the `moqui-deploy` pipeline uploads changed files INTO the running container and
# `docker commit`s the image — it never updates this build-context source dir. So the dir drifts, and a
# from-scratch rebuild would otherwise bake a stale (possibly months-old) component tree. Run this before
# any from-scratch image rebuild (or after a batch of deploys) to re-sync. Verified: after running this,
# `docker build` produces a zenith-erp-* tree byte-identical to the running container.
#
# NOTE: this syncs FROM the running container (the definitive live state). For a true disaster-recovery
# rebuild where no container exists, populate the build context from the git component mirror instead
# (the repo's component/ dir, kept ~in sync with the container by the edit->deploy->commit discipline;
# a single known drift at capture time is noted in docs/infra/README.md).
#
# Idempotent; backs up the current context first. Usage: bash docs/infra/sync-build-context.sh [user@host]
set -euo pipefail
HOST="${1:-root@167.233.117.229}"
SSH=(ssh -o StrictHostKeyChecking=no "$HOST")

"${SSH[@]}" 'set -e
  BC=/opt/deploy/deploy/zenith-erp
  [ -d "$BC" ] || { echo "build context $BC not found" >&2; exit 1; }
  tar czf /opt/deploy/zenith-erp.buildctx-backup.tar.gz -C /opt/deploy/deploy zenith-erp
  docker exec deploy-moqui-1 sh -c "cd /opt/moqui/runtime/component && tar cf - zenith-erp-*" > /tmp/zc.tar
  find "$BC" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  tar xf /tmp/zc.tar -C "$BC"
  rm -f /tmp/zc.tar
  echo "build context refreshed from running container: $(ls -d "$BC"/zenith-erp-*/ | wc -l) components, $(find "$BC" -type f | wc -l) files"
'
echo "==> Done. A from-scratch rebuild now reproduces the live component tree."
