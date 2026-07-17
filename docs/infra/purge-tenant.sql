-- ZE-GATE-004 follow-up (2026-07-17): generic, catalog-driven throwaway-tenant purge.
--
-- WHY: cleaning up a test tenant by hand-listing its FK children ALWAYS misses some (saas_audit_log, the
-- organization subtype row, system_sequence, ...), and each miss aborts the delete transaction -> guess/
-- rollback/retry. This derives the COMPLETE footprint from the live catalog: seed the tenant's root rows,
-- walk every FK transitively (all Moqui single-col FKs reference the parent PK — verified 0 exceptions),
-- then delete leaves-first in one atomic transaction.
--
-- Moqui does NOT DB-enforce every relationship, so an FK walk alone silently orphans rows whose tenant link
-- is an *unenforced* relationship (pos_terminal.organization_party_id, visit.user_id, serial_number_history
-- .performed_by_user_id, ...). The engine closes that by deriving a REFERENCE VOCABULARY from the catalog:
-- the set of column names that appear in a REAL FK to a root entity (party/person/organization -> 'party',
-- user_account -> 'user', saas_tenant -> 'tenant', facility -> 'facility'). Any table carrying such a name
-- but WITHOUT an FK on it (the "_vgap" set) is an unenforced reference; those are seeded AND self-verified
-- against the tenant's captured id sets. Seed and verify use the SAME vocabulary, so a clean purge always
-- self-verifies, and the check is catalog-derived so it cannot go stale as entities are added.
-- The only residual boundary: a reference column whose name appears as an FK NOWHERE in the schema — nothing
-- in the catalog then marks it as a reference. The self-verify's value-based nature can't help there without
-- risking id-space collisions, so that single case stays out of scope by design.
--
-- SAFETY: refuses protected orgs; p_commit=false (dry run) issues NO DELETE, only counts; p_commit=true
-- deletes AND self-verifies before returning (any residue RAISES -> caller's tx rolls back). Always eyeball
-- the dry-run table list + tenant identity before committing. Driven by purge-tenant.sh.
--
-- Returns one row per involved table: (del_order, tbl_name, rows_n).

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

  -- REFERENCE VOCABULARY: column names that appear in a real FK to a root entity, mapped to a kind and the
  -- _mark table whose pkvals are that kind's id set. This is the naming vocabulary Moqui uses for references
  -- to parties/users/tenants/facilities.
  CREATE TEMP TABLE _vocab ON COMMIT DROP AS
    SELECT DISTINCT ca.attname AS col,
           CASE WHEN pt.relname IN ('party','person','organization') THEN 'party'
                WHEN pt.relname='user_account' THEN 'user'
                WHEN pt.relname='saas_tenant'  THEN 'tenant'
                WHEN pt.relname='facility'     THEN 'facility' END AS kind,
           CASE WHEN pt.relname IN ('party','person','organization') THEN 'party'
                WHEN pt.relname='user_account' THEN 'user_account'
                WHEN pt.relname='saas_tenant'  THEN 'saas_tenant'
                WHEN pt.relname='facility'     THEN 'facility' END AS kindtbl
    FROM pg_constraint c
    JOIN pg_class ct ON ct.oid=c.conrelid
    JOIN pg_class pt ON pt.oid=c.confrelid
    JOIN pg_attribute ca ON ca.attrelid=c.conrelid AND ca.attnum=c.conkey[1]
    WHERE c.contype='f' AND array_length(c.conkey,1)=1
      AND pt.relname IN ('party','person','organization','user_account','saas_tenant','facility');

  -- _vgap = every occurrence of a vocabulary column on a table that has NO real FK on it. These are the
  -- UNENFORCED references the FK walk can't see; they need explicit seeding + self-verification. (FK
  -- occurrences are handled by the closure and are guaranteed clean, so they are excluded here — which also
  -- keeps the seed/verify sweeps small and fast.)
  CREATE TEMP TABLE _vgap ON COMMIT DROP AS
    SELECT c.table_name AS tbl, v.col, v.kind, v.kindtbl, pk.pkcol
    FROM _vocab v
    JOIN information_schema.columns c ON c.column_name=v.col
    JOIN pg_class rc ON rc.relname=c.table_name AND rc.relkind='r'
    LEFT JOIN _pk pk ON pk.tbl=c.table_name
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_constraint fc JOIN pg_class fct ON fct.oid=fc.conrelid
      JOIN pg_attribute fca ON fca.attrelid=fc.conrelid AND fca.attnum=fc.conkey[1]
      WHERE fc.contype='f' AND fct.relname=c.table_name AND fca.attname=v.col);

  CREATE TEMP TABLE _mark(tbl text, pkval text, PRIMARY KEY(tbl,pkval)) ON COMMIT DROP;  -- expandable rows
  CREATE TEMP TABLE _pred(tbl text, col text, val text, PRIMARY KEY(tbl,col,val)) ON COMMIT DROP; -- delete predicates

  -- ---- ROOT seeds: the tenant's anchor rows. These establish the id sets (party/user/tenant/facility) that
  -- both the FK closure and the vocabulary propagation grow from. ----
  INSERT INTO _mark VALUES ('party', p_org) ON CONFLICT DO NOTHING;
  INSERT INTO _pred VALUES ('party','party_id', p_org) ON CONFLICT DO NOTHING;
  INSERT INTO _mark SELECT 'party', party_id FROM party WHERE owner_party_id=p_org ON CONFLICT DO NOTHING;
  INSERT INTO _mark SELECT 'saas_tenant', tenant_id FROM saas_tenant WHERE organization_party_id=p_org ON CONFLICT DO NOTHING;
  INSERT INTO _mark SELECT 'facility', facility_id FROM facility WHERE owner_party_id=p_org ON CONFLICT DO NOTHING;
  -- tenant users (identified by ACTIVE_ORGANIZATION pref) + their person parties. A tenant user's person
  -- party is NOT always owner_party_id=org (the admin person is owned by _NA_), so seed it explicitly.
  INSERT INTO _mark SELECT 'user_account', ua.user_id FROM user_account ua JOIN user_preference up ON up.user_id=ua.user_id
     WHERE up.preference_key='ACTIVE_ORGANIZATION' AND up.preference_value=p_org ON CONFLICT DO NOTHING;
  INSERT INTO _mark SELECT 'party', ua.party_id FROM user_account ua JOIN user_preference up ON up.user_id=ua.user_id
     WHERE up.preference_key='ACTIVE_ORGANIZATION' AND up.preference_value=p_org AND ua.party_id IS NOT NULL ON CONFLICT DO NOTHING;

  -- ---- transitive closure: propagate deletes until stable, along BOTH real FKs (any target) AND unenforced
  -- vocabulary references (_vgap, root-kind targets). The id sets in _mark grow as entities are marked, and
  -- every marked row also becomes a delete predicate. ----
  LOOP
    v_changed := false;

    -- (a) real single-column FKs: child rows referencing a marked parent
    FOR r IN SELECT f.child, f.ccol, f.parent, pk.pkcol AS childpk
             FROM _fk f LEFT JOIN _pk pk ON pk.tbl=f.child
    LOOP
      EXECUTE format(
        'INSERT INTO _pred SELECT %L,%L, ch.%I::text FROM %I ch '
        'WHERE ch.%I::text IN (SELECT pkval FROM _mark WHERE tbl=%L) AND ch.%I IS NOT NULL ON CONFLICT DO NOTHING',
        r.child, r.ccol, r.ccol, r.child, r.ccol, r.parent, r.ccol);
      GET DIAGNOSTICS n = ROW_COUNT; IF n>0 THEN v_changed:=true; END IF;
      IF r.childpk IS NOT NULL THEN
        EXECUTE format(
          'INSERT INTO _mark SELECT %L, ch.%I::text FROM %I ch '
          'WHERE ch.%I::text IN (SELECT pkval FROM _mark WHERE tbl=%L) AND ch.%I IS NOT NULL ON CONFLICT DO NOTHING',
          r.child, r.childpk, r.child, r.ccol, r.parent, r.childpk);
        GET DIAGNOSTICS n = ROW_COUNT; IF n>0 THEN v_changed:=true; END IF;
      END IF;
    END LOOP;

    -- (b) unenforced vocabulary references: rows whose value is in the referenced kind's id set
    FOR r IN SELECT tbl, col, kindtbl, pkcol FROM _vgap
    LOOP
      EXECUTE format(
        'INSERT INTO _pred SELECT %L,%L, ch.%I::text FROM %I ch '
        'WHERE ch.%I::text IN (SELECT pkval FROM _mark WHERE tbl=%L) AND ch.%I IS NOT NULL ON CONFLICT DO NOTHING',
        r.tbl, r.col, r.col, r.tbl, r.col, r.kindtbl, r.col);
      GET DIAGNOSTICS n = ROW_COUNT; IF n>0 THEN v_changed:=true; END IF;
      IF r.pkcol IS NOT NULL AND r.pkcol <> r.col THEN
        EXECUTE format(
          'INSERT INTO _mark SELECT %L, ch.%I::text FROM %I ch '
          'WHERE ch.%I::text IN (SELECT pkval FROM _mark WHERE tbl=%L) AND ch.%I IS NOT NULL ON CONFLICT DO NOTHING',
          r.tbl, r.pkcol, r.tbl, r.col, r.kindtbl, r.pkcol);
        GET DIAGNOSTICS n = ROW_COUNT; IF n>0 THEN v_changed:=true; END IF;
      END IF;
    END LOOP;

    EXIT WHEN NOT v_changed;
  END LOOP;

  -- every marked entity is itself a row to delete (keyed by its PK)
  INSERT INTO _pred SELECT m.tbl, pk.pkcol, m.pkval FROM _mark m JOIN _pk pk ON pk.tbl=m.tbl ON CONFLICT DO NOTHING;

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

  -- ---- SELF-VERIFY completeness (catalog-derived). After the deletes, NO row anywhere may still reference
  -- the tenant's captured identifiers, via EITHER the systemic id-columns (%party_id / user_id / tenant_id /
  -- facility_id) OR any unenforced vocabulary column (_vgap). id sets come from _mark (captured before the
  -- deletes — the rows are gone now, so they can't be recomputed). A hit = the purge missed a table -> RAISE,
  -- rolling the whole purge back so the operator sees exactly which table.column, never a silent orphan. ----
  CREATE TEMP TABLE _idset(kind text, val text) ON COMMIT DROP;
  INSERT INTO _idset SELECT 'party',    pkval FROM _mark WHERE tbl='party';
  INSERT INTO _idset SELECT 'user',     pkval FROM _mark WHERE tbl='user_account';
  INSERT INTO _idset SELECT 'tenant',   pkval FROM _mark WHERE tbl='saas_tenant';
  INSERT INTO _idset SELECT 'facility', pkval FROM _mark WHERE tbl='facility';
  v_res := '';
  FOR r IN
    -- systemic id columns by name + every unenforced vocabulary occurrence
    SELECT tbl, col, kind FROM (
      SELECT c.table_name AS tbl, c.column_name AS col,
             CASE WHEN c.column_name ~ 'party_id$' THEN 'party'
                  WHEN c.column_name='user_id'     THEN 'user'
                  WHEN c.column_name='tenant_id'   THEN 'tenant'
                  WHEN c.column_name='facility_id' THEN 'facility' END AS kind
      FROM information_schema.columns c
      JOIN pg_class rc ON rc.relname=c.table_name AND rc.relkind='r'
      WHERE c.column_name ~ 'party_id$' OR c.column_name IN ('user_id','tenant_id','facility_id')
      UNION
      SELECT tbl, col, kind FROM _vgap
    ) q
  LOOP
    EXECUTE format('SELECT count(*) FROM %I t WHERE t.%I::text IN (SELECT val FROM _idset WHERE kind=%L)',
                   r.tbl, r.col, r.kind) INTO n;
    IF n > 0 THEN v_res := v_res || format('%s.%s=%s ', r.tbl, r.col, n); END IF;
  END LOOP;
  IF v_res <> '' THEN
    RAISE EXCEPTION 'ztest_purge_tenant: RESIDUE remains after purge (an unenforced reference the seed missed) -> %', v_res;
  END IF;
END;
$fn$;

-- Standalone auditor: sweep every reference column (systemic id-names + the unenforced-reference vocabulary)
-- for rows still pointing at an org. Empty = provably clean of party-scoped references (not "clean per a
-- hand-picked list"). Use to confirm a purge or hunt orphans: SELECT * FROM ztest_tenant_residue('<org>');
CREATE OR REPLACE FUNCTION ztest_tenant_residue(p_org text)
RETURNS TABLE(table_name text, column_name text, rows_n bigint) LANGUAGE plpgsql AS $fn$
DECLARE r record; n bigint;
BEGIN
  FOR r IN
    SELECT DISTINCT c.table_name AS tbl, c.column_name AS col
    FROM pg_constraint fc
    JOIN pg_class fct ON fct.oid=fc.confrelid
    JOIN pg_attribute fca ON fca.attrelid=fc.conrelid AND fca.attnum=fc.conkey[1]
    JOIN information_schema.columns c ON c.column_name=fca.attname
    JOIN pg_class rc ON rc.relname=c.table_name AND rc.relkind='r'
    WHERE fc.contype='f' AND array_length(fc.conkey,1)=1
      AND fct.relname IN ('party','person','organization')   -- party-kind reference vocabulary
    ORDER BY 1,2
  LOOP
    EXECUTE format('SELECT count(*) FROM %I WHERE %I::text=%L', r.tbl, r.col, p_org) INTO n;
    IF n > 0 THEN table_name:=r.tbl; column_name:=r.col; rows_n:=n; RETURN NEXT; END IF;
  END LOOP;
END;
$fn$;
