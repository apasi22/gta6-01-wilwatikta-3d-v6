// Police and the wanted system: heat builds on crimes, stars follow heat,
// patrol cars pursue and ram, roadblocks go up at three stars, and a
// helicopter orbits with a searchlight that blocks heat decay while it
// watches. Dispatch lines rotate through the HUD panel.

import { Rng } from './rng.js';
import { makeVehicle } from './vehicles.js';
import { G, CFG } from './state.js';
import { angDiff, clamp } from './mat.js';

export const DISPATCH = [
  'All units, suspect heading west on Jl. Pantai Utara. Air support on scene.',
  'All units, five stars — suspect in Alun-Alun. Helicopter has the spotlight.',
  'Units 7 and 12, set a roadblock on Jl. Merdeka. Suspect is armed.',
  'Dispatch to all units: gold coupe reported stolen near the casino strip.',
  'Air support, keep the spotlight on the suspect. Ground units, close in.',
  'All units, suspect broke line of sight near Pasar Senja. Search the zone.',
  'Unit 3, suspect last seen heading for the docks. Cut them off at the pier.',
];

const UNIT_NAMES = ['UNIT 7', 'UNIT 12', 'UNIT 3', 'UNIT 21', 'UNIT 9'];

export function wantedFromHeat(heat) {
  if (heat < 8) return 0;
  if (heat < 22) return 1;
  if (heat < 40) return 2;
  if (heat < 60) return 3;
  if (heat < 85) return 4;
  return 5;
}

export function addHeat(n) {
  G.heat = clamp(G.heat + n, 0, 120);
  const w = wantedFromHeat(G.heat);
  if (w !== G.wanted) {
    G.wanted = w;
    if (w > 0) G.dispatch = DISPATCH[Math.floor(Math.random() * DISPATCH.length)];
  }
}

export class Police {
  constructor(rng) {
    this.rng = rng;
    this.cars = [];
    this.blocks = [];
    this.heli = { active: false, angle: 0.6, dist: 30, height: 30, rotor: 0, x: 0, y: 30, z: 0, heading: 0 };
    this.dispatchT = 0;
    this.lineIdx = 0;
    this.forceHeli = false;
  }

  nearestRoad(v) {
    let best = CFG.roads[0];
    let bd = Infinity;
    for (const r of CFG.roads) {
      const d = Math.abs(v - r);
      if (d < bd) {
        bd = d;
        best = r;
      }
    }
    return best;
  }

  spawnCar(player) {
    const road = this.nearestRoad(player.x);
    const along = player.z + this.rng.sign() * this.rng.range(45, 70);
    const car = makeVehicle('police', road, along, along > player.z ? Math.PI : 0, 0xf0f0f0);
    car.name = UNIT_NAMES[this.cars.length % UNIT_NAMES.length];
    car.speed = 10;
    this.cars.push(car);
  }

  update(dt, world, player) {
    const want = G.wanted;
    const target = want === 0 ? 0 : Math.min(1 + want, 5);
    while (this.cars.length < target) this.spawnCar(player);
    while (this.cars.length > target) this.cars.pop();

    // Pursuit: steer toward the player, ram at close range.
    for (const car of this.cars) {
      const dx = player.x - car.x;
      const dz = player.z - car.z;
      const dist = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      const turn = clamp(angDiff(wantHeading, car.heading), -2.4 * dt, 2.4 * dt);
      car.heading += turn;
      const targetSpeed = dist > 10 ? 27 + want * 1.5 : 14;
      car.speed += clamp(targetSpeed - car.speed, -30 * dt, 12 * dt);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      world.collide(car, 1.4);
      car.x = clamp(car.x, -124, 124);
      car.z = clamp(car.z, -124, 124);
      car.ramming = dist < 7;
    }

    // Roadblocks at three stars and up, ahead of the player on their road.
    const wantBlocks = want >= 3 ? Math.min(2, want - 2) : 0;
    while (this.blocks.length < wantBlocks) {
      const road = this.nearestRoad(player.x);
      const ahead = player.z + Math.cos(player.heading) * 38;
      const bx = road;
      const bz = clamp(ahead, -120, 120);
      this.blocks.push({ x: bx, z: bz, heading: Math.PI / 2, id: this.blocks.length });
    }
    this.blocks = this.blocks.filter((b) => {
      const d = Math.hypot(b.x - player.x, b.z - player.z);
      return d < 90 && want >= 3;
    });

    // Helicopter: orbits, spotlights, blocks decay.
    const heli = this.heli;
    heli.active = want >= 2 || this.forceHeli;
    if (heli.active) {
      heli.angle += dt * 0.22;
      heli.rotor += dt * 16;
      const tx = player.x + Math.cos(heli.angle) * heli.dist;
      const tz = player.z + Math.sin(heli.angle) * heli.dist;
      heli.x += (tx - heli.x) * Math.min(1, dt * 1.5);
      heli.z += (tz - heli.z) * Math.min(1, dt * 1.5);
      heli.y += (heli.height - heli.y) * Math.min(1, dt);
      heli.heading = Math.atan2(player.x - heli.x, player.z - heli.z);
      heli.spotX = player.x;
      heli.spotZ = player.z;
    }

    // Heat decay: only when hidden — no car close and no helicopter watch.
    let nearest = Infinity;
    for (const car of this.cars) nearest = Math.min(nearest, Math.hypot(car.x - player.x, car.z - player.z));
    const watched = heli.active && Math.hypot(heli.x - player.x, heli.z - player.z) < 70;
    if (nearest > 45 && !watched && G.heat > 0) {
      G.heat = Math.max(0, G.heat - dt * 4);
      G.wanted = wantedFromHeat(G.heat);
    }

    // Dispatch chatter.
    this.dispatchT -= dt;
    if (this.dispatchT <= 0) {
      this.dispatchT = 7;
      if (want > 0) {
        G.dispatch = DISPATCH[this.lineIdx % DISPATCH.length];
        this.lineIdx++;
      } else {
        G.dispatch = 'WPD DISPATCH: Semua unit, situasi aman di Wilwatikta.';
      }
    }
  }

  unitsForHud(player) {
    const rows = [];
    for (const car of this.cars) {
      const d = Math.round(Math.hypot(car.x - player.x, car.z - player.z));
      rows.push({ name: car.name + ' · WPD', dist: d, status: d < 12 ? 'RAMMING' : d < 30 ? 'PURSUIT' : 'FLANKING' });
    }
    if (this.heli.active) {
      const d = Math.round(Math.hypot(this.heli.x - player.x, this.heli.z - player.z));
      rows.push({ name: 'HELI-1 · WPD AIR', dist: d, status: 'SPOTLIGHT' });
    }
    for (const b of this.blocks) {
      const d = Math.round(Math.hypot(b.x - player.x, b.z - player.z));
      rows.push({ name: 'ROADBLOCK', dist: d, status: 'ROADBLOCK' });
    }
    return rows.slice(0, 5);
  }
}
