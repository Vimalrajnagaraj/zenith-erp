-- Disposable local verification only. Import before expiry-risk-regression.mjs.
-- No customer rows, credentials or legal identifiers. Password hash is copied locally.
BEGIN;
DO $$ BEGIN
 IF current_database() !~ '^moqui_expiry_risk_[a-z0-9_]+$' THEN RAISE EXCEPTION 'Use a dedicated disposable Expiry Risk database'; END IF;
END $$;
INSERT INTO party (party_id,party_type_enum_id,owner_party_id) VALUES ('ERFIX_ORG','PtyOrganization','_NA_'),('ERFIX_OTHER','PtyOrganization','_NA_'),('ERFIX_PERSON','PtyPerson','_NA_');
INSERT INTO organization (party_id,organization_name) VALUES ('ERFIX_ORG','Expiry Risk audit'),('ERFIX_OTHER','Expiry Risk foreign audit');
INSERT INTO party_role (party_id,role_type_id) VALUES ('ERFIX_ORG','OrgInternal'),('ERFIX_OTHER','OrgInternal');
INSERT INTO party_role (party_id,role_type_id) VALUES ('ERFIX_PERSON','Employee');
INSERT INTO party_relationship (party_relationship_id,from_party_id,to_party_id,from_role_type_id,to_role_type_id,relationship_type_enum_id,from_date)
VALUES ('ERFIX_MEMBERSHIP','ERFIX_PERSON','ERFIX_ORG','Employee','OrgInternal','PrtEmployee','2024-01-01');
INSERT INTO facility (facility_id,facility_name,owner_party_id,facility_type_enum_id) VALUES
('ERFIX_A','Sample Main Warehouse','ERFIX_ORG','FcTpRetailStore'),('ERFIX_B','Sample Secondary Warehouse','ERFIX_ORG','FcTpRetailStore'),('ERFIX_FOREIGN','Foreign audit warehouse','ERFIX_OTHER','FcTpRetailStore');
INSERT INTO product (product_id,pseudo_id,product_name,owner_party_id,product_type_enum_id,mrp_amount,inventory_tracked,enable_batch_tracking,enable_serial_tracking) VALUES
('ERFIX_P','ERFIX-SKU','Sample pantry stock','ERFIX_ORG','PtAsset',10,'Y','N','N'),
('ERFIX_BATCH','ERFIX-BATCH','Sample batch-tracked stock','ERFIX_ORG','PtAsset',10,'Y','Y','N'),
('ERFIX_SERIAL','ERFIX-SERIAL','Sample serial stock','ERFIX_ORG','PtAsset',10,'Y','N','Y'),
('ERFIX_NEW','ERFIX-NEW','Sample new stock','ERFIX_ORG','PtAsset',10,'N','N','N'),
('ERFIX_FOREIGN','FOREIGN-SKU','Foreign transfer product','ERFIX_OTHER','PtAsset',10,'Y','N','N');
INSERT INTO asset (asset_id,product_id,owner_party_id,facility_id,asset_type_enum_id,status_id,quantity_on_hand_total,available_to_promise_total,batch_number,expiry_date,manufacturing_date,valuation_rate,mrp_amount) VALUES
('ERFIX_A1','ERFIX_P','ERFIX_ORG','ERFIX_A','AstTpInventory','AstAvailable',10,8,NULL,NULL,NULL,5,10),
('ERFIX_A2','ERFIX_P','ERFIX_ORG','ERFIX_A','AstTpInventory','AstAvailable',5,5,NULL,NULL,NULL,5,10),
('ERFIX_B1','ERFIX_P','ERFIX_ORG','ERFIX_B','AstTpInventory','AstAvailable',2,2,NULL,NULL,NULL,5,10),
('ERFIX_SUPPLY','ERFIX_P','ERFIX_ORG','ERFIX_A','AstTpSupplies','AstAvailable',100,100,NULL,NULL,NULL,5,10),
('ERFIX_BATCH1','ERFIX_BATCH','ERFIX_ORG','ERFIX_A','AstTpInventory','AstAvailable',8,8,'ERFIX-LOT','2027-03-01','2026-03-01',4,10),
('ERFIX_S1','ERFIX_SERIAL','ERFIX_ORG','ERFIX_A','AstTpInventory','AstAvailable',3,2,NULL,NULL,NULL,5,10),
('ERFIX_BAD_OWNER','ERFIX_P','ERFIX_OTHER','ERFIX_A','AstTpInventory','AstAvailable',100,100,NULL,NULL,NULL,5,10);
INSERT INTO product_serial_number (serial_number_id,serial_number,product_id,facility_id,asset_id,status_id,received_date) VALUES
('ERFIX_SN1','ERFIX-SN-1','ERFIX_SERIAL','ERFIX_A','ERFIX_S1','SnInStock',CURRENT_DATE),
('ERFIX_SN2','ERFIX-SN-2','ERFIX_SERIAL','ERFIX_A','ERFIX_S1','SnInStock',CURRENT_DATE),
('ERFIX_SN3','ERFIX-SN-3','ERFIX_SERIAL','ERFIX_A','ERFIX_S1','SnReserved',CURRENT_DATE),
('ERFIX_SN4','ERFIX-SN-4','ERFIX_SERIAL','ERFIX_A','ERFIX_S1','SnReturned',CURRENT_DATE);
INSERT INTO stock_adjustment (stock_adjustment_id,organization_party_id,facility_id,adjustment_type,adjustment_date,status_id,remarks) VALUES ('ERFIX_FOREIGN','ERFIX_OTHER','ERFIX_FOREIGN','PhysicalCount',CURRENT_TIMESTAMP,'AdjPending','Foreign adjustment marker');
INSERT INTO user_account (user_id,username,user_full_name,current_password,password_salt,password_hash_type,password_base64,password_set_date,disabled,require_password_change,locale,time_zone,party_id)
SELECT id,audit_username,'Expiry Risk audit',current_password,password_salt,password_hash_type,password_base64,password_set_date,'N','N',locale,time_zone,'ERFIX_PERSON'
FROM user_account CROSS JOIN (VALUES ('ERFIX_USER','expiry.risk.audit'),('ERFIX_VIEW','expiry.risk.viewer'),('ERFIX_NOORG','expiry.risk.noorg'),('ERFIX_MANAGER','expiry.risk.manager')) AS users(id,audit_username)
WHERE user_account.username='john.doe';
INSERT INTO user_group_member (user_group_id,user_id,from_date)
SELECT user_group_id,id,from_date FROM user_group_member CROSS JOIN (VALUES ('ERFIX_USER'),('ERFIX_NOORG')) AS users(id) WHERE user_id='EX_JOHN_DOE';
INSERT INTO user_group_member (user_group_id,user_id,from_date) VALUES ('ZENITH_ALL','ERFIX_VIEW',CURRENT_TIMESTAMP),('ZENITH_AUDITOR','ERFIX_VIEW',CURRENT_TIMESTAMP);
INSERT INTO user_group_member (user_group_id,user_id,from_date) VALUES ('ZENITH_ALL','ERFIX_MANAGER','2024-01-01'),('ZENITH_INVENTORY_MGR','ERFIX_MANAGER','2024-01-01');
INSERT INTO user_preference (user_id,preference_key,preference_value) VALUES ('ERFIX_USER','ACTIVE_ORGANIZATION','ERFIX_ORG'),('ERFIX_VIEW','ACTIVE_ORGANIZATION','ERFIX_ORG'),('ERFIX_NOORG','ACTIVE_ORGANIZATION','_NA_');
INSERT INTO user_preference (user_id,preference_key,preference_value) VALUES ('ERFIX_MANAGER','ACTIVE_ORGANIZATION','ERFIX_ORG');
UPDATE asset SET expiry_date = CURRENT_DATE + INTERVAL '30 days', last_updated_stamp=CURRENT_TIMESTAMP WHERE asset_id IN ('ERFIX_A1','ERFIX_A2','ERFIX_SUPPLY','ERFIX_BAD_OWNER','ERFIX_S1');
UPDATE asset SET expiry_date = CURRENT_DATE - INTERVAL '2 days', last_updated_stamp=CURRENT_TIMESTAMP WHERE asset_id='ERFIX_BATCH1';
UPDATE asset SET expiry_date = CURRENT_DATE + INTERVAL '91 days', last_updated_stamp=CURRENT_TIMESTAMP WHERE asset_id='ERFIX_B1';
INSERT INTO asset (asset_id,product_id,owner_party_id,facility_id,asset_type_enum_id,status_id,quantity_on_hand_total,available_to_promise_total,expiry_date,valuation_rate,mrp_amount,last_updated_stamp) VALUES
('ERFIX_TODAY','ERFIX_P','ERFIX_ORG','ERFIX_A','AstTpInventory','AstAvailable',1,1,CURRENT_DATE,0,10,CURRENT_TIMESTAMP),
('ERFIX_EDGE31','ERFIX_P','ERFIX_ORG','ERFIX_A','AstTpInventory','AstAvailable',1,1,CURRENT_DATE+INTERVAL '31 days',2,10,CURRENT_TIMESTAMP),
('ERFIX_EDGE60','ERFIX_P','ERFIX_ORG','ERFIX_A','AstTpInventory','AstAvailable',1,1,CURRENT_DATE+INTERVAL '60 days',2,10,CURRENT_TIMESTAMP),
('ERFIX_EDGE61','ERFIX_P','ERFIX_ORG','ERFIX_A','AstTpInventory','AstAvailable',1,1,CURRENT_DATE+INTERVAL '61 days',2,10,CURRENT_TIMESTAMP),
('ERFIX_EDGE90','ERFIX_P','ERFIX_ORG','ERFIX_A','AstTpInventory','AstAvailable',1,1,CURRENT_DATE+INTERVAL '90 days',2,10,CURRENT_TIMESTAMP),
('ERFIX_SCRAPPED','ERFIX_P','ERFIX_ORG','ERFIX_A','AstTpInventory','AstMorgue',1,1,CURRENT_DATE,2,10,CURRENT_TIMESTAMP);
COMMIT;
