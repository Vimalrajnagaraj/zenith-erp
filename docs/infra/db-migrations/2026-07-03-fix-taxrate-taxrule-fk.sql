-- 2026-07-03 — Repair stale FK targets on the zenith tax master-data tables.
--
-- Root cause: entity name collision. Mantle ships its own `mantle.party.TaxAuthority`
-- (physical table `tax_authority`, 22 rows, different schema). Zenith defines its own
-- `zenith.erp.tax.TaxAuthority` with table-name="ZENITH_TAX_AUTHORITY" to avoid clobbering it.
-- The zenith `TaxRate` and `TaxRule` entities declare `related="zenith.erp.tax.TaxAuthority"`,
-- but their FK constraints in THIS database were generated (before table-name was added) against
-- the mantle `tax_authority` table instead of `zenith_tax_authority`. Result: creating a zenith
-- TaxRate/TaxRule against a zenith authority (e.g. "Central GST") failed with
--   violates foreign key constraint "taxratetaxauthority" (Key ... not present in table "tax_authority").
-- Never surfaced because both tables are empty/unused (India uses IndiaGstSlab).
--
-- The entity definitions are already correct, so a fresh database regenerates these FKs against
-- ZENITH_TAX_AUTHORITY. This script only repairs an existing database that carries the stale FK.
-- Both tables are empty, so there are no rows to validate; Moqui does NOT revert the change on
-- restart (it only adds missing FKs by name).

ALTER TABLE tax_rate DROP CONSTRAINT taxratetaxauthority;
ALTER TABLE tax_rate ADD CONSTRAINT taxratetaxauthority
    FOREIGN KEY (tax_authority_id) REFERENCES zenith_tax_authority(tax_authority_id);

ALTER TABLE tax_rule DROP CONSTRAINT taxruletaxauthority;
ALTER TABLE tax_rule ADD CONSTRAINT taxruletaxauthority
    FOREIGN KEY (tax_authority_id) REFERENCES zenith_tax_authority(tax_authority_id);
