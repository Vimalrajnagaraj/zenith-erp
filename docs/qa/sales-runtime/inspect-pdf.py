"""Read only synthetic acceptance PDFs; semantic checks supplement visual review."""
import json, re, sys
from pypdf import PdfReader
reader = PdfReader(sys.argv[1])
text = '\n'.join(page.extract_text() or '' for page in reader.pages)
if len(sys.argv) > 2 and sys.argv[2] == '--text':
    print(json.dumps({'pages': len(reader.pages), 'text': ' '.join(text.split())}))
    sys.exit(0)
orphans = []
for index, page in enumerate(reader.pages[1:], 2):
    page_text = page.extract_text() or ''
    if 'SOP-PDF-LINE-' in page_text and 'Rs.' in page_text.split('SOP-PDF-LINE-', 1)[0]:
        orphans.append(index)
print(json.dumps({'pages': len(reader.pages),
    'lineCount': len(set(re.findall(r'SOP-PDF-LINE-\d{3}', text))),
    'hasTotals': bool(re.search(r'Total|TOTAL', text)),
    'hasAmountWords': bool(re.search(r'Seventy[ -]Five', text, re.I)),
    'finalPageHasTotals': bool(re.search(r'Total|TOTAL', reader.pages[-1].extract_text() or '')),
    'pagesWithOrphanAmounts': orphans}))
