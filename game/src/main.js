// Wilwatikta: boot, game loop, driving, on-foot play, missions, combat,
// police, cameras and per-frame effects. The 3D world is drawn as two draw
// lists (opaque + translucent) rebuilt every frame; the city meshes are
// static and the moving pieces are transformed copies of cached meshes.

import { G, CFG, newGame, saveGame, loadGame } from './state.js';
import { buildCity } from './city.js';
import { buildWalker, buildScooter, makePed, updatePeds, scatterPeds } from './actors.js';
import { makeVehicle, carMesh, buildHeli, buildRotor, buildRotorDisc, buildBarrier, buildCone } from './vehicles.js';
import { Renderer, legMatrix } from './render.js';
import { Mesh, col } from './mesh.js';
import { mIdentity, mModel, mModelS, mMul, mTranslate, clamp, lerp } from './mat.js';
import { paletteAt } from './palette.js';
import { AudioSys } from './audio.js';
import { MISSIONS, currentMission } from './missions.js';
import { Police, addHeat } from './police.js';
import { initHud, updateHud, showScreen, setDialogue, toast, showPassed, showSaves, refreshGarage } from './hud.js';
import { applyShot } from './stage.js';
import { Rng } from './rng.js';

const canvas = document.getElementById('game-canvas');
const renderer = new Renderer(canvas);
const IDENT = mIdentity();
const params = new URLSearchParams(location.search);
const SEED = parseInt(params.get('seed') || '1', 10);
const SHOT = params.get('shot');

const world = {
  city: null, police: null, traffic: [], peds: [], parked: [], enemies: [],
  playerCar: null, targetCar: null, scooter: null,
  camera: { eye: [0, 4, 10], target: [0, 1, 0], fov: 55, w: 1280, h: 720 },
  cameraOverride: null, objective: null, objectiveProgress: 0,
  tracers: [], flashes: [], sparks: [],
  collide(a, b, r) {
    const x = typeof a === 'object' ? a.x : a;
    const z = typeof a === 'object' ? a.z : b;
    const rad = typeof a === 'object' ? b : r;
    for (const c of world.city.colliders) {
      const cx = clamp(x, c.x0, c.x1);
      const cz = clamp(z, c.z0, c.z1);
      const dx = x - cx;
      const dz = z - cz;
      if (dx * dx + dz * dz < rad * rad) return true;
    }
    return Math.abs(x) > 142 || Math.abs(z) > 142;
  },
};

// Shared effect meshes (built once, reused with matrices).
const tracerMesh = (() => { const m = new Mesh(); m.box(0, 0, 0, 0.5, 0.5, 0.5, col(0xfff2b0, 1), 2.2); return m.toArray(); })();
const flashMesh = (() => { const m = new Mesh(); m.box(0, 0, 0, 0.5, 0.5, 0.5, col(0xffe89a, 1), 2.5); return m.toArray(); })();
const simRng = new Rng(SEED ^ 0x9e37);
const heliMesh = buildHeli();
const rotorMesh = buildRotor();
const rotorDiscMesh = buildRotorDisc();
const barrierMesh = buildBarrier();
const coneMesh = buildCone();
const fxTrans = new Mesh(); // rebuilt per frame, world-space translucent effects
const fxOpaque = new Mesh();

let camYaw = 0;
let returnTo = 'title';
let camPitch = 0;
let camDist = 10.5;
let camSmooth = null;
let keys = {};
let dragging = false;
let lastMouse = null;
let bustedTimer = 0;
let missionLineShown = false;
let gangFireTimer = 0;
let muzzleTimer = 0;
let shake = 0;

function startMission(idx) {
  G.missionIdx = idx;
  G.missionTime = MISSIONS[idx].timer;
  G.checkpoints = 0;
  const m = MISSIONS[idx];
  missionLineShown = false;
  world.targetCar = null;
  world.enemies = [];
  if (m.type === 'steal' || m.type === 'chase') {
    const pt = m.points[0];
    const tc = makeVehicle(pt.car || 'sedan', pt.x, pt.z, 0, pt.color || 0x8a2e2e);
    tc.target = true;
    world.targetCar = tc;
  }
  if (m.type === 'combat') {
    const pt = m.points[0];
    for (let i = 0; i < 4; i++) {
      const w = buildWalker(0xa32e2e, 0x222222, 0xd8b89a);
      world.enemies.push({ x: pt.x + (i % 2) * 6 - 3, z: pt.z + Math.floor(i / 2) * 6 - 3, heading: 0, hp: 50, meshes: w, dead: false });
    }
  }
  world.objective = missionObjective();
  world.objectiveProgress = 0;
  const d0 = m.dialogue[0];
  if (d0) setDialogue(d0.who, d0.role, d0.text, 7);
}

