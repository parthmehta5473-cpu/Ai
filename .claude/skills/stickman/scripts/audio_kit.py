"""Sound toolkit: real CC0 recordings pitched down, synthesized beds, optional music and voice.
Dark recipe for tense scenes: pitch 0.5-0.75, low-pass, short dark reverb, low impact under each boot."""
import os, re, subprocess, wave
from pathlib import Path
import numpy as np
from scipy.signal import butter, fftconvolve, resample, sosfilt
from common import SKILL, ffmpeg

SR = 44100
SFX_DIR = SKILL / "sfx"
CACHE = Path(".sfxcache")


def _lp(x, f, o=2): return sosfilt(butter(o, f, "low", fs=SR, output="sos"), x)
def _hp(x, f, o=2): return sosfilt(butter(o, f, "high", fs=SR, output="sos"), x)
def _bp(x, a, b, o=2): return sosfilt(butter(o, [a, b], "band", fs=SR, output="sos"), x)
def _pitch(x, r): return resample(x, max(8, int(len(x) / r)))


def decode(path, channels=1):
    raw = subprocess.run([ffmpeg(), "-v", "error", "-i", str(path), "-ar", str(SR), "-ac", str(channels), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    a = np.frombuffer(raw, "<f4").copy()
    return a.reshape(-1, channels) if channels > 1 else a


def load_sfx(name):
    """name without extension, for example 'footstep-wood-001'. Hyphen before the number also works."""
    CACHE.mkdir(exist_ok=True)
    f = CACHE / f"{name}.npy"
    if f.exists():
        return np.load(f)
    src = SFX_DIR / f"{name}.ogg"
    if not src.exists():
        alt = sorted(SFX_DIR.glob(name.rsplit("-", 1)[0] + "-*.ogg"))
        if not alt:
            raise FileNotFoundError(f"no sound called {name}; look in sfx/")
        src = alt[int(name[-1]) % len(alt)] if name[-1].isdigit() else alt[0]
    a = decode(src)
    a = a / (np.abs(a).max() + 1e-6)
    np.save(f, a)
    return a


class Mix:
    def __init__(self, dur, seed=9):
        self.D, self.N = dur, int(SR * dur)
        self.t = np.arange(self.N) / SR
        self.rng = np.random.default_rng(seed)
        self.dry = [np.zeros(self.N), np.zeros(self.N)]
        self.wet = np.zeros(self.N)
        self.mus = [np.zeros(self.N), np.zeros(self.N)]
        self.vo = np.zeros(self.N)

    def curve(self, k): return np.interp(self.t, [a for a, _ in k], [b for _, b in k])
    def noise(self, n=None): return self.rng.standard_normal(n or self.N)

    def put(self, t, s, g=1, p=0, w=.25):
        i = int(t * SR)
        if i >= self.N or i < 0:
            return
        j = min(self.N, i + len(s))
        s = s[: j - i] * g
        self.dry[0][i:j] += s * np.cos((p + 1) * np.pi / 4)
        self.dry[1][i:j] += s * np.sin((p + 1) * np.pi / 4)
        self.wet[i:j] += s * w

    def sfx(self, name, t, pitch=1., lp=6000, g=.5, pan=0., wet=.25):
        self.put(t, _lp(_pitch(load_sfx(name), pitch), lp), g, pan, wet)

    def nb(self, t, lo, hi, d, a, r, g, p=0):
        m = int(d * SR)
        e = np.ones(m); ai = max(1, int(a * SR)); ri = max(1, int(r * SR))
        e[:ai] = np.linspace(0, 1, ai); e[-ri:] *= np.linspace(1, 0, ri) ** 1.5
        self.put(t, _bp(self.noise(m), lo, hi) * e, g, p)

    # ---- beds (each takes a curve of (time, level)) -----
    def room_bed(self, k):
        c = self.curve(k)
        for ch in range(2):
            self.dry[ch] += _bp(self.noise(), 170, 620) * .21 * (1 + .45 * np.sin(2 * np.pi * (.5 + ch * .13) * self.t + ch)) * c
            self.dry[ch] += np.sin(2 * np.pi * 58 * self.t) * .012 + np.sin(2 * np.pi * 116 * self.t) * .007

    def rain_bed(self, k):
        c = self.curve(k)
        for ch in range(2):
            r = _hp(_lp(self.noise(), 6200), 700) * .13 + _lp(self.noise(), 260) * .15
            self.dry[ch] += r * c * (.8 if ch == 0 else 1.15)

    def wind_bed(self, k):
        c = self.curve(k)
        for ch in range(2):
            self.dry[ch] += _bp(self.noise(), 110, 760) * .3 * (1 + .6 * np.sin(2 * np.pi * .7 * self.t + ch * 1.4)) * c

    def street_bed(self, k):
        c = self.curve(k)
        for ch in range(2):
            self.dry[ch] += (_lp(self.noise(), 320) * .16 + _bp(self.noise(), 900, 5000) * .012) * c

    def air_bed(self, k):
        """Near silence for symbolic scenes: the drop in level is what sells the change."""
        c = self.curve(k)
        for ch in range(2):
            self.dry[ch] += (_bp(self.noise(), 90, 420) * .05 + _bp(self.noise(), 2500, 7000) * .004) * c

    def drone(self, k):
        c = self.curve(k)
        d = (np.sin(2 * np.pi * 41 * self.t) + .7 * np.sin(2 * np.pi * 41.7 * self.t) + .32 * np.sin(2 * np.pi * 61.9 * self.t)) * c * .11
        self.dry[0] += d; self.dry[1] += d

    # ---- recipes -----
    def boots(self, t, pan=0, g=.5, surface="wood", i=None):
        i = int(t * 97) % 5 if i is None else i
        self.sfx(f"footstep-{surface}-00{i}", t, .68, 2300, g, pan, .42)
        self.sfx("impactsoft-heavy-002", t, .56, 300, g, pan, .3)

    def step(self, t, pan=0, g=.22, surface="wood"):
        self.sfx(f"footstep-{surface}-00{int(t * 97) % 5}", t, .85, 2800, g, pan, .25)

    def door_open(self, t, pan=.35):
        self.sfx("dooropen-2", t, .62, 2600, .5, pan, .4)
        self.sfx("creak2", t + .35, .55, 1900, .34, pan, .5)
        self.sfx("creak1", t + .8, .5, 1700, .16, pan, .5)

    def door_stop(self, t, pan=.35):
        self.sfx("impactwood-heavy-001", t, .55, 1500, .42, pan, .6)
        self.sfx("impactsoft-heavy-000", t, .5, 420, .72, pan * .3, .5)

    def cup_down(self, t, pan=0): self.sfx("impactglass-light-001", t, .62, 2400, .2, pan, .25)
    def cloth(self, t, pan=0, g=.08): self.sfx(f"cloth{1 + int(t * 7) % 4}", t, .75, 2400, g, pan, .2)

    def chair_scrape(self, t, pan=0, d=.7):
        m = int(d * SR); k = np.arange(m) / SR
        self.put(t, _bp(self.noise(m), 260, 1300) * (1 + .8 * np.sin(2 * np.pi * 43 * k)) * np.linspace(1, .2, m) * .42, 1, pan, .3)
        self.sfx("creak3", t, .5, 1500, .14, pan, .3)

    def heart(self, t, g=.6):
        self.sfx("impactsoft-heavy-000", t, .42, 170, g, 0, .1)
        self.sfx("impactsoft-heavy-000", t + .17, .36, 150, g * .66, 0, .1)

    def gunshot(self, t, pan=.35, g=1., tail=1.5):
        m = int(tail * SR); k = np.arange(m) / SR; n = self.noise(m)
        s = _hp(n, 700) * np.exp(-k * 60) * .8 + _lp(n, 620) * np.exp(-k * 9) * 2.6 + np.sin(2 * np.pi * (44 + 80 * np.exp(-k * 20)) * k) * np.exp(-k * 6) * 1.5
        self.put(t, s, g, pan, .8)
        self.sfx("impactmetal-heavy-000", t, .5, 2600, .5, pan, .6)

    def slow_shot(self, t, pan=.4):
        m = int(1.8 * SR); k = np.arange(m) / SR
        s = np.sin(2 * np.pi * (31 + 36 * np.exp(-k * 5)) * k) * np.exp(-k * 2.6) + _lp(self.noise(m), 240) * np.exp(-k * 3.4) * 1.6
        self.put(t, s * np.minimum(1, k / .05), .5, pan, .4)

    def whoosh(self, t, pan=0, d=1.1, g=.42):
        m = int(d * SR); x = np.linspace(-1, 1, m)
        self.put(t - d / 2, _bp(self.noise(m), 180, 1100) * np.exp(-x * x * 4.5), g, pan, .3)

    def thunder(self, t, g=.42, pan=-.3):
        m = int(4 * SR); s = _lp(self.noise(m), 110, 3); e = np.ones(m); e[: int(.5 * SR)] = np.linspace(0, 1, int(.5 * SR)); e *= np.linspace(1, 0, m) ** 1.5
        self.put(t, s / np.abs(s).max() * e, g, pan, .2)

    def splash(self, t, pan=0, g=.5): self.nb(t, 250, 1400, .13, .004, .1, .5 * g, pan); self.nb(t + .02, 1500, 5200, .18, .01, .15, .14 * g, pan)
    def sigh(self, t, g=.3): self.nb(t, 350, 2400, .7, .15, .45, g)
    def tick(self, t, g=.03, pan=.5):
        m = int(.03 * SR); k = np.arange(m) / SR
        self.put(t, np.sin(2 * np.pi * 2300 * k) * np.exp(-k * 340), g, pan, .1)

    def engine_pass(self, t, d=3.2, pan0=-.9, pan1=.5, g=.13):
        m = int(d * SR); k = np.arange(m) / SR; f = np.interp(k, [0, d * .75, d], [68, 52, 42]); ph = 2 * np.pi * np.cumsum(f) / SR
        s = (np.sin(ph) + .5 * np.sin(2 * ph) + .3 * np.sin(3 * ph)) + _lp(self.noise(m), 300) * 1.2
        e = np.interp(k, [0, d * .5, d * .8, d], [0, 1, .7, .4]); pan = np.linspace(pan0, pan1, m); i = int(t * SR); j = min(self.N, i + m)
        self.dry[0][i:j] += (s * e * np.cos((pan + 1) * np.pi / 4) * g)[: j - i]
        self.dry[1][i:j] += (s * e * np.sin((pan + 1) * np.pi / 4) * g)[: j - i]

    def crowd(self, a, b, g=.1):
        n = int((b - a) * SR); self.put(a, (_bp(self.noise(n), 250, 1100) + .6 * _bp(self.noise(n), 1100, 2800)) * np.minimum(1, np.minimum(np.arange(n), n - 1 - np.arange(n)) / (.2 * SR)), g, 0, .1)

    # ---- music: a supplied file, or a soft synthesized bed. Sits about 5 dB under effects. -----
    def music_file(self, path, gain_db=-16):
        a = decode(path, 2)[: self.N]
        g = 10 ** (gain_db / 20)
        e = np.minimum(1, np.minimum(np.arange(len(a)), len(a) - 1 - np.arange(len(a))) / (1.2 * SR))
        self.mus[0][: len(a)] += a[:, 0] * g * e
        self.mus[1][: len(a)] += a[:, 1] * g * e

    def music(self, mood="warm", bpm=72, gain=1.):
        P = {"warm": [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], "sad": [[57, 60, 64], [52, 55, 59], [53, 57, 60], [50, 53, 57]],
             "tense": [[45, 48, 52], [44, 48, 51], [45, 48, 52], [46, 49, 53]], "hopeful": [[48, 52, 55], [55, 59, 62], [57, 60, 64], [53, 57, 60]]}[mood]
        beat = 60 / bpm; bar = beat * 4; n = 0; t = 0; nf = lambda v: 440 * 2 ** ((v - 69) / 12)
        def pluck(t0, v, g, p):
            m = int(2.2 * SR); k = np.arange(m) / SR; f = nf(v)
            s = (np.sin(2 * np.pi * f * k) + .28 * np.sin(4 * np.pi * f * k) + .08 * np.sin(6 * np.pi * f * k)) * np.exp(-k * 3.2) * np.minimum(1, k / .006)
            s = _lp(s, 2600); i = int(t0 * SR); j = min(self.N, i + m)
            if i < self.N:
                self.mus[0][i:j] += s[: j - i] * g * np.cos((p + 1) * np.pi / 4); self.mus[1][i:j] += s[: j - i] * g * np.sin((p + 1) * np.pi / 4)
        while t < self.D - 1:
            ch = P[n % 4]; i, j = int(t * SR), min(self.N, int((t + bar + .6) * SR)); k = np.arange(j - i) / SR
            e = np.minimum(1, k / .9) * np.minimum(1, (k[-1] - k) / .9 + 1e-3)
            s = sum(np.sin(2 * np.pi * nf(v) * k) + .5 * np.sin(2 * np.pi * nf(v) * 1.003 * k + 1) for v in ch)
            s = _lp(s, 1200) * e * .014 * gain; self.mus[0][i:j] += s; self.mus[1][i:j] += s
            for q in range(4):
                pluck(t + q * beat, ch[[0, 1, 2, 1][q]] + 12, .055 * gain, -.3 if q % 2 else .3)
            t += bar; n += 1

    def voice(self, path, at=.5, gain_db=-3.5, cuts=()):
        """Lay the MP3 in at `at`. cuts=[(voice_time, hold_seconds)] inserts silence at a pause, for held story beats."""
        v = decode(path); g = 10 ** (gain_db / 20); pos = int(at * SR); last = 0
        for c, hold in list(cuts) + [(len(v) / SR, 0)]:
            s = v[last: int(c * SR)]; j = min(self.N, pos + len(s)); self.vo[pos:j] += s[: j - pos] * g; pos += len(s) + int(hold * SR); last = int(c * SR)

    def write(self, name="audio.wav"):
        ir_n = int(1.1 * SR); ir = _lp(self.rng.standard_normal(ir_n), 1400) * np.exp(-np.arange(ir_n) / SR * 6)
        wet = fftconvolve(self.wet, ir)[: self.N]; wp = np.abs(wet).max()
        if wp > 0:
            wet = wet / wp * .26
        fi = self.curve([(0, 0), (.5, 1), (self.D - .6, 1), (self.D - .1, 0), (self.D, 0)])
        L = (self.dry[0] + wet) * fi; R = (self.dry[1] + wet) * fi; pk = max(np.abs(L).max(), np.abs(R).max(), 1e-6)
        # soft-limit effects so a gunshot cannot pull quiet moments down; quiet beds keep their level, then music and voice go on top
        ref = max(pk, 1.2)
        L = np.tanh(L / ref * 2.2) * .72; R = np.tanh(R / ref * 2.2) * .72
        L = L + (self.mus[0] * fi); R = R + (self.mus[1] * fi)
        if self.vo.any():
            L = L * .55 + self.vo; R = R * .55 + self.vo
        st = np.stack([_lp(L, 13500), _lp(R, 13500)], 1); st = np.clip(st, -.98, .98)
        def save(arr):
            with wave.open(name, "wb") as w:
                w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((arr * 32767).astype("<i2").tobytes())
        save(st)
        # final level: about -17 LUFS, peak held under -1 dBFS
        r = subprocess.run([ffmpeg(), "-hide_banner", "-i", name, "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr
        found = re.findall(r"I:\s+(-?[\d.]+) LUFS", r)
        if found:
            g = 10 ** ((-17 - float(found[-1])) / 20); g = min(g, .89 / max(np.abs(st).max(), 1e-6)); st = st * g; save(st)
        x = st.mean(1); X = np.abs(np.fft.rfft(x)) ** 2; f = np.fft.rfftfreq(len(x), 1 / SR)
        print("audio ok; spectral centroid Hz", round(float((X * f).sum() / max(X.sum(), 1e-9))))
