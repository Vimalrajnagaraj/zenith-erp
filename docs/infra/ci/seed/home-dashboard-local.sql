-- Disposable LOCAL verification only; requires the Local ERP Demo organization and Moqui demo vendor.
-- Fails atomically if any AUDIT_HOME_* id already exists. Never run on a production database.
-- Moqui's JDBC timestamps are UTC; fixture times below represent Asia/Kolkata business hours.
BEGIN;
INSERT INTO invoice (invoice_id,invoice_type_enum_id,from_party_id,to_party_id,status_id,invoice_date,currency_uom_id,invoice_total,unpaid_total,applied_payments_total) VALUES
('AUDIT_HOME_S1','InvoiceSales','LOCAL_ERP_ORG','ORG_ZINC','InvoiceFinalized',(CURRENT_DATE::timestamp + interval '00:15' - interval '05:30'),'INR',100.25,100.25,0),
('AUDIT_HOME_S2','InvoiceSales','LOCAL_ERP_ORG','ORG_ZINC','InvoiceFinalized',(CURRENT_DATE::timestamp + interval '23:59:59.5' - interval '05:30'),'INR',200.75,50,150.75),
('AUDIT_HOME_OLD','InvoiceSales','LOCAL_ERP_ORG','ORG_ZINC','InvoiceFinalized',(CURRENT_DATE::timestamp - interval '7 days' + interval '10:00' - interval '05:30'),'INR',90.50,0,90.50),
('AUDIT_HOME_OTHER','InvoiceSales','ORG_ZINC','LOCAL_ERP_ORG','InvoiceFinalized',(CURRENT_DATE::timestamp + interval '10:00' - interval '05:30'),'INR',9999,0,9999),
('AUDIT_HOME_P1','InvoicePurchase','ORG_ZINC','LOCAL_ERP_ORG','InvoiceReceived',(CURRENT_DATE::timestamp + interval '10:00' - interval '05:30'),'INR',500,120,380),
('AUDIT_HOME_PPAID','InvoicePurchase','ORG_ZINC','LOCAL_ERP_ORG','InvoicePmtSent',(CURRENT_DATE::timestamp + interval '10:00' - interval '05:30'),'INR',500,0,500),
('AUDIT_HOME_PDRAFT','InvoicePurchase','ORG_ZINC','LOCAL_ERP_ORG','InvoiceInProcess',(CURRENT_DATE::timestamp + interval '10:00' - interval '05:30'),'INR',1000,1000,0);
INSERT INTO pos_transaction (transaction_id,organization_party_id,status_id,entry_date,completed_date,is_credit,payable_amount,paid_amount,change_amount,linked_invoice_id) VALUES
('AUDIT_HOME_CREDIT','LOCAL_ERP_ORG','PtCompleted',(CURRENT_DATE::timestamp + interval '00:15' - interval '05:30'),(CURRENT_DATE::timestamp + interval '00:16' - interval '05:30'),'Y',100.25,40,0,'AUDIT_HOME_S1'),
('AUDIT_HOME_CASH','LOCAL_ERP_ORG','PtCompleted',(CURRENT_DATE::timestamp - interval '1 day' + interval '23:59' - interval '05:30'),(CURRENT_DATE::timestamp + interval '00:01' - interval '05:30'),'N',100,100,20,NULL);
INSERT INTO pos_payment (payment_id,transaction_id,payment_method,amount) VALUES ('AUDIT_HOME_PAYMENT','AUDIT_HOME_CASH','Cash',120);
INSERT INTO product (product_id,product_name,owner_party_id) VALUES ('AUDIT_HOME_PRODUCT','Dashboard test product','LOCAL_ERP_ORG');
INSERT INTO invoice_item (invoice_id,invoice_item_seq_id,product_id,quantity,amount) VALUES
('AUDIT_HOME_S1','01','AUDIT_HOME_PRODUCT',1,100.25),('AUDIT_HOME_S2','01','AUDIT_HOME_PRODUCT',2,100.375),('AUDIT_HOME_OLD','01','AUDIT_HOME_PRODUCT',1,90.5);
COMMIT;
