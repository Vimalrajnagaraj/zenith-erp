-- Optional cleanup of this task's synthetic local review records only.
-- If additional transfers use the preview product, foreign keys safely abort cleanup.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM organization WHERE party_id='LOCAL_ERP_ORG' AND organization_name='Local ERP Demo')
 THEN RAISE EXCEPTION 'Local ERP Demo organization required'; END IF;
END $$;
DELETE FROM stock_transfer_item WHERE stock_transfer_id IN ('PREVIEW_ST_100612','PREVIEW_ST_100613','PREVIEW_ST_100614','PREVIEW_ST_100615','PREVIEW_ST_100616','PREVIEW_ST_101071','PREVIEW_ST_100617');
DELETE FROM stock_transfer WHERE stock_transfer_id IN ('PREVIEW_ST_100612','PREVIEW_ST_100613','PREVIEW_ST_100614','PREVIEW_ST_100615','PREVIEW_ST_100616','PREVIEW_ST_101071','PREVIEW_ST_100617') AND organization_party_id='LOCAL_ERP_ORG';
DELETE FROM asset_detail WHERE asset_id IN ('PREVIEW_ST_SOURCE','PREVIEW_ST_DEST');
DELETE FROM asset WHERE asset_id IN ('PREVIEW_ST_SOURCE','PREVIEW_ST_DEST') AND product_id='PREVIEW_ST_COTTON' AND owner_party_id='LOCAL_ERP_ORG';
DELETE FROM product WHERE product_id='PREVIEW_ST_COTTON' AND owner_party_id='LOCAL_ERP_ORG';
COMMIT;
