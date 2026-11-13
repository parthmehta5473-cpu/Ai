# Script playbook: voiceover scripts for ElevenLabs

Every script needs its own story and freshly checked facts. If the user shares example transcripts, take patterns only. Never reuse a premise, character, plot, joke, sequence of facts or line.

## Clarity first
Viewers open YouTube to switch off and watch. They should know what the video is about straight away and never have to work to follow it.
- Say the premise plainly in the first two or three lines: who this is, and what the video is about. Do not hide it behind mood or mystery.
- One hero, one story, one question. No side plots.
- Everyday words. If a twelve-year-old would stop to work out a line, rewrite it.
- No clever or poetic lines that need decoding. A strong image is fine only if its meaning is obvious.
- Each beat follows from the last. Join them with simple cause and effect: so, because, then, but.
- Call each thing by the same name every time.
- The ending callback must be obvious, not subtle.
- Test: read the script with no visuals. A half-listening viewer should be able to say in one sentence what it was about. If not, simplify before anything else.

## Numbers to plan with
| Measure | Narrated fable | Serial drama |
|---|---|---|
| Pace including pauses | 125-133 wpm | 96-127 wpm |
| Mean sentence | 8-9 words | 4.5-5 words |
| Sentences of 4 words or fewer | about 20% | over 50% |
| Sentences of 16+ words | 6-16% | 0-2% |
| Questions | a few | 10-26 in a 6-8 minute film |
| Ellipses per 100 words | few | 2-3 at most |
| End call to action | none | yes |

Plan on about 125 words per finished minute. Use 100-115 for dialogue-heavy, slow drama and about 130 for narration. A 7-minute script is about 900 words.

## Choose a format
**Narrated fable, the default:** one voice, second person, one small sidekick or companion, no spoken dialogue. It needs one voice and is the easiest to animate and to make.

**Serial drama:** narrator plus spoken characters, a villain and a cliffhanger. It needs a distinct voice per speaker and more complex animation.

Do not mix them unless asked.

## Narrated fable structure
Percentages are of runtime.

1. 0-10%: The ache and the wish. Open on a small, ordinary, physical moment. Show one feeling every viewer knows: unseen, left behind, scared, not enough. The power arrives from that feeling, in very few words. State the premise plainly here.
2. About 10%: The promise. A short line says this is better, or stranger, than expected. Hold a title beat of 9-10 s straight after.
3. 10-25%: First fun and first catch. Give the fantasy immediately, then turn: the power has a rule or a physical problem.
4. 25-70%: Escalation in 5-7 blocks. Each has one idea, one real surprising fact, one concrete image and one small joke. Rotate wonder, comedy and problem. Use a spine: rules, hours, days or numbered problems.
5. 70-88%: The cost. The power deepens the opening ache. It stops solving the problem and begins to take something human. Sentences get shorter and jokes stop.
6. 88-100%: The return. Go back to the opening person, place or image. The answer is a human choice, not more power. The final line is short and changes the meaning of the opening line.

Where the pain sits: it starts small and personal, disappears during the fun, returns larger about three-quarters through, and is relieved by connection, acceptance or courage. The power gives the wish but cannot give what the character needed.

For a short film, compress this: ache, power, catch, cost, return. A 30 s script is about 60 words.

## Serial drama structure
1. 0-3%: Cold open at the most exciting image or an impressive demonstration.
2. 3-10%: State the premise with one anchor fact or number.
3. 10-45%: Benefits and costs. Alternate plus and minus in short blocks, or run escalating tests. Plant one quiet personal loss early. Show one trait that protects the hero and one that isolates them.
4. 45-60%: Harm reaches someone the hero loves, or a hidden cost is revealed. This is the real start of the story.
5. 60-85%: The temptation and the clever answer. The hero rejects the easy, unethical use of power and wins through a smarter frame, not more force.
6. 85-93%: The planted payoff. Return the early loss in a form the viewer did not predict. The win should be emotional, not just tactical.
7. 93-100%: The new threat, then a specific comments question and a subscribe prompt tied to what comes next.

