// Screenshot staging: deterministic, placed — never hoped-for — setups for
// the four contact-sheet shots. Each shot fixes the game state, the camera,
// the helicopter, the police, the traffic and the pedestrians, then the main
// loop runs a fixed number of fixed-timestep frames and freezes, so the same
// shot captured twice is byte-identical.
//
// The cover fix: a 3/4 rear chase view with the sleek hero car BIG and
// center-frame, fully clear of every HUD panel, and the helicopter BIG in
// open sky, clear of panels, buildings and signs. There are no billboards
// anywhere in the city — only small neon shop signs — so no flat slab can
// ever dominate a frame.

import { G } from './state.js';
import { makeVehicle } from './vehicles.js';

function setHudState(o) {
  Object.assign(G, o);
}

function placeTraffic(world, list) {
  world.traffic = list.map((t) => {
    const v = makeVehicle(t.kind || 'sedan', t.x, t.z, t.heading, t.color || 0x8a8a92);
    v.speed = t.speed || 0;
    return v;
  });
}

function placePeds(world, list) {
  list.forEach((spot, i) => {
    const p = world.peds[i % world.peds.length];
    if (!p) return;
    p.x = spot.x;
    p.z = spot.z;
    p.homeX = spot.x;
    p.homeZ = spot.z;
    p.targetX = spot.x + (spot.dx || 0);
    p.targetZ = spot.z + (spot.dz || 0);
    p.heading = spot.heading || 0;
    p.roam = spot.roam || 3;
    p.scatter = 0;
  });
}

function baseCar(world, x, z, heading, speed, color) {
  const car = makeVehicle('hero', x, z, heading, color || 0xd8342c);
  car.speed = speed;
  world.playerCar = car;
  G.player.x = x;
  G.player.z = z;
  G.player.heading = heading;
  G.player.speed = speed;
  G.player.onFoot = false;
  return car;
}

function coverShot(world) {
  setHudState({
    mode: 'play',
    missionIdx: 8,
    missionTime: 149,
    cash: 12480,
    wanted: 4,
    heat: 70,
    rep: 890,
    clockMin: 18 * 60 + 36,
    day: 1,
    health: 100,
    armor: 45,
    weaponIdx: 2,
    dispatch: 'All units, suspect heading west on Jl. Pantai Utara. Air support on scene.',
  });
  G.weapons[1].mag = 12;
  G.weapons[1].reserve = 48;
  G.weapons[2].mag = 30;
  G.weapons[2].reserve = 90;
  G.weapons[3].locked = true;
  G.crew[0].cd = 0;
  G.crew[1].cd = 12;
  G.crew[2].cd = 0;
  G.car.condition = 100;
  G.dialogue = { who: 'AGUS', role: 'FIXER', text: 'Roadblock on Pantai road! Ram it or cut through the sand — your call, Sugeng.', until: 1e9 };
  baseCar(world, -108, -20, Math.PI, 17.2, 0xd8342c);
  // Parked cars near the camera would block the chase view: move them
  // behind the camera, still curbside on the same road.
  for (const pc of world.parked) {
    if (Math.hypot(pc.x + 105, pc.z + 12) < 25) pc.z += 60;
  }
  // Camera: behind-right of the car, looking north-west through it — the car
  // sits big and center, the sea and low sun fill the left, towers the right.
  world.cameraOverride = { eye: [-105, 3.3, -11.5], target: [-109, 1.4, -26], fov: 55 };
  // Helicopter: high over the beach, in open sky, clear of every panel.
  const heli = world.police.heli;
  world.police.forceHeli = true;
  heli.active = true;
  heli.x = -112;
  heli.z = -40;
  heli.y = 11;
  heli.angle = 2.4;
  heli.rotor = 0.7;
  heli.heading = 2.6;
  heli.spotX = -108;
  heli.spotZ = -30;
  // Police: oncoming cruiser, one behind-right, one further up the road.
  world.police.cars = [];
  const c1 = makeVehicle('police', -109.5, -38, 0, 0xf0f0f0);
  c1.name = 'UNIT 7';
  const c2 = makeVehicle('police', -103.5, -28, Math.PI, 0xf0f0f0);
  c2.name = 'UNIT 12';
  const c3 = makeVehicle('police', -109.5, -58, 0, 0xf0f0f0);
  c3.name = 'UNIT 3';
  world.police.cars = [c1, c2, c3];
  world.police.blocks = [{ x: -108, z: -44, heading: Math.PI / 2, id: 0 }];
  placeTraffic(world, [
    { x: -106.5, z: -52, heading: Math.PI, kind: 'sedan', color: 0x3e6ec8, speed: 8 },
    { x: -109.5, z: -64, heading: 0, kind: 'taxi', color: 0xe8c838, speed: 7 },
    { x: -106.5, z: -78, heading: Math.PI, kind: 'van', color: 0x8a8a92, speed: 6 },
    { x: -109.5, z: -92, heading: 0, kind: 'sedan', color: 0xc84e2e, speed: 7 },
    { x: -106.5, z: -106, heading: Math.PI, kind: 'sedan', color: 0x4e8e4e, speed: 7 },
  ]);
  world.scooter = { x: -104, z: -48, heading: Math.PI, speed: 9 };
  placePeds(world, [
    { x: -134, z: -48, roam: 2 }, { x: -131, z: -36, roam: 2 }, { x: -137, z: -24, roam: 2 },
    { x: -120, z: -34, roam: 2 }, { x: -120, z: -48, roam: 2 }, { x: -136, z: -58, roam: 2 },
    { x: -100, z: -44, roam: 3 }, { x: -100, z: -32, roam: 3 }, { x: -100, z: -56, roam: 3 },
    { x: -100, z: -68, roam: 3 },
  ]);
  world.objective = { x: -108, z: -187, label: 'Ujung Pantai' };
  world.objectiveProgress = 0.62;
}

