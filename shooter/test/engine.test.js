const assert = require("node:assert/strict");
const { test } = require("node:test");
const S = require("../engine.js");

// Plays a level with the autopilot until it ends. Returns the final game.
function play(n, opts = {}) {
  const g = S.createGame(n, opts);
  let input = {};
  for (let steps = 0; g.status === "playing" && steps < 60 * 600; steps++) {
    if (steps % 3 === 0) input = S.autopilot(g);
    S.step(g, input);
  }
  return g;
}

const spawnCount = (spec) => spec.waves.reduce((sum, w) => sum + w.spawns.length, 0);

test("there are exactly 100 levels and out-of-range levels are rejected", () => {
  for (let n = 1; n <= 100; n++) assert.equal(S.levelSpec(n).n, n);
  for (const bad of [0, 101, 2.5, "3", -1]) assert.throws(() => S.levelSpec(bad), RangeError);
});

test("levels are generated the same way every time", () => {
  assert.deepEqual(S.levelSpec(37), S.levelSpec(37));
  assert.notDeepEqual(S.levelSpec(37).waves, S.levelSpec(38).waves);
});

test("every 10th level is a boss level, with 10 different bosses", () => {
  const names = new Set();
  for (let n = 1; n <= 100; n++) {
    const spec = S.levelSpec(n);
    assert.equal(spec.boss, n % 10 === 0, `level ${n}`);
    const bossWaves = spec.waves.filter((w) => w.type === "boss");
    assert.equal(bossWaves.length, spec.boss ? 1 : 0);
    if (spec.boss) names.add(spec.bossInfo.name);
  }
  assert.equal(names.size, 10);
});

test("each enemy type is introduced on its unlock level, as the first wave, with a tip", () => {
  for (const type of S.TYPES) {
    const n = S.ENEMIES[type].unlock;
    const spec = S.levelSpec(n);
    assert.equal(spec.newType, type);
    assert.equal(spec.waves[0].type, type);
    assert.ok(spec.tip);
    for (let earlier = 1; earlier < n; earlier++) {
      assert.ok(!S.levelSpec(earlier).waves.some((w) => w.type === type), `${type} appears before level ${n}`);
    }
  }
});

test("all spawns are inside the screen width", () => {
  for (let n = 1; n <= 100; n++) {
    for (const w of S.levelSpec(n).waves) for (const s of w.spawns) assert.ok(s.x >= 20 && s.x <= S.W - 20, `level ${n}`);
  }
});

test("difficulty rises: each sector has more total enemy health than the one before", () => {
  const health = (spec) => spec.waves.reduce((sum, w) => sum + (w.type === "boss" ? 0 : w.spawns.length * Math.max(1, Math.round(S.ENEMIES[w.type].hp * spec.mods.hp))), 0);
  let previous = 0;
  for (let sector = 0; sector < 10; sector++) {
    let total = 0;
    for (let i = 1; i <= 9; i++) total += health(S.levelSpec(sector * 10 + i));
    assert.ok(total > previous, `sector ${sector + 1}: ${total} <= ${previous}`);
    previous = total;
  }
  for (let k = 2; k <= 10; k++) assert.ok(S.levelSpec(k * 10).bossInfo.hp > S.levelSpec((k - 1) * 10).bossInfo.hp, `boss ${k}`);
});

test("all 100 levels can be finished: every enemy eventually leaves or dies and every boss can be killed", () => {
  for (let n = 1; n <= 100; n++) {
    const g = play(n, { god: true });
    assert.equal(g.status, "won", `level ${n} did not finish (t=${g.t.toFixed(0)}s)`);
    assert.ok(g.t < 180, `level ${n} took ${g.t.toFixed(0)}s`);
  }
});

test("a dodging autopilot without invincibility clears every boss level", () => {
  for (let n = 10; n <= 100; n += 10) {
    const wins = [0, 1, 2, 3].filter((seed) => play(n, { seed }).status === "won").length;
    assert.ok(wins >= 2, `boss level ${n}: autopilot won ${wins}/4`);
  }
});

test("a dodging autopilot takes more hits late in the game than early", () => {
  const hits = (from, to) => {
    let sum = 0;
    for (let n = from; n <= to; n++) sum += play(n).hitsTaken;
    return sum;
  };
  assert.ok(hits(81, 99) > hits(1, 19) + 5);
});

test("power-ups add guns up to the maximum", () => {
  const g = S.createGame(1);
  assert.equal(g.player.power, 1);
  for (let i = 0; i < 8; i++) g.pickups.push({ kind: "power", x: g.player.x, y: g.player.y, vy: 0, age: 0 }), S.step(g);
  assert.equal(g.player.power, S.MAX_POWER);
  g.shots = [];
  g.player.fireCd = 0;
  S.step(g);
  assert.equal(g.shots.length, S.GUNS[S.MAX_POWER].length);
});

test("taking a hit costs a heart, grants brief invincibility, and the shield absorbs one hit", () => {
  const g = S.createGame(5);
  const hitPlayer = () => g.ebullets.push({ x: g.player.x, y: g.player.y, vx: 0, vy: 0, r: 5, kind: "orb" });
  hitPlayer();
  S.step(g);
  assert.equal(g.player.hp, S.START_HP - 1);
  hitPlayer();
  S.step(g);
  assert.equal(g.player.hp, S.START_HP - 1, "invincible right after a hit");
  g.player.inv = 0;
  g.player.shield = 5;
  hitPlayer();
  S.step(g);
  assert.equal(g.player.hp, S.START_HP - 1, "shield takes the hit");
  assert.equal(g.player.shield, 0);
});

test("losing every heart ends the level as lost", () => {
  const g = S.createGame(3);
  for (let i = 0; i < S.START_HP; i++) {
    g.player.inv = 0;
    g.ebullets.push({ x: g.player.x, y: g.player.y, vx: 0, vy: 0, r: 5, kind: "orb" });
    S.step(g);
  }
  assert.equal(g.status, "lost");
  S.step(g);
  assert.equal(g.status, "lost", "a finished game does not advance");
});

test("splitters break into two fragments when destroyed", () => {
  const g = S.createGame(16);
  g.queue = [];
  const e = S.makeEnemy(g, "splitter", 200, 200);
  e.hp = 1;
  g.enemies.push(e);
  g.shots.push({ x: 200, y: 205, vx: 0, vy: 0 });
  g.player.fireCd = 99;
  S.step(g);
  assert.equal(g.enemies.filter((x) => x.type === "mini").length, 2);
});

test("stars reflect hits taken, and progress keeps the best result and unlocks the next level", () => {
  const g = play(1);
  assert.equal(g.status, "won");
  assert.equal(g.stars, 3);
  let p = S.recordResult({ unlocked: 1, stars: {} }, 1, 3);
  assert.equal(p.unlocked, 2);
  p = S.recordResult(p, 1, 1);
  assert.equal(p.stars[1], 3, "a worse replay does not lower stars");
  assert.equal(S.recordResult(p, 100, 2).unlocked, 100, "unlocks cap at 100");
  assert.equal(S.recordResult(null, 4, 2).unlocked, 5, "bad saved data is tolerated");
});