function missionObjective() {
  const m = currentMission();
  const pts = m.points;
  if (m.type === 'race') {
    const i = Math.min(G.checkpoints || 0, pts.length - 1);
    return { x: pts[i].x, z: pts[i].z, label: 'Checkpoint ' + (i + 1) + '/' + pts.length };
  }
  if (m.type === 'steal') {
    if (world.targetCar && G.player.inCar === world.targetCar) return { x: pts[1].x, z: pts[1].z, label: pts[1].label };
    return { x: pts[0].x, z: pts[0].z, label: 'Target Car' };
  }
  if (m.type === 'chase') return world.targetCar ? { x: world.targetCar.x, z: world.targetCar.z, label: 'Spy Car' } : null;
  if (m.type === 'escape') return { x: pts[0].x, z: pts[0].z, label: pts[0].label };
  if (m.type === 'combat') {
    const alive = world.enemies.find((e) => !e.dead);
    return alive ? { x: alive.x, z: alive.z, label: 'Gang' } : null;
  }
  return { x: pts[0].x, z: pts[0].z, label: pts[0].label };
}

function completeMission() {
  const m = currentMission();
  const bonus = G.missionTime > 0 ? 100 : 0;
  G.cash += m.reward + bonus;
  G.rep += m.rep;
  G.done.push(G.missionIdx);
  AudioSys.sfx('pass');
  if (G.shotMode) return;
  showPassed(m, m.reward + bonus);
  G.mode = 'passed';
}

function failMission(msg) {
  toast(msg, 4);
  startMission(G.missionIdx);
}

// --- Input ---------------------------------------------------------------

addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (G.mode === 'play') {
    if (k === 'm') { G.mode = 'map'; showScreen('map'); }
    else if (k === 'p' || k === 'escape') { G.mode = 'pause'; showScreen('pause'); }
    else if (k === 'e') enterExitCar();
    else if (k === 'g') tryGarage();
    else if (k === 'r') reloadWeapon();
    else if (k === 'f') punch();
    else if (k === 'j') shoot();
    else if (k === 'z') useCrew(0);
    else if (k === 'x') useCrew(1);
    else if (k === 'c') useCrew(2);
    else if (k === 't') AudioSys.nextStation();
    else if (k === 'b') AudioSys.setMuted(!AudioSys.muted);
    else if (k === 'h') AudioSys.sfx('horn');
    else if (k >= '1' && k <= '4') selectWeapon(parseInt(k, 10) - 1);
  } else if (G.mode === 'map' && (k === 'm' || k === 'escape')) {
    G.mode = 'play';
    showScreen(null);
  } else if (G.mode === 'pause' && (k === 'p' || k === 'escape')) {
    G.mode = 'play';
    showScreen(null);
  }
});
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
addEventListener('pointerdown', () => AudioSys.init(), { once: true });
addEventListener('keydown', () => AudioSys.init(), { once: true });
canvas.addEventListener('mousedown', (e) => {
  dragging = true;
  lastMouse = [e.clientX, e.clientY];
  if (G.mode === 'play' && e.button === 0) shoot();
});
addEventListener('mousemove', (e) => {
  if (!dragging || !lastMouse) return;
  camYaw -= (e.clientX - lastMouse[0]) * 0.005;
  camPitch = clamp(camPitch + (e.clientY - lastMouse[1]) * 0.003, -0.2, 0.5);
  lastMouse = [e.clientX, e.clientY];
});
addEventListener('mouseup', () => { dragging = false; });
canvas.addEventListener('wheel', (e) => { camDist = clamp(camDist + Math.sign(e.deltaY), 7, 15); }, { passive: true });
addEventListener('resize', () => renderer.resize(innerWidth, innerHeight));

// --- Actions -------------------------------------------------------------

function selectWeapon(i) {
  const w = G.weapons[i];
  if (!w || w.locked) return;
  G.weaponIdx = i;
  G.reload = 0;
}

function reloadWeapon() {
  const w = G.weapons[G.weaponIdx];
  if (w.mag === Infinity || w.reserve <= 0 || w.mag >= w.magSize || G.reload > 0) return;
  G.reload = 1.2;
}

function enterExitCar() {
  const p = G.player;
  if (!p.onFoot) {
    p.onFoot = true;
    p.inCar = null;
    // Step out on the first side that is not inside a collider.
    for (const off of [Math.PI / 2, -Math.PI / 2, 0, Math.PI]) {
      const nx = p.x + Math.sin(p.heading + off) * 2.5;
      const nz = p.z + Math.cos(p.heading + off) * 2.5;
      if (!world.collide(nx, nz, 0.5) || off === Math.PI) {
        p.x = nx;
        p.z = nz;
        break;
      }
    }
    return;
  }
  const all = [...world.traffic, ...world.parked, world.playerCar, world.targetCar].filter(Boolean);
  let best = null;
  let bestD = 4.5;
  for (const car of all) {
    const d = Math.hypot(car.x - p.x, car.z - p.z);
    if (d < bestD) {
      best = car;
      bestD = d;
    }
  }
  if (!best) return;
  p.onFoot = false;
  p.inCar = best;
  if (best.stolen === false && best !== world.playerCar) {
    best.stolen = true;
    G.stats.stolen++;
    addHeat(12);
    toast('Car stolen — WPD alerted!', 3);
  }
  if (best === world.targetCar) toast('Got the target car — take it to the garage!', 3);
  G.car.model = best.model;
  G.car.color = best.color;
  G.car.condition = best.condition;
  if (world.playerCar && world.playerCar !== best && !world.parked.includes(world.playerCar) && !world.traffic.includes(world.playerCar)) world.parked.push(world.playerCar);
  world.playerCar = best;
}

