// Wilwatikta itself: a procedural coastal city on a seven-by-seven road
// grid, with a beach and sea to the west, six named districts, windowed
// facades on ALL FOUR faces of every building (no blank walls from any
// angle), palms, props, boats, a plaza, and a fog-faded skyline ring. Two
// merged buffers come out: opaque geometry and one translucent buffer for
// shadows, puddles and sun streaks. Collision boxes are recorded as the
// buildings go up.

import { Rng } from './rng.js';
import { Mesh, col } from './mesh.js';
import { CFG, districtAt } from './state.js';

const FACADES = {
  segara: [0x5e6e7e, 0x4e5e6e, 0x6e7e8e, 0x3e4e5e],
  alun: [0x8e7e6e, 0x7e6e5e, 0x9e8e7e, 0x6e5e4e],
  kidul: [0xe8d8b8, 0xd8c8a8, 0xf0e0c0, 0xc8b898],
  senja: [0xb87e5e, 0xa86e4e, 0xc88e6e, 0x9e5e3e],
  batik: [0x7e6e8e, 0x6e5e7e, 0x8e7e9e, 0x5e4e6e],
  emas: [0xd8b878, 0xc8a868, 0xe8c888, 0xb89858],
};

const HEIGHTS = {
  segara: [6, 12],
  alun: [12, 30],
  kidul: [6, 14],
  senja: [5, 10],
  batik: [8, 18],
  emas: [14, 34],
};

const SIGNS = [0xff4e6e, 0x2ee8c8, 0xffc83e, 0x7ee82e, 0xff8e2e, 0xe84eff];

// Window grids on all four faces of a building. Lit windows glow warm;
// dark ones stay deep blue. Ground-floor storefront bands replace the
// lowest row on low buildings.
function addWindows(m, cx, cz, w, d, h, baseY, rng, district) {
  const faces = [
    { n: [0, 0, 1], along: 'x', off: d / 2 + 0.07, fixed: cz + d / 2 + 0.07 },
    { n: [0, 0, -1], along: 'x', off: -(d / 2 + 0.07), fixed: cz - d / 2 - 0.07 },
    { n: [1, 0, 0], along: 'z', off: w / 2 + 0.07, fixed: cx + w / 2 + 0.07 },
    { n: [-1, 0, 0], along: 'z', off: -(w / 2 + 0.07), fixed: cx - w / 2 - 0.07 },
  ];
  const litChance = district === 'emas' ? 0.6 : 0.55;
  for (const f of faces) {
    const span = f.along === 'x' ? w : d;
    const cols = Math.max(1, Math.floor((span - 2.4) / 2.6));
    const rows = Math.max(1, Math.floor((h - 3.2) / 2.6));
    const stepA = (span - 2.4) / cols;
    const stepY = (h - 3.2) / rows;
    const ww = Math.min(1.5, stepA * 0.58);
    const wh = Math.min(1.15, stepY * 0.55);
    for (let ci = 0; ci < cols; ci++) {
      for (let ri = 0; ri < rows; ri++) {
        const a = -(span / 2) + 1.2 + stepA * (ci + 0.5);
        const y = baseY + 3.0 + stepY * (ri + 0.5);
        const lit = rng.chance(litChance);
        const c = lit ? col(0xffc878, 1) : col(0x4a5a72, 1);
        const g = lit ? 0.9 : 0.05;
        const hw = ww / 2;
        const hh = wh / 2;
        if (f.along === 'x') {
          const x = cx + a;
          const z = f.fixed;
          m.quad([x - hw, y - hh, z], [x + hw, y - hh, z], [x + hw, y + hh, z], [x - hw, y + hh, z], f.n, c, g);
        } else {
          const z = cz + a;
          const x = f.fixed;
          m.quad([x, y - hh, z - hw], [x, y - hh, z + hw], [x, y + hh, z + hw], [x, y + hh, z - hw], f.n, c, g);
        }
      }
    }
  }
}

