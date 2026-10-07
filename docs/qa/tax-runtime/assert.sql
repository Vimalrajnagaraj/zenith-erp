-- Independent database assertions. Run ONLY in the disposable QA database.
DO $$ BEGIN
 IF (SELECT count(*) FROM organization WHERE party_id IN ('TAX_QA_A','TAX_QA_B')) <> 2 THEN RAISE EXCEPTION 'Required disposable tenants missing'; END IF;
 IF NOT EXISTS (SELECT 1 FROM tax_registration WHERE registration_id='TAX_QA_REG_B' AND organization_party_id='TAX_QA_B' AND registration_number='29ABCDE1234F1ZW') THEN RAISE EXCEPTION 'Foreign registration changed'; END IF;
 IF NOT EXISTS (SELECT 1 FROM tax_exemption WHERE exemption_id='TAX_QA_EX_B' AND organization_party_id='TAX_QA_B' AND exemption_type_enum_id='TexFull') THEN RAISE EXCEPTION 'Foreign exemption changed'; END IF;
 IF NOT EXISTS (SELECT 1 FROM gstr1_filing WHERE filing_id='TAX_QA_FILING_B' AND organization_party_id='TAX_QA_B' AND json_payload='FOREIGN_SENTINEL_DO_NOT_EXPOSE') THEN RAISE EXCEPTION 'Foreign filing changed'; END IF;
 IF EXISTS (SELECT 1 FROM gstr1_filing WHERE organization_party_id='TAX_QA_A' AND return_period NOT IN ('072026')) THEN RAISE EXCEPTION 'Invalid period generated a filing'; END IF;
 IF (SELECT count(*) FROM gstr1_b2b_record r JOIN gstr1_filing f USING(filing_id) WHERE f.organization_party_id='TAX_QA_A' AND r.taxable_value=100 AND r.cgst_amount=9 AND r.sgst_amount=9)<>1 THEN RAISE EXCEPTION 'B2B accounting math mismatch'; END IF;
 IF (SELECT count(*) FROM gstr1_b2cl_record r JOIN gstr1_filing f USING(filing_id) WHERE f.organization_party_id='TAX_QA_A' AND r.taxable_value=110000 AND r.igst_amount=19800)<>1 THEN RAISE EXCEPTION 'B2CL threshold or math mismatch'; END IF;
 IF EXISTS (SELECT 1 FROM india_einvoice) OR EXISTS (SELECT 1 FROM india_eway_bill) THEN RAISE EXCEPTION 'Provider mock persisted a statutory record'; END IF;
 IF NOT EXISTS (SELECT 1 FROM invoice WHERE invoice_id='TAX_QA_INV_PURCHASE' AND invoice_total=140.25 AND total_taxable_amount=100 AND total_cess=12 AND round_off_amount=0.25) THEN RAISE EXCEPTION 'Tax-inclusive convention changed'; END IF;
 IF (SELECT count(*) FROM tax_registration WHERE party_id='TAX_QA_UI_CUST' AND organization_party_id='TAX_QA_A' AND description='Synthetic UI O''Brien edited')<>2 THEN RAISE EXCEPTION 'Both native registration create/edit flows must persist'; END IF;
 IF (SELECT count(*) FROM tax_exemption WHERE party_id='TAX_QA_UI_CUST' AND description='Synthetic exemption edited')<>2 THEN RAISE EXCEPTION 'Both exemption create/edit flows must persist'; END IF;
 IF EXISTS (SELECT 1 FROM tax_registration WHERE registration_number='NO_CSRF') THEN RAISE EXCEPTION 'CSRF request wrote a row'; END IF;
 IF (SELECT count(*) FROM tax_exemption WHERE organization_party_id='TAX_QA_A')<>4 THEN RAISE EXCEPTION 'Viewer or denied request wrote an exemption'; END IF;
 IF NOT EXISTS (SELECT 1 FROM invoice WHERE from_party_id='TAX_QA_A' AND invoice_id NOT LIKE 'TAX_QA%' AND invoice_total=118 AND total_taxable_amount=100 AND total_igst=18) THEN RAISE EXCEPTION 'Sales caller tax-inclusive total mismatch'; END IF;
 IF NOT EXISTS (SELECT 1 FROM invoice WHERE vendor_invoice_number='TAX_QA_CROSS_PURCHASE' AND to_party_id='TAX_QA_A' AND invoice_total=118 AND total_taxable_amount=100) THEN RAISE EXCEPTION 'Purchase caller grand total mismatch'; END IF;
END $$;
