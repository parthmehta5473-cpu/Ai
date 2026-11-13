#!/usr/bin/env python3
"""Frame-level audit of a rendered film. usage: audit.py <folder> <file.mp4>
Eyes miss these. Fix every ISSUE, or explain why a flagged window is intended (a passing bus, a gunshot)."""
import base64, glob, json, math, os, re, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image
from common import browser_args, ffmpeg, is_3d, page_url

folder = Path(sys.argv[1]).resolve(); mp4 = folder / sys.argv[2]; os.chdir(folder)
S = []
for f in sorted(glob.glob("shots/st_*.json")):
    S.extend(json.load(open(f)))
S.sort(key=lambda s: s.get("f", 0))
info = json.load(open("film.json")); CUT = info["cuts"]; iss = []
print("frames in state files", len(S), "expected", CUT[-1])
if len(S) != CUT[-1]:
    iss.append("frame count mismatch")
if S and "people" in S[0]:
    for s in S:
        for name, p in s["people"].items():
            for k, v in (p.get("over") or {}).items():
                if v > 1: iss.append(f"f{s['f']} {name}.{k} out of reach by {v:.1f}")
            if p.get("walk") and p.get("elbow"):
                for k, sx in (("l", -73.5), ("r", 73.5)):
                    if (p.get("tuck") or {}).get(k): continue
                    if (p["elbow"][k][0] - (sx + p["hand"][k][0]) / 2) * p["face"] > 1: iss.append(f"f{s['f']} {name}.{k} elbow bends forward")
        for n, a, b in s["contacts"]:
            d = math.dist(a, b)
            if d > 3: iss.append(f"f{s['f']} contact {n} off by {d:.1f}px")
    sk = hs = 0
    for a, b in zip(S, S[1:]):
        if b["f"] in CUT: continue
        for name, p in b["people"].items():
            q = a["people"].get(name)
            if not q: continue
            if p.get("hand") and q.get("hand"):
                for k in "lr":
                    d = math.dist([p["x"] + p["hand"][k][0] * p["s"], p["y"] + p["hand"][k][1] * p["s"]], [q["x"] + q["hand"][k][0] * q["s"], q["y"] + q["hand"][k][1] * q["s"]]); hs = max(hs, d)
                    if d > 40: iss.append(f"f{b['f']} {name}.{k} hand jump {d:.0f}px")
            if p.get("world") and q.get("world"):
                for k in "lr":
                    # the lower foot is the planted one in both frames, so it must not slide
                    o = "r" if k == "l" else "l"
                    if p["world"][k][1] >= p["world"][o][1] - .2 and q["world"][k][1] >= q["world"][o][1] - .2 and abs(p["world"][k][1] - q["world"][k][1]) < .2:
                        sk = max(sk, abs(p["world"][k][0] - q["world"][k][0]))
    print("max hand step", round(hs, 1), "foot skate max", round(sk, 2))
    if sk > 3: iss.append(f"foot skate {sk:.1f}px")
raw = subprocess.run([ffmpeg(), "-v", "error", "-i", mp4.name, "-vf", "scale=320:180,format=gray", "-f", "rawvideo", "-"], capture_output=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, 180, 320).astype(float); print("decoded", len(fr))
d = np.abs(np.diff(fr, axis=0)).mean((1, 2)); fades = 20
for i, v in enumerate(d):
    f = i + 1
    if v > 6 and f not in CUT and fades < f < len(fr) - fades: iss.append(f"pop at frame {f} ({v:.1f})")
lo = 1e9
for s in range(15, max(16, len(d) - 45), 15):
    w = d[s:s + 30]; m = float(w.mean()); fz = float((w < .05).mean()); lo = min(lo, m)
    sym = np.mean([S[i].get("sym", 0) for i in range(s, min(s + 30, len(S)))]) > .5 if S else False
    if m < (.3 if sym else .2) or fz > .1: iss.append(f"still window at {s / 30:.1f}s mean {m:.2f} frozen {fz:.0%}")
print("lowest 1 s motion", round(lo, 2), "brightness", fr.mean((1, 2)).min().round(1), fr.mean((1, 2)).max().round(1))
# determinism: a frame must render the same after jumping around
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=browser_args(is_3d("."))); g = b.new_page(viewport={"width": 1920, "height": 1080}); g.goto(page_url(".")); g.wait_for_function("window.READY", timeout=120000)
    js = "f=>{renderAt(f/30);return document.getElementById('c').toDataURL('image/png')}"; n = CUT[-1]
    for f in (n // 5, n // 2, n * 4 // 5):
        a_ = g.evaluate(js, f); g.evaluate("n=>{renderAt(n*.11);renderAt(n*.031)}", n / 30); c_ = g.evaluate(js, f)
        if a_ != c_: iss.append(f"not deterministic at frame {f}")
    b.close()
# sound and sheet from the encoded file, not the working frames
r = subprocess.run([ffmpeg(), "-hide_banner", "-i", mp4.name, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
tail = r[r.rfind("Summary:"):]
g = lambda pat: (re.findall(pat, tail) or ["?"])[0]
print(f"sound: {g(r'I:\s+(-?[\d.]+)')} LUFS, range {g(r'LRA:\s+([\d.]+)')} LU, peak {g(r'Peak:\s+(-?[\d.]+)')} dBFS. Target about -17 LUFS, peak under -1.")
times = np.linspace(.5, info["dur"] - .5, 12)
for i, t in enumerate(times):
    subprocess.run([ffmpeg(), "-y", "-v", "error", "-ss", f"{t:.2f}", "-i", mp4.name, "-frames:v", "1", "-vf", "scale=640:-1", f"shots/sheet_{i:02d}.jpg"], check=False)
sh = Image.new("RGB", (640 * 3, 360 * 4))
for i in range(12):
    sh.paste(Image.open(f"shots/sheet_{i:02d}.jpg"), ((i % 3) * 640, (i // 3) * 360)); os.remove(f"shots/sheet_{i:02d}.jpg")
sh.save("contact_sheet.jpg", quality=88)
print("view contact_sheet.jpg before delivering")
print("ISSUES", len(iss))
kinds = {}
for i in iss:
    kinds.setdefault(re.sub(r"[\d.]+", "#", i), []).append(i)
for k, v in kinds.items():
    print(f"  {len(v)} x {v[0]}" + (f" ... {v[-1]}" if len(v) > 1 else ""))
