#!/usr/bin/env sh
# Apply real GitHub branch protection to master. Run this ONCE after upgrading the account to
# GitHub Pro (branch protection on a private repo requires Pro; on the free plan the API returns
# HTTP 403 "Upgrade to GitHub Pro or make this repository public").
#
#   sh docs/infra/github/apply-branch-protection.sh
#
# What it enables on master (see branch-protection-master.json for the exact settings):
#   - require a pull request before merging (1 approving review, stale approvals dismissed)
#   - require the `guards` status check (from .github/workflows/repo-guards.yml) to pass
#   - block force-pushes and branch deletion
#   - enforce_admins = false  → the owner/admins may still bypass for emergency hotfixes
#
# Once this is on, the `no-direct-push` / `no-force-push` CI guards become belt-and-suspenders
# (real protection blocks non-admins outright); you can keep or remove them.
set -eu

# gh on Windows/Git-Bash rewrites "/repos/..." into a filesystem path — disable that.
export MSYS_NO_PATHCONV=1

OWNER="${OWNER:-amalnathkp13-boop}"
REPO="${REPO:-zenith-erp}"
BRANCH="${BRANCH:-master}"
DIR="$(cd "$(dirname "$0")" && pwd)"
PAYLOAD="$DIR/branch-protection-master.json"

command -v gh >/dev/null 2>&1 || { echo "❌ GitHub CLI (gh) not found. Install it and 'gh auth login' first."; exit 1; }
[ -f "$PAYLOAD" ] || { echo "❌ Missing payload: $PAYLOAD"; exit 1; }

echo "Applying branch protection to ${OWNER}/${REPO}@${BRANCH} ..."
err="$(mktemp)"
if gh api --method PUT "repos/${OWNER}/${REPO}/branches/${BRANCH}/protection" \
     -H "Accept: application/vnd.github+json" --input "$PAYLOAD" >/dev/null 2>"$err"; then
  echo "✅ Branch protection applied. Current settings:"
  gh api "repos/${OWNER}/${REPO}/branches/${BRANCH}/protection" --jq '{
    require_pull_request: (.required_pull_request_reviews != null),
    required_reviews: (.required_pull_request_reviews.required_approving_review_count // 0),
    required_checks: (.required_status_checks.contexts // []),
    enforce_admins: .enforce_admins.enabled,
    block_force_push: (.allow_force_pushes.enabled | not),
    block_deletion: (.allow_deletions.enabled | not)
  }'
  rm -f "$err"
else
  if grep -qi "Upgrade to GitHub Pro" "$err" 2>/dev/null; then
    echo "❌ Not applied — this repo is on a plan without private-repo branch protection."
    echo "   Upgrade the account to GitHub Pro (or move the repo to a Team org), then re-run this."
  else
    echo "❌ Failed:"; cat "$err"
  fi
  rm -f "$err"
  exit 1
fi
