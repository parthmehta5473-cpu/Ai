#!/usr/bin/env python3
"""Check the machine and install what is missing. Works on Windows, macOS, Linux and the Claude chat sandbox."""
import importlib.util, shutil, subprocess, sys


def pip(*pkgs):
    for extra in ([], ["--user"], ["--break-system-packages"]):
        r = subprocess.run([sys.executable, "-m", "pip", "install", "-q", *extra, *pkgs], capture_output=True, text=True)
        if r.returncode == 0:
            return True
    print(r.stderr[-400:])
    return False


need = {"numpy": "numpy", "scipy": "scipy", "PIL": "pillow", "playwright": "playwright"}
missing = [p for m, p in need.items() if importlib.util.find_spec(m) is None]
if not shutil.which("ffmpeg") and importlib.util.find_spec("imageio_ffmpeg") is None:
    missing.append("imageio-ffmpeg")
if missing:
    print("installing:", *missing)
    if not pip(*missing):
        sys.exit("could not install " + " ".join(missing))

from playwright.sync_api import sync_playwright
ok = False
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); b.close(); ok = True
except Exception:
    print("installing Chromium for Playwright")
    r = subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"])
    if r.returncode == 0:
        with sync_playwright() as p:
            b = p.chromium.launch(); b.close(); ok = True
if not ok:
    sys.exit("Chromium is not available. Use the browser player fallback: scripts/bundle_player.py")
print("ready")
