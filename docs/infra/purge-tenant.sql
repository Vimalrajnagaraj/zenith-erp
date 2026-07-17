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
-- .performed_by_user_id, approved_by_user_id, ...). The engine closes that with _refcol: every UNENFORCED
-- (no-FK) reference column to a root entity (party/person/organization -> party, user_account -> user,
-- saas_tenant -> tenant, facility -> facility), identified TWO ways — by NAMING CONVENTION (a suffix->kind
-- map: %party_id/%person_id/%department_id/%employee_id -> party; %user_id or %_by -> user; %facility_id ->
-- facility; %tenant_id -> tenant) AND by the real-FK column vocabulary (for odd spellings like
-- preferred_supplier_id). The closure propagates through _refcol AND real FKs; the SEED covers _refcol; the
-- VERIFY sweeps _refcol. One set drives all three, so seed and verify are symmetric (a clean purge always
-- self-verifies) and both update themselves as the schema grows. A value check makes an over-broad name
-- harmless: a non-reference column never holds one of the tenant's ids, so it never matches.
-- Residual boundary (now tiny, watched by lint-purge-vocabulary.sh): a root reference whose column name
-- matches NEITHER a convention suffix NOR any FK column name — nothing in the catalog then marks it as a
-- reference, and value-scanning arbitrary columns can't be made sound (Moqui id spaces overlap across
-- entities). The lint flags any such name at schema-change time so it never lands silently.
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

  -- _refcol = every UNENFORCED (no-FK) reference column to a root entity, from BOTH sources:
  --   (1) NAMING CONVENTION: a suffix -> kind map covering how Moqui names references. This is what catches
  --       columns that are an FK NOWHERE, e.g. approved_by_user_id / operator_party_id / cashier_party_id /
  --       from_facility_id — the FK vocabulary alone would miss these (they never appear in a constraint).
  --   (2) FK VOCABULARY (_vocab): real-FK column names, to catch odd spellings the suffixes don't (e.g.
  --       preferred_supplier_id).
  -- FK occurrences are handled by the closure (guaranteed clean), so they are excluded here. The value check
  -- at seed/verify time makes an over-broad NAME harmless: a non-reference column (gateway_customer_id holding
  -- a Stripe id, a sort_by holding 'asc') never equals one of the tenant's ids, so it simply never matches.
  -- Residual boundary (now tiny, watched by docs/infra/lint-purge-vocabulary.sh): a root reference whose name
  -- matches NEITHER a convention suffix NOR any FK column name — nothing then marks it as a reference.
  CREATE TEMP TABLE _refcol ON COMMIT DROP AS
    WITH named AS (
      SELECT c.table_name AS tbl, c.column_name AS col,
        CASE WHEN c.column_name ~ '(party_id|person_id|department_id|employee_id)$' THEN 'party'
             WHEN c.column_name ~ 'user_id$' OR c.column_name ~ '_by$'              THEN 'user'
             WHEN c.column_name ~ 'facility_id$'                                    THEN 'facility'
             WHEN c.column_name ~ 'tenant_id$'                                      THEN 'tenant' END AS kind
      FROM information_schema.columns c
      JOIN pg_class rc ON rc.relname=c.table_name AND rc.relkind='r' AND rc.relnamespace='public'::regnamespace
      WHERE c.table_schema='public'
        AND c.column_name ~ '(party_id|person_id|department_id|employee_id|user_id|facility_id|tenant_id|_by)$'
      UNION
      SELECT c.table_name, c.column_name, v.kind
      FROM _vocab v JOIN information_schema.columns c ON c.column_name=v.col
      JOIN pg_class rc ON rc.relname=c.table_name AND rc.relkind='r' AND rc.relnamespace='public'::regnamespace
      WHERE c.table_schema='public'
    )
    SELECT n.tbl, n.col, n.kind,
           CASE n.kind WHEN 'party' THEN 'party' WHEN 'user' THEN 'user_account'
                       WHEN 'tenant' THEN 'saas_tenant' WHEN 'facility' THEN 'facility' END AS kindtbl,
           pk.pkcol
    FROM named n LEFT JOIN _pk pk ON pk.tbl=n.tbl
    WHERE n.kind IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM pg_constraint fc JOIN pg_class fct ON fct.oid=fc.conrelid
        JOIN pg_attribute fca ON fca.attrelid=fc.conrelid AND fca.attnum=fc.conkey[1]
        WHERE fc.contype='f' AND fct.relname=n.tbl AND fca.attname=n.col);

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

    -- (b) unenforced reference columns (naming-convention + FK-vocabulary): rows whose value is in the
    -- referenced kind's id set
    FOR r IN SELECT tbl, col, kindtbl, pkcol FROM _refcol
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
  -- the tenant's captured identifiers through any unenforced reference column (_refcol — naming-convention +
  -- FK-vocabulary, non-FK occurrences; FK occurrences are guaranteed clean by the closure). id sets come from
  -- _mark (captured before the deletes — the rows are gone now, so they can't be recomputed). A hit = the
  -- purge missed a table -> RAISE, rolling the whole purge back so the operator sees exactly which
  -- table.column, never a silent orphan. Seed (loop b) and verify use the SAME _refcol, so a clean purge
  -- always self-verifies. ----
  CREATE TEMP TABLE _idset(kind text, val text) ON COMMIT DROP;
  INSERT INTO _idset SELECT 'party',    pkval FROM _mark WHERE tbl='party';
  INSERT INTO _idset SELECT 'user',     pkval FROM _mark WHERE tbl='user_account';
  INSERT INTO _idset SELECT 'tenant',   pkval FROM _mark WHERE tbl='saas_tenant';
  INSERT INTO _idset SELECT 'facility', pkval FROM _mark WHERE tbl='facility';
  v_res := '';
  FOR r IN SELECT tbl, col, kind FROM _refcol
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

-- Standalone auditor: sweep every party-kind reference column (naming-convention + FK vocabulary) for rows
-- still pointing at an org. Empty = provably clean of party-scoped references (not "clean per a hand-picked
-- list"). Use to confirm a purge or hunt orphans: SELECT * FROM ztest_tenant_residue('<org>');
CREATE OR REPLACE FUNCTION ztest_tenant_residue(p_org text)
RETURNS TABLE(table_name text, column_name text, rows_n bigint) LANGUAGE plpgsql AS $fn$
DECLARE r record; n bigint;
BEGIN
  FOR r IN
    SELECT DISTINCT c.table_name AS tbl, c.column_name AS col
    FROM information_schema.columns c
    JOIN pg_class rc ON rc.relname=c.table_name AND rc.relkind='r' AND rc.relnamespace='public'::regnamespace
    WHERE c.table_schema='public'
      AND (c.column_name ~ '(party_id|person_id|department_id|employee_id)$'   -- party-kind names
       OR c.column_name IN (SELECT DISTINCT ca.attname FROM pg_constraint fc   -- + odd real-FK spellings
            JOIN pg_class pt ON pt.oid=fc.confrelid
            JOIN pg_attribute ca ON ca.attrelid=fc.conrelid AND ca.attnum=fc.conkey[1]
            WHERE fc.contype='f' AND pt.relname IN ('party','person','organization')))
    ORDER BY 1,2
  LOOP
    EXECUTE format('SELECT count(*) FROM %I WHERE %I::text=%L', r.tbl, r.col, p_org) INTO n;
    IF n > 0 THEN table_name:=r.tbl; column_name:=r.col; rows_n:=n; RETURN NEXT; END IF;
  END LOOP;
END;
$fn$;
