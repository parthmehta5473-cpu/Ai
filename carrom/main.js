(function () {
  "use strict";
  const C = window.Carrom;
  const FRAME = 36; // wooden border around the playing surface, in board units
  const TOTAL = C.SIZE + FRAME * 2;
  const MAX_PULL = 190; // drag distance (board units) for a full-power strike
  const MIN_POWER = 0.06;

  const $ = (id) => document.getElementById(id);
  const canvas = $("board");
  const ctx = canvas.getContext("2d");
  const slider = $("position");
  const status = $("status");
  const modeSelect = $("mode");

  let game;
  // Maximum aiming error of the computer, in radians, per difficulty.
  const AIM_ERROR = { easy: 0.08, medium: 0.045, hard: 0.02 };
  let mode = "medium"; // a key of AIM_ERROR, or "two" for two players
  let pull = null; // { sx, sy, x, y } in board units while the player is dragging
  let preview = null; // { angle, power } shown briefly before the computer strikes
  let blocked = false;
  let generation = 0; // bumps on every new game so stale timers do nothing
  let acc = 0;
  let last = 0;

  const vsComputer = () => mode !== "two";
  const isComputerTurn = () => vsComputer() && game.turn === 1;
  const humanCanAim = () => game.phase === "aim" && !isComputerTurn();
  const playerName = (p) => (vsComputer() ? (p === 0 ? "You" : "Computer") : p === 0 ? "White" : "Black");

  function start() {
    generation++;
    game = C.newGame();
    pull = preview = null;
    $("over").hidden = true;
    beginTurn([]);
  }

  // Called whenever a player is about to aim: syncs the controls and, on the
  // computer's turn, schedules its strike.
  function beginTurn(notes) {
    blocked = !C.placeStriker(game, game.striker.x);
    slider.value = String(Math.round(((game.striker.x - C.BASE_MIN) / (C.BASE_MAX - C.BASE_MIN)) * 1000));
    slider.disabled = !humanCanAim();
    const who = playerName(game.turn);
    const prompt = isComputerTurn() ? "Computer is thinking…" : `${who === "You" ? "Your" : who + "'s"} strike.`;
    status.textContent = [...notes, prompt].join(" ");
    renderPlayers();
    if (isComputerTurn()) computerStrike(generation);
  }

  function computerStrike(token) {
    setTimeout(() => {
      if (token !== generation || game.phase !== "aim") return;
      const shot = C.chooseShot(game, Math.random, AIM_ERROR[mode]);
      C.placeStriker(game, shot.x);
      preview = { angle: shot.angle, power: shot.power };
      setTimeout(() => {
        if (token !== generation || game.phase !== "aim") return;
        preview = null;
        C.shoot(game, shot.angle, shot.power);
      }, 650);
    }, 600);
  }

  function finishShot() {
    C.resolve(game);
    if (game.phase === "over") {
      const who = playerName(game.winner);
      const points = `${game.points} point${game.points === 1 ? "" : "s"}`;
      $("result").textContent = `${who} ${who === "You" ? "win" : "wins"} the board with ${points}.`;
      status.textContent = game.notes.join(" ");
      slider.disabled = true;
      renderPlayers();
      $("over").hidden = false;
      $("again").focus();
      return;
    }
    beginTurn(game.notes);
  }

  function renderPlayers() {
    for (const p of [0, 1]) {
      const el = $("p" + p);
      const color = C.COLORS[p];
      const left = C.remaining(game, color);
      el.classList.toggle("active", game.phase !== "over" && game.turn === p);
      el.querySelector(".name").textContent = `${playerName(p)} · ${color}`;
      el.querySelector(".left").textContent = `${left} left`;
      const tally = el.querySelector(".tally");
      tally.replaceChildren();
      for (let i = 0; i < 9; i++) {
        const dot = document.createElement("span");
        dot.className = `dot ${color}${i < 9 - left ? " in" : ""}`;
        tally.append(dot);
      }
      if (game.queenOwner === p) {
        const dot = document.createElement("span");
        dot.className = "dot queen in";
        dot.title = game.queen === "covered" ? "Queen covered" : "Queen waiting for cover";
        tally.append(dot);
        el.querySelector(".left").textContent += game.queen === "covered" ? " · queen" : " · queen (cover it)";
      }
    }
  }

  // --- Input ---------------------------------------------------------------

  function boardPoint(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * TOTAL - FRAME, y: ((e.clientY - rect.top) / rect.height) * TOTAL - FRAME };
  }

  function currentAim() {
    if (!pull) return null;
    const dx = pull.sx - pull.x;
    const dy = pull.sy - pull.y;
    const power = Math.min(1, Math.hypot(dx, dy) / MAX_PULL);
    return { angle: Math.atan2(dy, dx), power };
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (!humanCanAim() || blocked) return;
    const p = boardPoint(e);
    pull = { sx: p.x, sy: p.y, x: p.x, y: p.y };
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!pull) return;
    const p = boardPoint(e);
    pull.x = p.x;
    pull.y = p.y;
  });

  canvas.addEventListener("pointerup", () => {
    const aim = currentAim();
    pull = null;
    if (aim && aim.power >= MIN_POWER && humanCanAim() && !blocked) C.shoot(game, aim.angle, aim.power);
  });

  canvas.addEventListener("pointercancel", () => { pull = null; });

  slider.addEventListener("input", () => {
    if (!humanCanAim()) return;
    const x = C.BASE_MIN + (Number(slider.value) / 1000) * (C.BASE_MAX - C.BASE_MIN);
    blocked = !C.placeStriker(game, x);
    if (blocked) status.textContent = "The striker can't sit on a coin. Slide it clear.";
    else if (status.textContent.startsWith("The striker can't")) status.textContent = "";
  });

  $("new").addEventListener("click", start);
  $("again").addEventListener("click", start);
  modeSelect.addEventListener("change", () => {
    mode = modeSelect.value;
    start();
  });

  // --- Drawing -------------------------------------------------------------

  function resize() {
    const size = Math.round(canvas.getBoundingClientRect().width * (window.devicePixelRatio || 1));
    if (size && canvas.width !== size) canvas.width = canvas.height = size;
  }

  function circle(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }

  function drawBoard() {
    const S = C.SIZE;
    ctx.fillStyle = "#5a3a22";
    ctx.fillRect(-FRAME, -FRAME, TOTAL, TOTAL);
    ctx.fillStyle = "#e8c98f";
    ctx.fillRect(0, 0, S, S);

    ctx.fillStyle = "#1a120c";
    for (const p of C.POCKETS) {
      circle(p.x, p.y, C.POCKET_R + 3);
      ctx.fill();
    }

    // Baselines on all four sides, with the end circles.
    ctx.strokeStyle = "#5a3a22";
    ctx.lineWidth = 2;
    const off = C.BASE_OFFSET;
    for (let side = 0; side < 4; side++) {
      ctx.save();
      ctx.translate(S / 2, S / 2);
      ctx.rotate((Math.PI / 2) * side);
      ctx.translate(-S / 2, -S / 2);
      ctx.strokeRect(C.BASE_MIN, off - 14, C.BASE_MAX - C.BASE_MIN, 28);
      for (const x of [C.BASE_MIN, C.BASE_MAX]) {
        circle(x, off, 14);
        ctx.fillStyle = "#b5423a";
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    circle(S / 2, S / 2, 96);
    ctx.stroke();
    circle(S / 2, S / 2, 18);
    ctx.stroke();
  }

  const FILL = { white: "#f7f1e3", black: "#26211e", queen: "#d63b4a", striker: "#3f7fd0" };
  const RING = { white: "#b9a888", black: "#6b5f57", queen: "#8f1f2c", striker: "#dbe8fb" };

  function drawDisc(d) {
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    circle(d.x + 2, d.y + 3, d.r);
    ctx.fill();
    ctx.fillStyle = FILL[d.kind];
    circle(d.x, d.y, d.r);
    ctx.fill();
    ctx.strokeStyle = RING[d.kind];
    ctx.lineWidth = 2;
    circle(d.x, d.y, d.r * 0.62);
    ctx.stroke();
  }

  function drawAim(aim, pulling) {
    const s = game.striker;
    const reach = 70 + aim.power * 260;
    const live = aim.power >= MIN_POWER;
    ctx.strokeStyle = live ? "rgba(30,20,10,0.85)" : "rgba(30,20,10,0.3)";
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + Math.cos(aim.angle) * reach, s.y + Math.sin(aim.angle) * reach);
    ctx.stroke();
    ctx.setLineDash([]);
    if (pulling) {
      // Power ring around the striker fills as the player pulls further back.
      ctx.strokeStyle = "#b5423a";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * aim.power);
      ctx.stroke();
    }
  }

  function draw() {
    resize();
    const k = canvas.width / TOTAL;
    ctx.setTransform(k, 0, 0, k, FRAME * k, FRAME * k);
    drawBoard();
    for (const d of game.discs) if (d.active) drawDisc(d);
    if (game.striker.active && game.phase !== "over") {
      drawDisc(game.striker);
      if (blocked && humanCanAim()) {
        ctx.strokeStyle = "#d63b4a";
        ctx.lineWidth = 4;
        circle(game.striker.x, game.striker.y, game.striker.r + 4);
        ctx.stroke();
      }
    }
    const aim = currentAim();
    if (aim && game.phase === "aim") drawAim(aim, true);
    else if (preview && game.phase === "aim") drawAim(preview, false);
  }

  function frame(now) {
    const elapsed = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (game.phase === "moving") {
      acc += elapsed;
      while (acc >= C.DT && game.phase === "moving") {
        acc -= C.DT;
        if (!C.step(game)) {
          acc = 0;
          finishShot();
        }
      }
    }
    draw();
    requestAnimationFrame(frame);
  }

  // Test hook: lets automated checks read state and fire exact shots.
  window.__carrom = { get game() { return game; }, shoot: (angle, power) => C.shoot(game, angle, power) };

  start();
  requestAnimationFrame(frame);
})();
