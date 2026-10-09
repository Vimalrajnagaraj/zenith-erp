"""Decode rendered label pixels with an independent ZXing reader (no encoder metadata)."""
import json, os, sys
sys.path.insert(0,os.environ.get('BARCODE_QA_PYTHON_DEPS',''))
import zxingcpp
from PIL import Image
results=zxingcpp.read_barcodes(Image.open(sys.argv[1]))
print(json.dumps([{'text':r.text,'format':str(r.format)} for r in results],ensure_ascii=True))
