// People: low-poly walkers built from boxes — a torso mesh plus two leg
// meshes so the walk cycle swings opposite legs — plus a seated scooter
// rider, and the pedestrian wander/scatter behaviour.

import { Mesh, col } from './mesh.js';

const SKINS = [0xc89878, 0xa87858, 0x8a5e40, 0xd8a888];
const JACKETS = [0x2e6ec8, 0xc82e4e, 0x2ea86e, 0xe8a82e, 0x8e4ec8, 0x38a8c8, 0xd8d8d8];
const PANTS = [0x2a2a34, 0x3e4e6e, 0x5e4e3e, 0x1e1e24];

// Returns { torso, legL, legR } as vertex arrays. Legs pivot at the hip
// (y = 0.9) when the renderer draws them with a rotation matrix.
export function buildWalker(jacketHex, pantsHex, skinHex, hat) {
  const jacket = col(jacketHex);
  const pants = col(pantsHex);
  const skin = col(skinHex);
  const torso = new Mesh();
  torso.box(0, 1.25, 0, 0.55, 0.65, 0.3, jacket);
  torso.box(0, 1.78, 0, 0.34, 0.36, 0.34, skin);
  torso.box(0, 1.97, 0, 0.36, 0.1, 0.36, col(0x1e1a16));
  torso.box(-0.37, 1.24, 0, 0.16, 0.6, 0.16, jacket);
  torso.box(0.37, 1.24, 0, 0.16, 0.6, 0.16, jacket);
  if (hat) torso.box(0, 2.0, 0, 0.44, 0.1, 0.44, col(hat));
  const legL = new Mesh();
  legL.box(-0.15, 0.45, 0, 0.2, 0.9, 0.2, pants);
  legL.box(-0.15, 0.06, 0.05, 0.22, 0.12, 0.3, col(0x1a1a1e));
  const legR = new Mesh();
  legR.box(0.15, 0.45, 0, 0.2, 0.9, 0.2, pants);
  legR.box(0.15, 0.06, 0.05, 0.22, 0.12, 0.3, col(0x1a1a1e));
  return { torso: torso.toArray(), legL: legL.toArray(), legR: legR.toArray() };
}

// Scooter with a seated rider, one static mesh: the rider leans forward,
// hands on the bars, feet on the deck.
export function buildScooter(jacketHex) {
  const m = new Mesh();
  const jacket = col(jacketHex);
  const deck = col(0xc82e4e);
  m.box(0, 0.3, 0.1, 0.5, 0.3, 1.5, deck);
  m.box(0, 0.62, 0.75, 0.42, 0.55, 0.14, deck);
  m.box(0, 0.95, 0.72, 0.6, 0.08, 0.08, col(0x1a1a1e));
  m.cylX(0, 0.28, 0.85, 0.28, 0.16, 8, col(0x151515));
  m.cylX(0, 0.28, -0.7, 0.28, 0.16, 8, col(0x151515));
  m.box(0, 0.55, -0.35, 0.44, 0.18, 0.7, col(0x1a1a1e));
  // Rider: torso leaning forward, head, arms to the bars, bent legs.
  m.box(0, 1.05, -0.3, 0.5, 0.6, 0.28, jacket);
  m.box(0, 1.5, -0.24, 0.32, 0.34, 0.32, col(SKINS[0]));
  m.box(0, 1.68, -0.24, 0.4, 0.12, 0.4, col(0x2a2a34));
  m.box(-0.3, 1.05, 0.25, 0.14, 0.14, 0.7, jacket);
  m.box(0.3, 1.05, 0.25, 0.14, 0.14, 0.7, jacket);
  m.box(-0.2, 0.55, 0.15, 0.16, 0.16, 0.6, col(0x2a2a34));
  m.box(0.2, 0.55, 0.15, 0.16, 0.16, 0.6, col(0x2a2a34));
  return m.toArray();
}

export function makePed(rng, spawn) {
  const jacket = rng.pick(JACKETS);
  const pants = rng.pick(PANTS);
  const skin = rng.pick(SKINS);
  return {
    x: spawn.x,
    z: spawn.z,
    homeX: spawn.x,
    homeZ: spawn.z,
    roam: spawn.roam,
    heading: rng.range(0, Math.PI * 2),
    speed: rng.range(1.0, 1.7),
    phase: rng.range(0, Math.PI * 2),
    targetX: spawn.x,
    targetZ: spawn.z,
    scatter: 0,
    meshes: buildWalker(jacket, pants, skin, rng.chance(0.3) ? rng.pick(JACKETS) : 0),
  };
}

// Wander inside the home radius; scatter away from danger (a speeding car
// or a gunshot) for a few seconds. Deterministic under a fixed timestep.
export function updatePeds(peds, dt, danger, rng) {
  for (const p of peds) {
    if (p.scatter > 0) {
      p.scatter -= dt;
      const away = Math.atan2(p.x - danger.x, p.z - danger.z);
      p.heading = away;
      const sp = 4.2;
      p.x += Math.sin(p.heading) * sp * dt;
      p.z += Math.cos(p.heading) * sp * dt;
      p.phase += dt * 9;
      continue;
    }
    const dx = p.targetX - p.x;
    const dz = p.targetZ - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.2) {
      p.targetX = p.homeX + rng.range(-p.roam, p.roam);
      p.targetZ = p.homeZ + rng.range(-p.roam, p.roam);
    } else {
      p.heading = Math.atan2(dx, dz);
      p.x += Math.sin(p.heading) * p.speed * dt;
      p.z += Math.cos(p.heading) * p.speed * dt;
      p.phase += dt * 5 * p.speed;
    }
  }
}

export function scatterPeds(peds, x, z, radius) {
  for (const p of peds) {
    if (Math.hypot(p.x - x, p.z - z) < radius) p.scatter = 3;
  }
}
