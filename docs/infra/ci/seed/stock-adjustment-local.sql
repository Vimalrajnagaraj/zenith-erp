-- Disposable local verification only. Import before stock-adjustment-regression.mjs.
-- No customer rows, credentials or legal identifiers. Password hash is copied locally.
BEGIN;
DO $$ BEGIN
 IF current_database() !~ '^moqui_stock_adjustments_[a-z0-9_]+$' THEN RAISE EXCEPTION 'Use a dedicated disposable Stock Adjustments database'; END IF;
END $$;
INSERT INTO party (party_id,party_type_enum_id,owner_party_id) VALUES ('SAFIX_ORG','PtyOrganization','_NA_'),('SAFIX_OTHER','PtyOrganization','_NA_'),('SAFIX_PERSON','PtyPerson','_NA_');
INSERT INTO organization (party_id,organization_name) VALUES ('SAFIX_ORG','Stock adjustment audit'),('SAFIX_OTHER','Stock adjustment foreign audit');
INSERT INTO party_role (party_id,role_type_id) VALUES ('SAFIX_ORG','OrgInternal'),('SAFIX_OTHER','OrgInternal');
INSERT INTO party_role (party_id,role_type_id) VALUES ('SAFIX_PERSON','Employee');
INSERT INTO party_relationship (party_relationship_id,from_party_id,to_party_id,from_role_type_id,to_role_type_id,relationship_type_enum_id,from_date)
VALUES ('SAFIX_MEMBERSHIP','SAFIX_PERSON','SAFIX_ORG','Employee','OrgInternal','PrtEmployee','2024-01-01');
INSERT INTO facility (facility_id,facility_name,owner_party_id,facility_type_enum_id) VALUES
('SAFIX_A','Adjustment audit sender','SAFIX_ORG','FcTpRetailStore'),('SAFIX_B','Adjustment audit receiver','SAFIX_ORG','FcTpRetailStore'),('SAFIX_FOREIGN','Foreign audit warehouse','SAFIX_OTHER','FcTpRetailStore');
INSERT INTO product (product_id,pseudo_id,product_name,owner_party_id,product_type_enum_id,mrp_amount,inventory_tracked,enable_batch_tracking,enable_serial_tracking) VALUES
('SAFIX_P','SAFIX-SKU','Adjustment fractional test','SAFIX_ORG','PtAsset',10,'Y','N','N'),
('SAFIX_BATCH','SAFIX-BATCH','Adjustment batch test','SAFIX_ORG','PtAsset',10,'Y','Y','N'),
('SAFIX_SERIAL','SAFIX-SERIAL','Adjustment serial test','SAFIX_ORG','PtAsset',10,'Y','N','Y'),
('SAFIX_NEW','SAFIX-NEW','Adjustment opening test','SAFIX_ORG','PtAsset',10,'N','N','N'),
('SAFIX_FOREIGN','FOREIGN-SKU','Foreign transfer product','SAFIX_OTHER','PtAsset',10,'Y','N','N');
INSERT INTO asset (asset_id,product_id,owner_party_id,facility_id,asset_type_enum_id,status_id,quantity_on_hand_total,available_to_promise_total,batch_number,expiry_date,manufacturing_date,valuation_rate,mrp_amount) VALUES
('SAFIX_A1','SAFIX_P','SAFIX_ORG','SAFIX_A','AstTpInventory','AstAvailable',10,8,NULL,NULL,NULL,5,10),
('SAFIX_A2','SAFIX_P','SAFIX_ORG','SAFIX_A','AstTpInventory','AstAvailable',5,5,NULL,NULL,NULL,5,10),
('SAFIX_B1','SAFIX_P','SAFIX_ORG','SAFIX_B','AstTpInventory','AstAvailable',2,2,NULL,NULL,NULL,5,10),
('SAFIX_SUPPLY','SAFIX_P','SAFIX_ORG','SAFIX_A','AstTpSupplies','AstAvailable',100,100,NULL,NULL,NULL,5,10),
('SAFIX_BATCH1','SAFIX_BATCH','SAFIX_ORG','SAFIX_A','AstTpInventory','AstAvailable',8,8,'SAFIX-LOT','2027-03-01','2026-03-01',4,10),
('SAFIX_S1','SAFIX_SERIAL','SAFIX_ORG','SAFIX_A','AstTpInventory','AstAvailable',3,2,NULL,NULL,NULL,5,10),
('SAFIX_BAD_OWNER','SAFIX_P','SAFIX_OTHER','SAFIX_A','AstTpInventory','AstAvailable',100,100,NULL,NULL,NULL,5,10);
INSERT INTO product_serial_number (serial_number_id,serial_number,product_id,facility_id,asset_id,status_id,received_date) VALUES
('SAFIX_SN1','SAFIX-SN-1','SAFIX_SERIAL','SAFIX_A','SAFIX_S1','SnInStock',CURRENT_DATE),
('SAFIX_SN2','SAFIX-SN-2','SAFIX_SERIAL','SAFIX_A','SAFIX_S1','SnInStock',CURRENT_DATE),
('SAFIX_SN3','SAFIX-SN-3','SAFIX_SERIAL','SAFIX_A','SAFIX_S1','SnReserved',CURRENT_DATE),
('SAFIX_SN4','SAFIX-SN-4','SAFIX_SERIAL','SAFIX_A','SAFIX_S1','SnReturned',CURRENT_DATE);
INSERT INTO stock_adjustment (stock_adjustment_id,organization_party_id,facility_id,adjustment_type,adjustment_date,status_id,remarks) VALUES ('SAFIX_FOREIGN','SAFIX_OTHER','SAFIX_FOREIGN','PhysicalCount',CURRENT_TIMESTAMP,'AdjPending','Foreign adjustment marker');
INSERT INTO user_account (user_id,username,user_full_name,current_password,password_salt,password_hash_type,password_base64,password_set_date,disabled,require_password_change,locale,time_zone,party_id)
SELECT id,audit_username,'Stock adjustment audit',current_password,password_salt,password_hash_type,password_base64,password_set_date,'N','N',locale,time_zone,'SAFIX_PERSON'
FROM user_account CROSS JOIN (VALUES ('SAFIX_USER','stock.adjustment.audit'),('SAFIX_VIEW','stock.adjustment.viewer'),('SAFIX_NOORG','stock.adjustment.noorg'),('SAFIX_MANAGER','stock.adjustment.manager')) AS users(id,audit_username)
WHERE user_account.username='john.doe';
INSERT INTO user_group_member (user_group_id,user_id,from_date)
SELECT user_group_id,id,from_date FROM user_group_member CROSS JOIN (VALUES ('SAFIX_USER'),('SAFIX_NOORG')) AS users(id) WHERE user_id='EX_JOHN_DOE';
INSERT INTO user_group_member (user_group_id,user_id,from_date) VALUES ('ZENITH_ALL','SAFIX_VIEW',CURRENT_TIMESTAMP),('ZENITH_AUDITOR','SAFIX_VIEW',CURRENT_TIMESTAMP);
INSERT INTO user_group_member (user_group_id,user_id,from_date) VALUES ('ZENITH_ALL','SAFIX_MANAGER','2024-01-01'),('ZENITH_INVENTORY_MGR','SAFIX_MANAGER','2024-01-01');
INSERT INTO user_preference (user_id,preference_key,preference_value) VALUES ('SAFIX_USER','ACTIVE_ORGANIZATION','SAFIX_ORG'),('SAFIX_VIEW','ACTIVE_ORGANIZATION','SAFIX_ORG'),('SAFIX_NOORG','ACTIVE_ORGANIZATION','_NA_');
INSERT INTO user_preference (user_id,preference_key,preference_value) VALUES ('SAFIX_MANAGER','ACTIVE_ORGANIZATION','SAFIX_ORG');
COMMIT;