function tryGarage() {
  if (Math.hypot(G.player.x - 18, G.player.z - 54) < 10 && !G.player.onFoot) {
    G.mode = 'garage';
    refreshGarage();
    showScreen('garage');
  }
}

function useCrew(i) {
  const c = G.crew[i];
  if (c.cd > 0 || G.cash < c.cost) return;
  G.cash -= c.cost;
  c.cd = 20;
  if (i === 0) {
    const o = world.objective;
    toast(o ? `Route marked: ${o.label}, ${Math.round(Math.hypot(o.x - G.player.x, o.z - G.player.z))}m` : 'No active objective', 4);
  } else if (i === 1) {
    G.car.condition = 100;
    if (world.playerCar) world.playerCar.condition = 100;
    toast('Bambang fixed the car — good as new.', 3);
  } else {
    G.heat = 0;
    G.wanted = 0;
    world.police.cars = [];
    world.police.heli.active = false;
    toast('Ratna cleared your heat — the WPD lost the trail.', 3);
  }
}

function aimDir() {
  const cam = world.camera;
  const dx = cam.target[0] - cam.eye[0];
  const dz = cam.target[2] - cam.eye[2];
  const len = Math.hypot(dx, dz) || 1;
  return [dx / len, dz / len];
}

function shoot() {
  if (G.reload > 0) return;
  const w = G.weapons[G.weaponIdx];
  const p = G.player;
  if (w.id === 'fist') {
    punch();
    return;
  }
  if (w.mag <= 0) {
    reloadWeapon();
    return;
  }
  w.mag--;
  AudioSys.sfx('shot');
  muzzleTimer = 0.07;
  const [dx, dz] = aimDir();
  const mx = p.x + dx * 1.2;
  const mz = p.z + dz * 1.2;
  const my = p.onFoot ? 1.4 : 1.2;
  let hitDist = 45;
  let hitEnemy = null;
  for (const e of world.enemies) {
    if (e.dead) continue;
    const ex = e.x - mx;
    const ez = e.z - mz;
    const along = ex * dx + ez * dz;
    if (along < 0 || along > hitDist) continue;
    const perp = Math.abs(ex * dz - ez * dx);
    if (perp < 1.3) {
      hitDist = along;
      hitEnemy = e;
    }
  }
  if (hitEnemy) {
    hitEnemy.hp -= w.damage;
    world.sparks.push({ x: hitEnemy.x, y: 1.2, z: hitEnemy.z, t: 0.15 });
    if (hitEnemy.hp <= 0) {
      hitEnemy.dead = true;
      G.stats.kills++;
      addHeat(8);
      scatterPeds(world.peds, hitEnemy.x, hitEnemy.z, 20);
    }
  }
  world.tracers.push({ x: mx, y: my, z: mz, dx, dz, len: hitDist, t: 0.1 });
  if (G.wanted === 0 && hitEnemy) addHeat(5);
}

function punch() {
  const p = G.player;
  AudioSys.sfx('punch');
  for (const e of world.enemies) {
    if (e.dead) continue;
    if (Math.hypot(e.x - p.x, e.z - p.z) < 2.4) {
      e.hp -= 25;
      if (e.hp <= 0) {
        e.dead = true;
        G.stats.kills++;
      }
    }
  }
  if (!p.onFoot) return;
  for (const ped of world.peds) {
    if (Math.hypot(ped.x - p.x, ped.z - p.z) < 2.2) scatterPeds(world.peds, p.x, p.z, 15);
  }
}

// --- Update --------------------------------------------------------------

function driveCar(car, dt, isPlayer) {
  const accel = 14 + G.car.engine * 3;
  const maxSpeed = 26 + G.car.engine * 2.5;
  if (isPlayer) {
    if (keys['w'] || keys['arrowup']) car.speed += accel * dt;
    if (keys['s'] || keys['arrowdown']) car.speed -= (car.speed > 0.5 ? 26 : 8) * dt;
    if (keys[' ']) car.speed *= Math.max(0, 1 - 3 * dt);
    const steer = (keys['a'] || keys['arrowleft'] ? 1 : 0) - (keys['d'] || keys['arrowright'] ? 1 : 0);
    car.heading += steer * clamp(Math.abs(car.speed) / 8, 0, 1) * 2.2 * dt * (car.speed >= 0 ? 1 : -1);
    car.speed = clamp(car.speed, -9, maxSpeed);
    if (!keys['w'] && !keys['s'] && !keys['arrowup'] && !keys['arrowdown']) car.speed *= Math.max(0, 1 - 0.8 * dt);
  }
  const onRoad = CFG.roads.some((r) => Math.abs(car.x - r) < 7) || CFG.roads.some((r) => Math.abs(car.z - r) < 7);
  if (!onRoad) car.speed *= Math.max(0, 1 - 1.4 * dt);
  if (car.condition <= 0) car.speed = 0;
  const stepX = Math.sin(car.heading) * car.speed * dt;
  const stepZ = Math.cos(car.heading) * car.speed * dt;
  if (!world.collide(car.x + stepX, car.z, 1.5)) car.x += stepX;
  else {
    car.speed *= 0.4;
    car.condition -= 2;
    AudioSys.sfx('crash');
    shake = 0.25;
  }
  if (!world.collide(car.x, car.z + stepZ, 1.5)) car.z += stepZ;
  else {
    car.speed *= 0.4;
    car.condition -= 2;
    AudioSys.sfx('crash');
    shake = 0.25;
  }
  if (isPlayer) {
    G.player.x = car.x;
    G.player.z = car.z;
    G.player.heading = car.heading;
    G.player.speed = car.speed;
    G.car.condition = car.condition;
  }
}

