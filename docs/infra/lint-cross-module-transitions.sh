#!/bin/sh
# ZE-GATE-004 guard — keep the cross-module transition registry honest.
#
# The plan gate (ZenithApp.xml always-actions -> zenith.base.SecurityServices check#ModulePlanAccess)
# infers the module a request belongs to from its URL. That is wrong for a transition in module B
# called by a screen in module A: the tenant is using A, but the gate sees B and demands B in the plan.
# So a <transition> in module B targeted by a cross-module URL from module A MUST be registered in the
# _sharedTx map (// SHARED-TX) in SecurityServices.xml, or a tenant whose plan lacks B silently loses
# the feature. Cross-module URLs pointing at a SCREEN are fine (gated at render). Also flags a registry
# entry naming a transition that no longer exists (rot). See [[project_contacts-module]] / ZE-GATE-004.
#
# Logic lives in lint-cross-module-transitions.js (Node). It was a pure-shell scan, but that spawned
# ~3000 subprocesses (per-file sed/grep) which on Windows Git Bash (~30ms/fork) took ~2 min and tripped
# the pre-commit timeout; the Node port does it in one process in <1s and is separator-robust.
#
# Run before a deploy / in review. Exits non-zero on any violation. Requires node.
# Usage: sh docs/infra/lint-cross-module-transitions.sh [component-dir]   (default: ./component)
set -e
DIR="${1:-component}"
SELF_DIR=$(dirname "$0")
if ! command -v node >/dev/null 2>&1; then
  echo "lint-cross-module-transitions: node not found on PATH (needed to scan the tree)." >&2
  exit 2
fi
exec node "$SELF_DIR/lint-cross-module-transitions.js" "$DIR"
