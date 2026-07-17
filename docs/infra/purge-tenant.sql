-- ZE-GATE-004 follow-up (2026-07-17): generic, FK-graph-driven throwaway-tenant purge.
--
-- WHY: cleaning up a test tenant by hand-listing its FK children ALWAYS misses some (saas_audit_log,
-- the organization subtype row, system_sequence, ...), and each miss aborts the delete transaction, so
-- cleanup became guess -> rollback -> add-a-table -> retry. This derives the COMPLETE footprint from the
-- live catalog instead: seed the tenant's root rows, walk every FK transitively (all Moqui single-col FKs
-- reference the parent PK — verified 0 exceptions), then delete leaves-first in one atomic transaction.
--
-- SAFETY: refuses protected orgs; p_commit=false (dry run) issues NO DELETE, only counts what WOULD go;
-- p_commit=true deletes but the CALLER must wrap it in BEGIN/COMMIT so any error rolls the whole thing back.
-- Always eyeball the dry-run's table list + the tenant identity before committing. Driven by purge-tenant.sh.
--
-- Returns one row per involved table: (del_order, tbl_name, rows_n). Dry run reports rows_n = would-delete
-- count (del_order 0); commit reports actual deletes in the order they happened (leaves first).

CREATE OR REPLACE FUNCTION ztest_purge_tenant(p_org text, p_commit boolean DEFAULT false)
RETURNS TABLE(del_order int, tbl_name text, rows_n bigint) LANGUAGE plpgsql AS $fn$
DECLARE
  r record; n bigint; v_changed boolean; v_ord int := 0; v_left int; v_where text; v_del bigint; v_res text;
