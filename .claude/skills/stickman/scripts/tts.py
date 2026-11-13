#!/usr/bin/env python3
"""Free voiceover from a script, so a finished film needs no ElevenLabs.
Uses Kokoro-82M (Apache-2.0 weights) through kokoro-onnx (MIT): https://github.com/thewh1teagle/kokoro-onnx
Runs on CPU on Windows, macOS, Linux and the Claude sandbox. The model downloads once from GitHub releases (about 350 MB).

usage: tts.py <folder> <script.txt> [--voice am_michael] [--speed 1] [--lang auto] [--cast "Mia=af_heart,Ravi=hm_omega"]
       tts.py <folder> <script.txt> --audition am_michael,bm_george,af_heart   # first beat in each voice, to choose one
       tts.py --list-voices

Writes into the folder:
  vo.wav         the voice, loudness-matched, for audio_mix.py (VOICE = "vo.wav")
  vo.mp3         the same voice, to hand to the person
  vo_lines.json  exact start and end of every spoken line, in vo.wav time
  vo_script.txt  the spoken words only (no pause marks), as align.py wants them
  pauses.json    the gaps between lines; align.py replaces it with silence detection for English
  align.json     word times: exact from align.py for English, otherwise spread over each line by length
Every line is cached in voice_parts/, so after an edit only the changed lines are spoken again.

Script format: the paste-ready script from script-playbook.md works as it is.
  blank line = new beat (longer gap); line break = new thought; "..." = weighted pause
  [pause 2] or <break time="2s" /> = exact silence; [short pause] / [long pause] also work
  other [bracket tags] and stage notes are never spoken; lines starting with # are skipped
  "Name: line" uses that speaker's voice when Name is in --cast
"""
import argparse, hashlib, json, os, re, shutil, subprocess, sys, urllib.request, wave
from pathlib import Path
from common import ffmpeg

SCRIPTS = Path(__file__).resolve().parent
REL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
MODEL = {"full": "kokoro-v1.0.onnx", "small": "kokoro-v1.0.int8.onnx"}
VOICES = "voices-v1.0.bin"
SR = 24000
LANG = {"a": "en-us", "b": "en-gb", "h": "hi", "e": "es", "f": "fr-fr", "i": "it", "j": "ja", "p": "pt-br", "z": "cmn"}
GUIDE = """Good story voices:
  am_michael   warm US male, the default narrator      bm_george   calm UK male storyteller
  bm_fable     softer UK male, fables and bedtime      am_onyx     deep US male, dark or tense
  af_heart     the strongest US female voice           bf_emma     clear UK female
  am_puck      light and playful, comedy               af_bella    bright US female
Hindi (write the script in Devanagari; English words may stay in English letters):
  hm_omega, hm_psi (male)   hf_alpha, hf_beta (female)
Blend two voices for a unique narrator: --voice "am_michael:0.6+bm_george:0.4" """
GAPS = {"sentence": .3, "reveal": .65, "line": .5, "beat": .95}
PAUSE = re.compile(r"\[\s*pause\s*([\d.]+)\s*s?\s*\]|<break\s+time=\"([\d.]+)\s*s\"\s*/?>|\[\s*(short|long)\s+pause\s*\]", re.I)
ABBR = re.compile(r"(?:\b(?:Mr|Mrs|Ms|Dr|St|Sr|Jr|vs|etc|No)|\b[A-Z])\.$")


def pip(*pkgs):
    for extra in ([], ["--user"], ["--break-system-packages"]):
        if subprocess.run([sys.executable, "-m", "pip", "install", "-q", *extra, *pkgs], capture_output=True).returncode == 0:
            return True
    return False


def load_engine():
    try:
        from kokoro_onnx import Kokoro
    except ImportError:
        print("installing kokoro-onnx (one time)", flush=True)
        if not pip("kokoro-onnx"):
            sys.exit("kokoro-onnx would not install (it needs Python 3.10-3.13). Fallback: write the script for ElevenLabs and ask for the MP3.")
        from kokoro_onnx import Kokoro
    return Kokoro


