// Time-of-day palettes. All sunset parameters live in one place: sky
// gradient stops, fog, sun direction and tint, ambient floor and the glow
// boost that makes windows and neon come alive after dark. The in-game clock
// interpolates between the day, dusk and night presets.

import { lerp, lerp3 } from './mat.js';

const DAY = {
  skyTop: [0.22, 0.46, 0.84],
  skyMid: [0.52, 0.72, 0.94],
  skyBot: [0.96, 0.86, 0.7],
  fog: [0.86, 0.8, 0.72],
  fogNear: 120,
  fogFar: 430,
  sunDir: [-0.5, 0.74, 0.24],
  sunCol: [1.0, 0.94, 0.84],
  ambient: 0.56,
  glowBoost: 0.4,
};

const DUSK = {
  skyTop: [0.48, 0.24, 0.5],
  skyMid: [0.95, 0.45, 0.42],
  skyBot: [1.0, 0.6, 0.3],
  fog: [0.93, 0.55, 0.42],
  fogNear: 90,
  fogFar: 380,
  sunDir: [-0.88, 0.2, -0.3],
  sunCol: [1.0, 0.55, 0.3],
  ambient: 0.38,
  glowBoost: 1.0,
};

const NIGHT = {
  skyTop: [0.02, 0.03, 0.1],
  skyMid: [0.06, 0.08, 0.2],
  skyBot: [0.13, 0.12, 0.26],
  fog: [0.08, 0.09, 0.16],
  fogNear: 70,
  fogFar: 300,
  sunDir: [0.4, 0.55, -0.35],
  sunCol: [0.5, 0.6, 0.9],
  ambient: 0.3,
  glowBoost: 1.7,
};

function smooth(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function blend(a, b, t) {
  return {
    skyTop: lerp3(a.skyTop, b.skyTop, t),
    skyMid: lerp3(a.skyMid, b.skyMid, t),
    skyBot: lerp3(a.skyBot, b.skyBot, t),
    fog: lerp3(a.fog, b.fog, t),
    fogNear: lerp(a.fogNear, b.fogNear, t),
    fogFar: lerp(a.fogFar, b.fogFar, t),
    sunDir: lerp3(a.sunDir, b.sunDir, t),
    sunCol: lerp3(a.sunCol, b.sunCol, t),
    ambient: lerp(a.ambient, b.ambient, t),
    glowBoost: lerp(a.glowBoost, b.glowBoost, t),
  };
}

// clockMin: minutes since midnight. Dusk peaks at 18:30; night owns 21:00
// to 05:00; the rest is day with soft transitions at both ends.
export function paletteAt(clockMin) {
  const h = ((clockMin / 60) % 24 + 24) % 24;
  const duskF = smooth(16.5, 18.2, h) * (1 - smooth(19.2, 20.6, h));
  const nightF = smooth(19.6, 21.0, h) + (1 - smooth(5.0, 6.6, h)) * (h < 12 ? 1 : 0);
  const night = Math.max(0, Math.min(1, nightF));
  const base = blend(DAY, DUSK, duskF);
  return blend(base, NIGHT, night);
}
