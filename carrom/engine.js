// Carrom rules and physics. No DOM access, so it runs in the browser (as the
// global `Carrom`) and in Node (via require) for tests.
(function (root) {
  "use strict";

  const SIZE = 740; // playing surface, in board units (about 1 unit = 1 mm)
  const COIN_R = 16;
  const STRIKER_R = 21;
  const POCKET_R = 24; // a disc is pocketed when its centre is this close to a pocket centre
  const POCKET_INSET = 30;
  const COIN_MASS = 1;
  const STRIKER_MASS = 2.8;
  const FRICTION = 520; // deceleration, units/s^2
  const WALL_BOUNCE = 0.72;
  const DISC_BOUNCE = 0.93;
  const MAX_SPEED = 2600;
  const DT = 1 / 240; // fixed physics step, shared by live play and AI look-ahead
  const BASE_OFFSET = 118; // baseline distance from the edge
  const BASE_MIN = 150;
  const BASE_MAX = SIZE - 150;
  const COLORS = ["white", "black"]; // player 0 plays white from the bottom, player 1 black from the top
  const QUEEN_POINTS = 3;

  const POCKETS = [
    { x: POCKET_INSET, y: POCKET_INSET },
    { x: SIZE - POCKET_INSET, y: POCKET_INSET },
    { x: POCKET_INSET, y: SIZE - POCKET_INSET },
    { x: SIZE - POCKET_INSET, y: SIZE - POCKET_INSET },
  ];

  const baseY = (turn) => (turn === 0 ? SIZE - BASE_OFFSET : BASE_OFFSET);

  function newGame() {
    const c = SIZE / 2;
    const gap = COIN_R * 2 + 0.6;
    const discs = [{ kind: "queen", x: c, y: c }];
    // Hexagonal pack: 6 coins around the queen, then 12 around those.
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      discs.push({ kind: COLORS[i % 2], x: c + Math.cos(a) * gap, y: c + Math.sin(a) * gap });
      discs.push({ kind: COLORS[i % 2], x: c + Math.cos(a) * gap * 2, y: c + Math.sin(a) * gap * 2 });
      const b = a + Math.PI / 6;
      discs.push({ kind: COLORS[(i + 1) % 2], x: c + Math.cos(b) * gap * Math.sqrt(3), y: c + Math.sin(b) * gap * Math.sqrt(3) });
    }
    discs.forEach((d, i) => Object.assign(d, { id: i, r: COIN_R, m: COIN_MASS, vx: 0, vy: 0, active: true, order: 0 }));
    const game = {
      discs,
      striker: { kind: "striker", x: c, y: baseY(0), r: STRIKER_R, m: STRIKER_MASS, vx: 0, vy: 0, active: true },
      turn: 0,
      phase: "aim", // "aim" | "moving" | "over"
      queen: "board", // "board" | "pending" (pocketed, awaiting cover) | "covered"
      queenOwner: null,
      shot: emptyShot(),
      pocketCount: 0,
      winner: null,
      points: 0,
      notes: [],
    };
    return game;
  }

  const emptyShot = () => ({ white: [], black: [], queen: false, striker: false });

  function clone(game) {
    return {
      ...game,
      discs: game.discs.map((d) => ({ ...d })),
      striker: { ...game.striker },
      shot: { white: [...game.shot.white], black: [...game.shot.black], queen: game.shot.queen, striker: game.shot.striker },
      notes: [...game.notes],
    };
  }

  const remaining = (game, color) => game.discs.filter((d) => d.kind === color && d.active).length;

  function overlapsCoin(game, x, y, r) {
    return game.discs.some((d) => d.active && Math.hypot(d.x - x, d.y - y) < d.r + r);
  }

  // Puts the striker on the current player's baseline. Returns false if it
  // would sit on top of a coin (the shot is not allowed from there).
  function placeStriker(game, x) {
    const s = game.striker;
    s.x = Math.max(BASE_MIN, Math.min(BASE_MAX, x));
    s.y = baseY(game.turn);
    s.vx = s.vy = 0;
    s.active = true;
    return !overlapsCoin(game, s.x, s.y, s.r);
  }

  // Centre of the baseline if free, otherwise the nearest free position.
  function placeStrikerAnywhere(game) {
    const mid = SIZE / 2;
    for (let off = 0; off <= mid - BASE_MIN; off += 4) {
      if (placeStriker(game, mid + off) || placeStriker(game, mid - off)) return true;
    }
    return placeStriker(game, mid);
  }

  function shoot(game, angle, power) {
    const speed = MAX_SPEED * Math.max(0, Math.min(1, power));
    game.striker.vx = Math.cos(angle) * speed;
    game.striker.vy = Math.sin(angle) * speed;
    game.shot = emptyShot();
    game.phase = "moving";
  }

  // Advances the physics by one fixed step. Returns true while anything moves.
  function step(game) {
    const all = game.striker.active ? [game.striker, ...game.discs] : game.discs;
    const live = all.filter((d) => d.active);
    let moving = false;

    for (const d of live) {
      const speed = Math.hypot(d.vx, d.vy);
      if (speed === 0) continue;
      const next = speed - FRICTION * DT;
      if (next <= 0) {
        d.vx = d.vy = 0;
        continue;
      }
      d.vx *= next / speed;
      d.vy *= next / speed;
      d.x += d.vx * DT;
      d.y += d.vy * DT;
      moving = true;

      if (POCKETS.some((p) => Math.hypot(p.x - d.x, p.y - d.y) < POCKET_R)) {
        d.active = false;
        d.vx = d.vy = 0;
        if (d.kind === "striker") game.shot.striker = true;
        else if (d.kind === "queen") game.shot.queen = true;
        else {
          d.order = ++game.pocketCount;
          game.shot[d.kind].push(d.id);
        }
        continue;
      }
      if (d.x < d.r) { d.x = d.r; d.vx = Math.abs(d.vx) * WALL_BOUNCE; }
      else if (d.x > SIZE - d.r) { d.x = SIZE - d.r; d.vx = -Math.abs(d.vx) * WALL_BOUNCE; }
      if (d.y < d.r) { d.y = d.r; d.vy = Math.abs(d.vy) * WALL_BOUNCE; }
      else if (d.y > SIZE - d.r) { d.y = SIZE - d.r; d.vy = -Math.abs(d.vy) * WALL_BOUNCE; }
    }

    for (let i = 0; i < live.length; i++) {
      const a = live[i];
      if (!a.active) continue;
      for (let j = i + 1; j < live.length; j++) {
        const b = live[j];
        if (!b.active) continue;
        if (a.vx === 0 && a.vy === 0 && b.vx === 0 && b.vy === 0) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const min = a.r + b.r;
        const distSq = dx * dx + dy * dy;
        if (distSq >= min * min) continue;
        const dist = Math.sqrt(distSq) || 0.001;
        const nx = dx / dist;
        const ny = dy / dist;
        const ia = 1 / a.m;
        const ib = 1 / b.m;
        // Separate the pair, lighter disc moving further.
        const push = (min - dist) / (ia + ib);
        a.x -= nx * push * ia;
        a.y -= ny * push * ia;
        b.x += nx * push * ib;
        b.y += ny * push * ib;
        const approach = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (approach < 0) {
          const impulse = (-(1 + DISC_BOUNCE) * approach) / (ia + ib);
          a.vx -= impulse * ia * nx;
          a.vy -= impulse * ia * ny;
          b.vx += impulse * ib * nx;
          b.vy += impulse * ib * ny;
          moving = true;
        }
      }
    }
    return moving;
  }

  // Runs the shot to rest. Used by the AI look-ahead and by tests.
  function settle(game, maxSteps = 240 * 30) {
    let steps = 0;
    while (steps++ < maxSteps && step(game)) { /* keep stepping */ }
    return steps;
  }

  function returnToCentre(game, disc) {
    const c = SIZE / 2;
    let x = c;
    let y = c;
    for (let ring = 1; overlapsCoin(game, x, y, disc.r) && ring < 60; ring++) {
      for (let k = 0; k < 12; k++) {
        const a = (Math.PI / 6) * k;
        x = c + Math.cos(a) * ring * 8;
        y = c + Math.sin(a) * ring * 8;
        if (!overlapsCoin(game, x, y, disc.r)) break;
      }
    }
    Object.assign(disc, { x, y, vx: 0, vy: 0, active: true, order: 0 });
  }

  const queenDisc = (game) => game.discs.find((d) => d.kind === "queen");

  // Most recently pocketed coins of a colour, newest first.
  const pocketed = (game, color) => game.discs.filter((d) => d.kind === color && !d.active).sort((a, b) => b.order - a.order);

  // Applies the rules once everything has stopped. Sets the next turn (or the
  // winner) and fills game.notes with plain-language descriptions of what happened.
  function resolve(game) {
    const me = COLORS[game.turn];
    const shot = game.shot;
    const own = shot[me].length;
    const foul = shot.striker;
    const notes = [];
    let keepTurn = !foul && own > 0;

    if (shot.queen) {
      if (foul) {
        returnToCentre(game, queenDisc(game));
      } else if (own > 0) {
        game.queen = "covered";
        game.queenOwner = game.turn;
        notes.push("Queen pocketed and covered.");
      } else {
        game.queen = "pending";
        game.queenOwner = game.turn;
        keepTurn = true;
        notes.push("Queen pocketed. Pocket one of your own coins on the next strike to keep it.");
      }
    } else if (game.queen === "pending") {
      if (!foul && own > 0) {
        game.queen = "covered";
        notes.push("Queen covered.");
      } else {
        game.queen = "board";
        game.queenOwner = null;
        returnToCentre(game, queenDisc(game));
        notes.push("Queen not covered. It returns to the centre.");
      }
    }

    if (foul) {
      // Coins pocketed on the foul strike come back, plus one more as a penalty.
      const back = pocketed(game, me).slice(0, own + 1);
      back.forEach((d) => returnToCentre(game, d));
      notes.push(`Foul: striker pocketed.${back.length ? ` ${back.length} ${me} coin${back.length > 1 ? "s" : ""} returned to the board.` : ""}`);
    }

    // Nobody may clear their coins while the queen is still in play.
    if (game.queen !== "covered") {
      for (const color of COLORS) {
        if (remaining(game, color) === 0) {
          returnToCentre(game, pocketed(game, color)[0]);
          if (color === me) keepTurn = false;
          notes.push(`The last ${color} coin can't go down before the queen is covered. It returns to the centre.`);
        }
      }
    }

    for (const player of [game.turn, 1 - game.turn]) {
      if (game.winner === null && remaining(game, COLORS[player]) === 0) {
        game.winner = player;
        game.points = remaining(game, COLORS[1 - player]) + (game.queenOwner === player ? QUEEN_POINTS : 0);
        game.phase = "over";
      }
    }

    game.notes = notes;
    if (game.phase !== "over") {
      if (!keepTurn) game.turn = 1 - game.turn;
      game.phase = "aim";
      placeStrikerAnywhere(game);
    }
    return game;
  }

  function segmentDistance(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
  }

  // Picks a shot for the player to move: finds straight-ish pots geometrically,
  // plays each one forward with the real physics, and keeps the best outcome.
  // `noise` is the maximum aiming error in radians, which sets the difficulty.
  function chooseShot(game, rng = Math.random, noise = 0.012) {
    const me = COLORS[game.turn];
    const y = baseY(game.turn);
    const coins = game.discs.filter((d) => d.active);
    const targets = coins.filter((d) => d.kind === me || (d.kind === "queen" && game.queen === "board"));
    const plans = [];

    for (const coin of targets) {
      for (const pocket of POCKETS) {
        const toPocket = Math.hypot(pocket.x - coin.x, pocket.y - coin.y);
        const ux = (pocket.x - coin.x) / toPocket;
        const uy = (pocket.y - coin.y) / toPocket;
        const gx = coin.x - ux * (coin.r + STRIKER_R);
        const gy = coin.y - uy * (coin.r + STRIKER_R);
        let best = null;
        for (let x = BASE_MIN; x <= BASE_MAX; x += 20) {
          if (overlapsCoin(game, x, y, STRIKER_R)) continue;
          const len = Math.hypot(gx - x, gy - y);
          const straightness = ((gx - x) * ux + (gy - y) * uy) / (len || 1);
          if (straightness < 0.5) continue;
          const blocked = coins.some((d) => d !== coin && segmentDistance(d.x, d.y, x, y, gx, gy) < d.r + STRIKER_R);
          if (blocked) continue;
          const quality = straightness - (len + toPocket) / 3000;
          if (!best || quality > best.quality) best = { x, angle: Math.atan2(gy - y, gx - x), quality };
        }
        if (best) plans.push(best);
      }
    }
    plans.sort((a, b) => b.quality - a.quality);
    plans.length = Math.min(plans.length, 40);

    // Fallback: hit towards the middle of the remaining target coins.
    const cx = targets.reduce((s, d) => s + d.x, 0) / (targets.length || 1) || SIZE / 2;
    const cy = targets.reduce((s, d) => s + d.y, 0) / (targets.length || 1) || SIZE / 2;
    for (const x of [BASE_MIN + 40, SIZE / 2, BASE_MAX - 40]) {
      if (!overlapsCoin(game, x, y, STRIKER_R)) plans.push({ x, angle: Math.atan2(cy - y, cx - x), quality: -1 });
    }
    if (!plans.length) plans.push({ x: game.striker.x, angle: Math.atan2(cy - y, cx - game.striker.x), quality: -2 });

    let choice = null;
    for (const plan of plans) {
      for (const power of [0.5, 0.75]) {
        const trial = clone(game);
        placeStriker(trial, plan.x);
        shoot(trial, plan.angle, power);
        settle(trial);
        const s = trial.shot;
        const own = s[me].length;
        const value =
          10 * own +
          (s.queen ? (own > 0 ? 12 : 4) : 0) +
          (game.queen === "pending" && own > 0 ? 12 : 0) -
          8 * s[COLORS[1 - game.turn]].length -
          25 * (s.striker ? 1 : 0) +
          plan.quality -
          power * 0.1;
        if (!choice || value > choice.value) choice = { x: plan.x, angle: plan.angle, power, value };
      }
    }
    choice.angle += (rng() * 2 - 1) * noise;
    return choice;
  }

  const api = {
    SIZE, COIN_R, STRIKER_R, POCKET_R, POCKETS, COLORS, DT, BASE_MIN, BASE_MAX, BASE_OFFSET, MAX_SPEED, QUEEN_POINTS,
    baseY, newGame, clone, remaining, placeStriker, placeStrikerAnywhere, shoot, step, settle, resolve, chooseShot,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Carrom = api;
})(typeof self !== "undefined" ? self : this);
