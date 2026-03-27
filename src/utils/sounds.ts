// ─── Sound Generation using Web Audio API ────────────────────
// No external sound files needed - everything is synthesized

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.5) {
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

  gainNode.gain.setValueAtTime(volume, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + duration);
}

// ─── Match Sounds ─────────────────────────────────────────────

/** Long ascending tone - match is starting */
export function playStartSound() {
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = 'sawtooth';
  oscillator.frequency.setValueAtTime(400, ctx.currentTime);
  oscillator.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.5);

  gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
  gainNode.gain.setValueAtTime(0.4, ctx.currentTime + 0.8);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + 1.2);

  // Second tone for emphasis
  setTimeout(() => {
    playTone(880, 0.8, 'square', 0.3);
  }, 200);
}

/** Double beep - 30 seconds warning */
export function playWarningSound() {
  playTone(660, 0.2, 'square', 0.4);
  setTimeout(() => {
    playTone(660, 0.2, 'square', 0.4);
  }, 300);
  setTimeout(() => {
    playTone(880, 0.3, 'square', 0.3);
  }, 600);
}

/** Long buzzer - match ended */
export function playEndSound() {
  const ctx = getAudioContext();

  // Low buzzer
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sawtooth';
  osc1.frequency.setValueAtTime(200, ctx.currentTime);
  gain1.gain.setValueAtTime(0.4, ctx.currentTime);
  gain1.gain.setValueAtTime(0.4, ctx.currentTime + 1.5);
  gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.0);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(ctx.currentTime);
  osc1.stop(ctx.currentTime + 2.0);

  // Higher buzzer layered on top
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'square';
  osc2.frequency.setValueAtTime(350, ctx.currentTime);
  gain2.gain.setValueAtTime(0.25, ctx.currentTime);
  gain2.gain.setValueAtTime(0.25, ctx.currentTime + 1.5);
  gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.0);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(ctx.currentTime);
  osc2.stop(ctx.currentTime + 2.0);
}

/** Quick click sound for UI feedback */
export function playClickSound() {
  playTone(1000, 0.05, 'sine', 0.2);
}

/** Enable audio context on user interaction (needed for browsers) */
export function initAudio() {
  getAudioContext();
}
