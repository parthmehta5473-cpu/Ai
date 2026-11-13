# Packaging playbook: titles and thumbnail prompts

Claude does not generate the thumbnail. It writes prompts the person pastes into an image generator such as ChatGPT or Google Flow. If the person shares example titles or thumbnails, use only their general style: length, wording, approach. Never copy or store a title, thumbnail text, character or concept.

## Output format
For each video, give matched pairs: title + thumbnail text + one thumbnail prompt. Default to 5 pairs, each from a different angle. Say which pair you would test first.

## Package logic
- Title and thumbnail are one unit. The title carries the hook or topic; the thumbnail carries the emotion or consequence.
- Thumbnail text never repeats the title. Together they leave one question only the video answers.
- Everything promised must happen in the video. Never promise an event, power or ending the story lacks.
- Plan the title and thumbnail before the video when possible, so the thumbnail moment exists as a real scene.

## Title patterns
Length: under 30 to 50 characters. Under 30 suits short film and entertainment. Keep the hook inside the first 40 characters. Plain words a 12-year-old knows. Title Case. No ALL CAPS title, emoji or hashtags.

Angles:
1. Second-person what-if: an impossible premise with one clear rule, phrased as a question.
2. Blunt verdict: a short declaration about the viewer or a habit, ending in a full stop.
3. Reframe: rejects the viewer's explanation and offers a harsher one, in two short sentences.
4. Mystery fragment: a noun phrase or tiny statement that withholds who, what or why.
5. Before and after: two short clauses marking a start and end point, showing escalation over time.
6. Named film: a short evocative name plus a format label after a vertical bar. Use it when the story is the draw.

Language: favour "you", concrete nouns and stakes. Numbers must make a specific promise, not decorate. Full stops add weight to short titles. Part labels go on series only.

## Thumbnail patterns
Composition:
- One idea, one focal point, at most three elements: character, one story prop, text.
- Character large, usually 40 to 70% of the frame height, with an emotion readable at phone size.
- Eyes and face are the main hook. Exaggerate expression; do not rely on small details.
- Strong figure-ground separation: dark, simple background with one motivated light source on the subject.
- One visual tension: scale contrast, split before and after, a threat just out of reach, or something impossible.
- Keep the bottom-right corner empty, because the duration badge covers it.

Text:
- 1 to 3 words, 4 maximum. It reads as the character's inner voice, a verdict or the consequence.
- Heavy rounded or brush-like lettering, ALL CAPS, off-white on dark. Optional single accent colour on one word.
- A full stop or question mark gives tone. Place text in an empty zone, usually top or left, never over the face.
- It must stay readable at about 160 px wide. If not, shorten it.

Vary by emotion:
- Inner struggle: dark, warm single light, tense expression, text as thought.
- Power or fantasy: confident expression, cool night with one warm or electric accent, text as a boast.
- Mystery: small figure, big empty space, one strange detail, minimal text.

House style: use this skill's hero and look. Avoid bokeh dots, sparkle fields and flashy effects. Use realistic light and shadow.

Hero for prompts: round cream face (#F8E9CC) with simple dark ink eyes, brows and mouth, thin dark outline, coral hoodie (#FF6B5E) with a darker red hood (#E4493F). Hands are thin ink finger strokes only, never white mittens.

## Prompt rules for image generators
These work in both ChatGPT and Google Flow unless noted.
- Write natural sentences, not keyword lists.
- Order: format, reference role, subject and expression, action, setting, composition and placement, light, style, exact text, safe zone.
- Always open with: "Create a wide 16:9 landscape YouTube thumbnail." Flow still needs 16:9 selected in the interface; keep the line for portability.
- Quote exact text, state font style, colour, size and placement, and add: "Render the text verbatim. This is the only text in the image."
- Describe what should be there rather than listing exclusions. Say "clean dark background" instead of "no clutter". Use "negative prompt:" only as a fix in ChatGPT.
- Use spatial words: left third, right third, foreground, background. Use camera language: close-up, low angle, shallow depth of field.
- Name materials and light direction: "warm lamp light from the left", not "beautiful lighting".
- For consistency, attach a clean frame from the video and start: "Image 1 is the character reference. Preserve the character's design, proportions, colours and line style exactly." One or two labelled references beat many.

Fixing a result:
- Edit one thing at a time: "Change only X. Keep everything else exactly the same."
- Repeat the preserve list on each edit.
- Spell unusual words letter by letter if the text breaks.
- If text keeps failing, generate with a reserved empty zone and add the text in Canva or similar.

Delivery note: test the final at phone size before upload. A common recommendation is 16:9, at least 1280x720, under 2 MB, but check YouTube's upload page, since limits change. A/B test up to three variants with Test & Compare if eligible.

## Sources
- [OpenAI Academy: creating images with ChatGPT](https://openai.com/academy/image-generation)
- [Google Cloud: Nano Banana prompting guide](https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-nano-banana)
- [Runware: prompting GPT Image 2](https://runware.ai/docs/models/openai-gpt-image-2/guides/prompting)
- [AIR Media-Tech: YouTube title study](https://air.io/en/audience-growth/how-to-write-a-youtube-title-that-gets-clicked-research-across-11-niches)
- [vidIQ: YouTube title guide](https://vidiq.com/blog/post/youtube-video-title/)
