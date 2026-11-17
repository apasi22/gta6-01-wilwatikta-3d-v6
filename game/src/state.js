// Game state: one mutable object the whole game reads and writes, plus the
// world constants, weapon and crew definitions, and the three save slots in
// localStorage. Nothing here touches the DOM or WebGL.

export const CFG = {
  roads: [-108, -72, -36, 0, 36, 72, 108],
  roadW: 10,
  city: 126,
  seaX: -150,
  blockC: [-90, -54, -18, 18, 54, 90],
};

export const DISTRICTS = [
  { id: 'segara', name: 'PELABUHAN SEGARA', color: '#3f7fbf', dark: 0x2e5f8f },
  { id: 'alun', name: 'ALUN-ALUN', color: '#6f7fe8', dark: 0x4a55a8 },
  { id: 'kidul', name: 'PANTAI KIDUL', color: '#3fbfa8', dark: 0x2e8f7d },
  { id: 'senja', name: 'PASAR SENJA', color: '#e07f3f', dark: 0xa85f2e },
  { id: 'batik', name: 'KAMPUNG BATIK', color: '#a86fd8', dark: 0x7d529f },
  { id: 'emas', name: 'LORONG EMAS', color: '#d8a83f', dark: 0x9f7d2e },
];

export function districtAt(x, z) {
  if (x < -72) return z > 54 ? DISTRICTS[0] : z < -54 ? DISTRICTS[4] : DISTRICTS[2];
  if (x < 36) return z < -54 ? DISTRICTS[4] : z > 54 ? DISTRICTS[3] : DISTRICTS[1];
  return DISTRICTS[5];
}

export const LEVELS = ['PEMULA', 'WHEELMAN', 'HUSTLER', 'FIXER', 'LEGENDA'];

export function freshWeapons() {
  return [
    { id: 'fist', name: 'TINJU', mag: Infinity, reserve: Infinity, magSize: Infinity, locked: false, damage: 25, rate: 0.45 },
    { id: 'pistol', name: 'PISTOL', mag: 12, reserve: 48, magSize: 12, locked: false, damage: 34, rate: 0.28 },
    { id: 'smg', name: 'SMG', mag: 30, reserve: 90, magSize: 30, locked: false, damage: 22, rate: 0.09 },
    { id: 'ar9', name: 'AR-9', mag: 24, reserve: 60, magSize: 24, locked: true, damage: 45, rate: 0.13 },
  ];
}

export function freshCrew() {
  return [
    { key: 'Z', name: 'AGUS', role: 'FIXER', desc: 'INFO DALAM', cost: 100, cd: 0, maxCd: 45 },
    { key: 'X', name: 'BAMBANG', role: 'MEKANIK', desc: 'SERVIS CEPAT', cost: 150, cd: 0, maxCd: 60 },
    { key: 'C', name: 'RATNA', role: 'PELARI', desc: 'JALUR TIKUS', cost: 200, cd: 0, maxCd: 75 },
  ];
}

export const G = {
  mode: 'title',
  prevMode: 'play',
  cash: 1250,
  health: 100,
  armor: 0,
  wanted: 0,
  heat: 0,
  rep: 0,
  clockMin: 18 * 60 + 36,
  day: 1,
  missionIdx: 0,
  done: [],
  weapons: freshWeapons(),
  weaponIdx: 2,
  reload: 0,
  crew: freshCrew(),
  car: { model: 'GARUDA GT', color: 0xd8342c, condition: 100, engine: 0, armorUp: 0, spoiler: true },
  player: { x: -108, z: 20, heading: Math.PI, speed: 0, onFoot: false, walk: 0, steer: 0 },
  stats: { kills: 0, stolen: 0, distance: 0, shots: 0 },
  radio: { station: 0, muted: false, track: 0 },
  dialogue: { who: '', role: '', text: '', until: 0 },
  dispatch: '',
  time: 0,
  shake: 0,
  missionTime: 0,
  bonus: 0,
  shotMode: false,
  shotName: '',
  seed: 1,
  frozen: false,
  frame: 0,
  message: '',
  messageUntil: 0,
};

export function levelTitle() {
  const i = Math.min(LEVELS.length - 1, Math.floor(G.rep / 400));
  return LEVELS[i];
}

export function storyPct() {
  return Math.round((G.done.length / 12) * 100);
}

export function newGame() {
  const keep = { shotMode: G.shotMode, shotName: G.shotName, seed: G.seed };
  Object.assign(G, {
    mode: 'play',
    cash: 1250,
    health: 100,
    armor: 0,
    wanted: 0,
    heat: 0,
    rep: 0,
    clockMin: 8 * 60,
    day: 1,
    missionIdx: 0,
    done: [],
    weapons: freshWeapons(),
    weaponIdx: 1,
    reload: 0,
    crew: freshCrew(),
    car: { model: 'GARUDA GT', color: 0xd8342c, condition: 100, engine: 0, armorUp: 0, spoiler: true },
    player: { x: -36, z: 54, heading: Math.PI / 2, speed: 0, onFoot: false, walk: 0, steer: 0 },
    stats: { kills: 0, stolen: 0, distance: 0, shots: 0 },
    radio: { station: 0, muted: false, track: 0 },
    dialogue: { who: '', role: '', text: '', until: 0 },
    dispatch: '',
    time: 0,
    shake: 0,
    missionTime: 0,
    bonus: 0,
    frozen: false,
    frame: 0,
    message: '',
    messageUntil: 0,
  });
  Object.assign(G, keep);
}

const SAVE_KEY = 'wilwatikta_save_';

export function saveGame(slot) {
  try {
    const data = {
      cash: G.cash,
      health: G.health,
      armor: G.armor,
      rep: G.rep,
      clockMin: G.clockMin,
      day: G.day,
      missionIdx: G.missionIdx,
      done: G.done,
      weapons: G.weapons.map((w) => ({ mag: w.mag, reserve: w.reserve, locked: w.locked })),
      car: G.car,
      stats: G.stats,
      player: { x: G.player.x, z: G.player.z, heading: G.player.heading },
    };
    localStorage.setItem(SAVE_KEY + slot, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame(slot) {
  try {
    const raw = localStorage.getItem(SAVE_KEY + slot);
    if (!raw) return false;
    const d = JSON.parse(raw);
    newGame();
    G.cash = d.cash;
    G.health = d.health;
    G.armor = d.armor;
    G.rep = d.rep;
    G.clockMin = d.clockMin;
    G.day = d.day;
    G.missionIdx = d.missionIdx;
    G.done = d.done || [];
    d.weapons.forEach((w, i) => Object.assign(G.weapons[i], w));
    Object.assign(G.car, d.car);
    Object.assign(G.stats, d.stats);
    Object.assign(G.player, d.player);
    G.mode = 'play';
    return true;
  } catch (e) {
    return false;
  }
}

export function hasSave(slot) {
  try {
    return !!localStorage.getItem(SAVE_KEY + slot);
  } catch (e) {
    return false;
  }
}

export function saveSummary(slot) {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY + slot));
    return d ? `Misi ${d.missionIdx + 1}/12 · $${d.cash} · Hari ${d.day}` : '';
  } catch (e) {
    return '';
  }
}