function addPalm(m, t, x, z, rng, tall) {
  const h = tall ? rng.range(8, 11) : rng.range(6, 8.5);
  const lean = rng.range(0.2, 0.6);
  const leanA = rng.range(0, Math.PI * 2);
  const lx = Math.cos(leanA) * lean;
  const lz = Math.sin(leanA) * lean;
  const trunk = col(0x7a5230);
  m.prism(x, 0, z, 0.34, h * 0.6, 6, trunk, 0, 0.28);
  m.prism(x + lx * 0.5, h * 0.6, z + lz * 0.5, 0.28, h * 0.4, 6, trunk, 0, 0.2);
  const tx = x + lx;
  const tz = z + lz;
  const fronds = 7;
  for (let i = 0; i < fronds; i++) {
    const a = (i / fronds) * Math.PI * 2 + rng.range(-0.15, 0.15);
    const c = i % 2 ? col(0x2e8f4e) : col(0x38a85c);
    m.frond(tx, h, tz, a, rng.range(3.0, 3.9), 0.95, rng.range(1.2, 2.0), c);
  }
  m.cone(tx, h - 0.2, tz, 0.55, 0.8, 6, col(0x2e7e46));
  for (let i = 0; i < 3; i++) {
    const a = rng.range(0, Math.PI * 2);
    m.prism(tx + Math.cos(a) * 0.4, h - 0.5, tz + Math.sin(a) * 0.4, 0.22, 0.3, 5, col(0x5e4028));
  }
  // Long dusk shadow stretching east, away from the sea sun.
  t.quad([x, 0.36, z - 0.8], [x + 7, 0.36, z - 0.8], [x + 7, 0.36, z + 0.8], [x, 0.36, z + 0.8], [0, 1, 0], col(0x000000, 0.22));
}

function addBuilding(m, t, rng, cx, cz, w, d, district, colliders) {
  const [hMin, hMax] = HEIGHTS[district];
  const centerBoost = district === 'alun' ? Math.max(0, 12 - Math.hypot(cx, cz) * 0.12) : 0;
  const h = rng.range(hMin, hMax) + centerBoost;
  const facade = col(rng.pick(FACADES[district]));
  const roof = col(0x3a3a42);
  m.box(cx, h / 2, cz, w, h, d, facade, 0, roof);
  // Cornice slab at the roof line.
  m.box(cx, h + 0.25, cz, w + 0.7, 0.5, d + 0.7, col(0x4a4a52));
  addWindows(m, cx, cz, w, d, h, 0, rng, district);
  // Storefront band + one SMALL neon sign on low buildings.
  if (h < 13) {
    const band = col(rng.pick(SIGNS), 1);
    const y = 1.4;
    m.quad([cx - w / 2, y - 1, cz + d / 2 + 0.08], [cx + w / 2, y - 1, cz + d / 2 + 0.08], [cx + w / 2, y + 1, cz + d / 2 + 0.08], [cx - w / 2, y + 1, cz + d / 2 + 0.08], [0, 0, 1], band, 0.55);
    const face = rng.int(0, 3);
    const sign = col(rng.pick(SIGNS));
    const sw = rng.range(3, 5);
    if (face === 0) m.box(cx, 3.4, cz + d / 2 + 0.4, sw, 1.1, 0.5, sign, 1.2);
    else if (face === 1) m.box(cx, 3.4, cz - d / 2 - 0.4, sw, 1.1, 0.5, sign, 1.2);
    else if (face === 2) m.box(cx + w / 2 + 0.4, 3.4, cz, 0.5, 1.1, sw, sign, 1.2);
    else m.box(cx - w / 2 - 0.4, 3.4, cz, 0.5, 1.1, sw, sign, 1.2);
  }
  // Balcony slabs on tall buildings.
  if (h > 18) {
    const n = rng.int(2, 4);
    for (let i = 0; i < n; i++) {
      const y = rng.range(6, h - 3);
      const side = rng.chance(0.5);
      if (side) m.box(cx + rng.sign() * (w / 2 + 0.5), y, cz + rng.range(-d / 4, d / 4), 1.1, 0.3, rng.range(2, 4), col(0x55555e));
      else m.box(cx + rng.range(-w / 4, w / 4), y, cz + rng.sign() * (d / 2 + 0.5), rng.range(2, 4), 0.3, 1.1, col(0x55555e));
    }
  }
  // Rooftop clutter: AC boxes, an antenna, sometimes a water tower.
  const clutter = rng.int(1, 3);
  for (let i = 0; i < clutter; i++) {
    m.box(cx + rng.range(-w / 4, w / 4), h + 0.9, cz + rng.range(-d / 4, d / 4), rng.range(1, 2), 1.2, rng.range(1, 2), col(0x8a8a92));
  }
  if (rng.chance(0.5)) m.prism(cx + rng.range(-w / 3, w / 3), h + 0.5, cz + rng.range(-d / 3, d / 3), 0.08, rng.range(3, 6), 4, col(0x222222));
  if (rng.chance(0.15)) {
    const tx = cx + rng.range(-w / 4, w / 4);
    const tz = cz + rng.range(-d / 4, d / 4);
    m.prism(tx, h + 0.5, tz, 1.4, 2.2, 8, col(0x7e6e5e));
    m.cone(tx, h + 2.7, tz, 1.7, 1.2, 8, col(0x5e4e3e));
  }
  // Fake long shadow eastward.
  const shLen = Math.min(26, h * 1.5);
  t.quad([cx + w / 2, 0.36, cz - d / 2], [cx + w / 2 + shLen, 0.36, cz - d / 2], [cx + w / 2 + shLen, 0.36, cz + d / 2], [cx + w / 2, 0.36, cz + d / 2], [0, 1, 0], col(0x000000, 0.26));
  colliders.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 });
}

