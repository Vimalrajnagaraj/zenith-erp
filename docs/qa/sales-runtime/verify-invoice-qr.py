"""Verify an A4 invoice PDF contains a real QR code of its invoice number."""
import os
import subprocess
import sys
import tempfile
from pathlib import Path

if len(sys.argv) != 3:
    raise SystemExit("usage: verify-invoice-qr.py <invoice.pdf> <invoice-number>")

deps = os.environ.get("BARCODE_QA_PYTHON_DEPS")
if deps:
    sys.path.insert(0, deps)
import zxingcpp
from PIL import Image

pdf = Path(sys.argv[1]).resolve()
expected = sys.argv[2]
renderer = os.environ.get("PDFTOPPM", "pdftoppm")
with tempfile.TemporaryDirectory(prefix="invoice-qr-") as tmp:
    prefix = Path(tmp) / "page"
    subprocess.run([renderer, "-f", "1", "-l", "1", "-r", "300", "-png", "-singlefile", str(pdf), str(prefix)], check=True, capture_output=True)
    symbols = zxingcpp.read_barcodes(Image.open(prefix.with_suffix(".png")))
    qr = [symbol for symbol in symbols if symbol.format == zxingcpp.BarcodeFormat.QRCode]
    assert any(symbol.text == expected for symbol in qr), (
        f"Expected a QR code encoding {expected!r}; decoded {[(str(s.format), s.text) for s in symbols]}"
    )
print(f"A4 invoice QR decoded: {expected}")
