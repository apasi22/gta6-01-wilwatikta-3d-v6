// Vehicles: procedural low-poly meshes built from boxes, wedges and
// cylinders. Local frame: forward is +Z, up is +Y. The hero car is a sleek
// low coupe with a sloped nose, a big glass canopy, flared arches, a spoiler
// and a rear light bar; the police helicopter is a detailed rounded
// fuselage with a glass cockpit, white belly, skids and a four-blade rotor.

import { Mesh, col } from './mesh.js';

const GLASS = 0x2e4258;
const TYRE = 0x151515;
const HUB = 0xb8bcc0;

function wheels(m, y, front, rear, halfW, r) {
  for (const z of [front, rear]) {
    for (const s of [-1, 1]) {
      m.cylX(s * halfW, y, z, r, 0.3, 10, col(TYRE));
      m.cylX(s * halfW, y, z, r * 0.45, 0.34, 8, col(HUB));
    }
  }
}

// Sloped nose wedge: top surface falling from (z0, yTop) to (z1, yLow),
// plus the small vertical front face and side triangles.
function noseWedge(m, w, z0, yTop, z1, yLow, yBot, color) {
  const hw = w / 2;
  m.quad([-hw, yTop, z0], [hw, yTop, z0], [hw, yLow, z1], [-hw, yLow, z1], [0, 0.8, 0.6], color);
  m.quad([-hw, yBot, z1], [hw, yBot, z1], [hw, yLow, z1], [-hw, yLow, z1], [0, 0, 1], color);
  for (const s of [-1, 1]) {
    m.tri([s * hw, yTop, z0], [s * hw, yLow, z1], [s * hw, yBot, z1], [s, 0, 0], color);
    m.tri([s * hw, yTop, z0], [s * hw, yBot, z1], [s * hw, yBot, z0], [s, 0, 0], color);
  }
}

export function buildHeroCar(colorHex) {
  const m = new Mesh();
  const body = col(colorHex);
  const dark = col(0x1a1a1e);
  // Low main body and sloped nose.
  m.box(0, 0.42, -0.3, 1.9, 0.5, 3.6, body);
  noseWedge(m, 1.9, 1.3, 0.67, 2.2, 0.34, 0.17, body);
  // Big glass canopy with sloped windshield and rear window.
  m.box(0, 0.82, -0.4, 1.5, 0.42, 1.7, col(GLASS), 0.3);
  m.quad([-0.72, 0.67, 0.55], [0.72, 0.67, 0.55], [0.72, 1.02, -0.05], [-0.72, 1.02, -0.05], [0, 0.6, 0.8], col(GLASS), 0.35);
  m.quad([-0.72, 1.02, -0.75], [0.72, 1.02, -0.75], [0.72, 0.67, -1.3], [-0.72, 0.67, -1.3], [0, 0.6, -0.8], col(GLASS), 0.35);
  // Flared arches, skirts, mirrors.
  for (const z of [1.45, -1.45]) {
    for (const s of [-1, 1]) m.box(s * 0.86, 0.58, z, 0.42, 0.3, 1.05, body);
  }
  for (const s of [-1, 1]) {
    m.box(s * 0.94, 0.26, 0, 0.14, 0.2, 3.2, dark);
    m.box(s * 1.02, 0.78, 0.5, 0.14, 0.12, 0.24, body);
  }
  // Spoiler, rear light bar, headlights, grille.
  m.box(-0.6, 0.78, -2.0, 0.12, 0.26, 0.3, dark);
  m.box(0.6, 0.78, -2.0, 0.12, 0.26, 0.3, dark);
  m.box(0, 0.94, -2.05, 1.8, 0.09, 0.5, dark);
  m.box(0, 0.56, -2.11, 1.62, 0.14, 0.06, col(0xff2a30), 1.5);
  m.box(-0.55, 0.4, 2.19, 0.5, 0.13, 0.06, col(0xfff2c8), 1.5);
  m.box(0.55, 0.4, 2.19, 0.5, 0.13, 0.06, col(0xfff2c8), 1.5);
  m.box(0, 0.28, 2.2, 0.9, 0.12, 0.05, dark);
  wheels(m, 0.35, 1.45, -1.45, 0.88, 0.35);
  return m.toArray();
}

