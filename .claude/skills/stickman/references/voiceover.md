# Building a film to a voiceover

Voiceover is optional. If the answer is no, skip this file.

## Inputs
- MP3 plus script text: the standard path. No SRT is needed.
- MP3 only: run recognition for a draft, show it to the person, correct it, then align. Blind recognition gets words wrong, so never use its text unchecked.
- SRT: accepted, not required.
- No MP3: make the voice free with `scripts/tts.py` (see `free-voice.md`). It writes `vo.wav`, `align.json` and `pauses.json` for you, so start at step 3 below.

## Steps
1. Run `python3 SKILL/scripts/align.py film vo.mp3 script.txt`. It installs a free package, writes `film/align.json` with each word's start and end, and lists pauses from silence detection. Alignment is English only as tested.
2. If the install fails, use the fallback the script prints: pauses plus each sentence's share of the word count.
3. Set cut frames from word times. Cuts sit in pauses or just before the word they illustrate.
4. To hold a story beat, insert silence at a pause with `cuts` in `m.voice`.
5. Film length is the voice length plus a short lead-in and tail.
6. Mix voice first. Keep effects low under it.

Upload note: Claude's upload limit is 30 MB per file, which is plenty for an MP3.

## Blind draft
```
python3 -m pip install pocketsphinx
```
Use pocketsphinx's decoder without `set_align_text` to produce a draft, then have the person correct it.
