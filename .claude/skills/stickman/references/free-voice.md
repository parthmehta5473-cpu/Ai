# Free voiceover, no ElevenLabs

The skill can speak the script itself with Kokoro-82M, an open-source voice model, through `scripts/tts.py`. No account, no key and no cost. It runs on CPU anywhere the skill runs. The first run installs one pip package (`kokoro-onnx`) and downloads the model once from GitHub (about 350 MB); after that it works offline.

## When
Use it whenever a voiceover is wanted and there is no MP3: a script you wrote, or one the person typed or pasted. An MP3 the person supplies always wins. If they say they will make the voice in ElevenLabs, use that path instead.

## Steps
1. Set up the film folder first with `new_film.py`, because it needs an empty folder.
2. Save the paste-ready script as `film/script.txt`: spoken words only, formatted as below.
3. Voice choice. If the person has not picked one and is there to answer, audition three:
   `python3 SKILL/scripts/tts.py film film/script.txt --audition am_michael,bm_george,af_heart`
   It speaks the first beat in each voice into `film/audition/`. Send the MP3s and let them pick. If nobody is there, use the default `am_michael` and say so.
4. Make the voice:
   `python3 SKILL/scripts/tts.py film film/script.txt --voice am_michael`
   Run it in the background for long scripts and poll it. On 2 CPU cores it takes about 0.8 s per second of speech, so a 7-minute script takes about 6 minutes. Each line is cached in `film/voice_parts/`, so a stopped run resumes and an edited script only re-speaks the changed lines.
5. It writes `vo.wav`, `vo.mp3`, `vo_lines.json`, `vo_script.txt`, `pauses.json` and `align.json`. For English it runs `align.py` itself, so word times are exact. Continue with `voiceover.md` from step 3.
6. In `film/audio_mix.py` set `VOICE = "vo.wav"`. The voice is already about -16 LUFS with peaks under -1.5 dBFS, the same as a typical ElevenLabs MP3, so the usual `m.voice` settings work.
7. Plan cuts from `vo_lines.json`. Film time is voice time plus `at` (default .5) plus any holds added before that point with `cuts`.
8. Deliver `film/vo.mp3` with the film when the person wants the voice track on its own, or when the request was only for a voiceover.

## Voices
| Voice | Sound | Good for |
|---|---|---|
| `am_michael` | warm US male | default narrator, fables |
| `bm_george` | calm UK male | serious stories, documentary feel |
| `bm_fable` | soft UK male | bedtime and gentle fables |
| `am_onyx` | deep US male | dark or tense stories |
| `af_heart` | the strongest US female voice | any narration |
| `bf_emma` | clear UK female | calm narration |
| `am_puck` | light and playful | comedy |

`python3 SKILL/scripts/tts.py --list-voices` prints all 54. Blend two for a narrator nobody else has: `--voice "am_michael:0.6+bm_george:0.4"`. Keep the same voice, speed and blend across every film of a series.

## Hindi and Hinglish
Hindi voices: `hm_omega`, `hm_psi` (male), `hf_alpha`, `hf_beta` (female). They read Devanagari as Hindi. Roman-letter Hinglish comes out with an English accent, and the script warns when that happens. So for a Hindi or Hinglish voiceover, write Hindi words in Devanagari and leave English words such as AI, app or phone in English letters: `फिर उसे एक AI app मिलता है।`. If the person gave a Roman Hinglish script, convert it this way, show them the converted text, then run. Tell them plainly that the Hindi voices sound less natural than the English ones. `align.py` is English only, so Hindi word times are spread over each line by length; line starts and ends are exact.

## Script format
The ElevenLabs paste-ready script works unchanged.
- One paragraph per beat, a blank line between beats. Spell numbers, units and symbols as spoken.
- Gaps the script adds: sentence end .3 s, after `...` .65 s, line break .5 s, blank line .95 s.
- Exact silence: `[pause 1.5]` or `<break time="1.5s" />`. `[short pause]` is .6 s, `[long pause]` 1.5 s. Holds of several seconds still belong in the mix as `cuts`, so the film can be re-timed without re-voicing.
- Other bracket tags such as `[excitedly]` are dropped, not spoken. Kokoro has no emotion tags, so carry the feeling with wording, short sentences, punctuation and speed.
- Lines starting with `#` are skipped, so notes can stay in the file.
- Several speakers: write `Name: line` and pass `--cast "Narrator=am_michael,Mia=af_heart"`. Lines without a cast name use `--voice`.

## Pace
Default `--speed .9`, an unhurried storyteller. The script prints words per minute. The playbook targets include the holds added in the edit, so speech alone can run a little faster than the target. Use about .8-.85 for slow drama and 1-1.1 for a brisk explainer.

## Fixing a line
- A name or brand said wrongly: respell it as it sounds in the script, for example `Kokoro` as `Koh-koh-roh`, and run again. Only that line is re-spoken.
- A line that sounds flat: split it into two shorter sentences, or end it with `...` for weight.
- You cannot hear the voice. Say so, give the measurements the script prints (length, pace, loudness), and suggest the person plays `vo.mp3` before a long render. When a storyboard was requested, send `vo.mp3` with it.

## If it will not run
`kokoro-onnx` needs Python 3.10-3.13. If the install or the model download fails, the script prints the manual download link and the folder to put the files in (`--model-dir` points elsewhere). If that is not possible either, use the ElevenLabs path: deliver the script and ask for an MP3.

## Licence
Kokoro-82M weights are Apache-2.0 (github.com/hexgrad/kokoro) and `kokoro-onnx` is MIT (github.com/thewh1teagle/kokoro-onnx), so the voice can be used in monetised videos with no fee. pip also installs the espeak-ng phonemizer, which is GPL-3.0 and is used unchanged as a separate component; it does not affect the audio you make.
