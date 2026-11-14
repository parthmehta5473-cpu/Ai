# Starline

A vertical space shooter for the browser: 100 levels across 10 sectors, with a boss at the end of each sector. The ship fires on its own; you steer and dodge. Works on phones (touch) and computers (mouse or keyboard).

## Play

Open `index.html` in a browser. There is nothing to install or build. Progress (unlocked levels and stars) is saved in the browser.

- **Phone:** drag anywhere. The ship moves by as much as your finger does, so your thumb never covers it.
- **Computer:** move the mouse, or use the arrow keys or WASD. P or Esc pauses.
- **Stars:** 3 for no hits, 2 for one hit, 1 otherwise.
- **Drops:** P adds guns (up to 5 levels), + restores a heart, S is a shield that absorbs one hit, R is rapid fire.

## How the 100 levels are made

Levels are generated from their number by `levelSpec(n)` in `engine.js`, so every player gets the same level 37 every time. The generator sets:

- **Enemy types:** nine types arrive over the game (drone on level 1, sniper on 31, swarm on 41, ...). Each one appears as the first wave of the level it is introduced on, with an on-screen tip.
- **Difficulty:** enemy health, speed, fire rate and bullet speed rise with the level number, as do the number and size of waves.
- **Bosses:** levels 10, 20 ... 100 each end with a named boss. Later bosses use more of six attack patterns and have more health.

## Balance testing

`autopilot()` is a simple bot that lines up under enemies and dodges by simulating where bullets will be. The tests use it to check that:

- all 100 levels finish (every enemy eventually dies or leaves, every boss can be killed);
- the bot, without invincibility, beats every boss level in at least 2 of 4 runs;
- it takes more hits late in the game than early.

The bot reacts faster than a person, so "the bot can win" means a level is possible, not that it is easy. Nobody has play-tested the curve by hand yet.

## Tests

```bash
npm test
```
