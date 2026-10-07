-- Removes only the disposable fixtures created by stock-level-local.sql.
BEGIN;
DELETE FROM user_login_history WHERE user_id='SLFIX_USER';
DELETE FROM user_group_member WHERE user_id='SLFIX_USER';
DELETE FROM user_preference WHERE user_id='SLFIX_USER';
DELETE FROM user_account WHERE user_id='SLFIX_USER';
DELETE FROM asset WHERE asset_id IN ('SLFIX_A1','SLFIX_EMPTY','SLFIX_B1','SLFIX_ZERO','SLFIX_NONE','SLFIX_NEG','SLFIX_SUPPLY','SLFIX_FOREIGN','SLFIX_BAD_OWNER');
DELETE FROM lot WHERE lot_id='SLFIX_EMPTY';
DELETE FROM product WHERE product_id IN ('SLFIX_P&1','SLFIX_ZERO','SLFIX_NONE','SLFIX_NEG','SLFIX_FOREIGN');
DELETE FROM facility WHERE facility_id IN ('SLFIX_A','SLFIX_B','SLFIX_FOREIGN');
COMMIT;
