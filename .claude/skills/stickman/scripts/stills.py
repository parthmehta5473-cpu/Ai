#!/usr/bin/env python3
"""Fast look at the film: a contact sheet of chosen times. usage: stills.py <folder> <out.jpg> <t> <t> ..."""
import base64, io, sys
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
from common import browser_args, is_3d, page_url

folder, out, ts = sys.argv[1], sys.argv[2], [float(a) for a in sys.argv[3:]]
with sync_playwright() as p:
    b = p.chromium.launch(args=browser_args(is_3d(folder))); g = b.new_page(viewport={"width": 1920, "height": 1080})
    g.on("pageerror", lambda e: print("PAGE ERROR", e))
    g.goto(page_url(folder)); g.wait_for_function("window.READY", timeout=120000); ims = []
    for t in ts:
        r = g.evaluate("t=>{renderAt(t);return document.getElementById('c').toDataURL('image/jpeg',.9)}", t)
        ims.append(Image.open(io.BytesIO(base64.b64decode(r.split(",")[1]))).convert("RGB"))
    b.close()
n = len(ims); cols = 1 if n == 1 else 2 if n <= 4 else 3; w, h = 1920 // cols, 1080 // cols
s = Image.new("RGB", (cols * w, ((n + cols - 1) // cols) * h))
for i, im in enumerate(ims):
    s.paste(im.resize((w, h)), ((i % cols) * w, (i // cols) * h))
s.save(out, quality=88); print("wrote", Path(out).resolve())
