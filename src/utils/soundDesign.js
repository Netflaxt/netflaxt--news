/* ─────────────────────────────────────────────────────────────
   src/utils/soundDesign.js
   Mini suoni discreti generati con Web Audio API.
   - Default OFF (opt-in dalle impostazioni profilo)
   - Volume basso (≤ 0.15)
   - 4 suoni totali: click, save, react, bell
   ───────────────────────────────────────────────────────────── */

const STORAGE_KEY = "netflaxt_sound_enabled";
const EVENT_CHANGE = "netflaxt:sound-enabled-changed";

/* ─── Preferenze ─── */
export function isSoundEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSoundEnabled(enabled) {
  try {
    if (enabled) localStorage.setItem(STORAGE_KEY, "1");
    else localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(EVENT_CHANGE, { detail: { enabled } }));
  } catch {}
}

export function onSoundEnabledChange(handler) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT_CHANGE, handler);
  return () => window.removeEventListener(EVENT_CHANGE, handler);
}

/* ─── AudioContext singleton (creato solo se serve, lazy) ─── */
let _ctx = null;
function getCtx() {
  if (typeof window === "undefined") return null;
  if (_ctx && _ctx.state !== "closed") return _ctx;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    _ctx = new Ctx();
    return _ctx;
  } catch {
    return null;
  }
}

function canPlay() {
  if (!isSoundEnabled()) return false;
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  return true;
}

/* ─────────────────────────────────────────────────────────────
   SUONI
   ───────────────────────────────────────────────────────────── */

/* Click leggero — un piccolo "puff" smorzato */
export function playClick() {
  if (!canPlay()) return;
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(1200, t);
  osc.frequency.exponentialRampToValueAtTime(800, t + 0.06);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.10, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);

  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.1);
}

/* Bookmark salvato — piccolo "cling" cristallino */
export function playSave() {
  if (!canPlay()) return;
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;

  // Due oscillatori in armonia (do alto + sol)
  const freqs = [1568, 2349]; // G6 + D7
  freqs.forEach((f, i) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t + i * 0.04);
    gain.gain.linearRampToValueAtTime(0.08, t + i * 0.04 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.04 + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t + i * 0.04);
    osc.stop(t + i * 0.04 + 0.4);
  });
}

/* Reazione data — tap morbido (legno percosso) */
export function playReact() {
  if (!canPlay()) return;
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;

  // Noise burst breve + filtro lowpass
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.02));
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buf;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 800;
  filter.Q.value = 8;

  const gain = ctx.createGain();
  gain.gain.value = 0.12;

  noise.connect(filter).connect(gain).connect(ctx.destination);
  noise.start(t);
}

/* Nuovo articolo / notifica — campanella lontana */
export function playBell() {
  if (!canPlay()) return;
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;

  // Bell sound: fondamentale + 2 armoniche, decay lungo
  const fundamental = 880; // A5
  const harmonics = [
    { f: fundamental,        g: 0.10, dur: 1.2 },
    { f: fundamental * 2.0,  g: 0.05, dur: 0.9 },
    { f: fundamental * 2.76, g: 0.04, dur: 0.8 },
  ];

  harmonics.forEach(({ f, g, dur }) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(g, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  });
}
