// Sound: synthesized WebAudio only — no audio files, no network. Two
// radio stations play step-sequenced loops (a gamelan station and a dangdut
// station), and engine, siren, gunshot, punch, crash, horn and pickup sounds
// are oscillators and filtered noise. Everything stays silent until the
// first key or click, as browsers require.

const SCALES = {
  slendro: [0, 2, 4, 7, 9],
  dangdut: [0, 2, 3, 5, 7, 8, 10],
};

export const STATIONS = [
  {
    name: 'GAMELAN FM 101.1',
    tempo: 96,
    scale: SCALES.slendro,
    root: 220,
    tracks: [
      { title: 'Bonang Malam', mel: '1..3.5..32..1..3.5..4...', bass: '1.......5.......' },
      { title: 'Gending Senja', mel: '..2.4..3.1..2.4..5.3..', bass: '1.....3.....5...' },
      { title: 'Kembang Api', mel: '5.4.3.2.1.2.3.4.5.4.3.2.', bass: '1...1...5...5...' },
    ],
  },
  {
    name: 'RADIO WILWATIKTA 88.4',
    tempo: 112,
    scale: SCALES.dangdut,
    root: 174,
    tracks: [
      { title: 'Joget Pantai', mel: '1.2.3..5.3.2.1.2.3..5..', bass: '1.1...1.1...5.5...' },
      { title: 'Kereta Malam', mel: '..5..3..2..1..2..3..5.', bass: '1.....1.....4...' },
      { title: 'Rindu Segara', mel: '3...5...6...5...3...2.', bass: '1.......6.......' },
    ],
  },
];

let ctx = null;
let master = null;
let musicBus = null;
let noiseBuf = null;
let step = 0;
let nextTime = 0;
let timer = null;
let engineNodes = null;
let sirenNodes = null;

function freq(root, scale, degree, octave) {
  const d = scale[(degree - 1) % scale.length];
  const o = octave + Math.floor((degree - 1) / scale.length);
  return root * Math.pow(2, d / 12 + o);
}

function tone(at, dur, f, type, gain, dest) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = f;
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.001, at + dur);
  o.connect(g);
  g.connect(dest || master);
  o.start(at);
  o.stop(at + dur + 0.05);
}

function noise(at, dur, gain, filterFreq) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = filterFreq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.001, at + dur);
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(at);
  src.stop(at + dur + 0.05);
}

function scheduleStep(i, at, station, track) {
  const mel = track.mel[i % track.mel.length];
  const bass = track.bass[i % track.bass.length];
  if (mel !== '.') {
    const d = parseInt(mel, 10);
    tone(at, 0.32, freq(station.root, station.scale, d, 1), 'sine', 0.16, musicBus);
    tone(at, 0.2, freq(station.root, station.scale, d, 2), 'triangle', 0.05, musicBus);
  }
  if (bass !== '.') {
    tone(at, 0.4, freq(station.root, station.scale, parseInt(bass, 10), -1), 'triangle', 0.2, musicBus);
  }
  if (i % 16 === 0) tone(at, 1.6, station.root / 2, 'sine', 0.14, musicBus);
  if (i % 4 === 2) noise(at, 0.05, 0.05, 3000);
}

function tick() {
  if (!ctx) return;
  const st = STATIONS[AudioSys.station];
  const track = st.tracks[AudioSys.track];
  const stepDur = 60 / st.tempo / 2;
  while (nextTime < ctx.currentTime + 0.15) {
    scheduleStep(step, nextTime, st, track);
    step = (step + 1) % 32;
    nextTime += stepDur;
  }
}

export const AudioSys = {
  station: 0,
  track: 0,
  muted: false,
  started: false,
  init() {
    if (ctx || typeof window === 'undefined') return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      return;
    }
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.8;
    musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    nextTime = ctx.currentTime + 0.1;
    timer = setInterval(tick, 40);
    this.started = true;
  },
  setStation(i) {
    this.station = i % STATIONS.length;
    this.track = 0;
    step = 0;
  },
  nextTrack() {
    const st = STATIONS[this.station];
    this.track = (this.track + 1) % st.tracks.length;
    step = 0;
  },
  nextStation() {
    this.setStation(this.station + 1);
  },
  trackName() {
    return STATIONS[this.station].tracks[this.track].title;
  },
  stationName() {
    return STATIONS[this.station].name;
  },
  setMuted(m) {
    this.muted = m;
    if (master) master.gain.value = m ? 0 : 0.7;
  },
  sfx(name) {
    if (!ctx || this.muted) return;
    const t = ctx.currentTime;
    if (name === 'shot') {
      noise(t, 0.12, 0.5, 2500);
      tone(t, 0.08, 160, 'square', 0.2);
    } else if (name === 'punch') {
      noise(t, 0.09, 0.35, 500);
    } else if (name === 'pickup') {
      tone(t, 0.12, 660, 'sine', 0.25);
      tone(t + 0.09, 0.16, 990, 'sine', 0.25);
    } else if (name === 'crash') {
      noise(t, 0.25, 0.5, 400);
      tone(t, 0.2, 70, 'sine', 0.4);
    } else if (name === 'horn') {
      tone(t, 0.28, 220, 'square', 0.14);
      tone(t, 0.28, 277, 'square', 0.14);
    } else if (name === 'pass') {
      tone(t, 0.14, 523, 'sine', 0.25);
      tone(t + 0.12, 0.14, 659, 'sine', 0.25);
      tone(t + 0.24, 0.3, 784, 'sine', 0.3);
    } else if (name === 'busted') {
      tone(t, 0.5, 220, 'sawtooth', 0.2);
      tone(t + 0.4, 0.5, 174, 'sawtooth', 0.2);
    }
  },
  setEngine(speed, throttle) {
    if (!ctx) return;
    if (!engineNodes) {
      const o = ctx.createOscillator();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      f.type = 'lowpass';
      f.frequency.value = 500;
      g.gain.value = 0;
      o.connect(f);
      f.connect(g);
      g.connect(master);
      o.start();
      engineNodes = { o, g };
    }
    const target = throttle ? 0.05 + Math.min(0.08, speed * 0.002) : 0.02;
    engineNodes.g.gain.setTargetAtTime(this.muted ? 0 : target, ctx.currentTime, 0.1);
    engineNodes.o.frequency.setTargetAtTime(55 + Math.abs(speed) * 3.2, ctx.currentTime, 0.08);
  },
  setSiren(on) {
    if (!ctx) return;
    if (on && !sirenNodes) {
      const o = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = 750;
      lfo.frequency.value = 1.4;
      lg.gain.value = 110;
      lfo.connect(lg);
      lg.connect(o.frequency);
      g.gain.value = 0.045;
      o.connect(g);
      g.connect(master);
      o.start();
      lfo.start();
      sirenNodes = { o, lfo, g };
    } else if (!on && sirenNodes) {
      try {
        sirenNodes.o.stop();
        sirenNodes.lfo.stop();
      } catch (e) {}
      sirenNodes = null;
    }
    if (sirenNodes) sirenNodes.g.gain.value = this.muted ? 0 : 0.045;
  },
  // Deterministic-ish EQ level for the radio widget bars.
  eqLevel(band, time) {
    return 0.25 + 0.55 * Math.abs(Math.sin(time * (2.1 + band * 0.7) + band * 1.7));
  },
};