## Writing rules
- Write for the ear. Read every line aloud.
- Use you and present tense for fables. Use one consistent person in dramas.
- Prefer concrete nouns and physical action. Show one precise detail instead of an explanation, but never at the cost of the viewer knowing what is happening.
- Plain words. Explain each science idea with one analogy from daily life.
- One idea per sentence, then one short sentence to land it.
- Rhythm: setup, setup, short punch. Stack fragments only at impact moments.
- Lists come in threes, with the third item as the twist.
- Repeat a key phrase at the start and end to create the callback.
- Give a recurring gag to a small companion. It must get a payoff.
- Turn with simple spoken markers: But. So. Here's the catch. Except. Then.
- Facts must be accurate, specific and interesting. Use about, roughly and scientists think when evidence is uncertain. Check them with a search if you can.
- Every number should compare to something familiar.
- Mark what is real and what is magic. Say plainly when the story is cheating physics.
- The moral appears through action. Do not lecture.
- Use the ending to reframe, not to summarise.

Avoid: a long greeting or channel introduction; a viewer-address question unless it opens or closes the story; more than 15 seconds without a new image, turn or joke; fake suspense the video does not resolve; sentences longer than about 25 words; vague openings where the viewer can't tell what the video is about.

## Before writing, get these
Topic, duration, format, audience, sound brief and any named character. Then create:
1. A one-sentence premise a distracted viewer would understand.
2. A one-line ache.
3. The power and its one main rule.
4. The cost, and what the character actually needs.
5. A plant and payoff.
6. The first and last image.
7. A beat sheet with word budgets.
Then write, read aloud, and fact-check.

## ElevenLabs delivery
Give two outputs:
1. **Paste-ready script:** only spoken words and delivery marks.
2. **Director version:** beat map, facts with sources, pronunciation notes, intended on-screen action, symbolic-beat marks and long holds. This is never pasted into ElevenLabs.

Paste-ready formatting:
- One paragraph per beat, with a blank line between beats.
- Spell numbers, dates, times, units and symbols as spoken: "four hundred meters per second", not "400 m/s".
- Use a full stop for a normal beat, a line break for a new thought, and an ellipsis for a weighted reveal.
- Use capitals rarely, for a single word of emphasis.
- No timestamps, stage directions, speaker labels (unless using multi-speaker dialogue) or bracketed music notes. They may be read aloud.
- No sound-effect tags. Effects are made separately.

Pauses by model. Check ElevenLabs' current docs if this matters, since models change:
- Punctuation works on every model, though it is less exact. Default to it.
- Multilingual v2, Flash v2 and Flash v2.5: `<break time="1.5s" />`, 3 seconds maximum. Too many can cause artifacts, so keep them to major beats.
- v4 and v3: no SSML break tags. Use punctuation, structure and audio tags, and test `[short pause]` and `[long pause]` on the chosen voice.

Long pauses belong in the edit, since the video is built from the MP3. Targets: normal sentence end .5-1.5 s, emphasis 1.5-2.5 s, section change 2.5-4 s, title or major reveal 5-10 s, done in the edit and marked in the director version.

Long scripts: a 900-word script is about 5,000 characters, so split at paragraph breaks if the plan has a per-generation limit, keeping the voice and settings the same. Regenerate single lines rather than the whole script. Test a voice on one emotional paragraph first.

Multi-speaker: one distinct voice per speaker. In v4 and v3 the documented form is `Speaker 1: [excitedly] ...`.

## Free built-in voice delivery
The same paste-ready script feeds `scripts/tts.py`, so no ElevenLabs step is needed. Differences: `<break time="1.5s" />` and `[pause 1.5]` give exact silences; other audio tags are dropped because the free voice has no emotion tags, so carry the feeling with wording and punctuation; for Hindi or Hinglish, write Hindi words in Devanagari. Details in `free-voice.md`.

## Quality check
- First 10 seconds: is it clear who and what this is about, and is the ache or danger clear?
- By 15%: is the promise clear?
- Cold listen with no visuals: can a half-listening viewer sum it up in one sentence?
- Does each block contain a new idea and follow from the one before?
- Is the ending an obvious callback that changes the opening?
- Is every fact checked, every number spelled out, and the word count within 5% of target?
- Has anything been taken from someone else's video? If yes, replace it.

## Sources
- [ElevenLabs best practices](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices)
- [ElevenLabs: adding pauses](https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-can-i-add-pauses)
- [ElevenLabs prompting](https://elevenlabs.io/docs/best-practices/prompting)
