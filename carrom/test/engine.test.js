const assert = require("node:assert/strict");
const { test } = require("node:test");
const C = require("../engine.js");

const coins = (g, kind) => g.discs.filter((d) => d.kind === kind);
// Marks n coins of a colour as already pocketed.
function pocket(g, kind, n) {
  coins(g, kind).filter((d) => d.active).slice(0, n).forEach((d) => { d.active = false; d.order = ++g.pocketCount; });
}
// Pretends a strike just ended with the given outcome, then applies the rules.
function finish(g, { own = 0, opp = 0, queen = false, striker = false } = {}) {
  const me = C.COLORS[g.turn];
  const other = C.COLORS[1 - g.turn];
  g.shot = { white: [], black: [], queen, striker };
  for (const [kind, n] of [[me, own], [other, opp]]) {
    coins(g, kind).filter((d) => d.active).slice(0, n).forEach((d) => { d.active = false; d.order = ++g.pocketCount; g.shot[kind].push(d.id); });
  }
  if (queen) coins(g, "queen")[0].active = false;
  if (striker) g.striker.active = false;
  return C.resolve(g);
}

test("a new board has 9 white, 9 black and a queen, none overlapping", () => {
  const g = C.newGame();
  assert.equal(C.remaining(g, "white"), 9);
  assert.equal(C.remaining(g, "black"), 9);
  assert.equal(coins(g, "queen").length, 1);
  for (const a of g.discs) for (const b of g.discs) {
    if (a.id < b.id) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= a.r + b.r, `coins ${a.id} and ${b.id} overlap`);
  }
});

test("a break shot comes to rest with every coin on the board or pocketed, and none overlapping", () => {
  const g = C.newGame();
  C.placeStriker(g, C.SIZE / 2);
  C.shoot(g, -Math.PI / 2, 1);
  const steps = C.settle(g);
  assert.ok(steps < 240 * 30, "shot should stop on its own");
  const live = g.discs.filter((d) => d.active);
  for (const d of live) {
    assert.ok(d.x >= d.r - 1e-6 && d.x <= C.SIZE - d.r + 1e-6 && d.y >= d.r - 1e-6 && d.y <= C.SIZE - d.r + 1e-6, "coin left the board");
    assert.equal(d.vx, 0);
  }
  for (const a of live) for (const b of live) {
    if (a.id < b.id) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > a.r + b.r - 0.5, "coins overlap at rest");
  }
  assert.ok(live.some((d) => Math.hypot(d.x - C.SIZE / 2, d.y - C.SIZE / 2) > 80), "break should scatter the pack");
});

test("a coin lined up with a corner is pocketed by a straight strike", () => {
  const g = C.newGame();
  g.discs.forEach((d) => { d.active = false; });
  const coin = coins(g, "white")[0];
  Object.assign(coin, { active: true, x: 150, y: 150 });
  C.placeStriker(g, 300); // baseline y = 622; aim along the diagonal through the coin to the top-left pocket
  g.striker.x = 622; g.striker.y = 622;
  C.shoot(g, Math.atan2(-1, -1), 0.6);
  C.settle(g);
  assert.deepEqual(g.shot.white, [coin.id]);
});

test("pocketing your own coin keeps the turn; pocketing nothing passes it", () => {
  const g = C.newGame();
  finish(g, { own: 1 });
  assert.equal(g.turn, 0);
  finish(g);
  assert.equal(g.turn, 1);
});

test("pocketing only an opponent's coin passes the turn and the coin stays down", () => {
  const g = C.newGame();
  finish(g, { opp: 1 });
  assert.equal(g.turn, 1);
  assert.equal(C.remaining(g, "black"), 8);
});

test("a foul returns the coins from that strike plus one penalty coin and ends the turn", () => {
  const g = C.newGame();
  pocket(g, "white", 3);
  finish(g, { own: 1, striker: true });
  assert.equal(C.remaining(g, "white"), 7); // 9 - 3 already down - 1 this strike + 2 returned
  assert.equal(g.turn, 1);
  assert.equal(g.striker.active, true);
});

test("the queen is covered by an own coin on the same strike", () => {
  const g = C.newGame();
  finish(g, { own: 1, queen: true });
  assert.equal(g.queen, "covered");
  assert.equal(g.queenOwner, 0);
  assert.equal(g.turn, 0);
});

test("the queen alone gives one more strike to cover it, and returns if that fails", () => {
  const g = C.newGame();
  finish(g, { queen: true });
  assert.equal(g.queen, "pending");
  assert.equal(g.turn, 0);
  finish(g);
  assert.equal(g.queen, "board");
  assert.equal(coins(g, "queen")[0].active, true);
  assert.equal(g.turn, 1);

  const h = C.newGame();
  finish(h, { queen: true });
  finish(h, { own: 1 });
  assert.equal(h.queen, "covered");
});

test("the last coin comes back if the queen is not covered", () => {
  const g = C.newGame();
  pocket(g, "white", 8);
  finish(g, { own: 1 });
  assert.equal(C.remaining(g, "white"), 1);
  assert.equal(g.winner, null);
  assert.equal(g.turn, 1);
});

test("clearing your coins after covering the queen wins, scoring opponent coins plus 3", () => {
  const g = C.newGame();
  pocket(g, "white", 7);
  pocket(g, "black", 5);
  finish(g, { own: 1, queen: true });
  finish(g, { own: 1 });
  assert.equal(g.phase, "over");
  assert.equal(g.winner, 0);
  assert.equal(g.points, 4 + 3);
});

test("the computer takes an easy pot and never places the striker on a coin", () => {
  const g = C.newGame();
  g.turn = 1;
  g.discs.forEach((d) => { d.active = false; });
  const mine = coins(g, "black")[0];
  Object.assign(mine, { active: true, x: 600, y: 600 });
  Object.assign(coins(g, "white")[0], { active: true, x: 200, y: 400 });
  C.placeStrikerAnywhere(g);
  const shot = C.chooseShot(g, () => 0.5, 0);
  assert.ok(C.placeStriker(g, shot.x));
  C.shoot(g, shot.angle, shot.power);
  C.settle(g);
  assert.deepEqual(g.shot.black, [mine.id]);
  assert.equal(g.shot.striker, false);
});

test("two computers can play a whole board to a result", () => {
  const g = C.newGame();
  let seed = 7;
  const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  let strikes = 0;
  while (g.phase !== "over" && strikes < 400) {
    const shot = C.chooseShot(g, rng);
    C.placeStriker(g, shot.x);
    C.shoot(g, shot.angle, shot.power);
    C.settle(g);
    C.resolve(g);
    strikes++;
  }
  assert.equal(g.phase, "over", `no result after ${strikes} strikes`);
  assert.equal(C.remaining(g, C.COLORS[g.winner]), 0);
  assert.equal(g.queen, "covered");
});