export function buildSedan(colorHex, taxi) {
  const m = new Mesh();
  const body = col(colorHex);
  const dark = col(0x1a1a1e);
  m.box(0, 0.5, 0, 1.85, 0.62, 4.3, body);
  m.box(0, 1.02, -0.3, 1.6, 0.55, 2.0, col(GLASS), 0.25);
  m.box(0, 1.3, -0.3, 1.5, 0.1, 1.9, body);
  m.box(0, 0.32, 2.16, 1.7, 0.16, 0.1, col(0x8a8a90));
  m.box(0, 0.32, -2.16, 1.7, 0.16, 0.1, col(0x8a8a90));
  m.box(-0.55, 0.55, 2.16, 0.42, 0.14, 0.06, col(0xfff2c8), 1.3);
  m.box(0.55, 0.55, 2.16, 0.42, 0.14, 0.06, col(0xfff2c8), 1.3);
  m.box(-0.55, 0.55, -2.16, 0.42, 0.14, 0.06, col(0xff2a30), 1.2);
  m.box(0.55, 0.55, -2.16, 0.42, 0.14, 0.06, col(0xff2a30), 1.2);
  if (taxi) m.box(0, 1.45, -0.3, 0.7, 0.22, 0.4, col(0xffc83e), 0.9);
  wheels(m, 0.35, 1.45, -1.45, 0.86, 0.35);
  return m.toArray();
}

export function buildPolice() {
  const m = new Mesh();
  const white = col(0xf0f0f0);
  const dark = col(0x1a1a1e);
  m.box(0, 0.5, 0, 1.85, 0.62, 4.3, white);
  m.box(0, 1.02, -0.3, 1.6, 0.55, 2.0, col(GLASS), 0.25);
  m.box(0, 1.3, -0.3, 1.5, 0.1, 1.9, white);
  // Black hood, doors stripe and push bar.
  m.box(0, 0.83, 1.45, 1.5, 0.04, 1.3, dark);
  for (const s of [-1, 1]) m.box(s * 0.94, 0.55, 0, 0.04, 0.3, 3.6, dark);
  m.box(0, 0.45, 2.2, 1.5, 0.4, 0.14, dark);
  // Flashing light bar: red left, blue right.
  m.box(0, 1.42, -0.3, 1.15, 0.16, 0.42, dark);
  m.box(-0.3, 1.52, -0.3, 0.5, 0.14, 0.4, col(0xff2030), 1.8);
  m.box(0.3, 1.52, -0.3, 0.5, 0.14, 0.4, col(0x2050ff), 1.8);
  m.box(-0.55, 0.55, 2.16, 0.42, 0.14, 0.06, col(0xfff2c8), 1.3);
  m.box(0.55, 0.55, 2.16, 0.42, 0.14, 0.06, col(0xfff2c8), 1.3);
  wheels(m, 0.35, 1.45, -1.45, 0.86, 0.35);
  return m.toArray();
}

export function buildVan(colorHex) {
  const m = new Mesh();
  const body = col(colorHex);
  m.box(0, 0.95, -0.4, 1.95, 1.6, 3.8, body);
  m.box(0, 0.55, 1.75, 1.9, 0.8, 0.9, body);
  m.box(0, 1.15, 1.55, 1.7, 0.6, 0.1, col(GLASS), 0.25);
  m.box(-0.55, 0.5, 2.2, 0.42, 0.14, 0.06, col(0xfff2c8), 1.3);
  m.box(0.55, 0.5, 2.2, 0.42, 0.14, 0.06, col(0xfff2c8), 1.3);
  wheels(m, 0.38, 1.5, -1.5, 0.9, 0.38);
  return m.toArray();
}

// Helicopter body: rounded fuselage, glass cockpit, white belly, tail boom,
// fin, skids and engine hump. The rotor is a separate mesh so it can spin.
export function buildHeli() {
  const m = new Mesh();
  const hull = col(0x35486a);
  const dark = col(0x1a1a1e);
  m.box(0, 0, 0.2, 1.7, 1.5, 3.2, hull);
  noseWedge(m, 1.7, 1.4, 0.75, 1.95, 0.1, -0.6, hull);
  m.box(0, 0.18, 1.15, 1.5, 0.9, 1.1, col(GLASS), 0.4);
  m.box(0, -0.62, 0.2, 1.5, 0.28, 2.6, col(0xe8e8e8));
  m.box(0, 0.9, -0.2, 1.0, 0.42, 1.4, dark);
  m.box(0, 0.1, -2.7, 0.5, 0.5, 2.3, hull);
  m.box(0, 0.55, -3.8, 0.12, 0.9, 0.7, hull);
  m.box(0, 0.05, -3.8, 1.1, 0.08, 0.4, hull);
  m.box(0.62, 0.1, -3.85, 0.08, 0.7, 0.08, dark);
  // Skids and struts.
  for (const s of [-1, 1]) {
    m.box(s * 0.78, -1.05, 0.3, 0.12, 0.12, 2.7, dark);
    m.box(s * 0.7, -0.8, 1.0, 0.1, 0.5, 0.1, dark);
    m.box(s * 0.7, -0.8, -0.5, 0.1, 0.5, 0.1, dark);
  }
  // Searchlight pod under the nose.
  m.prism(0, -0.85, 1.3, 0.22, 0.3, 8, dark);
  return m.toArray();
}