def model_dir(arg):
    chosen = arg or os.environ.get("STICKMAN_VOICE_DIR")
    if chosen:
        Path(chosen).mkdir(parents=True, exist_ok=True)
        return Path(chosen)
    cands = [Path.home() / ".cache" / "stickman-voice", SCRIPTS.parent / ".voice-models", Path.cwd() / ".voice-models"]
    for d in cands:
        if (d / VOICES).exists():
            return d
    for d in cands:
        try:
            d.mkdir(parents=True, exist_ok=True); (d / ".w").write_text("ok"); (d / ".w").unlink()
            return d
        except OSError:
            continue
    sys.exit("no writable folder for the voice model. Pass --model-dir.")


def fetch(d, name):
    p = d / name
    if p.exists() and p.stat().st_size > 1_000_000:
        return p
    tmp = d / (name + ".part"); url = REL + name
    print("downloading", name, "(one time)", flush=True)
    try:
        with urllib.request.urlopen(url, timeout=120) as r, open(tmp, "wb") as f:
            shutil.copyfileobj(r, f, 1 << 20)
    except Exception as e:
        if not (shutil.which("curl") and subprocess.run(["curl", "-sSLf", "-o", str(tmp), url]).returncode == 0):
            sys.exit(f"could not download {name}: {e}\nGet it by hand from {url}, put it in {d} (or pass --model-dir), and run again.\n"
                     "Fallback: write the script for ElevenLabs and ask for the MP3.")
    os.replace(tmp, p)
    return p


def clean(t):
    t = re.sub(r"<[^>]+>", " ", t)            # SSML other than breaks
    t = re.sub(r"\[[^\]]*\]", " ", t)         # audio tags and stage notes are never spoken
    t = re.sub(r"[*_`~#]", "", t).replace("…", "...")
    return re.sub(r"\s+", " ", t).strip()


def sentences(t):
    out = []
    for piece in re.split(r"(?<=[.!?।])\s+", t):
        if out and ABBR.search(out[-1]):
            out[-1] += " " + piece
        else:
            out.append(piece)
    return [s for s in out if re.search(r"\w", s)]


def parse(raw, cast, voice0):
    """Script -> spoken lines with the gap before each one."""
    stream = []
    for b, para in enumerate(p for p in re.split(r"\n\s*\n", raw.replace("\r", "")) if p.strip()):
        stream.append(("beat",))
        for k, row in enumerate(r.strip() for r in para.split("\n") if r.strip() and not r.strip().startswith("#")):
            if k:
                stream.append(("line",))
            voice, m = voice0, re.match(r"([^:\[\]<>]{1,30}):\s*(.*)$", row)
            if m and m.group(1).strip().lower() in cast:
                voice, row = cast[m.group(1).strip().lower()], m.group(2)
            pos = 0
            for pm in list(PAUSE.finditer(row)) + [None]:
                for s in sentences(clean(row[pos: pm.start() if pm else len(row)])):
                    stream.append(("text", s, voice, b))
                if pm:
                    num = pm.group(1) or pm.group(2)
                    secs = float(num) if num else (.6 if pm.group(3).lower() == "short" else 1.5)
                    stream.append(("pause", secs)); pos = pm.end()
    lines, kinds, extra, reveal = [], set(), 0.0, False
    for tok in stream:
        if tok[0] == "text":
            gap = 0.0
            if lines:
                gap = extra if extra else max([GAPS[x] for x in kinds] + [GAPS["reveal" if reveal else "sentence"]])
            lines.append({"text": tok[1], "voice": tok[2], "beat": tok[3], "gap": round(gap, 3)})
            kinds, extra, reveal = set(), 0.0, tok[1].endswith("...")
        elif tok[0] == "pause":
            extra += tok[1]
        else:
            kinds.add(tok[0])
    return lines


def voice_style(k, spec):
    """'am_michael' or a blend 'am_michael:0.6+bm_george:0.4'. Returns (style or name, lang from the first voice)."""
    parts = [(p.split(":")[0].strip(), float(p.split(":")[1]) if ":" in p else 1.0) for p in spec.split("+")]
    for n, _ in parts:
        if n not in k.get_voices():
            sys.exit(f"unknown voice {n}. Run tts.py --list-voices")
    lang = LANG.get(parts[0][0][0], "en-us")
    if len(parts) == 1:
        return parts[0][0], lang
    tot = sum(w for _, w in parts)
    return sum(k.get_voice_style(n) * (w / tot) for n, w in parts), lang


def trim(a, floor=.004):
    import numpy as np
    idx = np.where(np.abs(a) > floor)[0]
    if not len(idx):
        return a
    pad = int(.02 * SR)
    return a[max(0, idx[0] - pad): idx[-1] + pad]


