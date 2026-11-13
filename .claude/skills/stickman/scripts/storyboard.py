#!/usr/bin/env python3
"""Preview images from the real film before the full render. usage: storyboard.py <folder>
Writes <folder>/storyboard.jpg: one numbered frame from the middle of each shot, drawn by the same code as the final film."""
import base64, io, json, sys
from pathlib import Path
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright
from common import browser_args, is_3d, page_url

folder = Path(sys.argv[1]); ims = []
with sync_playwright() as p:
    b = p.chromium.launch(args=browser_args(is_3d(folder))); g = b.new_page(viewport={"width": 1920, "height": 1080})
    g.on("pageerror", lambda e: print("PAGE ERROR", e))
    g.goto(page_url(folder)); g.wait_for_function("window.READY", timeout=120000); c = g.evaluate("CUTF")
    for i in range(len(c) - 1):
        r = g.evaluate("t=>{renderAt(t);return document.getElementById('c').toDataURL('image/jpeg',.9)}", (c[i] + c[i + 1]) / 60)
        ims.append(Image.open(io.BytesIO(base64.b64decode(r.split(",")[1]))).convert("RGB").resize((640, 360)))
    b.close()
cols = 2 if len(ims) <= 4 else 3; rows = (len(ims) + cols - 1) // cols; s = Image.new("RGB", (cols * 640, rows * 360))
for i, im in enumerate(ims):
    d = ImageDraw.Draw(im); d.rectangle((8, 8, 118, 34), fill=(18, 10, 28)); d.text((16, 15), f"Shot {i + 1}  {c[i] / 30:.1f}s", fill=(255, 255, 255)); s.paste(im, ((i % cols) * 640, (i // cols) * 360))
s.save(folder / "storyboard.jpg", quality=88); json.dump([[c[i] / 30, c[i + 1] / 30] for i in range(len(c) - 1)], open(folder / "storyboard.json", "w"))
print("wrote", (folder / "storyboard.jpg").resolve(), len(ims), "shots")
