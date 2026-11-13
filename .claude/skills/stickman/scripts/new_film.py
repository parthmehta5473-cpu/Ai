#!/usr/bin/env python3
"""Create a film folder from the engine. usage: new_film.py <folder> [--3d]"""
import argparse, shutil, subprocess
from pathlib import Path
from common import SKILL

a = argparse.ArgumentParser(); a.add_argument("folder"); a.add_argument("--3d", dest="three", action="store_true")
o = a.parse_args(); d = Path(o.folder)
if d.exists() and any(d.iterdir()):
    raise SystemExit(f"{d} is not empty")
d.mkdir(parents=True, exist_ok=True)
if o.three:
    shutil.copytree(SKILL / "engine", d, dirs_exist_ok=True)   # 3D sets are painted by the 2D set code
    for f in (SKILL / "engine3d").iterdir():
        shutil.copy(f, d)
    shutil.copy(SKILL / "templates" / "film_3d.js", d / "film.js")
    npm = shutil.which("npm")
    if not npm:
        raise SystemExit("3D needs Node and npm. Install Node, or use the 2D route.")
    subprocess.run([npm, "i", "three@0.169.0", "--silent"], cwd=d, check=True)
else:
    shutil.copytree(SKILL / "engine", d, dirs_exist_ok=True)
    shutil.copy(SKILL / "templates" / "film_2d.js", d / "film.js")
shutil.copy(SKILL / "templates" / "audio_mix.py", d / "audio_mix.py")
print("film folder ready:", d.resolve())
