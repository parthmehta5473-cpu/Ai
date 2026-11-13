"""Sound mix for one film. build.py runs this inside the film folder.
Edit the marked block only. Plants and EVENTS come from film.js, so sound stays on the picture's clock."""
import json, os, sys
sys.path.insert(0, os.environ["STICKMAN_SCRIPTS"])
from audio_kit import Mix

info = json.load(open("film.json"))
m = Mix(info["dur"], seed=9)

# ---- EDIT FROM HERE: set this from the sound brief ----
SFX, MUSIC, VOICE = True, False, None     # VOICE = "vo.mp3" to lay in a voiceover, or "vo.wav" from scripts/tts.py

if SFX:
    m.room_bed([(0, 1), (3, 1), (4.5, .35), (info["dur"], .3)])
    m.rain_bed([(0, .08), (3, .08), (3.9, 1), (info["dur"], 1)])
    m.drone([(0, 0), (3, .05), (4, .55), (8, .45), (info["dur"], .2)])
    for t in info["plants"].get("stranger", []):
        m.boots(t - .03, pan=.4)
    for e in info["events"]:
        t, k = e["t"], e["k"]
        if k == "latch": m.sfx("metallatch", t, .72, 3200, .32, .35)
        elif k == "door": m.door_open(t, pan=.35)
        elif k == "doorstop": m.door_stop(t, pan=.35)
        elif k == "cupdown": m.cup_down(t, pan=-.4)
if MUSIC:
    m.music(mood="warm")                  # or m.music_file("track.mp3") if the person supplied one
if VOICE:
    m.voice(VOICE, at=.5)
# ---- TO HERE ----
m.write("audio.wav")
