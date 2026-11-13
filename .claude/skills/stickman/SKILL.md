---
name: stickman
description: Make cinematic stickman story videos as MP4 from code, plus ElevenLabs voiceover scripts, a free built-in open-source voiceover (no ElevenLabs needed), YouTube titles and thumbnail prompts. Use for /stickman or any stickman animation request.
argument-hint: "[topic or story] [length]"
---

# /stickman

Turn a topic into a finished stickman film rendered entirely from code: flat 2D characters, a dusk palette, film-style camera work and real sound. The skill covers four outputs: the video, the voiceover script, YouTube titles and thumbnail prompts.

It works anywhere Claude can run code, including the Claude free plan. No paid tools are needed and no AI image or video tools are used. ElevenLabs is optional and only for voiceover. Without an MP3, the skill speaks the script itself with a free open-source voice (`scripts/tts.py`, see `references/free-voice.md`), so a narrated film needs no ElevenLabs at all.

Everything below is relative to this skill's folder (the folder holding this file). Find its absolute path once and use it for every script. On Claude Code it is `${CLAUDE_SKILL_DIR}`. Call it `SKILL` in the commands below. Use `python3`, or `python` on Windows.

## Step 1: Work out what was asked

The user may want the whole package or one part. Do only what was asked:

| Request | Do |
|---|---|
| Story ideas | Do "Story ideas" below, then stop |
| Make a video | Steps 2-6 |
| Write a voiceover script | Read `references/script-playbook.md`, deliver the script, stop |
| Turn a script into a voiceover | Read `references/free-voice.md`, run `tts.py`, deliver `vo.mp3`, stop |
| Titles or thumbnails | Read `references/packaging-playbook.md`, deliver the pairs, stop |
| Full package | Script, then video, then titles and thumbnail prompts |

## Story ideas
If the length is not stated, ask how long the videos should be first. Then give 5 ideas, numbered, so the person can pick one by its number. Each idea has a short name, one plain sentence saying what happens, and the ending. Fit each idea to that length: under 20 s means one character and one simple turn. Ideas must be easy to animate with what is in `references/engine.md`, and each must be original. Later, "make idea 3" means that idea.

## Step 2: Ask before building

Unless the request already makes it clear, ask these together in one message, and use a question tool if there is one. Skip anything already answered. If nobody is there to answer, use the default and say so.

1. **Style:** 2D or 3D? Default 2D. Both use the same look. 3D adds real camera moves around the scene.
2. **Length:** how long? Default 30 s. With an MP3, the voiceover sets the length.
3. **Voiceover:** yes or no? Skip this if an MP3 is attached. If yes, they supply an MP3 and its script text, or ask you to write a script for ElevenLabs and come back with the MP3. No SRT is needed. Or, the default when there is no MP3: the free built-in voice speaks the script, theirs or one you write, so they never leave the chat. Ask which voice only if they care; `references/free-voice.md` has the audition.
4. **Sound effects:** yes or no? Default yes.
5. **Background music:** yes or no? Default no. If yes, use their uploaded track if there is one, otherwise the code-made music bed.
6. **Storyboard:** do you want to see a storyboard first? Always ask this unless the request already says. If nobody is there to answer, skip it.

Do not assume music, effects or voice. Quiet room ambience is not music.

## Step 3: Set up

```
python3 SKILL/scripts/doctor.py
python3 SKILL/scripts/new_film.py film        # add --3d for 3D
```

`doctor.py` installs anything missing. If Chromium cannot run at all, go to "If rendering is not possible".

**Free voice:** make it now, before planning, because the voice sets the timing. Save the script as `film/script.txt`, then run `python3 SKILL/scripts/tts.py film film/script.txt --voice am_michael` and set `VOICE = "vo.wav"` in `film/audio_mix.py`. Details in `references/free-voice.md`.

Then read, in this order:
1. `references/style-bible.md`: the look and the rules that never bend.
2. `references/production.md`: the fast path and known traps.
3. `references/engine.md`: the toolkit, so you reuse it instead of redrawing.
4. `references/film-craft.md`: story and shots for wordless or short films.

Also read when relevant: `references/script-playbook.md` for writing a script, `references/free-voice.md` for the free built-in voice, `references/voiceover.md` for an MP3, `references/sound.md` for the mix, `references/symbolic-beats.md` for films of about a minute or longer, `references/3d.md` for 3D.

## Step 4: Plan the film

Write these before any drawing code, because planning inside the code produces slides, not films:

1. One sentence a distracted viewer would understand.
2. A beat sheet where each beat has an action, a feeling, a camera and a sound.
3. **One world:** a list of fixed positions for every character and prop. Every shot is only a camera on that world.
4. A shot list with cut frames, not seconds. Aim for 8-11 shots per 30 s, and include a wide shot that shows the geography.
5. The thumbnail moment, if a package was asked for, so it exists as a real scene.

If a storyboard was requested, follow "Storyboard" in Step 5 before rendering.

## Step 5: Build

1. Replace `film/film.js`, keeping the engine files. Start from the patterns in the starter film.
2. Check stills at the busiest moments, and view the image: `python3 SKILL/scripts/stills.py film sheet.jpg 1 4.5 9 ...`. Two rounds is normal.
3. **Storyboard, if requested.** Run `python3 SKILL/scripts/storyboard.py film`. It writes `film/storyboard.jpg`, one numbered preview per shot, drawn by the same code as the final film. Show the person a table with one row per shot (shot, time, what happens, camera, sound), and show or send the image. If images can't be shown here, send the file, or give the table alone and say so. Then stop and wait. Change the film as they ask, re-run the storyboard if it changed much, and render only after they approve.
4. Edit the marked block of `film/audio_mix.py` to match the sound brief.
5. Render, mix, join and audit with one command:

```
python3 SKILL/scripts/build.py film --out my-film.mp4
```

Run this in the background if the environment limits command time, and poll it. Running the same command again resumes, because each shot is its own file. After a fix, use `--shots 3 7` to redo only those shots, or `--audio-only` to remix the sound.

## Step 6: Check, then deliver

`build.py` ends with the audit. Fix every ISSUE, or state why a flagged moment is intended. Then view `film/contact_sheet.jpg`, which comes from the encoded file. Check these by eye, because the audit cannot:

- Faces read as the intended emotion, and brows are not accidentally angry.
- Hands touch what they hold, and nothing crosses a face.
- Arms bend the right way on every walk.
- Doors open first, and then the character walks in.
- Characters stay at the same distance from objects from shot to shot.
- No decorative circles anywhere.

Deliver the MP4 with a short note. Say plainly that you cannot hear the mix: you measured it, so the user should listen to it. Do not claim checks you did not run. If the user asked for titles and thumbnails, add the pairs from the packaging playbook.

## If rendering is not possible

If no code execution or no browser is available, run `python3 SKILL/scripts/bundle_player.py film` when you can, which writes one HTML file that plays the film and records a real-time WebM. If you cannot run anything, say what is missing and offer the script, titles and thumbnail prompts, which need no rendering. Never rename a WebM to MP4.

## Rules on originality

Reference videos, titles, thumbnails or transcripts that a user shares are for general patterns only: length, wording, structure, pacing. Never copy or save anything specific to someone else's work, and never reuse a premise, character, plot, line or look. Every film gets its own story.
