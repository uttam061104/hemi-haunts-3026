// Procedural horror audio built with the Web Audio API (no external files).

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let ambientStarted = false;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setVolume(v: number) {
  const c = ac();
  if (c && master) master.gain.value = v;
}

function noiseBuffer(c: AudioContext, seconds: number) {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function env(c: AudioContext, gain: GainNode, peak: number, attack: number, decay: number) {
  const t = c.currentTime;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

export function playTone(
  freq: number,
  type: OscillatorType,
  dur: number,
  peak = 0.3,
  slideTo?: number,
) {
  const c = ac();
  if (!c || !master) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
  env(c, g, peak, 0.01, dur);
  osc.connect(g).connect(master);
  osc.start();
  osc.stop(c.currentTime + dur + 0.05);
}

function playNoise(dur: number, peak: number, filterFreq: number, q = 1) {
  const c = ac();
  if (!c || !master) return;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, Math.max(0.05, dur));
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = filterFreq;
  filter.Q.value = q;
  const g = c.createGain();
  env(c, g, peak, 0.005, dur);
  src.connect(filter).connect(g).connect(master);
  src.start();
  src.stop(c.currentTime + dur + 0.05);
}

export const sfx = {
  footstep() {
    playNoise(0.14, 0.12, 260 + Math.random() * 120, 1.2);
  },
  swing() {
    playNoise(0.22, 0.25, 900 + Math.random() * 400, 0.8);
  },
  hit() {
    playNoise(0.18, 0.35, 220, 1.5);
    playTone(90, "square", 0.12, 0.2, 50);
  },
  gunshot() {
    playNoise(0.3, 0.55, 1200, 0.6);
    playTone(120, "sawtooth", 0.18, 0.35, 40);
  },
  shotgun() {
    playNoise(0.45, 0.7, 700, 0.4);
    playTone(80, "sawtooth", 0.3, 0.4, 30);
  },
  dryFire() {
    playNoise(0.06, 0.2, 2400, 3);
  },
  ghostDeath() {
    playTone(420, "sine", 0.6, 0.25, 90);
    playNoise(0.4, 0.15, 500, 0.7);
  },
  hurt() {
    playTone(180, "square", 0.25, 0.3, 70);
    playNoise(0.2, 0.2, 300, 1);
  },
  heartbeat() {
    playTone(58, "sine", 0.16, 0.5, 40);
    window.setTimeout(() => playTone(52, "sine", 0.14, 0.35, 36), 170);
  },
  whisper() {
    playNoise(1.4, 0.09, 1500, 0.5);
    playTone(310, "sine", 1.2, 0.05, 220);
  },
  scream() {
    const c = ac();
    if (!c || !master) return;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(900, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, c.currentTime + 1.1);
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.frequency.value = 18;
    lfoGain.gain.value = 120;
    lfo.connect(lfoGain).connect(osc.frequency);
    env(c, g, 0.45, 0.02, 1.1);
    osc.connect(g).connect(master);
    osc.start();
    lfo.start();
    osc.stop(c.currentTime + 1.3);
    lfo.stop(c.currentTime + 1.3);
    playNoise(0.9, 0.3, 2000, 0.4);
  },
  unlock() {
    playTone(330, "triangle", 0.2, 0.25);
    window.setTimeout(() => playTone(495, "triangle", 0.3, 0.25), 130);
  },
  gameOver() {
    playTone(140, "sawtooth", 1.6, 0.3, 45);
  },
  win() {
    [330, 415, 494, 660].forEach((f, i) =>
      window.setTimeout(() => playTone(f, "triangle", 0.5, 0.22), i * 160),
    );
  },
};

export function startAmbient() {
  const c = ac();
  if (!c || !master || ambientStarted) return;
  ambientStarted = true;

  // wind bed
  const wind = c.createBufferSource();
  wind.buffer = noiseBuffer(c, 4);
  wind.loop = true;
  const windFilter = c.createBiquadFilter();
  windFilter.type = "lowpass";
  windFilter.frequency.value = 420;
  const windGain = c.createGain();
  windGain.gain.value = 0.09;
  wind.connect(windFilter).connect(windGain).connect(master);
  wind.start();

  // low dread drone
  const drone = c.createOscillator();
  drone.type = "sine";
  drone.frequency.value = 46;
  const droneGain = c.createGain();
  droneGain.gain.value = 0.07;
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.12;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 0.04;
  lfo.connect(lfoGain).connect(droneGain.gain);
  drone.connect(droneGain).connect(master);
  drone.start();
  lfo.start();
}

export function resumeAudio() {
  ac();
}
