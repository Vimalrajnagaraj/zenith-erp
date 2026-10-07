-- Disposable LOCAL demo verification only. Exact SLFIX_* IDs fail atomically on collision.
BEGIN;
SET LOCAL TIME ZONE 'UTC';
INSERT INTO facility (facility_id, facility_name, owner_party_id, facility_type_enum_id) VALUES
('SLFIX_A','Stock test A','LOCAL_ERP_ORG','FcTpRetailStore'),
('SLFIX_B','Stock test B','LOCAL_ERP_ORG','FcTpRetailStore'),
('SLFIX_FOREIGN','Stock foreign warehouse','ORG_ZINC','FcTpRetailStore');
INSERT INTO product (product_id, pseudo_id, product_name, owner_party_id, hsn_code, mrp_amount) VALUES
('SLFIX_P&1','SLFIX-001','Stock test multi-batch','LOCAL_ERP_ORG','111111',9),
('SLFIX_ZERO','SLFIX-002','Stock test zero','LOCAL_ERP_ORG','222222',9),
('SLFIX_NONE','SLFIX-003','Stock test no warehouse','LOCAL_ERP_ORG','333333',9),
('SLFIX_NEG','SLFIX-004','Stock test negative','LOCAL_ERP_ORG','444444',9),
('SLFIX_FOREIGN','SLFIX-OTHER','Stock foreign product','ORG_ZINC','111111',100);
INSERT INTO lot (lot_id) VALUES ('SLFIX_EMPTY');
INSERT INTO asset (asset_id,product_id,owner_party_id,facility_id,lot_id,asset_type_enum_id,
    quantity_on_hand_total,available_to_promise_total,valuation_rate,acquire_cost,last_updated_stamp) VALUES
('SLFIX_A1','SLFIX_P&1','LOCAL_ERP_ORG','SLFIX_A',NULL,'AstTpInventory',10,8,3,2,CURRENT_TIMESTAMP),
('SLFIX_EMPTY','SLFIX_P&1','LOCAL_ERP_ORG','SLFIX_A','SLFIX_EMPTY','AstTpInventory',0,0,NULL,NULL,CURRENT_TIMESTAMP),
('SLFIX_B1','SLFIX_P&1','LOCAL_ERP_ORG','SLFIX_B',NULL,'AstTpInventory',5,4,NULL,4,CURRENT_TIMESTAMP),
('SLFIX_ZERO','SLFIX_ZERO','LOCAL_ERP_ORG','SLFIX_A',NULL,'AstTpInventory',0,0,NULL,NULL,CURRENT_TIMESTAMP-INTERVAL '10 days'),
('SLFIX_NONE','SLFIX_NONE','LOCAL_ERP_ORG',NULL,NULL,'AstTpInventory',7,7,NULL,NULL,CURRENT_TIMESTAMP+INTERVAL '2 days'),
('SLFIX_NEG','SLFIX_NEG','LOCAL_ERP_ORG','SLFIX_A',NULL,'AstTpInventory',-2,-3,NULL,5,CURRENT_TIMESTAMP-INTERVAL '10 days'),
('SLFIX_SUPPLY','SLFIX_P&1','LOCAL_ERP_ORG','SLFIX_A',NULL,'AstTpSupplies',100,100,NULL,100,CURRENT_TIMESTAMP),
('SLFIX_FOREIGN','SLFIX_FOREIGN','ORG_ZINC','SLFIX_FOREIGN',NULL,'AstTpInventory',99,99,NULL,100,CURRENT_TIMESTAMP),
('SLFIX_BAD_OWNER','SLFIX_P&1','ORG_ZINC','SLFIX_A',NULL,'AstTpInventory',99,99,NULL,100,CURRENT_TIMESTAMP);
-- Dedicated demo user exercises the global shop default without changing the reviewer account.
INSERT INTO user_account (user_id,username,user_full_name,current_password,password_salt,password_hash_type,
    password_base64,password_set_date,disabled,require_password_change,locale,time_zone,party_id)
SELECT 'SLFIX_USER','stock.level.audit','Stock level audit',current_password,password_salt,password_hash_type,
    password_base64,password_set_date,'N','N',locale,time_zone,party_id FROM user_account WHERE username='john.doe';
INSERT INTO user_group_member (user_group_id,user_id,from_date)
SELECT user_group_id,'SLFIX_USER',from_date FROM user_group_member WHERE user_id='EX_JOHN_DOE';
INSERT INTO user_preference (user_id,preference_key,preference_value) VALUES
('SLFIX_USER','ACTIVE_ORGANIZATION','LOCAL_ERP_ORG'),('SLFIX_USER','ACTIVE_SHOP','SLFIX_A');
COMMIT;