function nightShot(world) {
  setHudState({
    mode: 'play',
    missionIdx: 11,
    missionTime: 199,
    cash: 15230,
    wanted: 5,
    heat: 100,
    rep: 1320,
    clockMin: 21 * 60 + 20,
    day: 1,
    health: 88,
    armor: 60,
    weaponIdx: 3,
    dispatch: 'All units, five stars — suspect in Alun-Alun. Helicopter has the spotlight.',
  });
  G.weapons[1].mag = 12;
  G.weapons[1].reserve = 48;
  G.weapons[2].mag = 30;
  G.weapons[2].reserve = 90;
  G.weapons[3].locked = false;
  G.weapons[3].mag = 24;
  G.weapons[3].reserve = 60;
  G.crew[0].cd = 0;
  G.crew[1].cd = 12;
  G.crew[2].cd = 0;
  G.car.condition = 82;
  G.dialogue = { who: 'KOMISARIS WANTO', role: 'WPD', text: 'Sugeng Wibowo, pull over! The whole city is watching tonight.', until: 1e9 };
  baseCar(world, -36, 20, Math.PI, 17.2, 0xd8342c);
  for (const pc of world.parked) {
    if (Math.hypot(pc.x + 33, pc.z - 28) < 25) pc.z += 60;
  }
  world.cameraOverride = { eye: [-33, 3.4, 29.5], target: [-36.5, 1.2, 14], fov: 55 };
  const heli = world.police.heli;
  world.police.forceHeli = true;
  heli.active = true;
  heli.x = -39;
  heli.z = 6;
  heli.y = 8;
  heli.angle = 1.1;
  heli.rotor = 1.9;
  heli.heading = 2.9;
  heli.spotX = -36;
  heli.spotZ = 8;
  const c1 = makeVehicle('police', -39, 6, 0, 0xf0f0f0);
  c1.name = 'UNIT 7';
  const c2 = makeVehicle('police', -33.5, -2, Math.PI, 0xf0f0f0);
  c2.name = 'UNIT 12';
  world.police.cars = [c1, c2];
  world.police.blocks = [{ x: -36, z: -6, heading: Math.PI / 2, id: 0 }];
  placeTraffic(world, [
    { x: -34.5, z: -20, heading: Math.PI, kind: 'sedan', color: 0xc82e4e, speed: 8 },
    { x: -37.5, z: -35, heading: 0, kind: 'taxi', color: 0xe8c838, speed: 7 },
    { x: -34.5, z: -52, heading: Math.PI, kind: 'van', color: 0x6e7e8e, speed: 6 },
  ]);
  world.scooter = null;
  placePeds(world, [
    { x: -28, z: 8, roam: 3 }, { x: -28, z: -4, roam: 3 }, { x: -44, z: 14, roam: 3 }, { x: -44, z: -10, roam: 3 },
  ]);
  world.objective = { x: -36, z: -60, label: 'Alun-Alun' };
  world.objectiveProgress = 0.8;
}

function titleShot(world) {
  setHudState({ mode: 'title', clockMin: 18 * 60 + 50, day: 1, cash: 1250, wanted: 0, heat: 0 });
  baseCar(world, -107, 14, 0.6, 0, 0xd8342c);
  world.cameraOverride = { eye: [-111, 3.2, 30], target: [-110, 3.5, -20], fov: 55 };
  world.police.cars = [];
  world.police.blocks = [];
  world.police.forceHeli = false;
  world.police.heli.active = false;
  placeTraffic(world, [
    { x: -106.5, z: -30, heading: Math.PI, kind: 'sedan', color: 0x3e6ec8, speed: 0 },
    { x: -109.5, z: -50, heading: 0, kind: 'taxi', color: 0xe8c838, speed: 0 },
  ]);
  world.scooter = null;
  placePeds(world, [
    { x: -133, z: -6, roam: 2 }, { x: -131, z: 12, roam: 2 }, { x: -100, z: -8, roam: 3 },
  ]);
  world.objective = null;
}

function mapShot(world) {
  setHudState({
    mode: 'map',
    missionIdx: 11,
    missionTime: 199,
    cash: 13230,
    wanted: 2,
    heat: 30,
    rep: 1320,
    clockMin: 18 * 60 + 50,
    day: 1,
    health: 100,
    armor: 30,
    weaponIdx: 2,
  });
  G.done = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  G.stats.kills = 14;
  G.stats.stolen = 6;
  baseCar(world, -90, 0, Math.PI, 0, 0xd8342c);
  world.cameraOverride = { eye: [-86, 4.0, 10], target: [-90, 1.0, -6], fov: 55 };
  world.police.cars = [];
  world.police.blocks = [];
  world.police.forceHeli = false;
  world.police.heli.active = false;
  world.objective = { x: 54, z: 54, label: 'Pasar Senja' };
  world.objectiveProgress = 0.5;
}

export const SHOTS = { cover: coverShot, night: nightShot, title: titleShot, map: mapShot };

export function applyShot(name, world) {
  const fn = SHOTS[name] || coverShot;
  fn(world);
  G.shotMode = true;
  G.shotName = name;
  G.frozen = false;
  G.frame = 0;
  G.time = 0;
}
