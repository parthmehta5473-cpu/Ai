# Symbolic beats

A symbolic beat is a short scene where the real set falls away and the feeling is shown as an image: a journey as a path, a choice as two doors, time as falling leaves.

## When
- The script decides. Use one only when a line already contains the moment: a journey, a decision, a loss, time passing, a realisation, a return. Never force one in.
- Films under about 60 s get none.
- A minute or longer: at most one per minute, with 60-90 s of real story between them, and no more than about 10% of the runtime. A 3-8 minute film usually has 1-3.
- It must show exactly what the voice says at that moment, using objects from this story. If the viewer would need it explained, cut it.
- Likely spots: the promise, the cost, the return. Length 3-8 s each.
- If unsure, leave it out. A missing beat costs nothing; a forced one cheapens the film.

## Design
- One metaphor, said in a line first, such as "he walks home along a path that builds itself under his feet".
- Same hero, rig and palette. Only the world changes: open sky, low horizon, a darker drop below.
- 4-7 flat silhouettes of things from this story. No circles, rings or floating dots.
- One destination or focal object that tells the viewer what the beat is about, and let it change during the beat.
- Three depth planes: far (parallax .45, heavy blur, low alpha), mid (.8, light blur), near (screen space, blur 5-7, passing in front).

## Motion floor
Each beat needs all of these. A still symbolic scene looks cheap.
1. The hero acts: walks with planted feet, looks, blinks, changes expression.
2. The camera never holds still.
3. Every object drifts and turns slowly, and surfaces into place at the start.
4. At least one event happens inside the beat.
5. Set `REPORT.sym=1` on these frames. The audit then requires mean motion of .3 in every 1 s window, against .2 elsewhere, and under 10% frozen frames.

## In and out
- Never hard-cut into the void. Transform the real set around the hero inside one shot.
- In, about 1.2 s: the ground cracks into chunks that fall, buildings sink, the sky crossfades, and a slab appears under the feet first so he never floats.
- Out, about .7 s: the ground rises to his feet and the sky returns. Line the destination up with something real so the image lands.
- Fade every real layer, ground included, or props float in the void.
- The hero ends the beat changed.

## Sound
Real ambience falls away with the ground, replaced by `air_bed`. The drop in level sells the change. Effects stay soft and low. With music, the voicing can open up and then resolve on the return. Voice stays dry and on top.

## Script
Mark it in the director version only: `[SYMBOLIC: one-line metaphor, 5 s, enters on "...", exits on "..."]`. Nothing goes in the paste-ready text. Give it its own frame range on the shot list.

## Code
`v` is 0 in the real world and 1 in the symbol. Blend with `comp([['bg',b,1-v],['void',0,v],...])`, and draw `drawVoid`, `drawSils`, `slab` and `drawChunks` on their own layers. Keep one clock for the whole film.
