#!/bin/sh
# ZE-GATE-004 follow-up (2026-07-17) — purge a THROWAWAY test tenant completely, deriving its full FK
# footprint from the live catalog (see purge-tenant.sql). Stops the guess -> rollback -> retry cycle that
# hand-listed FK children caused. Local-checkout companion to the lint scripts in this dir.
#
# Usage (run FROM the DB host, or adapt the psql call):
#   sh purge-tenant.sh <orgPartyId>              # DRY RUN: list every table + row count that WOULD be deleted
#   sh purge-tenant.sh <orgPartyId> --commit     # delete, atomically, then assert baselines + 0 residue
#
# From a workstation against the live box, pipe it through ssh/docker (what this repo uses):
#   cat purge-tenant.sql - <<EOF | ssh root@HOST 'docker exec -i deploy-db-1 psql -U moqui -d moqui -v org=... '
#   ...   (the deploy skill shows the psql-over-ssh pattern)
#
# SAFETY: refuses MARUTHI (100000) + the platform orgs; ALWAYS dry-run unless --commit; commit is wrapped in
# a single transaction so any FK surprise rolls the whole thing back (nothing half-deleted). Read the dry-run
# table list AND the printed tenant identity before you commit.
set -e
ORG="$1"; MODE="${2:-}"
# psql invocation. This deployment's psql lives in the deploy-db-1 container, so default to docker exec;
# override with ZPSQL when running elsewhere, e.g.
#   ZPSQL="ssh root@HOST docker exec -i deploy-db-1 psql -U moqui -d moqui"  (from a workstation)
#   ZPSQL="psql -U moqui -d moqui"                                          (on a host with a psql client)
PSQL="${ZPSQL:-docker exec -i deploy-db-1 psql -U moqui -d moqui} -v ON_ERROR_STOP=1"
HERE="$(dirname "$0")"

case "$ORG" in
  ''|_NA_|100000|ZETAERP|ORG_ZETA)
    echo "refusing: protected or empty org [$ORG]" >&2; exit 1;;
esac

# Identity — never purge something you haven't looked at.
echo "=== tenant identity for org $ORG ==="
$PSQL -c "SELECT t.tenant_id, t.tenant_name, t.subdomain, t.status_id, t.plan_id,
                 (SELECT organization_name FROM organization WHERE party_id='$ORG') AS org_name
          FROM saas_tenant t WHERE t.organization_party_id='$ORG';"

# Guard: never touch an org with issued financial documents (a real, transacted tenant).
ISSUED=$($PSQL -tAc "SELECT
   (SELECT count(*) FROM invoice WHERE from_party_id='$ORG' AND status_id NOT IN ('InvoiceCancelled','InvoiceInProcess'))
 + (SELECT count(*) FROM payment WHERE (from_party_id='$ORG' OR to_party_id='$ORG') AND status_id='PmntDelivered');" || echo 0)
if [ "${ISSUED:-0}" -gt 0 ] && [ "$MODE" = "--commit" ]; then
  echo "refusing --commit: org $ORG has $ISSUED issued invoice(s)/payment(s) — looks like a real tenant, not a throwaway." >&2
  echo "  (dry-run is still allowed; override intentionally only if you are certain.)" >&2
  exit 1
fi

DROPFNS="DROP FUNCTION IF EXISTS ztest_purge_tenant(text,boolean); DROP FUNCTION IF EXISTS ztest_tenant_residue(text); DROP FUNCTION IF EXISTS ztest_sweep_orphan_contact_mechs(boolean);"

if [ "$MODE" = "--commit" ]; then
  echo "=== COMMIT purge of org $ORG (atomic; self-verifies completeness before COMMIT) ==="
  # ztest_purge_tenant RAISES inside the tx if ANY row still references the tenant after the deletes, so a
  # missed table aborts the COMMIT (nothing deleted) and names table.column. On success, confirm externally
  # with the catalog-wide residue sweep too.
  { cat "$HERE/purge-tenant.sql"
    printf "BEGIN;\nSELECT * FROM ztest_purge_tenant('%s', true) ORDER BY del_order, tbl_name;\n" "$ORG"
    # ContactMech hangs off PartyContactMech (no party_id col), so the party-scoped purge above orphans it.
    # Sweep those orphans in the SAME transaction so a completed purge never leaves dangling contact data.
    printf "\\\\echo '=== sweep ContactMechs orphaned by the purge (referenced by nothing) ==='\n"
    printf "SELECT * FROM ztest_sweep_orphan_contact_mechs(true);\nCOMMIT;\n"
    printf "\\\\echo '=== residue sweep — EVERY %%party_id column in the schema (must be empty) ==='\n"
    printf "SELECT * FROM ztest_tenant_residue('%s');\n" "$ORG"
    printf "\\\\echo '=== contact_mech orphans remaining (must be 0) ==='\n"
    printf "SELECT * FROM ztest_sweep_orphan_contact_mechs(false);\n"
    printf "\\\\echo '=== billing baselines (plans 4 / plan_modules 76 must be intact) ==='\n"
    printf "SELECT (SELECT count(*) FROM saas_plan) plans, (SELECT count(*) FROM saas_plan_module) plan_mods;\n"
    printf "%s\n" "$DROPFNS"
  } | $PSQL
elif [ "$MODE" = "--audit" ]; then
  echo "=== AUDIT — any row in the schema still referencing org $ORG via a %party_id column (empty = clean) ==="
  { cat "$HERE/purge-tenant.sql"
    printf "SELECT * FROM ztest_tenant_residue('%s');\n%s\n" "$ORG" "$DROPFNS"
  } | $PSQL
else
  echo "=== DRY RUN — rows that WOULD be deleted (no changes made) ==="
  { cat "$HERE/purge-tenant.sql"
    printf "SELECT * FROM ztest_purge_tenant('%s', false) ORDER BY tbl_name;\n" "$ORG"
    printf "\\\\echo '=== + ContactMech orphans the post-purge sweep would clear (global; referenced by nothing) ==='\n"
    printf "SELECT * FROM ztest_sweep_orphan_contact_mechs(false);\n"
    printf "%s\n" "$DROPFNS"
  } | $PSQL
  echo "(re-run with --commit to delete, or --audit to sweep an org for residue)"
fi
