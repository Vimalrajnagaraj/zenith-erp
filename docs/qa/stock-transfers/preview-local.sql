-- Optional synthetic review data. Never auto-load or run against a real tenant.
-- Existing stock/products are not changed. Run once, then restart local Moqui.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM organization WHERE party_id='LOCAL_ERP_ORG' AND organization_name='Local ERP Demo')
 THEN RAISE EXCEPTION 'Local ERP Demo organization required'; END IF;
 IF (SELECT count(*) FROM facility WHERE facility_id IN ('PREVIEW_SL_MAIN','PREVIEW_SL_SECOND') AND owner_party_id='LOCAL_ERP_ORG') <> 2
 THEN RAISE EXCEPTION 'Local demo warehouses required'; END IF;
END $$;
INSERT INTO product (product_id,pseudo_id,product_name,owner_party_id,product_type_enum_id,mrp_amount,inventory_tracked,enable_batch_tracking,enable_serial_tracking,is_tax_exempt)
VALUES ('PREVIEW_ST_COTTON','ST-DEMO-398','0/8 Cotton Nool (transfer demo)','LOCAL_ERP_ORG','PtAsset',60,'Y','N','N','Y');
INSERT INTO asset (asset_id,product_id,owner_party_id,facility_id,asset_type_enum_id,status_id,quantity_on_hand_total,available_to_promise_total,valuation_rate,mrp_amount)
VALUES ('PREVIEW_ST_SOURCE','PREVIEW_ST_COTTON','LOCAL_ERP_ORG','PREVIEW_SL_MAIN','AstTpInventory','AstAvailable',140,140,60,60),
 ('PREVIEW_ST_DEST','PREVIEW_ST_COTTON','LOCAL_ERP_ORG','PREVIEW_SL_SECOND','AstTpInventory','AstAvailable',50,50,60,60);
INSERT INTO stock_transfer (stock_transfer_id,transfer_number,organization_party_id,from_facility_id,to_facility_id,transfer_date,status_id,total_value,eway_bill_required,remarks)
SELECT 'PREVIEW_ST_'||n,n,'LOCAL_ERP_ORG','PREVIEW_SL_MAIN','PREVIEW_SL_SECOND',d,s,600,'N','Synthetic local review transfer'
FROM (VALUES ('100612',CURRENT_TIMESTAMP,'StxReceived'),('100613','2026-07-26 12:00'::timestamp,'StxReceived'),
 ('100614','2026-07-21 12:00'::timestamp,'StxReceived'),('100615','2026-07-21 11:00'::timestamp,'StxDraft'),
 ('100616','2026-07-21 10:00'::timestamp,'StxReceived'),('101071','2026-07-18 12:00'::timestamp,'StxInTransit'),
 ('100617','2026-07-17 12:00'::timestamp,'StxReceived')) AS samples(n,d,s);
INSERT INTO stock_transfer_item (stock_transfer_id,transfer_item_seq_id,product_id,quantity,quantity_received,unit_amount,from_asset_id)
SELECT stock_transfer_id,'01','PREVIEW_ST_COTTON',10,CASE WHEN status_id='StxReceived' THEN 10 ELSE NULL END,60,'PREVIEW_ST_SOURCE'
FROM stock_transfer WHERE stock_transfer_id IN ('PREVIEW_ST_100612','PREVIEW_ST_100613','PREVIEW_ST_100614','PREVIEW_ST_100615','PREVIEW_ST_100616','PREVIEW_ST_101071','PREVIEW_ST_100617');
INSERT INTO asset_detail (asset_detail_id,asset_id,product_id,effective_date,quantity_on_hand_diff,available_to_promise_diff,unit_cost,description)
VALUES ('PREVIEW_ST_OPEN','PREVIEW_ST_SOURCE','PREVIEW_ST_COTTON','2026-07-01',200,200,60,'Synthetic preview opening balance');
INSERT INTO asset_detail (asset_detail_id,asset_id,product_id,effective_date,quantity_on_hand_diff,available_to_promise_diff,unit_cost,description)
SELECT 'PREVIEW_ST_OUT_'||transfer_number,'PREVIEW_ST_SOURCE','PREVIEW_ST_COTTON',transfer_date,-10,-10,60,'Synthetic preview shipment'
FROM stock_transfer WHERE stock_transfer_id IN ('PREVIEW_ST_100612','PREVIEW_ST_100613','PREVIEW_ST_100614','PREVIEW_ST_100616','PREVIEW_ST_101071','PREVIEW_ST_100617');
INSERT INTO asset_detail (asset_detail_id,asset_id,product_id,effective_date,quantity_on_hand_diff,available_to_promise_diff,unit_cost,description)
SELECT 'PREVIEW_ST_IN_'||transfer_number,'PREVIEW_ST_DEST','PREVIEW_ST_COTTON',transfer_date,10,10,60,'Synthetic preview receipt'
FROM stock_transfer WHERE stock_transfer_id IN ('PREVIEW_ST_100612','PREVIEW_ST_100613','PREVIEW_ST_100614','PREVIEW_ST_100616','PREVIEW_ST_100617');
COMMIT;
