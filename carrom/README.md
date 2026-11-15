# Carrom

A carrom board for the browser. Play the computer (easy, medium or hard) or a second player on the same screen. Works with mouse or touch.

## Play

Open `index.html` in a browser. There is nothing to install or build.

- Slide the striker along your baseline with the slider.
- Drag back anywhere on the board and release to flick. A longer drag is a harder strike.

## Rules implemented

- White plays from the bottom, black from the top. Pocket one of your own coins to strike again.
- The queen must be covered by pocketing one of your coins on the same strike or the next one; otherwise it returns to the centre.
- Pocketing the striker is a foul: coins of yours pocketed on that strike come back, plus one penalty coin, and the turn passes.
- Your last coin can't be pocketed before the queen is covered; it comes back.
- Clearing your coins wins the board: one point per opponent coin left, plus 3 if you covered the queen.

Simplified compared with tournament rules: a match is a single board, strikes may go in any direction, and there are no "due" coins when a foul happens with nothing pocketed.

## Code

- `engine.js` holds the physics, the rules and the computer player. It has no DOM access, so the same file runs in Node for tests.
- `main.js` handles drawing and input.

The computer finds near-straight pots geometrically, plays each candidate forward with the real physics, and keeps the best outcome. Difficulty is the size of the random aiming error added afterwards.

## Tests

```bash
npm test
```
