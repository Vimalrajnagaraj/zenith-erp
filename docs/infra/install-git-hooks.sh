#!/bin/sh
# One-time per clone: point git at the version-controlled hooks dir so the repo-guard
# pre-commit hook (docs/infra/git-hooks/pre-commit) runs automatically. core.hooksPath is
# LOCAL config (not committed), so every fresh clone must run this once.
# Undo with: git config --unset core.hooksPath
set -e
ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"
git config core.hooksPath docs/infra/git-hooks
chmod +x docs/infra/git-hooks/* 2>/dev/null || true
echo "git-hooks installed: core.hooksPath -> docs/infra/git-hooks"
echo "The pre-commit hook now runs the repo guards on staged .css/.xml changes."
echo "Emergency bypass: git commit --no-verify"
