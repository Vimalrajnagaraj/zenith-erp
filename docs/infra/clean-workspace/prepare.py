"""Read a legacy POS SQLite backup; write a private, reviewable catalog-only bundle.

No network, credentials, customer balances, stock or historical transactions are read.
Python standard library only. See README.md before preparing a real migration.
"""
import argparse
import collections
from contextlib import closing
from decimal import Decimal, InvalidOperation
import hashlib
import json
from pathlib import Path
import sqlite3


def money(value):
    try:
        number = Decimal(str(value))
    except InvalidOperation:
        raise ValueError("invalid price") from None
    if not number.is_finite() or number <= 0 or number != number.quantize(Decimal('.01')):
        raise ValueError("prices must be positive with at most two decimals")
    return format(number, '.2f')


def prepare(source, config):
    source = Path(source).resolve(strict=True)
    before = hashlib.sha256(source.read_bytes()).hexdigest()
    company = config['sourceCompanyId']
    if type(company) is not int or company <= 0:
        raise ValueError('Select a positive integer sourceCompanyId')
    active = config['activeFlagValue']  # Explicit: legacy flag meanings must be verified.
    if type(active) is not int or type(config['pricesIncludeGst']) is not bool:
        raise ValueError('Set activeFlagValue (integer) and pricesIncludeGst (boolean) explicitly')
    exclusions = {str(i) for i in config.get('excludeSourceIds', [])}
    units = config['unitUomIds']  # Unknown units must never silently become pieces.
    with closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)) as db:
        db.execute('PRAGMA query_only=ON')
        if db.execute('PRAGMA quick_check').fetchone()[0] != 'ok':
            raise ValueError('SQLite integrity check failed')
        db.row_factory = sqlite3.Row
        companies = list(db.execute('SELECT cdid,cdname FROM CompanyDetails WHERE cdid=?', (company,)))
        if len(companies) != 1:
            raise ValueError('Select exactly one source company')
        modes = [r for r in db.execute('SELECT modecode,modename,modecomid FROM ModeDetails WHERE modecode IN (1,2) ORDER BY modecode')
                 if company in json.loads(r['modecomid'] or '[]')]
        if [r['modecode'] for r in modes] != [1, 2]:
            raise ValueError('Expected one retail (1) and one wholesale (2) source mode')
        groups = {r['groupid']: r['groupname'] for r in db.execute('SELECT groupid,groupname FROM GroupDetails')}
        products = list(db.execute('SELECT proid,procode,proname,prolangname,provarcode,prohsn,prounitname,progpid,prosgst,procgst,provat,proactive FROM ProductDetails ORDER BY proid'))
        prices = list(db.execute('SELECT comproid,comrate1,comrate2,commrp,comproenabled FROM ProductCompany WHERE comcdid=?', (company,)))
    if len({str(p['proid']) for p in products}) != len(products):
        raise ValueError('Duplicate source product IDs')
    price_ids = [str(p['comproid']) for p in prices]
    if len(set(price_ids)) != len(price_ids):
        raise ValueError('Duplicate company/product price keys')
    by_id = {str(p['comproid']): p for p in prices}
    ids = {str(p['proid']) for p in products}
    if not exclusions <= ids:
        raise ValueError('An exclusion names an unknown source product ID')
    issues, rows, excluded = [], [], []
    codes = collections.Counter(str(p['procode'] or '').strip() for p in products)
    for p in products:
        key = str(p['proid'])
        if key in exclusions or p['proactive'] != active:
            excluded.append({'sourceId': key, 'reason': 'operator exclusion' if key in exclusions else 'source inactive flag'})
            continue
        rate = by_id.get(key)
        try:
            if not rate or rate['comproenabled'] != 1:
                raise ValueError('no enabled price row for the selected company')
            unit = str(p['prounitname'] or '').strip()
            if unit not in units or not units[unit]:
                raise ValueError('unmapped source unit')
            name = str(p['proname'] or '').strip()
            if not name:
                raise ValueError('missing product name')
            if p['procgst'] is None or p['prosgst'] is None:
                raise ValueError('missing source GST rates')
            if p['provat'] and Decimal(str(p['provat'])) != 0:
                raise ValueError('legacy VAT requires review; this migration maps GST only')
            cgst, sgst = Decimal(str(p['procgst'])), Decimal(str(p['prosgst']))
            if not all(t.is_finite() and 0 <= t <= 100 for t in (cgst, sgst)):
                raise ValueError('invalid GST rates')
            rows.append({
                'sourceId': key, 'sku': f'SRC-{company}-{key}', 'name': name,
                'sourceCode': str(p['procode'] or '').strip(), 'localName': p['prolangname'] or '',
                'barcode': str(p['provarcode'] or '').strip(), 'hsn': str(p['prohsn'] or '').strip(),
                'amountUomId': units[unit], 'sourceUnit': unit,
                'category': groups.get(p['progpid']) or '', 'cgst': str(cgst), 'sgst': str(sgst),
                'retail': money(rate['comrate1']), 'wholesale': money(rate['comrate2']),
                'sourceMrp': str(rate['commrp'] if rate['commrp'] is not None else ''),
            })
        except (ValueError, InvalidOperation) as exc:
            issues.append({'sourceId': key, 'reason': str(exc)})
    after = hashlib.sha256(source.read_bytes()).hexdigest()
    if before != after:
        raise ValueError('Source changed while preparing migration')
    return {
        'schemaVersion': 1,
        'source': {'sha256': before, 'companyId': company, 'companyName': companies[0]['cdname'],
                   'productCount': len(products), 'orphanPriceCount': len(set(price_ids) - ids),
                   'duplicateDisplayCodeCount': sum(n - 1 for n in codes.values() if n > 1)},
        'workspace': config['workspace'], 'shops': config['shops'], 'terminals': config['terminals'],
        'cashiers': config['cashiers'], 'pricesIncludeGst': config['pricesIncludeGst'],
        'modeNames': [r['modename'] for r in modes], 'products': rows,
        'excluded': excluded, 'issues': issues,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--config', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    config = json.loads(args.config.read_text(encoding='utf-8'))
    bundle = prepare(args.source, config)
    text = json.dumps(bundle, ensure_ascii=False, indent=2) + '\n'
    # Exclusive creation prevents accidental replacement of reviewed evidence.
    with args.out.open('x', encoding='utf-8', newline='\n') as output:
        output.write(text)
    print(json.dumps({'products': len(bundle['products']), 'excluded': len(bundle['excluded']),
                      'issues': len(bundle['issues']), 'readyForServerPreview': not bundle['issues'],
                      'bundleSha256': hashlib.sha256(text.encode()).hexdigest(), 'liveWrites': False}))
    return 2 if bundle['issues'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
