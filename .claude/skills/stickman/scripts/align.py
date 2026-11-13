#!/usr/bin/env python3
"""Word timings for a voiceover. usage: align.py <folder> <voice.mp3> <script.txt>
Writes align.json ([word,start,end]) and pauses.json into the folder. Uses a free PyPI package with its model bundled."""
import json, re, subprocess, sys
from pathlib import Path
from common import ffmpeg

folder, mp3, txt = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
r = subprocess.run([ffmpeg(), "-hide_banner", "-i", mp3, "-af", "silencedetect=noise=-35dB:d=0.18", "-f", "null", "-"], capture_output=True, text=True).stderr
starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", r)]; ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", r)]
pauses = list(zip(starts, ends)); json.dump(pauses, open(folder / "pauses.json", "w"))
print("pauses", [(round(a, 2), round(b, 2)) for a, b in pauses])
try:
    from pocketsphinx import Decoder
except ImportError:
    for extra in ([], ["--user"], ["--break-system-packages"]):
        if subprocess.run([sys.executable, "-m", "pip", "install", "-q", *extra, "pocketsphinx"], capture_output=True).returncode == 0:
            break
    try:
        from pocketsphinx import Decoder
    except ImportError:
        sys.exit("pocketsphinx would not install. Fallback: use pauses.json and give each sentence a share of the time by its word count.")
raw = subprocess.run([ffmpeg(), "-v", "error", "-i", mp3, "-ar", "16000", "-ac", "1", "-f", "s16le", "-"], capture_output=True, check=True).stdout
words = re.sub(r"[^a-z' ]", " ", " ".join(open(txt, encoding="utf8").read().split()).lower()).split()
d = Decoder(samprate=16000, loglevel="FATAL", bestpath=False); d.set_align_text(" ".join(words))
d.start_utt(); d.process_raw(raw, full_utt=True); d.end_utt()
seg = [(s.word, s.start_frame / 100, (s.end_frame + 1) / 100) for s in (d.seg() or [])]
json.dump(seg, open(folder / "align.json", "w"))
if not seg:
    sys.exit("alignment found nothing. Fallback: use pauses.json and give each sentence a share of the time by its word count.")
print(len(seg), "items aligned;", len(words), "script words. Check order against pauses.json.")
