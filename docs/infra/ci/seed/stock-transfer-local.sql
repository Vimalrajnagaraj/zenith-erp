-- Disposable local verification only. Import before stock-transfer-regression.mjs.
-- No customer rows, credentials or legal identifiers. Password hash is copied locally.
BEGIN;
INSERT INTO party (party_id,party_type_enum_id,owner_party_id) VALUES ('STFIX_ORG','PtyOrganization','_NA_'),('STFIX_OTHER','PtyOrganization','_NA_'),('STFIX_PERSON','PtyPerson','_NA_');
INSERT INTO organization (party_id,organization_name) VALUES ('STFIX_ORG','Stock transfer audit'),('STFIX_OTHER','Stock transfer foreign audit');
INSERT INTO party_role (party_id,role_type_id) VALUES ('STFIX_ORG','OrgInternal'),('STFIX_OTHER','OrgInternal');
INSERT INTO party_role (party_id,role_type_id) VALUES ('STFIX_PERSON','Employee');
INSERT INTO party_relationship (party_relationship_id,from_party_id,to_party_id,from_role_type_id,to_role_type_id,relationship_type_enum_id,from_date)
VALUES ('STFIX_MEMBERSHIP','STFIX_PERSON','STFIX_ORG','Employee','OrgInternal','PrtEmployee','2024-01-01');
INSERT INTO facility (facility_id,facility_name,owner_party_id,facility_type_enum_id) VALUES
('STFIX_A','Transfer audit sender','STFIX_ORG','FcTpRetailStore'),('STFIX_B','Transfer audit receiver','STFIX_ORG','FcTpRetailStore'),('STFIX_FOREIGN','Foreign audit warehouse','STFIX_OTHER','FcTpRetailStore');
INSERT INTO product (product_id,pseudo_id,product_name,owner_party_id,product_type_enum_id,mrp_amount,inventory_tracked,enable_batch_tracking,enable_serial_tracking) VALUES
('STFIX_P','STFIX-SKU','Transfer fractional test','STFIX_ORG','PtAsset',10,'Y','N','N'),
('STFIX_BATCH','STFIX-BATCH','Transfer batch test','STFIX_ORG','PtAsset',10,'Y','Y','N'),
('STFIX_SERIAL','STFIX-SERIAL','Transfer serial test','STFIX_ORG','PtAsset',10,'Y','N','Y'),
('STFIX_SERVICE','STFIX-SERVICE','Transfer service must be rejected','STFIX_ORG','PtService',10,'N','N','N'),
('STFIX_FOREIGN','FOREIGN-SKU','Foreign transfer product','STFIX_OTHER','PtAsset',10,'Y','N','N');
INSERT INTO asset (asset_id,product_id,owner_party_id,facility_id,asset_type_enum_id,status_id,quantity_on_hand_total,available_to_promise_total,batch_number,expiry_date,manufacturing_date,valuation_rate,mrp_amount) VALUES
('STFIX_A1','STFIX_P','STFIX_ORG','STFIX_A','AstTpInventory','AstAvailable',10,8,NULL,NULL,NULL,5,10),
('STFIX_A2','STFIX_P','STFIX_ORG','STFIX_A','AstTpInventory','AstAvailable',5,5,NULL,NULL,NULL,5,10),
('STFIX_B1','STFIX_P','STFIX_ORG','STFIX_B','AstTpInventory','AstAvailable',2,2,NULL,NULL,NULL,5,10),
('STFIX_SUPPLY','STFIX_P','STFIX_ORG','STFIX_A','AstTpSupplies','AstAvailable',100,100,NULL,NULL,NULL,5,10),
('STFIX_BATCH1','STFIX_BATCH','STFIX_ORG','STFIX_A','AstTpInventory','AstAvailable',8,8,'STFIX-LOT','2027-03-01','2026-03-01',4,10),
('STFIX_S1','STFIX_SERIAL','STFIX_ORG','STFIX_A','AstTpInventory','AstAvailable',3,3,NULL,NULL,NULL,5,10),
('STFIX_BAD_OWNER','STFIX_P','STFIX_OTHER','STFIX_A','AstTpInventory','AstAvailable',100,100,NULL,NULL,NULL,5,10);
INSERT INTO product_serial_number (serial_number_id,serial_number,product_id,facility_id,asset_id,status_id,received_date) VALUES
('STFIX_SN1','STFIX-SN-1','STFIX_SERIAL','STFIX_A','STFIX_S1','SnInStock',CURRENT_DATE),
('STFIX_SN2','STFIX-SN-2','STFIX_SERIAL','STFIX_A','STFIX_S1','SnInStock',CURRENT_DATE),
('STFIX_SN3','STFIX-SN-3','STFIX_SERIAL','STFIX_A','STFIX_S1','SnInStock',CURRENT_DATE);
INSERT INTO stock_transfer (stock_transfer_id,transfer_number,organization_party_id,from_facility_id,to_facility_id,transfer_date,status_id,total_value,eway_bill_required) VALUES
('STFIX_FOREIGN','STFIX-FOREIGN-TRANSFER','STFIX_OTHER','STFIX_FOREIGN','STFIX_FOREIGN',CURRENT_TIMESTAMP,'StxDraft',0,'N');
INSERT INTO user_account (user_id,username,user_full_name,current_password,password_salt,password_hash_type,password_base64,password_set_date,disabled,require_password_change,locale,time_zone,party_id)
SELECT id,audit_username,'Stock transfer audit',current_password,password_salt,password_hash_type,password_base64,password_set_date,'N','N',locale,time_zone,'STFIX_PERSON'
FROM user_account CROSS JOIN (VALUES ('STFIX_USER','stock.transfer.audit'),('STFIX_VIEW','stock.transfer.viewer'),('STFIX_NOORG','stock.transfer.noorg'),('STFIX_MANAGER','stock.transfer.manager')) AS users(id,audit_username)
WHERE user_account.username='john.doe';
INSERT INTO user_group_member (user_group_id,user_id,from_date)
SELECT user_group_id,id,from_date FROM user_group_member CROSS JOIN (VALUES ('STFIX_USER'),('STFIX_NOORG')) AS users(id) WHERE user_id='EX_JOHN_DOE';
INSERT INTO user_group_member (user_group_id,user_id,from_date) VALUES ('ZENITH_ALL','STFIX_VIEW',CURRENT_TIMESTAMP),('ZENITH_AUDITOR','STFIX_VIEW',CURRENT_TIMESTAMP);
INSERT INTO user_group_member (user_group_id,user_id,from_date) VALUES ('ZENITH_ALL','STFIX_MANAGER','2024-01-01'),('ZENITH_INVENTORY_MGR','STFIX_MANAGER','2024-01-01');
INSERT INTO user_preference (user_id,preference_key,preference_value) VALUES ('STFIX_USER','ACTIVE_ORGANIZATION','STFIX_ORG'),('STFIX_VIEW','ACTIVE_ORGANIZATION','STFIX_ORG'),('STFIX_NOORG','ACTIVE_ORGANIZATION','_NA_');
INSERT INTO user_preference (user_id,preference_key,preference_value) VALUES ('STFIX_MANAGER','ACTIVE_ORGANIZATION','STFIX_ORG');
COMMIT;