export function buildCity(seed) {
  const rng = new Rng(seed);
  const m = new Mesh();
  const t = new Mesh();
  const colliders = [];
  const pedSpawns = [];
  const parkSpots = [];

  // Ground, sea and sand.
  m.quad([-500, -0.2, -500], [500, -0.2, -500], [500, -0.2, 500], [-500, -0.2, 500], [0, 1, 0], col(0x23232a));
  m.quad([-520, -0.5, -450], [-150, -0.5, -450], [-150, -0.5, 450], [-520, -0.5, 450], [0, 1, 0], col(0x1d4e6e), 0.3);
  m.quad([-150, 0, -170], [-126, 0, -170], [-126, 0, 170], [-150, 0, 170], [0, 1, 0], col(0xd9b380), 0.04);
  // Sun streaks on the water.
  for (let i = 0; i < 9; i++) {
    const z = rng.range(-130, 130);
    const x0 = rng.range(-320, -180);
    const len = rng.range(30, 90);
    t.quad([x0, -0.35, z - 1.5], [x0 + len, -0.35, z - 1.5], [x0 + len, -0.35, z + 1.5], [x0, -0.35, z + 1.5], [0, 1, 0], col(0xffb060, 0.4), 0.7);
  }

  // Roads: asphalt strips plus dashed center lines, both directions.
  for (const r of CFG.roads) {
    m.quad([r - 5, 0.02, -140], [r + 5, 0.02, -140], [r + 5, 0.02, 140], [r - 5, 0.02, 140], [0, 1, 0], col(0x2e2e34));
    m.quad([-140, 0.02, r - 5], [140, 0.02, r - 5], [140, 0.02, r + 5], [-140, 0.02, r + 5], [0, 1, 0], col(0x2e2e34));
    for (let s = -132; s < 132; s += 8) {
      m.quad([r - 0.25, 0.06, s], [r + 0.25, 0.06, s], [r + 0.25, 0.06, s + 3.4], [r - 0.25, 0.06, s + 3.4], [0, 1, 0], col(0xcfc06a), 0.12);
      m.quad([s, 0.06, r - 0.25], [s + 3.4, 0.06, r - 0.25], [s + 3.4, 0.06, r + 0.25], [s, 0.06, r + 0.25], [0, 1, 0], col(0xcfc06a), 0.12);
    }
    // Wet-road puddles catching the sunset.
    for (let i = 0; i < 7; i++) {
      const s = rng.range(-130, 130);
      const w = rng.range(1.5, 3.5);
      t.quad([r - w / 2, 0.08, s], [r + w / 2, 0.08, s], [r + w / 2, 0.08, s + w * 2], [r - w / 2, 0.08, s + w * 2], [0, 1, 0], col(0xff9a50, 0.5), 0.55);
    }
  }
  // Crosswalk stripes at every intersection.
  for (const rx of CFG.roads) {
    for (const rz of CFG.roads) {
      for (let i = 0; i < 5; i++) {
        const o = -4 + i * 2;
        m.quad([rx + o - 0.7, 0.06, rz - 7.5], [rx + o + 0.7, 0.06, rz - 7.5], [rx + o + 0.7, 0.06, rz - 4.5], [rx + o - 0.7, 0.06, rz - 4.5], [0, 1, 0], col(0xd8d8d8), 0.1);
      }
    }
  }

  // Blocks: sidewalks, buildings, palms, shrubs. The (18,-18) block is the
  // Alun-Alun plaza; the (18,54) block holds the garage.
  for (const bx of CFG.blockC) {
    for (const bz of CFG.blockC) {
      const district = districtAt(bx, bz).id;
      m.box(bx, 0.15, bz, 26, 0.3, 26, col(0x6a6a70), 0, col(0x8f8f96));
      if (bx === 18 && bz === -18) {
        // Plaza: fountain, palms, benches, no buildings.
        m.prism(bx, 0.3, bz, 4.5, 0.8, 12, col(0x9a9aa2));
        m.disc(bx, 1.15, bz, 3.8, 12, col(0x4e9ec8), 0.5);
        m.prism(bx, 1.1, bz, 0.5, 2.2, 6, col(0xb8b8c0));
        m.disc(bx, 3.3, bz, 1.6, 8, col(0x7ec8e8), 0.6);
        colliders.push({ x0: bx - 4.5, x1: bx + 4.5, z0: bz - 4.5, z1: bz + 4.5 });
        for (const [ox, oz] of [[-9, -9], [9, -9], [-9, 9], [9, 9]]) addPalm(m, t, bx + ox, bz + oz, rng, true);
        for (let i = 0; i < 4; i++) m.box(bx + rng.range(-9, 9), 0.75, bz + rng.range(-9, 9), 2.2, 0.9, 0.8, col(0x7e5e3e));
        pedSpawns.push({ x: bx, z: bz + 8, roam: 10 });
        continue;
      }
      if (bx === 18 && bz === 54) {
        // Bengkel Bambang: big low garage with an open front and a sign.
        m.box(bx, 3.3, bz, 22, 6, 15, col(0x8e4e2e), 0, col(0x3a3a42));
        m.box(bx, 2.2, bz + 7.6, 12, 4.4, 0.4, col(0x14141a), 0.1);
        m.box(bx, 5.6, bz + 7.8, 9, 1.3, 0.5, col(0xff8e2e), 1.2);
        for (let i = 0; i < 8; i++) {
          m.quad([bx - 11 + i * 2.75, 0.4, bz + 7.55], [bx - 11 + (i + 1) * 2.75, 0.4, bz + 7.55], [bx - 11 + (i + 1) * 2.75, 1.2, bz + 7.55], [bx - 11 + i * 2.75, 1.2, bz + 7.55], [0, 0, 1], i % 2 ? col(0x141414) : col(0xe8e8e8), 0.1);
        }
        addWindows(m, bx, bz, 22, 15, 6, 0, rng, district);
        colliders.push({ x0: bx - 11, x1: bx + 11, z0: bz - 7.5, z1: bz + 7.5 });
        pedSpawns.push({ x: bx - 8, z: bz + 10, roam: 6 });
        continue;
      }
      // 2x2 cells, 1-3 buildings per block.
      const cells = [[-6.5, -6.5], [6.5, -6.5], [-6.5, 6.5], [6.5, 6.5]];
      const n = rng.int(1, 3);
      const order = [0, 1, 2, 3].sort(() => rng.float() - 0.5);
      for (let i = 0; i < n; i++) {
        const [ox, oz] = cells[order[i]];
        addBuilding(m, t, rng, bx + ox, bz + oz, rng.range(9, 12), rng.range(9, 12), district, colliders);
      }
      // Block-edge palms and shrubs.
      for (let i = 0; i < 4; i++) {
        if (rng.chance(0.55)) {
          const a = rng.int(0, 3);
          const ex = a === 0 ? -12 : a === 1 ? 12 : rng.range(-11, 11);
          const ez = a === 2 ? -12 : a === 3 ? 12 : rng.range(-11, 11);
          addPalm(m, t, bx + ex, bz + ez, rng, false);
        }
        if (rng.chance(0.6)) {
          m.cone(bx + rng.range(-11, 11), 0.3, bz + rng.range(-11, 11), rng.range(0.6, 1), rng.range(0.8, 1.4), 6, col(0x2e6e3e));
        }
      }
      pedSpawns.push({ x: bx + rng.range(-8, 8), z: bz + rng.range(-8, 8), roam: 11 });
    }
  }

  // Beach palms, umbrellas and towels along the sand strip.
  for (let z = -150; z < 155; z += rng.range(9, 15)) {
    addPalm(m, t, rng.range(-146, -132), z + rng.range(-3, 3), rng, true);
  }
  const umbrellaCols = [0xff4e6e, 0x2ee8c8, 0xffc83e, 0x7ee82e, 0xe84eff, 0xff8e2e];
  for (let i = 0; i < 14; i++) {
    const x = rng.range(-146, -130);
    const z = rng.range(-140, 140);
    const c = col(umbrellaCols[i % umbrellaCols.length]);
    m.prism(x, 0, z, 0.09, 2.6, 4, col(0xd8d8d8));
    m.cone(x, 2.6, z, 2.3, 1.0, 8, c);
    m.quad([x + 1.5, 0.05, z - 0.8], [x + 3.4, 0.05, z - 0.8], [x + 3.4, 0.05, z + 0.8], [x + 1.5, 0.05, z + 0.8], [0, 1, 0], col(umbrellaCols[(i + 3) % umbrellaCols.length]));
    pedSpawns.push({ x: x + 2.4, z, roam: 2.5 });
  }

  // Street lamps at alternating intersections, with warm ground pools.
  let lampFlip = false;
  for (const rx of CFG.roads) {
    for (const rz of CFG.roads) {
      lampFlip = !lampFlip;
      if (!lampFlip) continue;
      const x = rx + 6;
      const z = rz + 6;
      m.prism(x, 0, z, 0.12, 5.2, 5, col(0x222226));
      m.box(x, 5.4, z, 0.7, 0.35, 0.7, col(0xffe8a8), 1.4);
      t.disc(x, 0.1, z, 3.2, 10, col(0xffc878, 0.22), 0.5);
    }
  }

  // Boats off the docks.
  for (let i = 0; i < 4; i++) {
    const x = rng.range(-210, -165);
    const z = rng.range(60, 125);
    m.box(x, -0.1, z, 7, 1.6, 2.6, col(0x7e3e2e), 0, col(0x9e5e3e));
    m.box(x - 1, 1.0, z, 2.4, 1.4, 2.0, col(0xe8e0d0));
    m.prism(x + 2.4, 0.7, z, 0.09, 4.5, 4, col(0x5e4e3e));
  }

  // Parked cars along curbs (positions only — vehicles.js builds them).
  for (let i = 0; i < 20; i++) {
    const horizontal = rng.chance(0.5);
    const road = rng.pick(CFG.roads);
    const along = rng.range(-120, 120);
    const side = rng.sign() * 6.4;
    parkSpots.push(
      horizontal
        ? { x: along, z: road + side, heading: side > 0 ? 0 : Math.PI }
        : { x: road + side, z: along, heading: side > 0 ? Math.PI / 2 : -Math.PI / 2 },
    );
  }

  // Distant skyline ring and western mountains, fog-faded for depth.
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2 + rng.range(-0.05, 0.05);
    const r = rng.range(250, 330);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (x < -200) continue; // the sea horizon stays open
    const w = rng.range(16, 30);
    const h = rng.range(30, 72);
    m.box(x, h / 2 - 2, z, w, h, w, col(rng.pick([0x4a3a5e, 0x5e4a6e, 0x3e324e, 0x56406a])));
  }
  for (let i = 0; i < 8; i++) {
    const x = rng.range(-360, -270);
    const z = rng.range(-230, 230);
    m.cone(x, -2, z, rng.range(40, 70), rng.range(50, 95), 7, col(0x6e4a5e));
  }
  for (let i = 0; i < 6; i++) {
    const z = rng.sign() * rng.range(260, 330);
    m.cone(rng.range(-120, 200), -2, z, rng.range(50, 80), rng.range(35, 60), 7, col(0x5e4456));
  }

  return {
    opaque: m.toArray(),
    trans: t.toArray(),
    colliders,
    pedSpawns,
    parkSpots,
    garage: { x: 18, z: 54 },
    plaza: { x: 18, z: -18 },
  };
}
