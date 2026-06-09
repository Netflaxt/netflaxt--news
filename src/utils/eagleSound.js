/* ─────────────────────────────────────────────────────────────
   src/utils/eagleSound.js
   Verso aquila — audio singleton precaricato per avvio immediato.

   Strategia:
   1. Un singolo oggetto Audio viene creato e precaricato al primo
      import del modulo. Il file mp3 viene scaricato e tenuto in
      memoria pronto al play.
   2. Quando si chiama playEagleCry(): rewind a 0 + play() istantaneo.
      Niente fetch HEAD, niente nuovo Audio, niente attesa.
   3. Fallback sintetizzato (Web Audio API) solo se il file mp3
      fallisce o non è disponibile.
   ───────────────────────────────────────────────────────────── */

const SOUND_URL = "/eagle-cry.mp3";
let _audioInstance = null;
let _audioError = false;

/* Preload Audio singleton — chiamato dal Provider o all'import */
function ensureAudio() {
  if (_audioError) return null;
  if (_audioInstance) return _audioInstance;
  if (typeof window === "undefined") return null;
  try {
    const a = new Audio(SOUND_URL);
    a.preload = "auto";
    a.volume = 0.55;
    a.crossOrigin = "anonymous";
    // Forza il caricamento immediato
    a.load();
    a.addEventListener("error", () => {
      _audioError = true;
      _audioInstance = null;
    });
    _audioInstance = a;
    return a;
  } catch {
    _audioError = true;
    return null;
  }
}

/* API pubblica: preload manuale (chiamare al mount della Home) */
export function preloadEagleCry() {
  ensureAudio();
}

/* Riproduce il verso aquila istantaneamente (no fetch, no nuovo Audio) */
async function playFile() {
  const audio = ensureAudio();
  if (!audio) return false;
  try {
    audio.currentTime = 0;
    const p = audio.play();
    if (p && typeof p.then === "function") {
      await p;
    }
    return true;
  } catch {
    return false;
  }
}

/* ─────────────────────────────────────────────────────────────
   Sintesi procedurale del verso (fallback senza file).
   ───────────────────────────────────────────────────────────── */
function playSynth() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    const ctx = new Ctx();
    const t0 = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.0;
    master.connect(ctx.destination);
    master.gain.linearRampToValueAtTime(0.45, t0 + 0.03);
    master.gain.linearRampToValueAtTime(0, t0 + 2.2);

    const calls = [
      { start: 0.0, dur: 0.55, f0: 2100, f1: 1500 },
      { start: 0.7, dur: 0.32, f0: 2400, f1: 1700 },
      { start: 1.15, dur: 0.45, f0: 2200, f1: 1450 },
    ];

    calls.forEach(({ start, dur, f0, f1 }) => {
      const t = t0 + start;
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = (f0 + f1) / 2;
      bp.Q.value = 6;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 18;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 35;
      lfo.connect(lfoGain).connect(osc.frequency);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.5, t + 0.04);
      env.gain.linearRampToValueAtTime(0.35, t + dur * 0.5);
      env.gain.linearRampToValueAtTime(0, t + dur);
      osc.connect(bp).connect(env).connect(master);

      const harm = ctx.createOscillator();
      harm.type = "sine";
      harm.frequency.setValueAtTime(f0 * 1.6, t);
      harm.frequency.exponentialRampToValueAtTime(f1 * 1.6, t + dur);
      const harmEnv = ctx.createGain();
      harmEnv.gain.setValueAtTime(0, t);
      harmEnv.gain.linearRampToValueAtTime(0.18, t + 0.04);
      harmEnv.gain.linearRampToValueAtTime(0, t + dur);
      harm.connect(harmEnv).connect(master);

      osc.start(t);
      osc.stop(t + dur + 0.05);
      harm.start(t);
      harm.stop(t + dur + 0.05);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
    });

    setTimeout(() => ctx.close().catch(() => {}), 2500);
    return true;
  } catch (e) {
    console.warn("Eagle synth failed:", e);
    return false;
  }
}

/* API principale */
export async function playEagleCry() {
  if (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }
  // 1) Tenta file precaricato (istantaneo)
  const ok = await playFile();
  if (ok) return;
  // 2) Fallback sintesi
  playSynth();
}
