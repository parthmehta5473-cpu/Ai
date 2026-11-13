#!/usr/bin/env python3
"""One command from film folder to checked MP4.
usage: build.py <folder> --out name.mp4 [--shots 3 7] [--audio-only] [--jobs N] [--crf 25]
Each shot renders to its own file, so a stopped or timed-out run resumes where it left off and a fix re-renders only that shot."""
import argparse, base64, json, multiprocessing as mp, os, subprocess, sys
from pathlib import Path
from common import FRAME_JS, browser_args, ffmpeg, is_3d, page_url

SCRIPTS = Path(__file__).resolve().parent


def info(folder):
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch(args=browser_args(is_3d(folder))); g = b.new_page()
        errs = []; g.on("pageerror", lambda e: errs.append(str(e)))
        g.goto(page_url(folder))
        try:
            g.wait_for_function("window.READY", timeout=120000)
        except Exception:
            sys.exit("film did not load: " + "; ".join(errs))
        d = g.evaluate("({dur:DUR,cuts:CUTF,events:EVENTS,plants:PLANTS})"); b.close()
    return d


def worker(a):
    folder, shots, cuts, tmp = a
    from playwright.sync_api import sync_playwright
    os.chdir(folder)
    with sync_playwright() as p:
        b = p.chromium.launch(args=browser_args(is_3d("."))); g = b.new_page(viewport={"width": 1920, "height": 1080})
        g.goto(page_url(".")); g.wait_for_function("window.READY", timeout=120000)
        for sh in shots:
            t_ = Path(tmp) / f"tmp_{sh:03d}.mp4"
            ff = subprocess.Popen([ffmpeg(), "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", "30", "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-g", "30", str(t_)], stdin=subprocess.PIPE)
            st = []
            for i in range(cuts[sh], cuts[sh + 1]):
                r = g.evaluate(FRAME_JS, i); st.append(json.loads(r[0])); ff.stdin.write(base64.b64decode(r[1].split(",")[1]))
            ff.stdin.close()
            if ff.wait() == 0:
                os.replace(t_, Path(tmp) / f"shot_{sh:03d}.mp4"); json.dump(st, open(Path(tmp) / f"st_{sh:03d}.json", "w")); print("shot", sh, "done", flush=True)
        b.close()


def main():
    a = argparse.ArgumentParser(); a.add_argument("folder"); a.add_argument("--out", default="film.mp4"); a.add_argument("--shots", nargs="*", type=int)
    a.add_argument("--audio-only", action="store_true"); a.add_argument("--jobs", type=int, default=0); a.add_argument("--crf", type=int, default=25)
    o = a.parse_args(); folder = Path(o.folder).resolve(); parts = folder / "shots"; parts.mkdir(exist_ok=True)
    d = info(folder); json.dump(d, open(folder / "film.json", "w")); cuts = d["cuts"]; n = len(cuts) - 1
    env = dict(os.environ, STICKMAN_SCRIPTS=str(SCRIPTS))
    subprocess.run([sys.executable, "audio_mix.py"], cwd=folder, env=env, check=True)
    if not o.audio_only:
        todo = list(o.shots) if o.shots else [s for s in range(n) if not (parts / f"shot_{s:03d}.mp4").exists()]
        for s in todo:
            (parts / f"shot_{s:03d}.mp4").unlink(missing_ok=True)
        jobs = o.jobs or min(os.cpu_count() or 2, 1 if is_3d(folder) else 4, max(len(todo), 1))
        # balance by frames so each process gets a similar load
        buckets = [[] for _ in range(jobs)]; load = [0] * jobs
        for s in sorted(todo, key=lambda s: cuts[s] - cuts[s + 1]):
            k = load.index(min(load)); buckets[k].append(s); load[k] += cuts[s + 1] - cuts[s]
        if todo:
            with mp.get_context("spawn").Pool(jobs) as pool:
                pool.map(worker, [(str(folder), sorted(b), cuts, str(parts)) for b in buckets if b])
    missing = [s for s in range(n) if not (parts / f"shot_{s:03d}.mp4").exists()]
    if missing:
        sys.exit(f"shots not rendered: {missing}. Run the same command again to resume.")
    lst = folder / "list.txt"; lst.write_text("".join(f"file 'shots/shot_{s:03d}.mp4'\n" for s in range(n)))
    f = ffmpeg()
    subprocess.run([f, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", "list.txt", "-c", "copy", "silent.mp4"], cwd=folder, check=True)
    subprocess.run([f, "-y", "-loglevel", "error", "-i", "silent.mp4", "-i", "audio.wav", "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "medium", "-crf", str(o.crf), "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", o.out], cwd=folder, check=True)
    subprocess.run([sys.executable, str(SCRIPTS / "audit.py"), str(folder), o.out], check=False)
    print("OUTPUT", folder / o.out)


if __name__ == "__main__":
    main()
