"""
Extract every figure and screenshot from the MCI/O User Manual PDF.

Usage:
    pip install pymupdf pillow
    python extract-pdf-figures.py

Outputs:
    training-videos/assets/pdf-figures/page_NNN_img_M.png  (raw images)
    training-videos/assets/pdf-figures/page_NNN.png         (full page rasters)
    training-videos/assets/pdf-figures/_index.csv           (image manifest)

These images become the source material for synthetic screen recordings
in After Effects (re-animated with cursor moves and click feedback).
"""

import csv
import sys
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    print("Missing dependency. Run:  pip install pymupdf pillow")
    sys.exit(1)

PDF = Path("standards/pdfs/MCIO Instrument Manual GB50010130.pdf")
OUT = Path("training-videos/assets/pdf-figures")
OUT.mkdir(parents=True, exist_ok=True)

DPI = 300  # high-DPI rasters for 4K video usage


def extract():
    doc = fitz.open(PDF)
    manifest = []

    for page_index in range(doc.page_count):
        page = doc[page_index]
        page_num = page_index + 1

        # Full-page raster (always useful as a fallback)
        pix = page.get_pixmap(dpi=DPI, alpha=False)
        page_path = OUT / f"page_{page_num:03d}.png"
        pix.save(page_path)

        # Embedded images
        for img_idx, img_info in enumerate(page.get_images(full=True), start=1):
            xref = img_info[0]
            pix = fitz.Pixmap(doc, xref)
            if pix.n - pix.alpha >= 4:  # CMYK → RGB
                pix = fitz.Pixmap(fitz.csRGB, pix)
            img_path = OUT / f"page_{page_num:03d}_img_{img_idx}.png"
            pix.save(img_path)
            manifest.append({
                "page": page_num,
                "index": img_idx,
                "filename": img_path.name,
                "width": pix.width,
                "height": pix.height,
            })

    # Manifest for After Effects bulk-import
    with open(OUT / "_index.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["page", "index", "filename", "width", "height"])
        writer.writeheader()
        writer.writerows(manifest)

    print(f"Extracted {len(manifest)} embedded images + {doc.page_count} full-page rasters")
    print(f"Output:  {OUT.resolve()}")


if __name__ == "__main__":
    extract()
