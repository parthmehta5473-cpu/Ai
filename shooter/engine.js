// Level generator, simulation and autopilot. No DOM access, so the same file
// runs in the browser (as the global `Shooter`) and in Node for tests.
(function (root) {
  "use strict";

  const W = 400;
  const H = 640;
  const DT = 1 / 60;
  const LEVELS = 100;
  const KEY_SPEED = 300;
  const POINTER_SPEED = 900; // max speed when following a pointer target
  const SHOT_SPEED = 640;
  const PLAYER_CORE = 5; // bullets must reach this radius to hurt the player
  const PLAYER_BODY = 11; // radius for ramming enemies
  const PICKUP_REACH = 26;
  const MAX_POWER = 5;
  const MAX_HP = 5;
  const START_HP = 3;
  const MIN_Y = H * 0.3;

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const SECTORS = [
    { name: "Outer Belt", hue: 205 },
    { name: "Ion Drift", hue: 175 },
    { name: "Cinder Reach", hue: 18 },
    { name: "Glass Nebula", hue: 275 },
    { name: "Rust Fields", hue: 32 },
    { name: "Static Veil", hue: 135 },
    { name: "Hollow Moons", hue: 240 },
    { name: "Ember Gate", hue: 355 },
    { name: "Null Expanse", hue: 300 },
    { name: "The Core", hue: 48 },
  ];

  const BOSS_NAMES = ["Warden", "Twin Lance", "Cinder Maw", "Prism", "Rust Colossus", "Static Choir", "Hollow King", "Gatekeeper", "The Null", "Core Mind"];

  // unlock: first level the type appears. tip: shown on that level.
  const ENEMIES = {
    drone: { hp: 1, r: 12, score: 10, unlock: 1, name: "Drone", tip: "Flies straight down." },
    zigzag: { hp: 2, r: 12, score: 15, unlock: 2, name: "Weaver", tip: "Weaves side to side." },
    shooter: { hp: 3, r: 14, score: 25, unlock: 4, name: "Gunner", tip: "Stops and fires at you." },
    diver: { hp: 2, r: 12, score: 25, unlock: 7, name: "Diver", tip: "Pauses, then dives at where you are." },
    tank: { hp: 10, r: 20, score: 60, unlock: 12, name: "Bulwark", tip: "Slow and tough. Fires three-way shots." },
    splitter: { hp: 4, r: 16, score: 30, unlock: 16, name: "Splitter", tip: "Breaks into two fast fragments." },
    orbiter: { hp: 6, r: 14, score: 45, unlock: 23, name: "Orbiter", tip: "Circles and fires rings of bullets." },
    sniper: { hp: 3, r: 13, score: 40, unlock: 31, name: "Sniper", tip: "Watch the red line: a fast shot follows it." },
    swarm: { hp: 1, r: 8, score: 8, unlock: 41, name: "Swarm", tip: "Fast packs that steer toward you." },
    mini: { hp: 1, r: 8, score: 5, unlock: Infinity, name: "Fragment" },
    boss: { hp: 1, r: 46, score: 1000, unlock: Infinity, name: "Boss" },
  };
  const TYPES = ["drone", "zigzag", "shooter", "diver", "tank", "splitter", "orbiter", "sniper", "swarm"];
  const WAVE_SIZE = { drone: 5, zigzag: 4, shooter: 2, diver: 3, tank: 1, splitter: 2, orbiter: 1, sniper: 2, swarm: 8 };
  const GAP = { drone: 0.35, zigzag: 0.45, shooter: 0.8, diver: 0.6, tank: 1.5, splitter: 0.9, orbiter: 1.8, sniper: 1.1, swarm: 0.12 };
  const LINGER = { shooter: 2.5, tank: 2, orbiter: 3, sniper: 2 }; // extra rest after waves that stay on screen
  const FORMATIONS = ["line", "column", "v", "random", "sweep"];
  const BOSS_PATTERNS = ["fan", "aimed", "ring", "spiral", "summon", "rain"];

  // Player guns by power level: [x offset, angle from straight up].
  const GUNS = [
    null,
    [[0, 0]],
    [[-7, 0], [7, 0]],
    [[0, 0], [-6, -0.13], [6, 0.13]],
    [[-7, 0], [7, 0], [-9, -0.16], [9, 0.16]],
    [[-9, 0], [0, 0], [9, 0], [-11, -0.2], [11, 0.2]],
  ];

  function spawnsFor(formation, count, gap, rng) {
    const margin = 40;
    const span = W - margin * 2;
    const colX = margin + span * (0.15 + rng() * 0.7);
    const out = [];
    for (let i = 0; i < count; i++) {
      const f = count === 1 ? 0.5 : i / (count - 1);
      let x;
      let dt = i * gap;
      if (formation === "line") {
        x = margin + span * f;
        dt = 0;
      } else if (formation === "column") {
        x = colX;
      } else if (formation === "v") {
        const side = i % 2 ? 1 : -1;
        x = W / 2 + side * Math.ceil(i / 2) * (span / 2 / Math.max(1, Math.ceil((count - 1) / 2)));
        dt = Math.ceil(i / 2) * gap;
      } else if (formation === "sweep") {
        x = rng() < 0.5 ? margin + span * f : W - margin - span * f;
      } else {
        x = margin + span * rng();
      }
      out.push({ dt, x: Math.round(Math.max(margin, Math.min(W - margin, x))) });
    }
    return out;
  }

  // Everything about level n, derived from n alone.
  function levelSpec(n) {
    if (!Number.isInteger(n) || n < 1 || n > LEVELS) throw new RangeError(`level must be 1-${LEVELS}`);
    const rng = mulberry32(n * 7919 + 13);
    const d = (n - 1) / (LEVELS - 1);
    const sector = Math.floor((n - 1) / 10);
    const boss = n % 10 === 0;
    const types = TYPES.filter((t) => ENEMIES[t].unlock <= n);
    const newType = types.find((t) => ENEMIES[t].unlock === n) || null;
    const mods = { hp: 1 + d * 2.2, speed: 1 + d * 0.45, fire: 1 + d * 1.5, bullet: 1 + d * 0.55 };

    const pick = () => {
      // Newer types are more likely; the oldest fade out gradually.
      const weights = types.map((t, i) => 1 + i * 0.6);
      let roll = rng() * weights.reduce((a, b) => a + b, 0);
      for (let i = 0; i < types.length; i++) if ((roll -= weights[i]) <= 0) return types[i];
      return types[types.length - 1];
    };

    const waves = [];
    const waveCount = boss ? 2 : 4 + Math.floor(n / 12);
    let at = 2.5;
    for (let i = 0; i < waveCount; i++) {
      const type = i === 0 && newType ? newType : pick();
      const count = Math.max(1, Math.round(WAVE_SIZE[type] * (1 + d * 1.1) * (0.85 + rng() * 0.3)));
      const formation = type === "swarm" ? "column" : FORMATIONS[Math.floor(rng() * FORMATIONS.length)];
      const spawns = spawnsFor(formation, count, GAP[type], rng);
      waves.push({ at: Math.round(at * 100) / 100, type, formation, spawns });
      const stagger = spawns[spawns.length - 1].dt;
      at += Math.max(1.5, stagger) + (LINGER[type] || 0) + 3.2 - 1.7 * d;
    }

    const bossInfo = boss ? bossSpec(n / 10, n) : null;
    if (boss) waves.push({ at: Math.round((at + 1) * 100) / 100, type: "boss", formation: "line", spawns: [{ dt: 0, x: W / 2 }] });

    return {
      n,
      d,
      sector,
      sectorName: SECTORS[sector].name,
      hue: SECTORS[sector].hue,
      boss,
      bossInfo,
      newType,
      newTypeName: newType ? ENEMIES[newType].name : null,
      tip: newType ? ENEMIES[newType].tip : null,
      mods,
      waves,
      startPower: Math.min(3, 1 + Math.floor((n - 1) / 25)),
    };
  }

  function bossSpec(k, n) {
    const count = Math.min(BOSS_PATTERNS.length, 1 + Math.ceil(k * 0.55));
    const start = (k - 1) % 2; // alternate the opening move
    const patterns = [];
    for (let i = 0; i < count; i++) patterns.push(BOSS_PATTERNS[(i + start) % count]);
    const startPower = Math.min(3, 1 + Math.floor((n - 1) / 25));
    return {
      k,
      name: BOSS_NAMES[k - 1],
      patterns,
      hp: Math.round((120 + 42 * k) * (0.7 + 0.3 * startPower)),
    };
  }

  function createGame(n, opts = {}) {
    const spec = levelSpec(n);
    const queue = [];
    for (const w of spec.waves) for (const s of w.spawns) queue.push({ at: w.at + s.dt, type: w.type, x: s.x });
    queue.sort((a, b) => a.at - b.at);
    return {
      spec,
      n,
      t: 0,
      queue,
      qi: 0,
      rng: mulberry32(n * 31 + 7 + (opts.seed || 0)),
      god: !!opts.god,
      player: {
        x: W / 2,
        y: H - 90,
        hp: START_HP,
        inv: 0,
        power: spec.startPower,
        rapid: 0,
        shield: 0,
        fireCd: 0,
      },
      shots: [],
      ebullets: [],
      enemies: [],
      pickups: [],
      events: [],
      score: 0,
      kills: 0,
      hitsTaken: 0,
      stars: 0,
      status: "playing",
    };
  }

  const emit = (g, event) => g.events.push(event);

  function makeEnemy(g, type, x, y = -24) {
    const base = ENEMIES[type];
    const rng = g.rng;
    const hp = type === "boss" ? g.spec.bossInfo.hp : Math.max(1, Math.round(base.hp * g.spec.mods.hp));
    const e = {
      id: ++g.lastId || (g.lastId = 1),
      type,
      x,
      y,
      vx: 0,
      vy: 0,
      dx: 0,
      dy: 0,
      r: base.r,
      hp,
      maxHp: hp,
      score: base.score,
      age: 0,
      phase: 0,
      timer: 0,
      flash: 0,
      baseX: Math.max(70, Math.min(W - 70, x)),
      stopY: 0,
      fireCd: 0.5 + rng() * 0.9,
      aim: null,
      locked: false,
      shots: 0,
    };
    if (type === "shooter") e.stopY = 90 + rng() * 150;
    if (type === "diver") e.stopY = 80 + rng() * 90;
    if (type === "orbiter") e.stopY = 100 + rng() * 110;
    if (type === "sniper") e.stopY = 60 + rng() * 70;
    if (type === "boss") {
      Object.assign(e, { boss: g.spec.bossInfo, y: -60, patCd: 1.2, pi: 0, spiral: 0, spiralCd: 0, spin: 0, sway: 0 });
      emit(g, { type: "bossIn", name: g.spec.bossInfo.name });
    }
    return e;
  }

  function cool(e, interval) {
    e.fireCd -= DT;
    if (e.fireCd > 0) return false;
    e.fireCd += interval;
    return true;
  }

  function fireAt(g, e, angle, speed, r = 5, kind = "orb") {
    g.ebullets.push({ x: e.x, y: e.y + e.r * 0.5, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r, kind });
  }

  const angleTo = (e, p) => Math.atan2(p.y - e.y, p.x - e.x);

  function updateEnemy(g, e) {
    const m = g.spec.mods;
    const p = g.player;
    const sp = m.speed;
    const ox = e.x;
    const oy = e.y;
    e.age += DT;
    if (e.flash > 0) e.flash -= DT;
    const visible = e.y > 12 && e.y < H - 140;

    switch (e.type) {
      case "drone":
        e.y += 110 * sp * DT;
        break;
      case "zigzag":
        e.y += 85 * sp * DT;
        e.x = e.baseX + Math.sin(e.age * 2.4) * 60;
        break;
      case "shooter":
        if (e.phase === 0) {
          e.y += 130 * sp * DT;
          if (e.y >= e.stopY) e.phase = 1;
        } else if (e.phase === 1) {
          e.x += Math.cos(e.age * 0.9) * 36 * DT;
          if (cool(e, 1.9 / m.fire)) fireAt(g, e, angleTo(e, p), 200 * m.bullet);
          if (e.age > 9) e.phase = 2;
        } else e.y -= 120 * DT;
        break;
      case "diver":
        if (e.phase === 0) {
          e.y += 150 * sp * DT;
          if (e.y >= e.stopY) e.phase = 1;
        } else if (e.phase === 1) {
          e.timer += DT;
          if (e.timer >= 0.7) {
            const a = angleTo(e, p);
            e.vx = Math.cos(a) * 340 * sp;
            e.vy = Math.sin(a) * 340 * sp;
            e.phase = 2;
          }
        } else {
          e.x += e.vx * DT;
          e.y += e.vy * DT;
        }
        break;
      case "tank":
        e.y += 38 * sp * DT;
        if (visible && cool(e, 2.4 / m.fire)) for (const off of [-0.28, 0, 0.28]) fireAt(g, e, Math.PI / 2 + off, 160 * m.bullet);
        break;
      case "splitter":
        e.y += 65 * sp * DT;
        e.x += Math.cos(e.age * 1.5) * 30 * DT;
        break;
      case "orbiter":
        if (e.phase === 0) {
          e.y += 120 * sp * DT;
          if (e.y >= e.stopY) Object.assign(e, { phase: 1, cx: e.x, cy: e.y, orb: 0 });
        } else if (e.phase === 1) {
          e.orb += 1.4 * DT;
          e.x = e.cx + Math.sin(e.orb) * 55;
          e.y = e.cy + (1 - Math.cos(e.orb)) * 30;
          if (cool(e, 3.2 / m.fire)) {
            const count = 8 + Math.floor(g.spec.d * 8);
            const off = g.rng() * Math.PI;
            for (let i = 0; i < count; i++) fireAt(g, e, off + (Math.PI * 2 * i) / count, 120 * m.bullet);
          }
          if (e.age > 11) e.phase = 2;
        } else e.y -= 100 * DT;
        break;
      case "sniper":
        if (e.phase === 0) {
          e.y += 140 * sp * DT;
          if (e.y >= e.stopY) e.phase = 1;
        } else if (e.phase === 1) {
          e.timer += DT;
          if (e.timer < 0) {
            e.aim = null;
          } else if (e.timer < 0.7) {
            e.aim = angleTo(e, p);
            e.locked = false;
          } else if (e.timer < 1.25) {
            e.locked = true;
          } else {
            fireAt(g, e, e.aim, 430 * Math.min(m.bullet, 1.2), 4, "needle");
            e.aim = null;
            e.locked = false;
            e.timer = -0.7 / m.fire;
            if (++e.shots >= 3) e.phase = 2;
          }
        } else e.y -= 130 * DT;
        break;
      case "swarm":
        e.vy = 210 * sp;
        if (e.y < p.y - 140) e.vx = Math.max(-100, Math.min(100, e.vx + Math.sign(p.x - e.x) * 170 * DT));
        e.x += e.vx * DT;
        e.y += e.vy * DT;
        break;
      case "mini":
        e.x += e.vx * DT;
        e.y += e.vy * DT;
        break;
      case "boss":
        updateBoss(g, e);
        break;
    }
    e.dx = (e.x - ox) / DT;
    e.dy = (e.y - oy) / DT;
  }

  function updateBoss(g, e) {
    const k = e.boss.k;
    const mb = g.spec.mods.bullet;
    if (e.phase === 0) {
      e.y += 60 * DT;
      if (e.y >= 110) e.phase = 1;
      return;
    }
    e.sway += DT;
    e.x = W / 2 + Math.sin(e.sway * 0.55) * (W / 2 - 80);
    const enraged = e.hp < e.maxHp / 2;

    if (e.spiral > 0) {
      e.spiral -= DT;
      e.spiralCd -= DT;
      if (e.spiralCd <= 0) {
        e.spiralCd += enraged ? 0.07 : 0.09;
        e.spin += 0.32;
        fireAt(g, e, e.spin, 130 * mb);
        fireAt(g, e, e.spin + Math.PI, 130 * mb);
      }
    }

    e.patCd -= DT;
    if (e.patCd > 0) return;
    const pattern = e.boss.patterns[e.pi++ % e.boss.patterns.length];
    const p = g.player;
    if (pattern === "fan") {
      const n = 5 + Math.floor(k / 2);
      const centre = angleTo(e, p);
      for (let i = 0; i < n; i++) fireAt(g, e, centre - 0.5 + (i / (n - 1)) * 1.0, 150 * mb);
    } else if (pattern === "aimed") {
      const n = 3 + Math.floor(k / 4);
      const centre = angleTo(e, p);
      for (let i = 0; i < n; i++) fireAt(g, e, centre + (i - (n - 1) / 2) * 0.12, 200 * mb, 4, "needle");
    } else if (pattern === "ring") {
      const n = Math.round(12 + k * 1.2);
      const off = g.rng() * Math.PI;
      for (let i = 0; i < n; i++) fireAt(g, e, off + (Math.PI * 2 * i) / n, 115 * mb);
    } else if (pattern === "spiral") {
      e.spiral = 1.8;
      e.spiralCd = 0;
    } else if (pattern === "summon") {
      const n = 2 + Math.floor(k / 3);
      const type = k >= 5 ? "swarm" : "drone";
      for (let i = 0; i < n; i++) g.enemies.push(makeEnemy(g, type, Math.max(30, Math.min(W - 30, e.x + (i - (n - 1) / 2) * 40)), e.y + 30));
    } else if (pattern === "rain") {
      // Falling bullets with one clear lane, so there is always a way through.
      const n = 5 + Math.ceil(k / 2);
      const lane = 50 + g.rng() * (W - 100);
      const rmb = Math.min(mb, 1.3);
      for (let i = 0; i < n; i++) {
        let x = 20 + g.rng() * (W - 40);
        if (Math.abs(x - lane) < 45) x = lane + Math.sign(x - lane || 1) * (45 + g.rng() * 30);
        g.ebullets.push({ x, y: -10 - g.rng() * 120, vx: 0, vy: (160 + g.rng() * 50) * rmb, r: 5, kind: "orb" });
      }
    }
    e.patCd = Math.max(1.5, ((2.6 - k * 0.08) * (enraged ? 0.75 : 1)) / Math.pow(g.spec.mods.fire, 0.3));
  }

  function movePlayer(g, input) {
    const p = g.player;
    if (typeof input.tx === "number" && typeof input.ty === "number") {
      const dx = input.tx - p.x;
      const dy = input.ty - p.y;
      const dist = Math.hypot(dx, dy);
      const max = POINTER_SPEED * DT;
      if (dist > max) {
        p.x += (dx / dist) * max;
        p.y += (dy / dist) * max;
      } else {
        p.x = input.tx;
        p.y = input.ty;
      }
    } else if (input.mx || input.my) {
      const len = Math.hypot(input.mx || 0, input.my || 0) || 1;
      p.x += ((input.mx || 0) / Math.max(1, len)) * KEY_SPEED * DT;
      p.y += ((input.my || 0) / Math.max(1, len)) * KEY_SPEED * DT;
    }
    p.x = Math.max(16, Math.min(W - 16, p.x));
    p.y = Math.max(MIN_Y, Math.min(H - 30, p.y));
  }

  function firePlayer(g) {
    const p = g.player;
    p.fireCd -= DT;
    if (p.fireCd > 0) return;
    p.fireCd += p.rapid > 0 ? 0.09 : 0.15;
    for (const [ox, a] of GUNS[p.power]) {
      g.shots.push({ x: p.x + ox, y: p.y - 14, vx: Math.sin(a) * SHOT_SPEED, vy: -Math.cos(a) * SHOT_SPEED });
    }
  }

  function hurt(g) {
    const p = g.player;
    if (g.god || p.inv > 0 || g.status !== "playing") return;
    if (p.shield > 0) {
      p.shield = 0;
      p.inv = 0.8;
      emit(g, { type: "shieldBreak", x: p.x, y: p.y });
      return;
    }
    p.hp--;
    g.hitsTaken++;
    p.inv = 1.4;
    emit(g, { type: "playerHit", x: p.x, y: p.y });
    if (p.hp <= 0) {
      g.status = "lost";
      emit(g, { type: "explode", x: p.x, y: p.y, size: 3, color: "player" });
      emit(g, { type: "lost" });
    }
  }

  const DROP_TABLE = [
    ["power", 0.4],
    ["heal", 0.2],
    ["shield", 0.2],
    ["rapid", 0.2],
  ];

  function kill(g, e) {
    e.hp = 0;
    g.score += e.score;
    g.kills++;
    emit(g, { type: "explode", x: e.x, y: e.y, size: e.type === "boss" ? 4 : e.r > 15 ? 2 : 1, color: e.type });
    if (e.type === "splitter") {
      for (const side of [-1, 1]) {
        const mini = makeEnemy(g, "mini", e.x + side * 8, e.y);
        mini.vx = side * 90;
        mini.vy = 170 * g.spec.mods.speed;
        g.enemies.push(mini);
      }
    }
    if (e.type === "boss") {
      emit(g, { type: "bossDown", x: e.x, y: e.y });
      for (const b of g.ebullets) emit(g, { type: "fizzle", x: b.x, y: b.y });
      g.ebullets.length = 0;
      for (const other of g.enemies) if (other !== e && other.hp > 0) kill(g, other);
      return;
    }
    const chance = e.type === "tank" || e.type === "orbiter" ? 0.3 : e.type === "mini" || e.type === "swarm" ? 0.03 : 0.07;
    if (g.rng() < chance) {
      let roll = g.rng();
      let kind = "rapid";
      for (const [k, w] of DROP_TABLE) if ((roll -= w) <= 0) {
        kind = k;
        break;
      }
      if (kind === "power" && g.player.power >= MAX_POWER) kind = "heal";
      g.pickups.push({ kind, x: e.x, y: e.y, vy: 70, age: 0 });
    }
  }

  function applyPickup(g, kind) {
    const p = g.player;
    if (kind === "power") p.power = Math.min(MAX_POWER, p.power + 1);
    else if (kind === "heal") p.hp = Math.min(MAX_HP, p.hp + 1);
    else if (kind === "shield") p.shield = 8;
    else if (kind === "rapid") p.rapid = 8;
    emit(g, { type: "pickup", kind, x: p.x, y: p.y });
  }

  function step(g, input = {}) {
    if (g.status !== "playing") return;
    g.t += DT;
    const p = g.player;

    while (g.qi < g.queue.length && g.queue[g.qi].at <= g.t) {
      const s = g.queue[g.qi++];
      g.enemies.push(makeEnemy(g, s.type, s.x));
    }

    movePlayer(g, input);
    if (p.inv > 0) p.inv -= DT;
    if (p.rapid > 0) p.rapid -= DT;
    if (p.shield > 0) p.shield -= DT;
    firePlayer(g);

    for (const s of g.shots) {
      s.x += s.vx * DT;
      s.y += s.vy * DT;
    }
    for (let i = 0; i < g.enemies.length; i++) updateEnemy(g, g.enemies[i]);
    for (const b of g.ebullets) {
      b.x += b.vx * DT;
      b.y += b.vy * DT;
    }
    for (const k of g.pickups) {
      k.age += DT;
      k.y += k.vy * DT;
      k.x += Math.sin(k.age * 3) * 20 * DT;
    }

    // Player shots against enemies.
    for (const s of g.shots) {
      for (const e of g.enemies) {
        if (e.hp <= 0 || (e.type === "boss" && e.phase === 0)) continue;
        const reach = e.r + 4;
        if (Math.abs(s.x - e.x) > reach || Math.abs(s.y - e.y) > reach) continue;
        if (Math.hypot(s.x - e.x, s.y - e.y) >= reach) continue;
        s.dead = true;
        e.hp -= 1;
        e.flash = 0.08;
        if (e.hp <= 0) kill(g, e);
        else emit(g, { type: "hit", x: s.x, y: s.y });
        break;
      }
    }

    if (g.status === "playing") {
      for (const b of g.ebullets) {
        if (Math.hypot(b.x - p.x, b.y - p.y) < b.r + PLAYER_CORE) {
          b.dead = true;
          hurt(g);
        }
      }
      for (const e of g.enemies) {
        if (e.hp <= 0 || Math.hypot(e.x - p.x, e.y - p.y) >= e.r + PLAYER_BODY) continue;
        hurt(g);
        if (e.type !== "boss") {
          e.hp -= 3;
          e.flash = 0.08;
          if (e.hp <= 0) kill(g, e);
        }
      }
      for (const k of g.pickups) {
        if (Math.hypot(k.x - p.x, k.y - p.y) < PICKUP_REACH) {
          k.dead = true;
          applyPickup(g, k.kind);
        }
      }
    }

    const inside = (o, pad) => o.x > -pad && o.x < W + pad && o.y > -pad - 140 && o.y < H + pad;
    g.shots = g.shots.filter((s) => !s.dead && s.y > -20 && s.x > -20 && s.x < W + 20);
    g.ebullets = g.ebullets.filter((b) => !b.dead && inside(b, 20));
    g.pickups = g.pickups.filter((k) => !k.dead && k.y < H + 20);
    g.enemies = g.enemies.filter((e) => e.hp > 0 && e.y < H + 50 && e.x > -60 && e.x < W + 60 && !(e.y < -70 && e.age > 2));

    if (g.status === "playing" && g.qi >= g.queue.length && g.enemies.length === 0) {
      g.status = "won";
      g.stars = g.hitsTaken === 0 ? 3 : g.hitsTaken <= 1 ? 2 : 1;
      emit(g, { type: "won" });
    }
    if (g.events.length > 400) g.events.splice(0, g.events.length - 400);
  }

  // A simple pilot: line up under the nearest enemy, and pick the nearby
  // position whose predicted path stays clear of bullets and bodies.
  // Used by tests to check every level can be cleared, and by the title screen.
  function autopilot(g) {
    const p = g.player;
    let target = null;
    for (const e of g.enemies) {
      if (e.y < -10 || e.y > p.y - 30 || (e.type === "boss" && e.phase === 0)) continue;
      if (!target || e.type === "boss" || (target.type !== "boss" && e.y > target.y)) target = e;
    }
    const pickup = g.pickups.find((k) => k.y > p.y - 220 && k.y < p.y + 10);
    const goalX = pickup ? pickup.x : target ? target.x : W / 2;
    const goalY = pickup ? Math.max(MIN_Y, pickup.y + 10) : H - 90;
    if (g.god) return { tx: goalX, ty: H - 90 };

    const threats = [];
    for (const b of g.ebullets) if (Math.abs(b.y - p.y) < 300 && Math.abs(b.x - p.x) < 260) threats.push([b.x, b.y, b.vx, b.vy, b.r + PLAYER_CORE + 9]);
    for (const e of g.enemies) {
      if (e.hp <= 0 || Math.abs(e.y - p.y) > 320) continue;
      threats.push([e.x, e.y, e.dx, e.dy, e.r + PLAYER_BODY + 10]);
      if (e.type === "sniper" && e.aim !== null) {
        // Treat the aim line as a threat: sample points along it.
        for (let d = 40; d < 700; d += 25) threats.push([e.x + Math.cos(e.aim) * d, e.y + Math.sin(e.aim) * d, 0, 0, e.locked ? 22 : 14]);
      }
    }

    let best = null;
    const times = [0.05, 0.12, 0.2, 0.3, 0.42, 0.55];
    for (let ty = p.y - 120; ty <= p.y + 120; ty += 40) {
      if (ty < MIN_Y || ty > H - 30) continue;
      for (let tx = p.x - 160; tx <= p.x + 160; tx += 16) {
        if (tx < 16 || tx > W - 16) continue;
        const dx = tx - p.x;
        const dy = ty - p.y;
        const dist = Math.hypot(dx, dy) || 1;
        let danger = 0;
        for (const s of times) {
          const move = Math.min(dist, POINTER_SPEED * s);
          const px = p.x + (dx / dist) * move;
          const py = p.y + (dy / dist) * move;
          for (const [x, y, vx, vy, lim] of threats) {
            const ex = x + vx * s - px;
            const ey = y + vy * s - py;
            if (ex * ex + ey * ey < lim * lim) danger += 1.2 - s;
          }
        }
        const cost = danger * 1000 + Math.abs(tx - goalX) * 1.2 + Math.abs(ty - goalY) * 0.6 + Math.abs(tx - W / 2) * 0.15;
        if (!best || cost < best.cost) best = { tx, ty, cost };
      }
    }
    return best ? { tx: best.tx, ty: best.ty } : { tx: p.x, ty: p.y };
  }

  // Merges a finished level into saved progress without mutating it.
  function recordResult(progress, n, stars) {
    const prev = progress && typeof progress === "object" ? progress : {};
    const out = {
      unlocked: Math.max(Number(prev.unlocked) || 1, Math.min(LEVELS, n + 1)),
      stars: { ...(prev.stars || {}) },
      best: { ...(prev.best || {}) },
    };
    out.stars[n] = Math.max(out.stars[n] || 0, stars);
    return out;
  }

  const api = {
    W, H, DT, LEVELS, MAX_POWER, MAX_HP, START_HP, SECTORS, ENEMIES, TYPES, GUNS,
    mulberry32, levelSpec, createGame, step, autopilot, recordResult, makeEnemy,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Shooter = api;
})(typeof self !== "undefined" ? self : this);