function carCollision(a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const d = Math.hypot(dx, dz);
  if (d > 3.4 || d < 0.01) return;
  const push = (3.4 - d) / 2;
  const nx = dx / d;
  const nz = dz / d;
  a.x -= nx * push;
  a.z -= nz * push;
  b.x += nx * push;
  b.z += nz * push;
  const impact = Math.abs(a.speed - b.speed);
  if (impact > 4) {
    a.condition -= impact * 0.8;
    b.condition -= impact * 0.8;
    AudioSys.sfx('crash');
    shake = 0.3;
    if (b.target) {
      b.hp -= impact * 6;
      if (b.hp <= 0 && currentMission().type === 'chase') completeMission();
    }
  }
  const tmp = a.speed;
  a.speed = b.speed * 0.6;
  b.speed = tmp * 0.6;
}

function update(dt) {
  G.time += dt;
  G.clockMin += dt / 1.2;
  if (G.clockMin >= 1440) {
    G.clockMin -= 1440;
    G.day++;
  }
  for (const c of G.crew) c.cd = Math.max(0, c.cd - dt);
  if (G.reload > 0) {
    G.reload -= dt;
    if (G.reload <= 0) {
      const w = G.weapons[G.weaponIdx];
      const need = w.magSize - w.mag;
      const take = Math.min(need, w.reserve);
      w.mag += take;
      w.reserve -= take;
    }
  }
  muzzleTimer = Math.max(0, muzzleTimer - dt);
  shake = Math.max(0, shake - dt);
  const p = G.player;
  if (p.onFoot) {
    let mx = 0;
    let mz = 0;
    if (keys['w'] || keys['arrowup']) mz -= 1;
    if (keys['s'] || keys['arrowdown']) mz += 1;
    if (keys['a'] || keys['arrowleft']) mx -= 1;
    if (keys['d'] || keys['arrowright']) mx += 1;
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      const sp = (keys['shift'] ? 9 : 6) * dt;
      const camH = Math.atan2(world.camera.eye[0] - world.camera.target[0], world.camera.eye[2] - world.camera.target[2]);
      const wx = (mx * Math.cos(camH) - mz * Math.sin(camH)) / len;
      const wz = (mx * Math.sin(camH) + mz * Math.cos(camH)) / len;
      p.heading = Math.atan2(wx, wz);
      p.speed = sp / dt;
      if (!world.collide(p.x + wx * sp, p.z, 0.5)) p.x += wx * sp;
      if (!world.collide(p.x, p.z + wz * sp, 0.5)) p.z += wz * sp;
      p.walkPhase = (p.walkPhase || 0) + dt * 9;
    } else {
      p.speed = 0;
    }
  } else if (world.playerCar) {
    driveCar(world.playerCar, dt, true);
  }
  // Traffic.
  for (const t of world.traffic) {
    t.x += Math.sin(t.heading) * t.speed * dt;
    t.z += Math.cos(t.heading) * t.speed * dt;
    if (Math.abs(t.x) > 132 || Math.abs(t.z) > 132) {
      t.x = -Math.sign(t.x) * 130;
      t.z = -Math.sign(t.z) * 130;
    }
    if (world.playerCar) carCollision(world.playerCar, t);
  }
  if (world.scooter) {
    const s = world.scooter;
    s.x += Math.sin(s.heading) * s.speed * dt;
    s.z += Math.cos(s.heading) * s.speed * dt;
    if (Math.abs(s.z) > 130) s.z = -Math.sign(s.z) * 130;
  }
  // Peds.
  updatePeds(world.peds, dt, p, simRng);
  // Police.
  world.police.update(dt, world, p);
  for (const car of world.police.cars) {
    if (world.playerCar) carCollision(world.playerCar, car);
  }
  // Busted check: boxed in and slow.
  if (G.wanted > 0 && !p.onFoot && Math.abs(p.speed) < 1) {
    const near = world.police.cars.some((c) => Math.hypot(c.x - p.x, c.z - p.z) < 7);
    if (near) {
      bustedTimer += dt;
      if (bustedTimer > 3) {
        G.cash = Math.max(0, G.cash - 300);
        G.wanted = 0;
        G.heat = 0;
        G.health = 100;
        p.x = -54;
        p.z = 120;
        bustedTimer = 0;
        G.mode = 'busted';
        showScreen('busted');
      }
    } else bustedTimer = 0;
  } else bustedTimer = 0;
  // Gang fire.
  gangFireTimer -= dt;
  if (gangFireTimer <= 0) {
    gangFireTimer = 1.6;
    for (const e of world.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - p.x, e.z - p.z);
      if (d < 45) {
        const dx = (p.x - e.x) / d;
        const dz = (p.z - e.z) / d;
        world.tracers.push({ x: e.x, y: 1.4, z: e.z, dx, dz, len: d, t: 0.1 });
        if (Math.random() < 0.5) {
          const dmg = 6;
          if (G.armor > 0) {
            G.armor = Math.max(0, G.armor - dmg);
            G.health -= dmg * 0.4;
          } else G.health -= dmg;
          AudioSys.sfx('shot');
        }
        e.heading = Math.atan2(dx, dz);
      }
    }
  }
  if (G.health <= 0) {
    G.cash = Math.max(0, G.cash - 200);
    G.health = 100;
    G.armor = 0;
    p.x = -54;
    p.z = 120;
    p.onFoot = true;
    p.inCar = null;
    G.mode = 'wasted';
    showScreen('wasted');
  }
  // Mission logic.
  const m = currentMission();
  G.missionTime = Math.max(0, G.missionTime - dt);
  const obj = missionObjective();
  world.objective = obj;
  if (obj) {
    const d = Math.hypot(obj.x - p.x, obj.z - p.z);
    world.objectiveProgress = clamp(1 - d / 220, 0.05, 1);
    if (m.type === 'race') {
      if (d < 10) {
        G.checkpoints++;
        AudioSys.sfx('pass');
        if (G.checkpoints >= m.points.length) completeMission();
        else world.objective = missionObjective();
      }
    } else if (m.type === 'goto' && d < 8) completeMission();
    else if (m.type === 'steal' && world.targetCar && p.inCar === world.targetCar && d < 10) completeMission();
    else if (m.type === 'escape' && G.wanted === 0 && d < 12) completeMission();
    else if (m.type === 'combat' && world.enemies.length > 0 && world.enemies.every((e) => e.dead)) completeMission();
    if (!missionLineShown && m.dialogue[1] && world.objectiveProgress > 0.5) {
      missionLineShown = true;
      const d1 = m.dialogue[1];
      setDialogue(d1.who, d1.role, d1.text, 7);
    }
  }
  // Timers on effects.
  for (const t of world.tracers) t.t -= dt;
  world.tracers = world.tracers.filter((t) => t.t > 0);
  for (const s of world.sparks) s.t -= dt;
  world.sparks = world.sparks.filter((s) => s.t > 0);
  // Audio.
  AudioSys.setEngine(p.onFoot ? 0 : Math.abs(p.speed));
  AudioSys.setSiren(G.wanted > 0 && world.police.cars.length > 0);
}

