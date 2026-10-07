-- Disposable local catalog QA records. Existing dashboard visual samples are left untouched.
BEGIN;
-- Run only against the local disposable Docker database. The read-only harness never seeds data.
-- Apply product-catalog-cleanup.sql after CATALOG_QA_FIXTURE=1 node docs/infra/ci/product-catalog-regression.mjs.

INSERT INTO product (product_id,pseudo_id,product_name,description,owner_party_id,product_type_enum_id,mrp_amount,reorder_point,enable_batch_tracking,gst_slab_id,uqc_enum_id) SELECT
'CATALOG_QA_P'||lpad(n::text,2,'0'),'CATQA-'||lpad(n::text,2,'0'),'A Catalog test '||lpad(n::text,2,'0'),'Disposable catalog verification item',
'LOCAL_ERP_ORG',CASE n WHEN 2 THEN 'PtService' WHEN 3 THEN 'PtDigitalAsset' WHEN 4 THEN 'PtVirtual' WHEN 5 THEN 'PtPickAssembly' ELSE 'PtAsset' END,
CASE WHEN n=1 THEN 0 ELSE n*10 END,CASE WHEN n=1 THEN 0 ELSE 5 END,CASE WHEN n%2=0 THEN 'Y' ELSE 'N' END,
CASE WHEN n=1 THEN 'GST_EXEMPT' ELSE NULL END,'PCS' FROM generate_series(1,25) n;
INSERT INTO product (product_id,pseudo_id,product_name,owner_party_id,product_type_enum_id,mrp_amount) VALUES ('CATALOG_QA_OTHER','CATQA-OTHER','Foreign catalog test','ORG_ZINC','PtAsset',9999);
INSERT INTO asset (asset_id,asset_type_enum_id,status_id,product_id,owner_party_id,quantity_on_hand_total,available_to_promise_total) VALUES
('CATALOG_QA_A1','AstTpInventory','AstAvailable','CATALOG_QA_P06','LOCAL_ERP_ORG',12.5,12.5),
('CATALOG_QA_A2','AstTpInventory','AstAvailable','CATALOG_QA_P06','LOCAL_ERP_ORG',3,3),
('CATALOG_QA_A3','AstTpInventory','AstAvailable','CATALOG_QA_P06',NULL,2,2),
('CATALOG_QA_A4','AstTpInventory','AstAvailable','CATALOG_QA_P06','ORG_ZINC',999,999),
('CATALOG_QA_A5','AstTpFixed','AstAvailable','CATALOG_QA_P06','LOCAL_ERP_ORG',888,888),
('CATALOG_QA_A6','AstTpInventory','AstAvailable','CATALOG_QA_P07','ORG_ZINC',777,777);
INSERT INTO product_barcode (barcode_id,organization_party_id,product_id,barcode_value,is_active,is_primary) VALUES
('CATALOG_QA_B1','LOCAL_ERP_ORG','CATALOG_QA_P25','CATQA-SECONDARY','Y','N'),
('CATALOG_QA_B2','LOCAL_ERP_ORG','CATALOG_QA_P24','CATQA-INACTIVE','N','N'),
('CATALOG_QA_B3','ORG_ZINC','CATALOG_QA_OTHER','CATQA-FOREIGN','Y','N');
UPDATE product SET sac_code='CATQA-SAC' WHERE product_id='CATALOG_QA_P02';
COMMIT;
