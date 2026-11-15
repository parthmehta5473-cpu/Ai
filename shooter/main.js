(function () {
  "use strict";
  const S = window.Shooter;
  const A = window.ShooterAudio;
  const { W, H, DT } = S;
  const STORE = "starline-progress-v1";
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $ = (id) => document.getElementById(id);
  const canvas = $("game");
  const ctx = canvas.getContext("2d");
  const screens = { menu: $("menu"), levels: $("levels"), play: $("play-screen") };

  let progress = loadProgress();
  let game = null;
  let paused = false;
  let acc = 0;
  let last = 0;
  let particles = [];
  let shake = 0;
  let bannerUntil = 0;
  let bossBanner = null; // { name, until }
  let flashUntil = 0;
  const keys = new Set();
  let drag = null; // touch/pen: { id, ax, ay, sx, sy, x, y }
  let mouseTarget = null; // mouse: absolute target in board units

  // --- Saved progress ------------------------------------------------------

  function loadProgress() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE) || "null");
      if (raw && typeof raw === "object") return { unlocked: Math.min(S.LEVELS, Math.max(1, Number(raw.unlocked) || 1)), stars: raw.stars || {}, best: raw.best || {} };
    } catch {
      /* private mode or corrupt data: start fresh */
    }
    return { unlocked: 1, stars: {}, best: {} };
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORE, JSON.stringify(progress));
    } catch {
      /* storage blocked: progress lasts for this visit only */
    }
  }

  const totalStars = () => Object.values(progress.stars).reduce((a, b) => a + (Number(b) || 0), 0);

  // --- Screens -------------------------------------------------------------

  function show(name) {
    for (const [key, el] of Object.entries(screens)) el.hidden = key !== name;
    document.body.style.overflow = name === "play" ? "hidden" : "";
  }

  function renderMenu() {
    const n = progress.unlocked;
    $("play").textContent = n === 1 && !progress.stars[1] ? "Start" : `Continue: level ${n}`;
    const stars = totalStars();
    $("progress-line").textContent = stars ? `${Object.keys(progress.stars).length} of ${S.LEVELS} levels cleared · ${stars} of ${S.LEVELS * 3} stars` : "";
    show("menu");
  }

  function renderLevels() {
    const box = $("sectors");
    box.replaceChildren();
    S.SECTORS.forEach((sector, si) => {
      const wrap = document.createElement("section");
      wrap.className = "sector";
      wrap.style.setProperty("--hue", `hsl(${sector.hue} 85% 62%)`);
      const h = document.createElement("h3");
      h.textContent = `Sector ${si + 1}`;
      const sub = document.createElement("span");
      sub.textContent = sector.name;
      h.append(" ", sub);
      const grid = document.createElement("div");
      grid.className = "grid";
      for (let i = 1; i <= 10; i++) {
        const n = si * 10 + i;
        const b = document.createElement("button");
        b.type = "button";
        b.className = "lvl" + (n % 10 === 0 ? " boss" : "");
        const locked = n > progress.unlocked;
        const stars = progress.stars[n] || 0;
        b.disabled = locked;
        b.append(String(n));
        const small = document.createElement("small");
        small.textContent = locked ? "" : "★".repeat(stars);
        b.append(small);
        b.setAttribute("aria-label", `Level ${n}${n % 10 === 0 ? ", boss" : ""}${locked ? ", locked" : stars ? `, ${stars} of 3 stars` : ""}`);
        b.addEventListener("click", () => startLevel(n));
        grid.append(b);
      }
      wrap.append(h, grid);
      box.append(wrap);
    });
    $("star-total").textContent = `★ ${totalStars()} / ${S.LEVELS * 3}`;
    show("levels");
    const current = box.querySelectorAll(".lvl")[progress.unlocked - 1];
    if (current) current.scrollIntoView({ block: "center" });
  }

  function startLevel(n, opts) {
    game = S.createGame(n, opts);
    paused = false;
    particles = [];
    shake = 0;
    acc = 0;
    drag = null;
    mouseTarget = null;
    bossBanner = null;
    bannerUntil = game.spec.tip ? 4.5 : 3;
    $("paused").hidden = true;
    $("result").hidden = true;
    $("pause").hidden = false;
    A.unlock();
    A.pause(false);
    show("play");
    canvas.focus?.();
  }

  function setPaused(value) {
    if (!game || game.status !== "playing") return;
    paused = value;
    A.pause(value);
    $("paused").hidden = !value;
    $("pause").hidden = value;
    if (value) $("resume").focus();
  }

  function finish() {
    $("pause").hidden = true;
    const won = game.status === "won";
    const n = game.n;
    if (won) {
      progress = S.recordResult(progress, n, game.stars);
      progress.best[n] = Math.max(progress.best[n] || 0, game.score);
      saveProgress();
    }
    $("result-kicker").textContent = `Level ${n} · ${game.spec.sectorName}`;
    $("result-title").textContent = won ? (n === S.LEVELS ? "Galaxy cleared!" : game.spec.boss ? `${game.spec.bossInfo.name} destroyed` : "Level cleared") : "Ship destroyed";
    const starsEl = $("result-stars");
    starsEl.replaceChildren();
    if (won) {
      for (let i = 0; i < 3; i++) {
        const s = document.createElement("span");
        s.textContent = "★";
        if (i >= game.stars) s.className = "off";
        starsEl.append(s);
      }
      starsEl.setAttribute("aria-label", `${game.stars} of 3 stars`);
    }
    const hits = game.hitsTaken;
    $("result-detail").textContent = won
      ? `Score ${game.score.toLocaleString()} · ${hits === 0 ? "no hits taken" : `${hits} hit${hits > 1 ? "s" : ""} taken`}${game.stars < 3 ? " · take no hits for 3 stars" : ""}`
      : `Score ${game.score.toLocaleString()} · reached ${Math.round((game.qi / game.queue.length) * 100)}% of the level`;
    $("next").hidden = !won || n === S.LEVELS;
    $("result").hidden = false;
    (won && n < S.LEVELS ? $("next") : $("retry")).focus();
  }

  function renderMute() {
    for (const id of ["mute", "mute-menu"]) {
      const b = $(id);
      b.textContent = A.muted ? "Sound off" : "Sound on";
      b.setAttribute("aria-pressed", String(!A.muted));
    }
    $("mute").textContent = A.muted ? "🔇" : "🔊";
    $("mute").setAttribute("aria-label", A.muted ? "Turn sound on" : "Turn sound off");
  }
  const toggleMute = () => {
    A.setMuted(!A.muted);
    renderMute();
  };
  $("mute").addEventListener("click", toggleMute);
  $("mute-menu").addEventListener("click", toggleMute);
  // Browsers only start audio after a user gesture.
  addEventListener("pointerdown", () => A.unlock(), { capture: true });
  addEventListener("keydown", () => A.unlock(), { capture: true });

  $("play").addEventListener("click", () => startLevel(progress.unlocked));
  $("choose").addEventListener("click", renderLevels);
  $("levels-back").addEventListener("click", renderMenu);
  $("pause").addEventListener("click", () => setPaused(true));
  $("resume").addEventListener("click", () => setPaused(false));
  $("restart").addEventListener("click", () => startLevel(game.n));
  $("quit").addEventListener("click", () => {
    game = null;
    renderLevels();
  });
  $("next").addEventListener("click", () => startLevel(game.n + 1));
  $("retry").addEventListener("click", () => startLevel(game.n));
  $("to-levels").addEventListener("click", () => {
    game = null;
    renderLevels();
  });

  // --- Input ---------------------------------------------------------------

  const KEYMAP = { ArrowLeft: "l", a: "l", A: "l", ArrowRight: "r", d: "r", D: "r", ArrowUp: "u", w: "u", W: "u", ArrowDown: "d", s: "d", S: "d" };

  addEventListener("keydown", (e) => {
    if (!game || screens.play.hidden) return;
    if (e.key === "m" || e.key === "M") {
      toggleMute();
      return;
    }
    if (e.key === "Escape" || e.key === "p" || e.key === "P") {
      setPaused(!paused);
      e.preventDefault();
      return;
    }
    if (KEYMAP[e.key]) {
      keys.add(KEYMAP[e.key]);
      mouseTarget = null;
      e.preventDefault();
    }
  });
  addEventListener("keyup", (e) => keys.delete(KEYMAP[e.key]));
  addEventListener("blur", () => {
    keys.clear();
    setPaused(true);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) setPaused(true);
  });

  function boardPoint(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (!game || paused || game.status !== "playing") return;
    const p = boardPoint(e);
    if (e.pointerType === "mouse") {
      mouseTarget = p;
      return;
    }
    // Relative steering: the ship moves by as much as the finger does.
    drag = { id: e.pointerId, ax: p.x, ay: p.y, sx: game.player.x, sy: game.player.y, x: p.x, y: p.y };
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!game) return;
    const p = boardPoint(e);
    if (e.pointerType === "mouse") {
      mouseTarget = p;
      return;
    }
    if (drag && drag.id === e.pointerId) {
      drag.x = p.x;
      drag.y = p.y;
    }
  });

  const endDrag = (e) => {
    if (drag && drag.id === e.pointerId) drag = null;
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "mouse") mouseTarget = null;
  });

  function currentInput() {
    if (window.__shooter.autoplay) return S.autopilot(game);
    if (drag) return { tx: drag.sx + (drag.x - drag.ax) * 1.15, ty: drag.sy + (drag.y - drag.ay) * 1.15 };
    if (keys.size) return { mx: (keys.has("r") ? 1 : 0) - (keys.has("l") ? 1 : 0), my: (keys.has("d") ? 1 : 0) - (keys.has("u") ? 1 : 0) };
    if (mouseTarget) return { tx: mouseTarget.x, ty: mouseTarget.y - 30 };
    return {};
  }

  // --- Effects -------------------------------------------------------------

  const ENEMY_HUE = { drone: 200, zigzag: 160, shooter: 30, diver: 330, tank: 45, splitter: 280, orbiter: 190, sniper: 0, swarm: 90, mini: 280, boss: 0, player: 175 };
  const PICKUP = { power: ["#fcd34d", "P"], heal: ["#fb7185", "+"], shield: ["#60a5fa", "S"], rapid: ["#a3e635", "R"] };

  function burst(x, y, count, hue, speed, life) {
    if (reduceMotion) count = Math.ceil(count / 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random());
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.6 + Math.random() * 0.6), max: life, hue, size: 1.5 + Math.random() * 2.5 });
    }
  }

  function handleEvents() {
    const events = game.events;
    game.events = [];
    for (const ev of events) {
      A.play(ev.type, ev.type === "explode" ? Math.min(4, ev.size) : ev.kind);
      if (ev.type === "explode") {
        const hue = ev.color === "boss" ? game.spec.hue : ENEMY_HUE[ev.color] ?? 30;
        burst(ev.x, ev.y, 10 + ev.size * 10, hue, 90 + ev.size * 60, 0.5 + ev.size * 0.15);
        if (ev.size >= 3) shake = Math.max(shake, 14);
        else if (ev.size >= 2) shake = Math.max(shake, 4);
      } else if (ev.type === "hit") {
        burst(ev.x, ev.y, 2, 50, 60, 0.2);
      } else if (ev.type === "playerHit") {
        shake = Math.max(shake, 10);
        flashUntil = game.t + 0.15;
        burst(ev.x, ev.y, 18, 0, 160, 0.5);
      } else if (ev.type === "shieldBreak") {
        burst(ev.x, ev.y, 20, 215, 180, 0.5);
      } else if (ev.type === "pickup") {
        burst(ev.x, ev.y, 12, { power: 45, heal: 350, shield: 215, rapid: 85 }[ev.kind], 120, 0.4);
      } else if (ev.type === "fizzle") {
        burst(ev.x, ev.y, 1, 300, 30, 0.3);
      } else if (ev.type === "bossIn") {
        bossBanner = { name: ev.name, until: game.t + 3 };
      } else if (ev.type === "won" || ev.type === "lost") {
        setTimeout(finish, ev.type === "won" ? 900 : 1100);
      }
    }
  }

  // --- Drawing -------------------------------------------------------------

  const stars = Array.from({ length: 90 }, () => ({ x: Math.random() * W, y: Math.random() * H, z: 0.2 + Math.random() * 0.8 }));

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    if (w && (canvas.width !== w || canvas.height !== h)) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function poly(points) {
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  }

  function drawBackground(dt) {
    const hue = game.spec.hue;
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, `hsl(${hue} 55% 9%)`);
    grad.addColorStop(1, "#03040a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    for (const s of stars) {
      if (!paused) {
        s.y += s.z * 90 * dt;
        if (s.y > H) {
          s.y = 0;
          s.x = Math.random() * W;
        }
      }
      ctx.fillStyle = `hsla(${hue} 60% ${70 + s.z * 30}% / ${0.25 + s.z * 0.6})`;
      ctx.fillRect(s.x, s.y, s.z * 2, s.z * 2 + (reduceMotion ? 0 : s.z * 3));
    }
  }

  function drawPlayer() {
    const p = game.player;
    if (game.status === "lost") return;
    if (p.inv > 0 && Math.floor(p.inv * 14) % 2 === 0) return;
    const { x, y } = p;
    // Engine flame
    ctx.fillStyle = `hsl(${30 + Math.random() * 20} 100% 60%)`;
    poly([[x - 5, y + 12], [x + 5, y + 12], [x, y + 22 + Math.random() * 8]]);
    ctx.fill();
    ctx.fillStyle = "#c7f9f1";
    poly([[x, y - 18], [x + 7, y - 2], [x + 16, y + 10], [x + 6, y + 8], [x, y + 13], [x - 6, y + 8], [x - 16, y + 10], [x - 7, y - 2]]);
    ctx.fill();
    ctx.fillStyle = "#14b8a6";
    poly([[x, y - 9], [x + 4, y + 3], [x - 4, y + 3]]);
    ctx.fill();
    if (p.shield > 0) {
      ctx.strokeStyle = `rgba(96,165,250,${p.shield < 2 && Math.floor(p.shield * 8) % 2 ? 0.25 : 0.8})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, 24, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawEnemy(e) {
    const hue = e.type === "boss" ? game.spec.hue : ENEMY_HUE[e.type];
    const light = e.flash > 0 ? (e.type === "boss" ? 72 : 95) : 60;
    ctx.fillStyle = `hsl(${hue} 80% ${light}%)`;
    ctx.strokeStyle = `hsl(${hue} 90% ${e.flash > 0 ? 100 : 80}%)`;
    ctx.lineWidth = 2;
    const { x, y, r } = e;
    switch (e.type) {
      case "drone":
        poly([[x, y + r], [x + r, y], [x, y - r], [x - r, y]]);
        ctx.fill();
        break;
      case "zigzag":
        poly([[x - r, y - r * 0.6], [x, y + r], [x + r, y - r * 0.6], [x, y - r * 0.1]]);
        ctx.fill();
        break;
      case "shooter":
        poly(Array.from({ length: 6 }, (_, i) => [x + Math.cos((i * Math.PI) / 3) * r, y + Math.sin((i * Math.PI) / 3) * r]));
        ctx.fill();
        ctx.fillStyle = "#05070f";
        ctx.beginPath();
        ctx.arc(x, y, r * 0.4, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "diver":
        poly([[x, y + r * 1.3], [x + r, y - r], [x, y - r * 0.4], [x - r, y - r]]);
        ctx.fill();
        if (e.phase === 1) {
          ctx.strokeStyle = "rgba(255,90,120,0.6)";
          ctx.beginPath();
          ctx.arc(x, y, r + 6 + e.timer * 10, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
      case "tank":
        poly(Array.from({ length: 8 }, (_, i) => [x + Math.cos((i * Math.PI) / 4 + Math.PI / 8) * r, y + Math.sin((i * Math.PI) / 4 + Math.PI / 8) * r]));
        ctx.fill();
        ctx.fillStyle = "#05070f";
        ctx.fillRect(x - r * 0.5, y - 3, r, 6);
        break;
      case "splitter":
        ctx.beginPath();
        ctx.arc(x - 4, y, r * 0.8, 0, Math.PI * 2);
        ctx.arc(x + 4, y, r * 0.8, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "orbiter":
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, r * 0.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "sniper":
        if (e.aim !== null) {
          ctx.strokeStyle = e.locked ? "rgba(255,60,60,0.9)" : "rgba(255,60,60,0.3)";
          ctx.lineWidth = e.locked ? 2 : 1;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(e.aim) * 900, y + Math.sin(e.aim) * 900);
          ctx.stroke();
        }
        ctx.fillStyle = `hsl(${hue} 80% ${light}%)`;
        poly([[x, y + r * 1.4], [x + r * 0.6, y - r], [x - r * 0.6, y - r]]);
        ctx.fill();
        break;
      case "swarm":
      case "mini":
        poly([[x, y + r], [x + r, y - r * 0.7], [x - r, y - r * 0.7]]);
        ctx.fill();
        break;
      case "boss": {
        const k = e.boss.k;
        const spikes = 5 + k;
        const pts = [];
        for (let i = 0; i < spikes * 2; i++) {
          const a = (i * Math.PI) / spikes + e.age * 0.4;
          const rr = i % 2 ? r * 0.72 : r;
          pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.75]);
        }
        poly(pts);
        ctx.fill();
        ctx.fillStyle = "#05070f";
        ctx.beginPath();
        ctx.arc(x, y, r * 0.38, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = e.hp < e.maxHp / 2 ? "#ff4d4d" : `hsl(${hue} 100% 75%)`;
        ctx.beginPath();
        ctx.arc(x, y, r * 0.18 + Math.sin(e.age * 6) * 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
    if (e.type === "tank" || e.type === "orbiter" || e.type === "splitter") {
      if (e.hp < e.maxHp) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(x - r, y - r - 8, r * 2, 3);
        ctx.fillStyle = "#a3e635";
        ctx.fillRect(x - r, y - r - 8, (r * 2 * e.hp) / e.maxHp, 3);
      }
    }
  }

  function drawPickups() {
    ctx.font = "900 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const k of game.pickups) {
      const [color, label] = PICKUP[k.kind];
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(k.x, k.y, 10 + Math.sin(k.age * 6) * 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#05070f";
      ctx.fillText(label, k.x, k.y + 0.5);
    }
  }

  function drawShots() {
    ctx.fillStyle = "#a5f3fc";
    for (const s of game.shots) ctx.fillRect(s.x - 1.5, s.y - 6, 3, 12);
    for (const b of game.ebullets) {
      if (b.kind === "needle") {
        const a = Math.atan2(b.vy, b.vx);
        ctx.strokeStyle = "#ff6b6b";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(b.x - Math.cos(a) * 9, b.y - Math.sin(a) * 9);
        ctx.lineTo(b.x + Math.cos(a) * 5, b.y + Math.sin(a) * 5);
        ctx.stroke();
      } else {
        ctx.fillStyle = "rgba(255,120,200,0.35)";
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r + 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffd1ec";
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r - 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawParticles(dt) {
    for (const p of particles) {
      if (!paused) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.96;
        p.vy *= 0.96;
      }
      ctx.fillStyle = `hsla(${p.hue} 100% 65% / ${Math.max(0, p.life / p.max)})`;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    particles = particles.filter((p) => p.life > 0);
  }

  function text(str, x, y, size, color, weight = 800, align = "center") {
    ctx.font = `${weight} ${size}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  function heart(x, y, full) {
    ctx.fillStyle = full ? "#fb7185" : "rgba(251,113,133,0.2)";
    ctx.beginPath();
    ctx.moveTo(x, y + 5);
    ctx.bezierCurveTo(x - 9, y - 2, x - 5, y - 9, x, y - 4);
    ctx.bezierCurveTo(x + 5, y - 9, x + 9, y - 2, x, y + 5);
    ctx.fill();
  }

  function drawHud() {
    const p = game.player;
    text(`LEVEL ${game.n}`, 14, 20, 13, "#eef2ff", 800, "left");
    text(game.score.toLocaleString(), 14, 38, 13, "#8f9bbd", 700, "left");
    for (let i = 0; i < Math.max(S.START_HP, p.hp); i++) heart(W / 2 - (Math.max(S.START_HP, p.hp) - 1) * 9 + i * 18, 22, i < p.hp);

    // Bottom right: weapon level and timed boosts.
    for (let i = 0; i < S.MAX_POWER; i++) {
      ctx.fillStyle = i < p.power ? "#fcd34d" : "rgba(252,211,77,0.18)";
      ctx.fillRect(W - 14 - (S.MAX_POWER - i) * 9, H - 18, 6, 8);
    }
    let bx = W - 14;
    for (const [t, color, label] of [[p.rapid, "#a3e635", "RAPID"], [p.shield, "#60a5fa", "SHIELD"]]) {
      if (t > 0) {
        text(`${label} ${Math.ceil(t)}`, bx, H - 32, 11, color, 800, "right");
        bx -= 76;
      }
    }

    const boss = game.enemies.find((e) => e.type === "boss");
    if (boss && boss.phase > 0) {
      const w = W - 120;
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(60, 54, w, 6);
      ctx.fillStyle = boss.hp < boss.maxHp / 2 ? "#ff4d4d" : `hsl(${game.spec.hue} 90% 60%)`;
      ctx.fillRect(60, 54, (w * boss.hp) / boss.maxHp, 6);
      text(boss.boss.name.toUpperCase(), W / 2, 70, 10, "#cbd5f5", 800);
    }
  }

  function drawBanners() {
    const t = game.t;
    if (t < bannerUntil) {
      const alpha = Math.min(1, t * 3, (bannerUntil - t) * 2);
      ctx.globalAlpha = alpha;
      text(`Level ${game.n}`, W / 2, H * 0.36, 34, "#ffffff", 900);
      text(`Sector ${game.spec.sector + 1} · ${game.spec.sectorName}`, W / 2, H * 0.36 + 32, 14, `hsl(${game.spec.hue} 80% 75%)`, 700);
      if (game.spec.tip) {
        text(`New enemy: ${game.spec.newTypeName}`, W / 2, H * 0.36 + 70, 15, "#fcd34d", 800);
        text(game.spec.tip, W / 2, H * 0.36 + 92, 13, "#cbd5f5", 500);
      }
      ctx.globalAlpha = 1;
    }
    if (bossBanner && t < bossBanner.until) {
      ctx.globalAlpha = Math.min(1, (bossBanner.until - t) * 2) * (0.6 + 0.4 * Math.abs(Math.sin(t * 5)));
      text("WARNING", W / 2, H * 0.42, 30, "#ff4d4d", 900);
      text(bossBanner.name, W / 2, H * 0.42 + 32, 16, "#ffd1d1", 700);
      ctx.globalAlpha = 1;
    }
  }

  function draw(dt) {
    resize();
    const k = canvas.width / W;
    let sx = 0;
    let sy = 0;
    if (shake > 0 && !reduceMotion) {
      sx = (Math.random() - 0.5) * shake;
      sy = (Math.random() - 0.5) * shake;
    }
    if (!paused) shake = Math.max(0, shake - dt * 40);
    ctx.setTransform(k, 0, 0, k, sx * k, sy * k);
    drawBackground(dt);
    drawPickups();
    for (const e of game.enemies) drawEnemy(e);
    drawShots();
    drawPlayer();
    drawParticles(dt);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    if (game.t < flashUntil && !reduceMotion) {
      ctx.fillStyle = "rgba(255,40,60,0.18)";
      ctx.fillRect(0, 0, W, H);
    }
    drawHud();
    drawBanners();
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (game && !screens.play.hidden) {
      if (!paused && game.status === "playing") {
        acc += dt;
        let steps = 0;
        while (acc >= DT && steps++ < 5) {
          acc -= DT;
          S.step(game, currentInput());
          if (game.status !== "playing") break;
        }
        if (steps >= 5) acc = 0;
      }
      handleEvents();
      draw(dt);
    }
    requestAnimationFrame(frame);
  }

  // Test hook: read state, jump to a level, or let the autopilot fly.
  window.__shooter = {
    autoplay: false,
    get game() {
      return game;
    },
    get progress() {
      return progress;
    },
    start: startLevel,
    audio: A,
  };

  renderMute();
  renderMenu();
  requestAnimationFrame(frame);
})();
