-- Read-only captured synthetic group IDs; used only by the labelled disposable stack.
SELECT json_build_object(
 'groups', (SELECT json_agg(g) FROM (SELECT customer_group_id AS id, organization_party_id AS org, group_name AS name, is_active AS active, payment_terms AS terms, description FROM customer_group WHERE customer_group_id IN ('CGQA_EMPTY_A','CGQA_POPULATED_A','CGQA_FOREIGN_B') ORDER BY customer_group_id) g),
 'members', COALESCE((SELECT json_agg(m) FROM (SELECT customer_group_id AS "group", party_id AS party, from_date::text AS "fromDate", thru_date::text AS "thruDate" FROM customer_group_member WHERE customer_group_id IN ('CGQA_EMPTY_A','CGQA_POPULATED_A','CGQA_FOREIGN_B') ORDER BY customer_group_id,party_id,from_date) m), '[]'::json),
 'parties', (SELECT json_agg(p) FROM (SELECT party_id AS id, owner_party_id AS owner FROM party WHERE party_id IN ('CITEST_A_CUST','CITEST_B_CUST') ORDER BY party_id) p)
);