// --- Camera ----------------------------------------------------------------

function updateCamera(dt) {
  const p = G.player;
  if (world.cameraOverride) {
    world.camera.eye = world.cameraOverride.eye.slice();
    world.camera.target = world.cameraOverride.target.slice();
    world.camera.fov = world.cameraOverride.fov;
    world.camera.w = canvas.width;
    world.camera.h = canvas.height;
    return;
  }
  let eye;
  let target;
  let fov = 55;
  if (G.mode === 'title') {
    const t = G.time * 0.08;
    const cx = world.playerCar ? world.playerCar.x : p.x;
    const cz = world.playerCar ? world.playerCar.z : p.z;
    eye = [cx + Math.cos(t) * 13, 4.5, cz + Math.sin(t) * 13];
    target = [cx, 1.5, cz];
  } else {
    const back = p.onFoot ? 6 : camDist;
    const yaw = p.heading + Math.PI + camYaw;
    const h = p.onFoot ? 3.2 : 4.2 + camPitch * 3;
    eye = [p.x + Math.sin(yaw) * back, h, p.z + Math.cos(yaw) * back];
    target = [p.x + Math.sin(p.heading) * 6, 1.2, p.z + Math.cos(p.heading) * 6];
    fov = 55 + clamp(Math.abs(p.speed) / 30, 0, 1) * 12;
    camYaw *= Math.max(0, 1 - dt * 0.6);
  }
  if (!camSmooth) camSmooth = { eye: eye.slice(), target: target.slice() };
  const k = Math.min(1, dt * 5);
  for (let i = 0; i < 3; i++) {
    camSmooth.eye[i] = lerp(camSmooth.eye[i], eye[i], k);
    camSmooth.target[i] = lerp(camSmooth.target[i], target[i], k);
  }
  if (shake > 0) {
    camSmooth.eye[0] += (Math.random() - 0.5) * shake * 0.5;
    camSmooth.eye[1] += (Math.random() - 0.5) * shake * 0.5;
  }
  world.camera.eye = camSmooth.eye;
  world.camera.target = camSmooth.target;
  world.camera.fov = fov;
  world.camera.w = canvas.width;
  world.camera.h = canvas.height;
}