export function buildRotor() {
  const m = new Mesh();
  const blade = col(0x14141a);
  m.box(0, 1.18, -0.2, 0.3, 0.12, 0.3, col(0x222226));
  for (const a of [0, Math.PI / 2]) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    const len = 2.7;
    const w = 0.22;
    // Blade as a thin box rotated about Y by hand: four corners.
    const px = -s * w;
    const pz = c * w;
    const dx = c * len;
    const dz = s * len;
    m.box(0, 1.24, -0.2, 0.01, 0.01, 0.01, blade); // hub filler, negligible
    const y = 1.24;
    const cx = 0;
    const cz = -0.2;
    m.quad(
      [cx - dx - px, y, cz - dz - pz],
      [cx - dx + px, y, cz - dz + pz],
      [cx + dx + px, y, cz + dz + pz],
      [cx + dx - px, y, cz + dz - pz],
      [0, 1, 0],
      blade,
    );
    m.quad(
      [cx - dx - px, y - 0.05, cz - dz - pz],
      [cx + dx - px, y - 0.05, cz + dz - pz],
      [cx + dx + px, y - 0.05, cz + dz + pz],
      [cx - dx + px, y - 0.05, cz - dz + pz],
      [0, -1, 0],
      blade,
    );
  }
  return m.toArray();
}

// Translucent rotor blur disc, drawn in the translucent pass.
export function buildRotorDisc() {
  const m = new Mesh();
  m.disc(0, 1.24, -0.2, 2.75, 20, col(0xd8d8d8, 0.22), 0.2);
  return m.toArray();
}

export function buildBarrier() {
  const m = new Mesh();
  const orange = col(0xff7a1e);
  const white = col(0xf0f0f0);
  m.box(0, 0.85, 0, 3.8, 0.55, 0.22, orange, 0.4);
  for (let i = 0; i < 5; i++) {
    const x = -1.52 + i * 0.76;
    m.box(x, 0.85, 0.13, 0.38, 0.55, 0.03, i % 2 ? white : orange, 0.4);
  }
  for (const s of [-1, 1]) {
    m.box(s * 1.6, 0.4, 0, 0.22, 0.8, 0.5, col(0x333333));
    m.box(s * 1.6, 0.08, 0, 0.7, 0.16, 0.7, col(0x333333));
  }
  return m.toArray();
}

export function buildCone() {
  const m = new Mesh();
  m.cone(0, 0.12, 0, 0.32, 0.75, 8, col(0xff7a1e), 0.3);
  m.prism(0, 0.42, 0, 0.2, 0.18, 8, col(0xf0f0f0), 0.3);
  m.box(0, 0.06, 0, 0.55, 0.12, 0.55, col(0xff7a1e));
  return m.toArray();
}

const cache = new Map();

export function carMesh(kind, colorHex) {
  const key = kind + ':' + colorHex;
  if (!cache.has(key)) {
    let arr;
    if (kind === 'hero') arr = buildHeroCar(colorHex);
    else if (kind === 'police') arr = buildPolice();
    else if (kind === 'van') arr = buildVan(colorHex);
    else arr = buildSedan(colorHex, kind === 'taxi');
    cache.set(key, arr);
  }
  return cache.get(key);
}

const MODELS = { hero: 'GARUDA GT', sedan: 'ARJUNA', taxi: 'SRIKANDI', van: 'GATOTKACA', police: 'WPD CRUISER' };

export function makeVehicle(kind, x, z, heading, colorHex) {
  return {
    kind,
    x,
    z,
    heading,
    speed: 0,
    color: colorHex,
    mesh: carMesh(kind, colorHex),
    radius: 2.1,
    steer: 0,
    brake: 0,
    condition: 100,
    model: MODELS[kind] || 'ARJUNA',
    stolen: false,
    hp: 100,
    target: false,
    name: '',
  };
}
