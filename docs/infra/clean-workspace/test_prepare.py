from contextlib import closing
import hashlib
import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('prepare', HERE/'prepare.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class CatalogMigration(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.db = Path(self.tmp.name)/'synthetic.db'
        with closing(sqlite3.connect(self.db)) as c, c:
            c.executescript('''
                CREATE TABLE CompanyDetails(cdid,cdname);
                INSERT INTO CompanyDetails VALUES(11,'Synthetic A'),(22,'Synthetic B');
                CREATE TABLE ModeDetails(modecode,modename,modecomid);
                INSERT INTO ModeDetails VALUES(1,'Retail','[11,22]'),(2,'Wholesale','[11,22]');
                CREATE TABLE GroupDetails(groupid,groupname);
                INSERT INTO GroupDetails VALUES(1,'Cups');
                CREATE TABLE ProductDetails(proid,procode,proname,prolangname,provarcode,prohsn,prounitname,progpid,prosgst,procgst,provat,proactive);
                INSERT INTO ProductDetails VALUES(1,'DUP','Cup, "large"','தமிழ்','','','PCS',1,6,6,0,0);
                INSERT INTO ProductDetails VALUES(2,'DUP','Cup small','','','','PCS',1,6,6,0,0);
                CREATE TABLE ProductCompany(comproid,comcdid,comrate1,comrate2,commrp,comproenabled);
                INSERT INTO ProductCompany VALUES(1,11,100,90,110,1),(2,11,200,180,210,1);
                INSERT INTO ProductCompany VALUES(1,22,10,9,11,1),(2,22,20,18,21,1);
                CREATE TABLE CreditBills(secret);
                INSERT INTO CreditBills VALUES('DO_NOT_COPY_TEST_CREDIT');
                CREATE TABLE UserDetails(userpass);
                INSERT INTO UserDetails VALUES('DO_NOT_COPY_CREDENTIAL');
            ''')
        self.config = {'sourceCompanyId':22,'activeFlagValue':0,'pricesIncludeGst':False,
                       'unitUomIds':{'PCS':'OTH_ea'},'workspace':{'name':'Synthetic'},
                       'shops':[], 'terminals':[], 'cashiers':[]}

    def prepare(self):
        return module.prepare(self.db, self.config)

    def mutate(self, sql):
        with closing(sqlite3.connect(self.db)) as c, c:
            c.execute(sql)

    def test_canonical_company_prices_and_source_id_keys(self):
        before = hashlib.sha256(self.db.read_bytes()).hexdigest()
        b = self.prepare()
        self.assertEqual([p['retail'] for p in b['products']], ['10.00','20.00'])
        self.assertEqual([p['wholesale'] for p in b['products']], ['9.00','18.00'])
        self.assertEqual([p['sku'] for p in b['products']], ['SRC-22-1','SRC-22-2'])
        self.assertEqual(b['products'][0]['localName'], 'தமிழ்')
        self.assertEqual(before, hashlib.sha256(self.db.read_bytes()).hexdigest())
        self.assertFalse(b['issues'])
        self.assertNotIn('DO_NOT_COPY', json.dumps(b))

    def test_missing_canonical_price_never_falls_back(self):
        self.mutate('DELETE FROM ProductCompany WHERE comcdid=22 AND comproid=2')
        b = self.prepare()
        self.assertEqual(len(b['products']), 1)
        self.assertEqual(b['issues'][0]['sourceId'], '2')

    def test_zero_price_is_an_issue_not_a_free_sale(self):
        self.mutate('UPDATE ProductCompany SET comrate2=0 WHERE comcdid=22 AND comproid=1')
        self.assertEqual(self.prepare()['issues'][0]['sourceId'], '1')

    def test_negative_and_fractional_prices_are_rejected(self):
        for value in [-1, 1.001]:
            with self.subTest(value=value):
                self.mutate(f'UPDATE ProductCompany SET comrate1={value} WHERE comcdid=22 AND comproid=1')
                self.assertTrue(self.prepare()['issues'])

    def test_duplicate_price_keys_are_fatal(self):
        self.mutate('INSERT INTO ProductCompany VALUES(1,22,1,1,1,1)')
        with self.assertRaisesRegex(ValueError, 'Duplicate company/product'):
            self.prepare()

    def test_duplicate_product_ids_are_fatal(self):
        self.mutate('INSERT INTO ProductDetails SELECT * FROM ProductDetails WHERE proid=1')
        with self.assertRaisesRegex(ValueError, 'Duplicate source product'):
            self.prepare()

    def test_unmapped_unit_is_not_silently_pieces(self):
        self.mutate("UPDATE ProductDetails SET prounitname='BOX' WHERE proid=1")
        self.assertEqual(self.prepare()['issues'][0]['reason'], 'unmapped source unit')

    def test_exclusions_are_explicit_and_preserved(self):
        self.config['excludeSourceIds'] = ['1']
        self.assertEqual(self.prepare()['excluded'], [{'sourceId':'1','reason':'operator exclusion'}])
        self.config['excludeSourceIds'] = ['999']
        with self.assertRaisesRegex(ValueError, 'unknown source'):
            self.prepare()

    def test_inactive_flag_requires_explicit_semantics(self):
        self.mutate('UPDATE ProductDetails SET proactive=1 WHERE proid=1')
        self.assertEqual(self.prepare()['excluded'][0]['reason'], 'source inactive flag')
        del self.config['activeFlagValue']
        with self.assertRaises(KeyError):
            self.prepare()

    def test_price_basis_must_be_boolean(self):
        self.config['pricesIncludeGst'] = 'false'
        with self.assertRaises(ValueError):
            self.prepare()

    def test_mode_must_belong_to_canonical_company(self):
        self.mutate("UPDATE ModeDetails SET modecomid='[11]' WHERE modecode=2")
        with self.assertRaisesRegex(ValueError, 'source mode'):
            self.prepare()

    def test_missing_tax_and_legacy_vat_are_not_invented_as_zero_gst(self):
        self.mutate('UPDATE ProductDetails SET prosgst=NULL WHERE proid=1')
        self.assertEqual(self.prepare()['issues'][0]['reason'], 'missing source GST rates')
        self.mutate('UPDATE ProductDetails SET prosgst=6,provat=5 WHERE proid=1')
        self.assertIn('legacy VAT', self.prepare()['issues'][0]['reason'])

    def test_orphan_prices_are_reported_without_fake_products(self):
        self.mutate('INSERT INTO ProductCompany VALUES(999,22,1,1,1,1)')
        b = self.prepare()
        self.assertEqual(b['source']['orphanPriceCount'], 1)
        self.assertEqual(len(b['products']), 2)


if __name__ == '__main__':
    unittest.main()
