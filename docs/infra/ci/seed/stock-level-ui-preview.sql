-- Explicitly requested visual samples. LOCAL demo only; never load in production.
-- Public example names/quantities from the supplied visual reference, not a live tenant.
BEGIN;
SET LOCAL TIME ZONE 'UTC';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM party WHERE party_id='LOCAL_ERP_ORG') THEN
    RAISE EXCEPTION 'Stock preview requires the named Local ERP Demo organization';
  END IF;
END $$;
INSERT INTO facility (facility_id,facility_name,owner_party_id,facility_type_enum_id) VALUES
('PREVIEW_SL_MAIN','Demo Main Store','LOCAL_ERP_ORG','FcTpRetailStore'),
('PREVIEW_SL_SECOND','Demo Second Store','LOCAL_ERP_ORG','FcTpRetailStore');
INSERT INTO product (product_id,pseudo_id,product_name,owner_party_id,inventory_tracked,mrp_amount,product_type_enum_id) VALUES
('PREVIEW_SL_COTTON','MTC398','0/8 Cotton Nool','LOCAL_ERP_ORG','Y',60,'PtAsset'),
('PREVIEW_SL_ROLL','MTC843','1 Kg Print Roll','LOCAL_ERP_ORG','Y',50,'PtAsset'),
('PREVIEW_SL_BOTTLE','MTC1074','1/2L empty bottle','LOCAL_ERP_ORG','Y',5,'PtAsset');
INSERT INTO asset (asset_id,product_id,owner_party_id,facility_id,asset_type_enum_id,
  quantity_on_hand_total,available_to_promise_total,valuation_rate,last_updated_stamp) VALUES
('PREVIEW_SL_COTTON_MAIN','PREVIEW_SL_COTTON','LOCAL_ERP_ORG','PREVIEW_SL_MAIN','AstTpInventory',10,10,10,'2026-07-23'),
('PREVIEW_SL_COTTON_SECOND','PREVIEW_SL_COTTON','LOCAL_ERP_ORG','PREVIEW_SL_SECOND','AstTpInventory',770,770,60,'2026-07-23'),
('PREVIEW_SL_COTTON_NONE','PREVIEW_SL_COTTON','LOCAL_ERP_ORG',NULL,'AstTpInventory',0,0,NULL,'2026-06-21'),
('PREVIEW_SL_ROLL_MAIN','PREVIEW_SL_ROLL','LOCAL_ERP_ORG','PREVIEW_SL_MAIN','AstTpInventory',150,150,50,'2026-07-23'),
('PREVIEW_SL_ROLL_NONE','PREVIEW_SL_ROLL','LOCAL_ERP_ORG',NULL,'AstTpInventory',0,-903,NULL,'2026-07-08'),
('PREVIEW_SL_BOTTLE_NONE','PREVIEW_SL_BOTTLE','LOCAL_ERP_ORG',NULL,'AstTpInventory',0,0,NULL,'2026-06-21');
COMMIT;