// --- Render ----------------------------------------------------------------

function drawVehicleInto(opaque, v) {
  opaque.push({ mesh: carMesh(v.kind, v.color), matrix: mModel(v.x, 0, v.z, v.heading) });
}

function buildFrame(pal) {
  const opaque = [{ mesh: world.city.opaque, matrix: IDENT }];
  const trans = [{ mesh: world.city.trans, matrix: IDENT, alpha: 1 }];
  const p = G.player;
  // Vehicles.
  const cars = [...world.traffic, ...world.parked];
  if (world.playerCar) cars.push(world.playerCar);
  if (world.targetCar) cars.push(world.targetCar);
  for (const c of world.police.cars) cars.push(c);
  const seen = new Set();
  for (const v of cars) {
    if (!v || seen.has(v)) continue;
    seen.add(v);
    drawVehicleInto(opaque, v);
  }
  // On-foot player.
  if (p.onFoot) {
    const w = world.playerWalker;
    opaque.push({ mesh: w.torso, matrix: mModel(p.x, 0, p.z, p.heading) });
    const sw = Math.sin(p.walkPhase || 0) * (p.speed > 0.5 ? 0.6 : 0);
    opaque.push({ mesh: w.legL, matrix: legMatrix(p.x, p.z, p.heading, sw) });
    opaque.push({ mesh: w.legR, matrix: legMatrix(p.x, p.z, p.heading, -sw) });
  }
  // Peds.
  for (const ped of world.peds) {
    const sw = Math.sin(ped.phase) * 0.55;
    opaque.push({ mesh: ped.meshes.torso, matrix: mModel(ped.x, 0, ped.z, ped.heading) });
    opaque.push({ mesh: ped.meshes.legL, matrix: legMatrix(ped.x, ped.z, ped.heading, sw) });
    opaque.push({ mesh: ped.meshes.legR, matrix: legMatrix(ped.x, ped.z, ped.heading, -sw) });
  }
  // Gang.
  for (const e of world.enemies) {
    if (e.dead) continue;
    opaque.push({ mesh: e.meshes.torso, matrix: mModel(e.x, 0, e.z, e.heading) });
    opaque.push({ mesh: e.meshes.legL, matrix: mModel(e.x, 0, e.z, e.heading) });
    opaque.push({ mesh: e.meshes.legR, matrix: mModel(e.x, 0, e.z, e.heading) });
  }
  // Scooter.
  if (world.scooter) {
    const s = world.scooter;
    opaque.push({ mesh: world.scooterMesh, matrix: mModel(s.x, 0, s.z, s.heading) });
  }
  // Roadblocks + cones.
  for (const b of world.police.blocks) {
    opaque.push({ mesh: barrierMesh, matrix: mModel(b.x, 0, b.z, b.heading) });
    opaque.push({ mesh: coneMesh, matrix: mModel(b.x - 4, 0, b.z, 0) });
    opaque.push({ mesh: coneMesh, matrix: mModel(b.x + 4, 0, b.z, 0) });
  }
  // Helicopter.
  const heli = world.police.heli;
  if (heli.active) {
    const bodyMat = mModel(heli.x, heli.y, heli.z, heli.heading);
    opaque.push({ mesh: heliMesh, matrix: bodyMat });
    // Spin about the rotor hub (local y 1.24, z -0.2), not the origin.
    const rotorMat = mMul(bodyMat, mMul(mModel(0, 1.24, -0.2, heli.rotor), mTranslate(0, -1.24, 0.2)));
    opaque.push({ mesh: rotorMesh, matrix: rotorMat });
    trans.push({ mesh: rotorDiscMesh, matrix: bodyMat, alpha: 0.35 });
  }
  // --- Translucent world-space effects (rebuilt every frame). ---
  fxTrans.v.length = 0;
  const night = clamp((pal.glowBoost - 0.35) / 1.25, 0, 1);
  // Blob shadows + headlight pools for every car.
  for (const v of cars) {
    if (!v) continue;
    fxTrans.disc(v.x, 0.03, v.z, 2.4, 12, col(0x000000, 0.32));
    if (night > 0.15) {
      const fx = Math.sin(v.heading);
      const fz = Math.cos(v.heading);
      fxTrans.disc(v.x + fx * 5, 0.04, v.z + fz * 5, 3.2, 12, col(0xffe6a0, 0.1 + night * 0.16));
    }
  }
  for (const ped of world.peds) fxTrans.disc(ped.x, 0.03, ped.z, 0.6, 8, col(0x000000, 0.3));
  // Police light flash.
  world.police.cars.forEach((c, i) => {
    const phase = Math.floor(G.time * 4 + i) % 2 === 0;
    fxTrans.disc(c.x, 1.55, c.z, 1.1, 10, col(phase ? 0xff3030 : 0x3080ff, 0.4));
  });
  // Searchlight cone + pool.
  if (heli.active) {
    const sx = heli.spotX;
    const sz = heli.spotZ;
    const apex = [heli.x, heli.y + 0.4, heli.z];
    const baseR = 5;
    for (let i = 0; i < 10; i++) {
      const a0 = (i / 10) * Math.PI * 2;
      const a1 = ((i + 1) / 10) * Math.PI * 2;
      fxTrans.tri(apex, [sx + Math.cos(a0) * baseR, 0.1, sz + Math.sin(a0) * baseR], [sx + Math.cos(a1) * baseR, 0.1, sz + Math.sin(a1) * baseR], [0, 1, 0], col(0xfff6c8, 0.13), 1.4);
    }
    fxTrans.disc(sx, 0.05, sz, baseR, 16, col(0xfff6c8, 0.35 + night * 0.2));
    fxTrans.disc(sx, 0.06, sz, 2.2, 12, col(0xffffff, 0.5));
  }
  // Objective beacon + route chevrons.
  const obj = world.objective;
  if (obj && G.mode === 'play') {
    const pulse = 0.7 + 0.3 * Math.sin(G.time * 3);
    fxTrans.box(obj.x, 6, obj.z, 0.5, 6, 0.5, col(0xffc83e, 0.3 * pulse), 1.6);
    fxTrans.disc(obj.x, 0.05, obj.z, 3.5 * pulse, 16, col(0xffc83e, 0.35), 1.2);
    // L-route chevrons from the player to the objective.
    const midX = obj.x;
    const midZ = p.z;
    const legs = [
      [p.x, p.z, midX, midZ],
      [midX, midZ, obj.x, obj.z],
    ];
    for (const [x0, z0, x1, z1] of legs) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.floor(len / 14);
      for (let i = 1; i <= n; i++) {
        const t = i / (n + 1);
        const cx = lerp(x0, x1, t);
        const cz = lerp(z0, z1, t);
        const s = 1.1 + 0.3 * Math.sin(G.time * 4 - i);
        fxTrans.disc(cx, 0.06, cz, s, 4, col(0xffc83e, 0.55), 1.2);
      }
    }
  }
  // Muzzle flash + tracers + sparks.
  if (muzzleTimer > 0) {
    const [dx, dz] = aimDir();
    opaque.push({ mesh: flashMesh, matrix: mModelS(p.x + dx * 1.4, p.onFoot ? 1.4 : 1.2, p.z + dz * 1.4, 0, 0.5, 0.5, 0.9) });
  }
  for (const t of world.tracers) {
    const yaw = Math.atan2(t.dx, t.dz);
    opaque.push({ mesh: tracerMesh, matrix: mModelS(t.x + (t.dx * t.len) / 2, t.y, t.z + (t.dz * t.len) / 2, yaw, 0.06, 0.06, t.len) });
  }
  for (const s of world.sparks) {
    fxTrans.disc(s.x, s.y, s.z, 0.4, 6, col(0xffd868, 0.8));
  }
  if (fxTrans.v.length > 0) trans.push({ mesh: fxTrans, matrix: IDENT, alpha: 1, dynamic: true });
  const cam = world.camera;
  renderer.frame(pal, cam.eye, cam.target, cam.fov, opaque, trans);
}

