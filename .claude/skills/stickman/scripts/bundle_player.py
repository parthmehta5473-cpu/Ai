#!/usr/bin/env python3
"""Fallback when no headless browser can render: one HTML file that plays the film and records WebM in real time.
usage: bundle_player.py <folder>   writes <folder>/player.html"""
import base64, re, sys
from pathlib import Path

d = Path(sys.argv[1]); html = (d / "index.html").read_text(encoding="utf8")
if (d / "lib3d.js").exists():
    sys.exit("The player works for 2D films only.")
js = "".join((d / s).read_text(encoding="utf8") + "\n" for s in re.findall(r"<script src=([\w/.-]+)></script>", html))
snd = ""
if (d / "audio.wav").exists():
    snd = "data:audio/wav;base64," + base64.b64encode((d / "audio.wav").read_bytes()).decode()
page = f"""<!doctype html><meta charset=utf8><title>Stickman player</title>
<body style="margin:0;background:#120a1c;color:#eee;font:15px system-ui;text-align:center">
<canvas id=c width=1920 height=1080 style="width:100%;max-width:1280px;display:block;margin:auto"></canvas>
<p><button id=play>Play</button> <button id=rec>Record WebM</button> <span id=st></span></p>
<audio id=au src="{snd}"></audio>
<script>{js}
bootFilm();const au=document.getElementById('au'),st=document.getElementById('st');let t0=0,run=false;
function loop(now){{if(!run)return;const t=(now-t0)/1000;renderAt(t);if(t>=FILM.dur){{run=false;window.onend&&onend()}}else requestAnimationFrame(loop)}}
function start(){{au.currentTime=0;au.play().catch(()=>{{}});t0=performance.now();run=true;requestAnimationFrame(loop)}}
renderAt(.6);document.getElementById('play').onclick=start;
document.getElementById('rec').onclick=()=>{{const v=main.captureStream(30);try{{const a=au.captureStream?au.captureStream():au.mozCaptureStream();a.getAudioTracks().forEach(x=>v.addTrack(x))}}catch(e){{}}
const r=new MediaRecorder(v,{{mimeType:'video/webm'}}),b=[];r.ondataavailable=e=>b.push(e.data);r.onstop=()=>{{const l=document.createElement('a');l.href=URL.createObjectURL(new Blob(b,{{type:'video/webm'}}));l.download='stickman.webm';l.click();st.textContent='saved'}};window.onend=()=>r.stop();r.start();st.textContent='recording in real time';start()}};
</script>"""
(d / "player.html").write_text(page, encoding="utf8"); print("wrote", (d / "player.html").resolve())
