# Production notes

Lessons from real renders. Reading this first saves more time than anything else in the skill.

## Fast path
1. Confirm the brief. Write the story and a shot list with cut FRAMES (30 fps).
2. Keep the engine files. Write only `film.js` and the marked block of `audio_mix.py`, in one go.
3. Test 9 stills at the busiest moments in one sheet. Two rounds is normal.
4. Run `build.py`. It renders each shot, joins them, adds sound, re-encodes, audits and checks determinism.
5. Fix only the shots that changed. Sound fixes need only `--audio-only`.

Timing guide on 2 cores: about 5 frames/s across two processes, so 30 s of 2D renders in about 4 minutes, plus stills and fixes. A 33 s, 15-shot film took about 7 minutes. Long films take proportionally longer.

## Rig
- Full body at `s` .66 in wide shots; .55-.85 when depth scales it.
- Drive a walk from position along the path (`makeWalk`), never from a timer, so the stance foot is locked.
- Use accelerate, cruise, decelerate. A sine ease over a whole walk makes the first step take over a second.
- A walk starts with a short blend from standing feet and ends with a .3-.4 s settle. Change `face` only at a cut, or it pops.
- A hand target too close to the shoulder gives hands-on-hips. An idle target should be near full reach. Omit `hands` to get the default.
- A hand holding something near the body needs `tuck`, or the elbow sticks out as a triangle. Clear `tuck` on any free arm during a walk, or the arm bends backwards.
- Use `kf()` for every pose value, not nested lerps.
- Brows: positive `sad` lifts the inner end. Negative reads angry. Check faces on the first sheet.
- Do not let `mouth` rest near 0, which looks deadpan. Pass through it quickly, or use a small `open` for surprise.
- Side-on backward lean from the hips: `p.bend`, with the feet still planted.

## Props
- Drive hands from the prop's position, not the reverse. Report it with `contact()` so the audit measures it.
- Draw the grip hand after the prop, so fingers wrap over it.
- After a hand-off, check the prop does not cross the new holder's face.

## Lighting
- Rim pass skips legs, because rim on dark trousers reads as a cream outline.
- Colour washes with `source-atop` turn a black-head character brown. Draw that character after the wash and light them with rim only.
- A warm wash above about .26 alpha bleaches a light character.

## Cuts and continuity
- Check any character who moves between places at the cut frame, or they appear twice.
- Keep a character out of frame before the shot where they enter. Cuts land on frame = t*30.
- Always consume `r()` whatever the branch, or background details change at a cut.
- In 2D there is no depth, so a straight path can cross a body drawn at another depth. Check each bullet or thrown object against the poses.
- Characters ducking behind a table must be clipped at the table line, or their torso shows beneath it.
- After a door opens, remove any silhouette on its glass before the swing, or the character appears twice. Keep them behind the door plane until it is open, and only draw them over the frame after the threshold.

## Effects
- Rain: world-space streaks. Cut sheltered areas with a blurred `destination-out` polygon that follows the slant.
- Bullet time without a 3D orbit: chase along the lane plus zoom, graded with low saturation and a cool wash.
- Check a bullet's nose direction on stills.

## Render and delivery
- Paths: never hardcode them. Scripts use the folder you pass.
- The film must be deterministic: same frame, same pixels, in any order. No `Math.random`, no `Date.now`.
- Fast motion such as a passing bus trips the pop and hand-speed checks. Read each flag before dismissing it.
- Check loudness section by section, because the loudest peak sets normalization.
- You cannot listen. Say so in the delivery note, and give the measurements.

## Learning from each film
After a film, note any new lesson in the conversation and offer to save it where the user keeps project notes, so the next film starts from it. Keep a running log if the user has a project or folder for it.
