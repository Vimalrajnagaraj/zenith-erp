# GitHub repo governance

## Branch protection for `master` (needs GitHub Pro)

Real branch protection on a **private** repo requires **GitHub Pro** (or moving the repo to a
GitHub Team organization). On the free plan the API returns
`403 "Upgrade to GitHub Pro or make this repository public"` — which is why the "Your master
branch isn't protected" banner keeps showing.

Everything is prepped so it's a **one-command** turn-on the moment the account is upgraded:

```bash
sh docs/infra/github/apply-branch-protection.sh
```

That applies [`branch-protection-master.json`](branch-protection-master.json) to `master`:

| Setting | Value |
|---|---|
| Require a pull request before merging | ✅ (1 approving review, stale approvals dismissed) |
| Require status check | `guards` (from `.github/workflows/repo-guards.yml`) |
| Block force-pushes | ✅ |
| Block branch deletion | ✅ |
| Enforce on admins | ❌ `enforce_admins:false` — owner/admins can bypass for emergency hotfixes |

Override the target if needed: `OWNER=... REPO=... BRANCH=... sh apply-branch-protection.sh`.

### Tweaks you might want (edit the JSON before running)
- **No required reviews** (just require a PR + the check): set
  `required_approving_review_count` to `0`.
- **Strict for admins too** (owner cannot bypass): set `enforce_admins` to `true`.
- **Require branches up to date before merge:** set `required_status_checks.strict` to `true`.

### After it's on
The CI stand-ins become belt-and-suspenders — real protection blocks non-admin direct pushes
and force-pushes outright:
- `.github/workflows/no-direct-push.yml` — keep it (still permits the owner's allowlisted
  direct pushes, which `enforce_admins:false` also allows), or remove it.
- `.github/workflows/no-force-push.yml` — now redundant for non-admins; keep as an audit trail
  or remove.

### To remove protection later
```bash
MSYS_NO_PATHCONV=1 gh api --method DELETE repos/<owner>/<repo>/branches/master/protection
```

## Free stand-ins (active today, no Pro needed)
- `repo-guards` — static lint guards on every push/PR.
- `no-direct-push` — fails when a commit reaches `master` without a PR (owner allowlisted).
- `no-force-push` — fails when `master` is force-pushed (everyone).

These are after-the-fact **signals**, not hard blocks; only real branch protection prevents the
action.