BEGIN
  IF p_org IS NULL OR btrim(p_org) = '' OR p_org IN ('_NA_','100000','ZETAERP','ORG_ZETA') THEN
    RAISE EXCEPTION 'ztest_purge_tenant: refusing protected/empty org [%]', p_org;
  END IF;

  -- single-column PKs (the "entity" tables that can be expanded through)
  CREATE TEMP TABLE _pk ON COMMIT DROP AS
    SELECT c.relname AS tbl, a.attname AS pkcol
    FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid
    JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=i.indkey[0]
    WHERE i.indisprimary AND i.indnatts=1 AND c.relkind='r';

  -- single-column FKs, used for expansion + delete predicates (all reference the parent PK)
  CREATE TEMP TABLE _fk ON COMMIT DROP AS
    SELECT ct.relname AS child, ca.attname AS ccol, pt.relname AS parent, pa.attname AS pcol
    FROM pg_constraint c
    JOIN pg_class ct ON ct.oid=c.conrelid
    JOIN pg_class pt ON pt.oid=c.confrelid
    JOIN pg_attribute ca ON ca.attrelid=c.conrelid AND ca.attnum=c.conkey[1]
    JOIN pg_attribute pa ON pa.attrelid=c.confrelid AND pa.attnum=c.confkey[1]
    WHERE c.contype='f' AND array_length(c.conkey,1)=1;

  -- ANY-arity FK edges (incl. composite link tables) purely for delete ORDERING: a child must be
  -- deleted before the parent it references. Self-references excluded (handled within one DELETE).
  CREATE TEMP TABLE _edge ON COMMIT DROP AS
    SELECT DISTINCT ct.relname AS child, pt.relname AS parent
    FROM pg_constraint c JOIN pg_class ct ON ct.oid=c.conrelid JOIN pg_class pt ON pt.oid=c.confrelid
    WHERE c.contype='f' AND ct.relname <> pt.relname;

  CREATE TEMP TABLE _mark(tbl text, pkval text, PRIMARY KEY(tbl,pkval)) ON COMMIT DROP;  -- expandable rows
  CREATE TEMP TABLE _pred(tbl text, col text, val text, PRIMARY KEY(tbl,col,val)) ON COMMIT DROP; -- delete predicates

  -- ---- seeds: the tenant's root rows ----
  INSERT INTO _mark VALUES ('party', p_org) ON CONFLICT DO NOTHING;
  INSERT INTO _pred VALUES ('party','party_id', p_org) ON CONFLICT DO NOTHING;
  INSERT INTO _mark SELECT 'saas_tenant', tenant_id FROM saas_tenant WHERE organization_party_id=p_org ON CONFLICT DO NOTHING;
  INSERT INTO _pred SELECT 'saas_tenant','tenant_id', tenant_id FROM saas_tenant WHERE organization_party_id=p_org ON CONFLICT DO NOTHING;
  INSERT INTO _mark SELECT 'facility', facility_id FROM facility WHERE owner_party_id=p_org ON CONFLICT DO NOTHING;
  INSERT INTO _pred SELECT 'facility','facility_id', facility_id FROM facility WHERE owner_party_id=p_org ON CONFLICT DO NOTHING;
  -- tenant users (identified by ACTIVE_ORGANIZATION pref) + their person parties. A tenant user's person
  -- party is NOT always owner_party_id=org (the admin person is owned by _NA_), so seed it explicitly.
  INSERT INTO _mark SELECT 'user_account', ua.user_id FROM user_account ua JOIN user_preference up ON up.user_id=ua.user_id
     WHERE up.preference_key='ACTIVE_ORGANIZATION' AND up.preference_value=p_org ON CONFLICT DO NOTHING;
  INSERT INTO _pred SELECT 'user_account','user_id', ua.user_id FROM user_account ua JOIN user_preference up ON up.user_id=ua.user_id
     WHERE up.preference_key='ACTIVE_ORGANIZATION' AND up.preference_value=p_org ON CONFLICT DO NOTHING;
  INSERT INTO _mark SELECT 'party', ua.party_id FROM user_account ua JOIN user_preference up ON up.user_id=ua.user_id
     WHERE up.preference_key='ACTIVE_ORGANIZATION' AND up.preference_value=p_org AND ua.party_id IS NOT NULL ON CONFLICT DO NOTHING;
  INSERT INTO _pred SELECT 'party','party_id', ua.party_id FROM user_account ua JOIN user_preference up ON up.user_id=ua.user_id
     WHERE up.preference_key='ACTIVE_ORGANIZATION' AND up.preference_value=p_org AND ua.party_id IS NOT NULL ON CONFLICT DO NOTHING;

  -- ---- CONVENTION seeds: Moqui scopes many entities to an org via an ownership COLUMN but does NOT always
  -- back it with a DB FK (e.g. pos_terminal / pos_session / pos_receipt_template .organization_party_id have
  -- no FK constraint). The pg_constraint walk below can't see those, so seed every table carrying one of these
  -- ownership columns, matched to this org. Extend the name list if a new org-scoping column appears — the
  -- dry-run + 0-residue assertion will flag anything still missed. (Party-reference columns like from_party_id
  -- ARE real FKs and are handled by the closure, so they are intentionally NOT here.) ----
  FOR r IN
    SELECT c.table_name AS tbl, c.column_name AS col, pk.pkcol
    FROM information_schema.columns c
    JOIN pg_class rc ON rc.relname=c.table_name AND rc.relkind='r'
    LEFT JOIN _pk pk ON pk.tbl=c.table_name
    WHERE c.column_name IN ('organization_party_id','owner_party_id')
  LOOP
    EXECUTE format('SELECT count(*) FROM %I WHERE %I=%L', r.tbl, r.col, p_org) INTO n;
    IF n > 0 THEN
      INSERT INTO _pred VALUES (r.tbl, r.col, p_org) ON CONFLICT DO NOTHING;
      IF r.pkcol IS NOT NULL THEN
        EXECUTE format('INSERT INTO _mark SELECT %L, %I::text FROM %I WHERE %I=%L AND %I IS NOT NULL ON CONFLICT DO NOTHING',
          r.tbl, r.pkcol, r.tbl, r.col, p_org, r.pkcol);
      END IF;
    END IF;
  END LOOP;

  -- ---- USER-owned rows: Moqui DB-enforces NONE of its user_id relationships (verified: 0 FKs to
  -- user_account across every table carrying a user_id), so deleting a user_account orphans its preferences,
  -- group memberships, login history, saved finds, screen theme, AND its visit/session rows. Rule: ANY table
  -- with a column literally named 'user_id' is user-owned on that column (audit columns are created_by_user_id
  -- / last_updated_..., never plain 'user_id'). This DELIBERATELY matches the self-verify sweep's user_id rule
  -- (below) so a clean purge always self-verifies. Seed those rows for this tenant's users, and mark any that
  -- are entities (single-col PK, e.g. visit.visit_id) so their own children expand. ----
  FOR r IN
    SELECT c.table_name AS tbl, pk.pkcol
    FROM information_schema.columns c
    JOIN pg_class rc ON rc.relname=c.table_name AND rc.relkind='r'
    LEFT JOIN _pk pk ON pk.tbl=c.table_name
    WHERE c.column_name='user_id' AND c.table_name <> 'user_account'
  LOOP
    EXECUTE format(
      'INSERT INTO _pred SELECT %L, ''user_id'', x.user_id FROM (SELECT DISTINCT user_id FROM %I) x '
      'JOIN _mark m ON m.tbl=''user_account'' AND m.pkval=x.user_id ON CONFLICT DO NOTHING', r.tbl, r.tbl);
    IF r.pkcol IS NOT NULL AND r.pkcol <> 'user_id' THEN
      EXECUTE format(
        'INSERT INTO _mark SELECT %L, x.%I::text FROM %I x JOIN _mark m ON m.tbl=''user_account'' AND m.pkval=x.user_id '
        'WHERE x.%I IS NOT NULL ON CONFLICT DO NOTHING', r.tbl, r.pkcol, r.tbl, r.pkcol);
    END IF;
  END LOOP;

  -- ---- transitive closure: propagate deletes to FK children until stable ----
  LOOP
    v_changed := false;
    FOR r IN SELECT f.child, f.ccol, f.parent, pk.pkcol AS childpk
             FROM _fk f LEFT JOIN _pk pk ON pk.tbl=f.child
    LOOP
      -- child rows whose FK points at a marked parent row are to be deleted
      EXECUTE format(
        'INSERT INTO _pred SELECT %L,%L, ch.%I::text FROM %I ch '
        'WHERE ch.%I::text IN (SELECT pkval FROM _mark WHERE tbl=%L) AND ch.%I IS NOT NULL ON CONFLICT DO NOTHING',
        r.child, r.ccol, r.ccol, r.child, r.ccol, r.parent, r.ccol);
      GET DIAGNOSTICS n = ROW_COUNT; IF n>0 THEN v_changed:=true; END IF;
      -- if the child is itself an entity (single-col PK), mark its rows so its own children expand too
      IF r.childpk IS NOT NULL THEN
        EXECUTE format(
          'INSERT INTO _mark SELECT %L, ch.%I::text FROM %I ch '
          'WHERE ch.%I::text IN (SELECT pkval FROM _mark WHERE tbl=%L) AND ch.%I IS NOT NULL ON CONFLICT DO NOTHING',
          r.child, r.childpk, r.child, r.ccol, r.parent, r.childpk);
        GET DIAGNOSTICS n = ROW_COUNT; IF n>0 THEN v_changed:=true; END IF;
      END IF;
    END LOOP;
    EXIT WHEN NOT v_changed;
  END LOOP;

  -- ---- DRY RUN: count what would go, no deletes ----
  IF NOT p_commit THEN
    FOR r IN SELECT DISTINCT tbl FROM _pred LOOP
      SELECT string_agg(clause, ' OR ') INTO v_where FROM (
        SELECT format('%I IN (%s)', col, string_agg(quote_literal(val), ',')) AS clause
        FROM _pred WHERE tbl=r.tbl GROUP BY col) s;
      EXECUTE format('SELECT count(*) FROM %I WHERE %s', r.tbl, v_where) INTO v_del;
      IF v_del > 0 THEN del_order:=0; tbl_name:=r.tbl; rows_n:=v_del; RETURN NEXT; END IF;
    END LOOP;
    RETURN;
  END IF;

  -- ---- COMMIT: delete leaves-first (a table goes once nothing involved still references it) ----
  CREATE TEMP TABLE _remain ON COMMIT DROP AS SELECT DISTINCT tbl FROM _pred;
  LOOP
    SELECT count(*) INTO v_left FROM _remain;
    EXIT WHEN v_left = 0;
    v_ord := v_ord + 1;
    FOR r IN
      SELECT rm.tbl FROM _remain rm
      WHERE NOT EXISTS (SELECT 1 FROM _edge e JOIN _remain r2 ON r2.tbl=e.child
                        WHERE e.parent=rm.tbl AND e.child<>rm.tbl)
    LOOP
      SELECT string_agg(clause, ' OR ') INTO v_where FROM (
        SELECT format('%I IN (%s)', col, string_agg(quote_literal(val), ',')) AS clause
        FROM _pred WHERE tbl=r.tbl GROUP BY col) s;
      EXECUTE format('DELETE FROM %I WHERE %s', r.tbl, v_where);
      GET DIAGNOSTICS v_del = ROW_COUNT;
      DELETE FROM _remain WHERE tbl=r.tbl;
      del_order:=v_ord; tbl_name:=r.tbl; rows_n:=v_del; RETURN NEXT;
    END LOOP;
    IF (SELECT count(*) FROM _remain) = v_left THEN
      RAISE EXCEPTION 'ztest_purge_tenant: FK cycle among remaining tables [%]',
        (SELECT string_agg(tbl, ',') FROM _remain);
    END IF;
  END LOOP;

  -- ---- SELF-VERIFY completeness (catalog-derived, not a hand-picked table list). After the deletes, NO row
  -- anywhere may still reference the tenant's captured identifiers. Build the id sets from _mark (captured
  -- BEFORE deletion — the org/user/facility/tenant rows are now gone, so they can't be recomputed) and scan
  -- EVERY table column named like a tenant identifier. A hit = the purge missed a table (typically a NEW
  -- unenforced-scoping column on some entity) -> RAISE, which rolls the whole purge back so the operator sees
  -- exactly which table.column instead of a silent orphan. This is what makes "the assertion will flag it"
  -- actually true: the check is derived from the live catalog, so it cannot go stale. ----
  CREATE TEMP TABLE _idset(kind text, val text) ON COMMIT DROP;
  INSERT INTO _idset SELECT 'party',    pkval FROM _mark WHERE tbl='party';
  INSERT INTO _idset SELECT 'user',     pkval FROM _mark WHERE tbl='user_account';
  INSERT INTO _idset SELECT 'tenant',   pkval FROM _mark WHERE tbl='saas_tenant';
  INSERT INTO _idset SELECT 'facility', pkval FROM _mark WHERE tbl='facility';
  v_res := '';
  FOR r IN
    SELECT c.table_name AS tbl, c.column_name AS col,
           CASE WHEN c.column_name ~ 'party_id$' THEN 'party'
                WHEN c.column_name='user_id'     THEN 'user'
                WHEN c.column_name='tenant_id'   THEN 'tenant'
                WHEN c.column_name='facility_id' THEN 'facility' END AS kind
    FROM information_schema.columns c
    JOIN pg_class rc ON rc.relname=c.table_name AND rc.relkind='r'
    WHERE c.column_name ~ 'party_id$' OR c.column_name IN ('user_id','tenant_id','facility_id')
  LOOP
    EXECUTE format('SELECT count(*) FROM %I t WHERE t.%I::text IN (SELECT val FROM _idset WHERE kind=%L)',
                   r.tbl, r.col, r.kind) INTO n;
    IF n > 0 THEN v_res := v_res || format('%s.%s=%s ', r.tbl, r.col, n); END IF;
  END LOOP;
  IF v_res <> '' THEN
    RAISE EXCEPTION 'ztest_purge_tenant: RESIDUE remains after purge (missed unenforced-scoping column? add it to the seed section) -> %', v_res;
  END IF;
END;
$fn$;

-- Standalone auditor: sweep EVERY '%party_id' column in the schema for rows still pointing at an org. Empty
-- result = provably clean (of party-scoped references), not "clean per a 6-table list". Use to confirm a
-- purge or hunt orphans: SELECT * FROM ztest_tenant_residue('<org>');
CREATE OR REPLACE FUNCTION ztest_tenant_residue(p_org text)
RETURNS TABLE(table_name text, column_name text, rows_n bigint) LANGUAGE plpgsql AS $fn$
DECLARE r record; n bigint;
BEGIN
  FOR r IN
    SELECT c.table_name AS tbl, c.column_name AS col
    FROM information_schema.columns c
    JOIN pg_class rc ON rc.relname=c.table_name AND rc.relkind='r'
    WHERE c.column_name ~ 'party_id$'
    ORDER BY 1,2
  LOOP
    EXECUTE format('SELECT count(*) FROM %I WHERE %I=%L', r.tbl, r.col, p_org) INTO n;
    IF n > 0 THEN table_name:=r.tbl; column_name:=r.col; rows_n:=n; RETURN NEXT; END IF;
  END LOOP;
END;
$fn$;
