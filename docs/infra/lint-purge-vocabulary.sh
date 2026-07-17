#!/bin/sh
# ZE-GATE-004 follow-up (2026-07-17) — watch the ONE residual boundary of the throwaway-tenant purge
# (docs/infra/purge-tenant.sql). The purge finds a tenant's rows by walking real FKs plus every UNENFORCED
# reference column it can recognise: by NAMING CONVENTION (suffix -> root kind) OR by the real-FK column
# vocabulary. The only thing it CANNOT recognise is a root reference whose column name matches neither — a
# name that is an FK nowhere AND follows no convention. Such a column would be silently orphaned by a purge
# and slip past its self-verify.
#
# This lint makes that boundary observable at schema-change time: it flags any column whose name LOOKS like a
# root reference (party/user/facility/tenant/person/employee/owner/operator/...) that the engine's rules would
# NOT recognise. A hit means: either add a real FK (best), or extend the suffix map in purge-tenant.sql
# (_refcol) so the purge covers it. Run before a deploy / in review.
#
# Usage: sh docs/infra/lint-purge-vocabulary.sh          (uses docker exec deploy-db-1 by default)
#        ZPSQL="ssh root@HOST docker exec -i deploy-db-1 psql -U moqui -d moqui" sh docs/infra/lint-purge-vocabulary.sh
set -e
PSQL="${ZPSQL:-docker exec -i deploy-db-1 psql -U moqui -d moqui}"

# A column is "recognised" by the purge if its name matches a convention suffix (the _refcol suffix map) OR it
# participates in a real FK to a root entity (the FK vocabulary). A column is "reference-looking" by a broad
# heuristic. Reference-looking MINUS recognised = the boundary to review.
OUT=$($PSQL -tA <<'SQL'
WITH vocab AS (   -- names that are a real FK to a root entity anywhere (recognised via _vocab)
  SELECT DISTINCT ca.attname AS col
  FROM pg_constraint c JOIN pg_class pt ON pt.oid=c.confrelid
  JOIN pg_attribute ca ON ca.attrelid=c.conrelid AND ca.attnum=c.conkey[1]
  WHERE c.contype='f'
    AND pt.relname IN ('party','person','organization','user_account','saas_tenant','facility')
),
anyfk AS (   -- any column that is an FK child anywhere: a catalog-known reference to SOME entity, so the
  SELECT DISTINCT ca.attname AS col    -- purge closure reaches it transitively (e.g. driver_id -> fleet_driver)
  FROM pg_constraint c JOIN pg_attribute ca ON ca.attrelid=c.conrelid AND ca.attnum=ANY(c.conkey)
  WHERE c.contype='f'
),
pkcol AS (   -- any column that is a PK anywhere: an ENTITY id, not a reference (e.g. sponsor_id = event_sponsor PK)
  SELECT DISTINCT a.attname AS col
  FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=ANY(i.indkey)
  WHERE i.indisprimary
),
-- Reviewed-benign names that LOOK like references but are not tenant party/user refs. Each must be justified.
allow AS ( SELECT unnest(ARRAY[
  'gateway_customer_id'   -- external payment-gateway (Stripe) customer id on saas_subscription, not a party
]) AS col ),
cols AS (
  SELECT DISTINCT c.column_name AS col
  FROM information_schema.columns c
  JOIN pg_class rc ON rc.relname=c.table_name AND rc.relkind='r' AND rc.relnamespace='public'::regnamespace
  WHERE c.table_schema='public'
)
SELECT string_agg(col, ', ' ORDER BY col)
FROM cols
WHERE
  -- reference-LOOKING (broad heuristic: clearly names a party/user/facility/tenant/role actor)
  ( col ~ '(party_id|user_id|facility_id|tenant_id|person_id)$'
    OR col ~ '_by$'
    OR col ~ '(employee|operator|owner|organization|department|customer|vendor|supplier|technician|driver|manager|approver|payee|deductee|subscriber|carrier|contact|creator|cashier|picker|inspector|attendee|recipient|sponsor|author|organizer|competitor|franchisor|delegate)_id$' )
  -- but NOT recognised by the engine: convention suffix map (_refcol) ...
  AND col !~ '(party_id|person_id|department_id|employee_id|user_id|facility_id|tenant_id|_by)$'
  AND col NOT IN (SELECT col FROM vocab)          -- ... nor the FK vocabulary,
  AND col NOT IN (SELECT col FROM anyfk)          -- ... and it isn't an FK to some entity (closure reaches it),
  AND col NOT IN (SELECT col FROM pkcol)          -- ... nor an entity's own PK (an id, not a reference),
  AND col NOT IN (SELECT col FROM allow);         -- ... nor a reviewed-benign external id.
SQL
)

OUT=$(printf '%s' "$OUT" | tr -d '[:space:]' | sed 's/^,*//; s/,*$//')
if [ -n "$OUT" ]; then
  echo "FAIL: reference-looking column name(s) the purge engine would NOT recognise:" >&2
  echo "$OUT" | tr ',' '\n' | sed 's/^/  /' >&2
  echo "  -> these are FK nowhere AND match no convention suffix, so purge-tenant.sql would silently orphan" >&2
  echo "     rows referencing a tenant through them. Fix ONE of:" >&2
  echo "       (a) add a real FK on the column (best — the closure then handles it), or" >&2
  echo "       (b) extend the _refcol suffix map in docs/infra/purge-tenant.sql to cover the name." >&2
  exit 1
fi
echo "lint-purge-vocabulary: OK — every reference-looking column is recognised by the purge (FK or convention)."
