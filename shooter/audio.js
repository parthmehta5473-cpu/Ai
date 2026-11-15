// Sound effects synthesised with the Web Audio API: no audio files to load.
// Exposes the global `ShooterAudio`. Every call is safe when audio is
// unavailable, blocked, or muted.
(function (root) {
  "use strict";
  const STORE = "starline-muted";
  const MIN_GAP = { shoot: 0.07, hit: 0.045, explode: 0.03, pickup: 0.05, fizzle: 0.2 }; // seconds between repeats

  let ctx = null;
  let master = null;
  let noise = null;
  let muted = false;
  const lastPlayed = {};
  const stats = {};

  try {
    muted = localStorage.getItem(STORE) === "1";
  } catch {
    /* storage blocked: default to sound on */
  }

  // Creates the audio graph. Browsers only allow this after a user gesture,
  // so it is called from click and key handlers.
  function unlock() {
    if (ctx) {
      if (ctx.state === "suspended" && !muted) ctx.resume().catch(() => {});
      return;
    }
    const Ctor = root.AudioContext || root.webkitAudioContext;
    if (!Ctor) return;
    try {
      ctx = new Ctor();
    } catch {
      ctx = null;
      return;
    }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 6;
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(comp);
    comp.connect(ctx.destination);
    const len = ctx.sampleRate;
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  function setMuted(value) {
    muted = !!value;
    try {
      localStorage.setItem(STORE, muted ? "1" : "0");
    } catch {
      /* not saved; applies for this visit */
    }
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.02);
    if (!muted) unlock();
  }

  function pause(value) {
    if (!ctx) return;
    (value ? ctx.suspend() : muted ? Promise.resolve() : ctx.resume()).catch(() => {});
  }

  // One enveloped oscillator, optionally sliding in pitch.
  function tone({ type = "square", from, to = from, dur, vol, delay = 0, attack = 0.005 }) {
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // Filtered noise burst for explosions and impacts.
  function crunch({ dur, vol, freq, to = freq / 4, delay = 0 }) {
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(freq, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  const SOUNDS = {
    shoot: () => tone({ type: "square", from: 1400, to: 700, dur: 0.05, vol: 0.025 }),
    hit: () => tone({ type: "triangle", from: 520, to: 360, dur: 0.04, vol: 0.05 }),
    explode: (size = 1) => {
      crunch({ dur: 0.18 + size * 0.12, vol: 0.18 + size * 0.07, freq: 2600 - size * 350 });
      tone({ type: "sine", from: 160 - size * 20, to: 40, dur: 0.15 + size * 0.1, vol: 0.12 + size * 0.04 });
    },
    playerHit: () => {
      crunch({ dur: 0.35, vol: 0.4, freq: 1800 });
      tone({ type: "sawtooth", from: 300, to: 70, dur: 0.35, vol: 0.18 });
    },
    shieldBreak: () => {
      tone({ type: "triangle", from: 1800, to: 500, dur: 0.25, vol: 0.12 });
      crunch({ dur: 0.2, vol: 0.12, freq: 6000, to: 2000 });
    },
    pickup: (kind) => {
      const base = { power: 660, heal: 520, shield: 440, rapid: 780 }[kind] || 600;
      [1, 1.25, 1.5].forEach((m, i) => tone({ type: "square", from: base * m, dur: 0.08, vol: 0.06, delay: i * 0.055 }));
    },
    fizzle: () => crunch({ dur: 0.4, vol: 0.08, freq: 5000, to: 800 }),
    bossIn: () => {
      for (let i = 0; i < 3; i++) {
        tone({ type: "sawtooth", from: 220, to: 330, dur: 0.3, vol: 0.12, delay: i * 0.45, attack: 0.05 });
        tone({ type: "sawtooth", from: 330, to: 220, dur: 0.15, vol: 0.1, delay: i * 0.45 + 0.3 });
      }
    },
    bossDown: () => {
      for (let i = 0; i < 4; i++) crunch({ dur: 0.6, vol: 0.35, freq: 2200 - i * 300, delay: i * 0.18 });
      tone({ type: "sine", from: 120, to: 30, dur: 1.2, vol: 0.3 });
    },
    won: () => [523, 659, 784, 1047].forEach((f, i) => tone({ type: "square", from: f, dur: i === 3 ? 0.35 : 0.12, vol: 0.07, delay: 0.1 + i * 0.11 })),
    lost: () => [392, 330, 262, 196].forEach((f, i) => tone({ type: "triangle", from: f, to: f * 0.97, dur: i === 3 ? 0.5 : 0.2, vol: 0.12, delay: 0.2 + i * 0.2 })),
  };

  function play(name, arg) {
    if (muted || !ctx || ctx.state !== "running" || !SOUNDS[name]) return;
    const now = ctx.currentTime;
    if (MIN_GAP[name] && now - (lastPlayed[name] ?? -1) < MIN_GAP[name]) return;
    lastPlayed[name] = now;
    stats[name] = (stats[name] || 0) + 1;
    try {
      SOUNDS[name](arg);
    } catch {
      /* a failed sound never breaks the game */
    }
  }

  root.ShooterAudio = {
    unlock,
    play,
    pause,
    setMuted,
    get muted() {
      return muted;
    },
    get state() {
      return ctx ? ctx.state : "none";
    },
    stats,
  };
})(typeof self !== "undefined" ? self : this);
