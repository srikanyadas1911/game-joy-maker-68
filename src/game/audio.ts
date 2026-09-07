// Tiny WebAudio blips + engine loop + background music. No assets, no dependencies.

let ctx: AudioContext | null = null;
let muted = false;
let musicOn = true;

export function setMuted(value: boolean) {
  muted = value;
  if (value) {
    stopEngine();
    stopMusic();
  } else if (musicOn) {
    startMusic();
  }
}

export function setMusicEnabled(value: boolean) {
  musicOn = value;
  if (value && !muted) startMusic();
  else stopMusic();
}

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType, gain = 0.08, slideTo?: number) {
  if (muted) return;
  const ac = getCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + dur);
  g.gain.setValueAtTime(gain, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
  osc.connect(g).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + dur + 0.02);
}

function noise(dur: number, gain = 0.12, from = 1200, to = 200) {
  if (muted) return;
  const ac = getCtx();
  if (!ac) return;
  const frames = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(from, ac.currentTime);
  filter.frequency.exponentialRampToValueAtTime(to, ac.currentTime + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
  src.connect(filter).connect(g).connect(ac.destination);
  src.start();
  src.stop(ac.currentTime + dur);
}

/* ---------- engine loop ---------- */
let engine: { osc: OscillatorNode; sub: OscillatorNode; gain: GainNode } | null = null;

export function startEngine() {
  if (muted || engine) return;
  const ac = getCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const sub = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sawtooth";
  sub.type = "square";
  osc.frequency.value = 70;
  sub.frequency.value = 35;
  gain.gain.value = 0.0001;
  gain.gain.linearRampToValueAtTime(0.03, ac.currentTime + 0.4);
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 700;
  osc.connect(lp);
  sub.connect(lp);
  lp.connect(gain).connect(ac.destination);
  osc.start();
  sub.start();
  engine = { osc, sub, gain };
}

/** speed01: 0..1 throttle level */
export function updateEngine(speed01: number, boosting = false) {
  if (!engine || !ctx) return;
  const base = 62 + speed01 * 120 + (boosting ? 60 : 0);
  engine.osc.frequency.setTargetAtTime(base, ctx.currentTime, 0.12);
  engine.sub.frequency.setTargetAtTime(base / 2, ctx.currentTime, 0.12);
  engine.gain.gain.setTargetAtTime(0.022 + speed01 * 0.03, ctx.currentTime, 0.2);
}

export function stopEngine() {
  if (!engine || !ctx) return;
  const { osc, sub, gain } = engine;
  engine = null;
  gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.08);
  const t = ctx.currentTime + 0.4;
  osc.stop(t);
  sub.stop(t);
}

/* ---------- background music ---------- */
let music: { timer: number; gain: GainNode } | null = null;
const MELODY = [0, 4, 7, 4, 9, 7, 4, 2];

export function startMusic() {
  if (muted || !musicOn || music) return;
  const ac = getCtx();
  if (!ac) return;
  const gain = ac.createGain();
  gain.gain.value = 0.05;
  gain.connect(ac.destination);
  let step = 0;
  const play = () => {
    if (!ctx) return;
    const semis = MELODY[step % MELODY.length]!;
    const freq = 261.63 * Math.pow(2, semis / 12);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.value = step % 4 === 0 ? freq / 2 : freq;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
    o.connect(g).connect(gain);
    o.start();
    o.stop(ctx.currentTime + 0.34);
    step++;
  };
  play();
  const timer = window.setInterval(play, 300);
  music = { timer, gain };
}

export function stopMusic() {
  if (!music) return;
  window.clearInterval(music.timer);
  music.gain.disconnect();
  music = null;
}

export const sfx = {
  click: () => tone(520, 0.09, "square", 0.06, 720),
  nitro: () => {
    tone(180, 0.45, "sawtooth", 0.05, 900);
    noise(0.5, 0.1, 400, 3000);
  },
  vroom: () => {
    tone(70, 0.5, "sawtooth", 0.07, 190);
    noise(0.4, 0.06, 300, 120);
  },
  horn: () => {
    tone(392, 0.35, "square", 0.06);
    tone(311, 0.35, "square", 0.05);
  },
  win: () => {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => tone(f, 0.22, "triangle", 0.08), i * 140),
    );
    setTimeout(() => noise(0.6, 0.09, 2000, 600), 200); // cheer-ish
    setTimeout(() => noise(0.8, 0.07, 3000, 800), 500);
  },
  lose: () => {
    tone(400, 0.25, "sawtooth", 0.06, 300);
    setTimeout(() => tone(300, 0.3, "sawtooth", 0.06, 200), 220);
    setTimeout(() => tone(190, 0.5, "square", 0.06, 90), 460);
  },
  finish: () => {
    tone(523, 0.16, "triangle", 0.08);
    setTimeout(() => tone(659, 0.16, "triangle", 0.08), 150);
    setTimeout(() => tone(880, 0.35, "triangle", 0.09), 300);
  },
};
