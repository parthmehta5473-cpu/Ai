# Sound

The approved recipe: real recordings pitched down, synthesized rain and room beds, no bright sounds in tense scenes.

## The brief decides
Apply only what the person said yes to: effects, music, voiceover. Room ambience is not music. ElevenLabs is for voiceover only, never effects.

## Toolkit
`scripts/audio_kit.py` holds a `Mix` class. `sfx/` holds real CC0 recordings: footsteps on wood, concrete, carpet and grass; doors, latches, creaks, cloth; impacts in wood, metal, glass, plate, tin and soft.

- Any recording: `m.sfx(name,t,pitch,lowpass,gain,pan,wet)`.
- Beds, each with a level curve: `room_bed`, `rain_bed`, `wind_bed`, `street_bed`, `air_bed`, `drone`.
- Recipes: `boots`, `step`, `door_open`, `door_stop`, `cup_down`, `cloth`, `chair_scrape`, `heart`, `gunshot`, `slow_shot`, `whoosh`, `thunder`, `splash`, `sigh`, `tick`, `engine_pass`, `crowd`.
- `nb(t,lo,hi,dur,attack,release,gain,pan)` makes any short noise burst. Use it for one-off foley.

Place sounds from `plants` and `EVENTS` so they stay on the picture's clock. Footfalls should land about .03 s before the contact.

## Mood
- Tense or dark: pitch real sounds down to about .5-.75, low-pass them, add reverb and a low impact under each boot. Measure it: a dark mix sits around a 500-600 Hz spectral centroid.
- Bells, chimes and bright metal are for light scenes only.
- Silence is a tool. Drop the room just before a big moment.

## Music
- If the person uploaded a track: `m.music_file("track.mp3")`.
- Otherwise `m.music(mood="warm")`, with moods `warm`, `sad`, `tense`, `hopeful`. It is a soft code-made pluck and pad.
- Keep it about 5 dB under effects and ambience. Voice stays dry and on top.
- Stock music from the internet is not used, because its licence cannot be checked here.

## Voice
`m.voice("vo.mp3",at=.5,gain_db=-3.5,cuts=[(voice_time,hold)])`. Effects are ducked under it automatically. If it clips, lower `gain_db`. The free built-in voice is `vo.wav` and takes the same settings.

## Targets
About -17 LUFS overall, peak under -1 dBFS. A flat loudness range under 2 LU usually means a bed is too loud and is flattening everything. Reduce it.
