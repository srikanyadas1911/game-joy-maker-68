// Tiny WebAudio blips. No assets, no dependencies.

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(value: boolean) {
  muted = value;
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

export const sfx = {
  click: () => tone(520, 0.09, "square", 0.06, 720),
  nitro: () => tone(180, 0.45, "sawtooth", 0.05, 900),
  finish: () => {
    tone(523, 0.16, "triangle", 0.08);
    setTimeout(() => tone(659, 0.16, "triangle", 0.08), 150);
    setTimeout(() => tone(880, 0.35, "triangle", 0.09), 300);
  },
};
