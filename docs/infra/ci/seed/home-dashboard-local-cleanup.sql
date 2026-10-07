-- LOCAL verification cleanup only, after a successful home-dashboard-local.sql import.
-- Every predicate uses an exact id created by that fixture.
BEGIN;
DELETE FROM invoice_item WHERE invoice_id IN ('AUDIT_HOME_S1','AUDIT_HOME_S2','AUDIT_HOME_OLD') AND invoice_item_seq_id='01';
DELETE FROM pos_payment WHERE payment_id='AUDIT_HOME_PAYMENT';
DELETE FROM pos_transaction WHERE transaction_id IN ('AUDIT_HOME_CREDIT','AUDIT_HOME_CASH');
DELETE FROM invoice WHERE invoice_id IN ('AUDIT_HOME_S1','AUDIT_HOME_S2','AUDIT_HOME_OLD','AUDIT_HOME_OTHER','AUDIT_HOME_P1','AUDIT_HOME_PPAID','AUDIT_HOME_PDRAFT');
DELETE FROM product WHERE product_id='AUDIT_HOME_PRODUCT';
COMMIT;