// --- Boot ------------------------------------------------------------------

function boot() {
  world.city = buildCity(SEED);
  world.police = new Police(simRng);
  world.playerWalker = buildWalker(0xd8342c, 0x2a3a5a, 0xd8b89a);
  world.scooterMesh = buildScooter(0x2e6ec8);
  // Parked cars.
  world.city.parkSpots.forEach((spot, i) => {
    const kinds = ['sedan', 'sedan', 'van', 'taxi'];
    const colors = [0x8a8a92, 0x3e6ec8, 0xc84e2e, 0x4e8e4e, 0xe8c838];
    world.parked.push(makeVehicle(kinds[i % kinds.length], spot.x, spot.z, spot.heading, colors[i % colors.length]));
  });
  // Pedestrians.
  for (let i = 0; i < 22; i++) {
    const spawn = world.city.pedSpawns[i % world.city.pedSpawns.length];
    world.peds.push(makePed(simRng, spawn));
  }
  // Traffic.
  const trafficDefs = [
    { x: -106.5, z: -60, heading: Math.PI, kind: 'sedan', color: 0x3e6ec8, speed: 8 },
    { x: -109.5, z: 40, heading: 0, kind: 'taxi', color: 0xe8c838, speed: 7 },
    { x: -34.5, z: 80, heading: Math.PI, kind: 'van', color: 0x8a8a92, speed: 6 },
    { x: 37.5, z: -40, heading: 0, kind: 'sedan', color: 0xc84e2e, speed: 8 },
    { x: 70, z: -34.5, heading: Math.PI / 2, kind: 'sedan', color: 0x4e8e4e, speed: 7 },
    { x: -70, z: 37.5, heading: -Math.PI / 2, kind: 'sedan', color: 0x8e4e8e, speed: 7 },
  ];
  world.traffic = trafficDefs.map((d) => {
    const v = makeVehicle(d.kind, d.x, d.z, d.heading, d.color);
    v.speed = d.speed;
    return v;
  });
  world.scooter = { x: -104, z: 60, heading: Math.PI, speed: 9 };

  initHud({
    new: () => {
      newGame();
      const car = makeVehicle('hero', -54, 120, Math.PI, 0xd8342c);
      world.playerCar = car;
      G.player.x = -54;
      G.player.z = 120;
      G.player.heading = Math.PI;
      startMission(0);
      G.mode = 'play';
      showScreen(null);
    },
    continue: () => {
      if (loadGame(0)) {
        const car = makeVehicle('hero', G.player.x, G.player.z, G.player.heading, G.car.color);
        world.playerCar = car;
        startMission(G.missionIdx);
        G.mode = 'play';
        showScreen(null);
      }
    },
    howto: () => {
      returnTo = G.mode === 'pause' ? 'pause' : 'title';
      showScreen('howto');
    },
    saves: () => {
      returnTo = G.mode === 'pause' ? 'pause' : 'title';
      showSaves();
    },
    load: (d) => {
      const slot = parseInt(d.slot, 10);
      if (loadGame(slot)) {
        const car = makeVehicle('hero', G.player.x, G.player.z, G.player.heading, G.car.color);
        world.playerCar = car;
        startMission(G.missionIdx);
        G.mode = 'play';
        showScreen(null);
      }
    },
    back: () => {
      showScreen(returnTo);
    },
    resume: () => {
      G.mode = 'play';
      showScreen(null);
    },
    quit: () => {
      G.mode = 'title';
      showScreen('title');
    },
    'save-game': () => {
      saveGame(0);
      toast('Game saved to slot 1.', 3);
    },
    garage: () => tryGarage(),
    'close-map': () => {
      G.mode = 'play';
      showScreen(null);
    },
    'buy-engine': () => {
      if (G.car.engine < 3 && G.cash >= 800) {
        G.cash -= 800;
        G.car.engine++;
        refreshGarage();
      }
    },
    'buy-armor': () => {
      if (G.car.armorUp < 3 && G.cash >= 600) {
        G.cash -= 600;
        G.car.armorUp++;
        refreshGarage();
      }
    },
    'buy-paint': () => {
      if (G.cash >= 300) {
        G.cash -= 300;
        const paints = [0xd8342c, 0x2e6ec8, 0x222222, 0xe8c838, 0x3fbfa8];
        G.car.color = paints[(paints.indexOf(G.car.color) + 1) % paints.length];
        if (world.playerCar) world.playerCar.color = G.car.color;
        refreshGarage();
      }
    },
    'buy-spoiler': () => {
      if (!G.car.spoiler && G.cash >= 200) {
        G.cash -= 200;
        G.car.spoiler = true;
        refreshGarage();
      }
    },
    repair: () => {
      const cost = Math.round((100 - G.car.condition) * 4);
      if (G.cash >= cost) {
        G.cash -= cost;
        G.car.condition = 100;
        if (world.playerCar) world.playerCar.condition = 100;
        refreshGarage();
      }
    },
    'leave-garage': () => {
      G.mode = 'play';
      showScreen(null);
    },
    crew: (i) => useCrew(i),
    weapon: (i) => selectWeapon(i),
    next: () => {
      const nextIdx = Math.min(G.missionIdx + 1, 11);
      startMission(nextIdx);
      G.mode = 'play';
      showScreen(null);
    },
    retry: () => {
      const car = makeVehicle('hero', -54, 120, Math.PI, G.car.color);
      world.playerCar = car;
      G.player.x = -54;
      G.player.z = 120;
      startMission(G.missionIdx);
      G.mode = 'play';
      showScreen(null);
    },
  });

  if (SHOT) {
    newGame();
    const car = makeVehicle('hero', -54, 120, Math.PI, 0xd8342c);
    world.playerCar = car;
    startMission(0);
    applyShot(SHOT, world);
    // In shot mode the scene is placed, not simulated: the staged values are
    // the final frame. Show the right screen for title/map shots.
    if (SHOT === 'title') showScreen('title');
    else if (SHOT === 'map') showScreen('map');
    else showScreen(null);
  } else {
    newGame();
    const car = makeVehicle('hero', -54, 120, Math.PI, 0xd8342c);
    world.playerCar = car;
    startMission(0);
    G.mode = 'title';
    showScreen('title');
  }

  window.__wil = { G, world, version: 'v6', audio: AudioSys };
  renderer.resize(innerWidth, innerHeight);

  let last = performance.now();
  let shotFrames = 0;
  function loop(now) {
    const dt = SHOT ? 1 / 60 : Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!SHOT && G.mode === 'play') update(dt);
    if (SHOT) {
      G.time += dt;
      G.frame++;
      updateCamera(dt);
      const pal = paletteAt(G.clockMin);
      buildFrame(pal);
      updateHud(world);
      shotFrames++;
      if (shotFrames >= 30) {
        G.frozen = true;
        window.__shotReady = true;
        window.__wil.shotReady = true;
        return;
      }
    } else {
      updateCamera(dt);
      const pal = paletteAt(G.clockMin);
      buildFrame(pal);
      updateHud(world);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

boot();