def save_wav(path, a):
    import numpy as np
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(a, -1, 1) * 32767).astype("<i2").tobytes())


def to_mp3(wav, mp3):
    return subprocess.run([ffmpeg(), "-y", "-v", "error", "-i", str(wav), "-c:a", "libmp3lame", "-b:a", "192k", str(mp3)]).returncode == 0


def loudness_match(path, a, target=-16.0):
    """Gentle compression, then about -16 LUFS with peaks under -1.5 dBFS, like a typical ElevenLabs MP3,
    so audio_mix.py treats both the same. Neither filter shifts timing, so vo_lines.json stays exact."""
    import numpy as np
    save_wav(path, a); tmp = path.with_name(path.stem + "_ln.wav")
    chain = f"acompressor=threshold=0.125:ratio=2.5:attack=8:release=120,loudnorm=I={target}:TP=-1.5:LRA=9"
    if subprocess.run([ffmpeg(), "-y", "-v", "error", "-i", str(path), "-af", chain, "-ar", str(SR), "-ac", "1", str(tmp)]).returncode == 0:
        with wave.open(str(tmp)) as w:
            b = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float32) / 32767
        tmp.unlink()
        if abs(len(b) - len(a)) < SR // 100:
            return np.pad(b, (0, max(0, len(a) - len(b))))[: len(a)]
    return a * min(10 ** (-1.5 / 20) / max(np.abs(a).max(), 1e-6), 4.0)


