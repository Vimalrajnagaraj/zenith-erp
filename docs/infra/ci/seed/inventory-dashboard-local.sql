-- Synthetic LOCAL audit data only. Run inside zenith-erp-db-1; never against production.
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM party WHERE party_id = 'LOCAL_ERP_ORG') THEN
    RAISE EXCEPTION 'This fixture requires the named Local ERP Demo organization';
  END IF;
END $$;
INSERT INTO facility (facility_id,facility_name,owner_party_id) VALUES
 ('AUDIT_INV_A','Audit Warehouse A','LOCAL_ERP_ORG'),
 ('AUDIT_INV_B','Audit Warehouse B','LOCAL_ERP_ORG') ON CONFLICT DO NOTHING;
INSERT INTO product (product_id,product_name,owner_party_id,inventory_tracked,reorder_point,mrp_amount,product_type_enum_id) VALUES
 ('AUDIT_INV_TRACKED','Audit Tracked Item','LOCAL_ERP_ORG','Y',10,100,'PtAsset'),
 ('AUDIT_INV_UNTRACKED','Audit Untracked Item','LOCAL_ERP_ORG','N',10,100,'PtAsset') ON CONFLICT DO NOTHING;
INSERT INTO asset (asset_id,asset_type_enum_id,product_id,owner_party_id,facility_id,quantity_on_hand_total,valuation_rate) VALUES
 ('AUDIT_INV_ASSET_A','AstTpInventory','AUDIT_INV_TRACKED','LOCAL_ERP_ORG','AUDIT_INV_A',5,100),
 ('AUDIT_INV_ASSET_B','AstTpInventory','AUDIT_INV_TRACKED','LOCAL_ERP_ORG','AUDIT_INV_B',20,100) ON CONFLICT DO NOTHING;
INSERT INTO asset_detail (asset_detail_id,asset_id,product_id,effective_date,quantity_on_hand_diff) VALUES
 ('AUDIT_INV_CURRENT','AUDIT_INV_ASSET_A','AUDIT_INV_TRACKED','2026-10-05 12:00:00',5),
 ('AUDIT_INV_OLD','AUDIT_INV_ASSET_A','AUDIT_INV_TRACKED','2025-01-01',20) ON CONFLICT DO NOTHING;
INSERT INTO asset_detail (asset_detail_id,asset_id,product_id,effective_date,quantity_on_hand_diff)
 SELECT 'AUDIT_INV_PAGE_'||n,'AUDIT_INV_ASSET_A','AUDIT_INV_TRACKED',TIMESTAMP '2025-02-01' + n * INTERVAL '1 hour',1
 FROM generate_series(1,55) n ON CONFLICT DO NOTHING;
INSERT INTO asset_detail (asset_detail_id,asset_id,product_id,effective_date,quantity_on_hand_diff)
 SELECT 'AUDIT_INV_ZERO_'||n,'AUDIT_INV_ASSET_A','AUDIT_INV_TRACKED',TIMESTAMP '2026-10-06 12:00:00',0
 FROM generate_series(1,60) n ON CONFLICT DO NOTHING;
COMMIT;