def main():
    ap = argparse.ArgumentParser(description="Free voiceover with Kokoro (open source).")
    ap.add_argument("folder", nargs="?"); ap.add_argument("script", nargs="?")
    ap.add_argument("--voice", default="am_michael")
    ap.add_argument("--speed", type=float, default=.9, help="0.5-2; .9 is an unhurried storyteller, 1 is brisk")
    ap.add_argument("--lang", default="auto", help="auto follows the voice: a=en-us b=en-gb h=hi e=es f=fr-fr i=it j=ja p=pt-br z=cmn")
    ap.add_argument("--cast", default="", help='speaker voices for "Name: line" scripts, e.g. "Narrator=am_michael,Mia=af_heart"')
    ap.add_argument("--audition", default="", help="comma list of voices; speaks the first beat in each, then stops")
    ap.add_argument("--small", action="store_true", help="smaller int8 model (90 MB); slower on most CPUs, slightly lower quality")
    ap.add_argument("--model-dir"); ap.add_argument("--list-voices", action="store_true")
    ap.add_argument("--no-align", action="store_true", help="skip running align.py for English word times")
    o = ap.parse_args()
    if not o.list_voices and not (o.folder and o.script):
        ap.error("give a film folder and a script file")
    if not 0.5 <= o.speed <= 2.0:
        sys.exit("--speed must be between 0.5 and 2.0")

    import numpy as np
    Kokoro = load_engine()
    d = model_dir(o.model_dir); mname = MODEL["small" if o.small else "full"]
    k = Kokoro(str(fetch(d, mname)), str(fetch(d, VOICES)))
    if o.list_voices:
        print(GUIDE); print("\nall voices:", " ".join(sorted(k.get_voices()))); return

    folder = Path(o.folder)
    if not (folder / "index.html").exists():
        print("note: no film in this folder yet. For a film, run new_film.py first, because it needs an empty folder.", flush=True)
    folder.mkdir(parents=True, exist_ok=True)
    raw = Path(o.script).read_text(encoding="utf8")
    cast = {a.split("=")[0].strip().lower(): a.split("=")[1].strip() for a in o.cast.split(",") if "=" in a}
    lines = parse(raw, cast, o.voice)
    if not lines:
        sys.exit("the script has no spoken words")
    parts = folder / "voice_parts"; parts.mkdir(exist_ok=True)
    styles = {}

    def speak(text, spec):
        if spec not in styles:
            styles[spec] = voice_style(k, spec)
        style, lang = styles[spec]
        lang = lang if o.lang == "auto" else o.lang
        key = hashlib.sha1(f"{mname}|{spec}|{o.speed}|{lang}|{text}".encode()).hexdigest()[:16]
        f = parts / f"{key}.npy"
        if f.exists():
            return np.load(f), lang
        a, _ = k.create(text, voice=style, speed=o.speed, lang=lang)
        a = trim(np.asarray(a, dtype=np.float32)); np.save(f, a)
        return a, lang

    if o.audition:
        first = " ".join(l["text"] for l in lines if l["beat"] == lines[0]["beat"])[:400]
        out = folder / "audition"; out.mkdir(exist_ok=True)
        for v in [v.strip() for v in o.audition.split(",") if v.strip()]:
            a, _ = speak(first, v); w = out / f"{v.replace(':', '-').replace('+', '_')}.wav"
            a = loudness_match(w, a); save_wav(w, a); to_mp3(w, w.with_suffix(".mp3")); print("audition", w.with_suffix(".mp3"), flush=True)
        return

    pieces, rows, t, warned = [], [], 0.0, False
    for i, ln in enumerate(lines):
        print(f"line {i + 1}/{len(lines)}", flush=True)
        a, lang = speak(ln["text"], ln["voice"])
        if lang == "hi" and not warned and not re.search(r"[\u0900-\u097F]", ln["text"]):
            print("NOTE: a Hindi voice is reading Roman-letter text, which it speaks with an English accent. "
                  "Write Hindi words in Devanagari for natural Hindi.", flush=True); warned = True
        if i:
            pieces.append(np.zeros(int(ln["gap"] * SR), np.float32)); t += ln["gap"]
        rows.append({"n": i, "beat": ln["beat"], "voice": ln["voice"], "start": round(t, 3), "end": round(t + len(a) / SR, 3), "text": ln["text"]})
        pieces.append(a); t += len(a) / SR
    pieces.append(np.zeros(int(.3 * SR), np.float32))
    vo = np.concatenate(pieces)
    wav = folder / "vo.wav"; vo = loudness_match(wav, vo); save_wav(wav, vo)
    mp3 = folder / "vo.mp3"; has_mp3 = to_mp3(wav, mp3)

    json.dump(rows, open(folder / "vo_lines.json", "w", encoding="utf8"), ensure_ascii=False, indent=1)
    beats = {}
    for r in rows:
        beats.setdefault(r["beat"], []).append(r["text"])
    (folder / "vo_script.txt").write_text("\n\n".join(" ".join(v) for v in beats.values()) + "\n", encoding="utf8")
    json.dump([[a["end"], b["start"]] for a, b in zip(rows, rows[1:])], open(folder / "pauses.json", "w"))
    est = []
    for r in rows:
        ws = r["text"].split(); tot = sum(len(w) + 1 for w in ws); s = r["start"]
        for w in ws:
            e = s + (r["end"] - r["start"]) * (len(w) + 1) / tot; est.append([w.lower().strip(".,!?;:\"'।…"), round(s, 3), round(e, 3)]); s = e
    json.dump(est, open(folder / "align_est.json", "w", encoding="utf8"), ensure_ascii=False)

    exact = False
    langs = {styles[v][1] if o.lang == "auto" else o.lang for v in styles}
    if not o.no_align and all(x.startswith("en") for x in langs):
        print("aligning words (English)", flush=True)
        subprocess.run([sys.executable, str(SCRIPTS / "align.py"), str(folder), str(wav), str(folder / "vo_script.txt")])
        try:
            exact = len(json.load(open(folder / "align.json"))) > 0
        except Exception:
            exact = False
    if not exact:
        shutil.copy(folder / "align_est.json", folder / "align.json")
        json.dump([[a["end"], b["start"]] for a, b in zip(rows, rows[1:])], open(folder / "pauses.json", "w"))

    words = sum(len(r["text"].split()) for r in rows); dur = len(vo) / SR
    print(f"\nvoice {dur:.2f} s, {len(rows)} lines, {len(beats)} beats, {words} words, pace {words / dur * 60:.0f} wpm "
          f"(narrated fable 125-133, serial drama 96-127; change with --speed)")
    print("word times:", "exact (align.py)" if exact else "estimated inside each line; line starts and ends are exact")
    print(f"film length: about {dur + 2:.1f} s with m.voice('vo.wav', at=.5) and a 1.5 s tail, plus any holds")
    print("beat starts (vo time):", ", ".join(f"{b}:{min(r['start'] for r in rows if r['beat'] == b):.2f}" for b in beats))
    print("OUTPUT", wav.resolve(), "|", mp3.resolve() if has_mp3 else "(mp3 skipped: this ffmpeg has no mp3 encoder)")


if __name__ == "__main__":
    main()
