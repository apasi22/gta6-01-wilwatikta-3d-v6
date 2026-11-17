// HUD and menus: every DOM panel over the 3D view — mission banner, cash
// and stars, radio, WPD response, crew cards, weapon slots, speedometer,
// dialogue, dispatch, minimap — plus the full-screen map, title, pause,
// garage, how-to, passed, busted, wasted and save screens.

import { G, districtAt, DISTRICTS, levelTitle, storyPct, saveSummary, hasSave } from './state.js';
import { MISSIONS, currentMission } from './missions.js';
import { AudioSys } from './audio.js';
import { mPerspective, mLookAt, mMul } from './mat.js';

const $ = (id) => document.getElementById(id);

const WEAPON_ICONS = {
  fist: '<svg viewBox="0 0 24 24"><path d="M7 11V6a2 2 0 0 1 4 0v4V5a2 2 0 0 1 4 0v5V7a2 2 0 0 1 4 0v6c0 5-3 8-7 8s-6-3-6-7v-3z" fill="#e8e8e8"/></svg>',
  pistol: '<svg viewBox="0 0 24 24"><path d="M2 8h14l2 2v2h-6l-1 6H8l1-6H6l-2-2z" fill="#e8e8e8"/></svg>',
  smg: '<svg viewBox="0 0 24 24"><path d="M1 9h13l3 2v2h-5l-1 6H8l1-5H6l-1-2H1zM15 6h5v3h-5z" fill="#e8e8e8"/></svg>',
  ar9: '<svg viewBox="0 0 24 24"><path d="M1 10h16l4 1v2h-8l-1 5h-3l1-5H6l-1-1H1zM9 5h4v3H9z" fill="#e8e8e8"/></svg>',
};

let callbacks = {};
let lastHud = {};

function setText(id, value) {
  if (lastHud[id] !== value) {
    lastHud[id] = value;
    const el = $(id);
    if (el) el.textContent = value;
  }
}

export function initHud(cb) {
  callbacks = cb;
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (btn && callbacks[btn.dataset.action]) callbacks[btn.dataset.action](btn.dataset);
  });
  // Crew cards.
  const crewBox = $('crew-box');
  crewBox.innerHTML = '';
  G.crew.forEach((c, i) => {
    const div = document.createElement('div');
    div.className = 'crew-card';
    div.id = 'crew-' + i;
    div.innerHTML =
      `<div class="crew-face" style="background:linear-gradient(135deg,${['#c86a2e', '#2e6ec8', '#c82e6e'][i]},#222)">${c.name[0]}</div>` +
      `<div class="crew-info"><b>${c.name}</b><span>${c.desc}</span><span class="crew-cost">$${c.cost} · ${c.key}</span></div>` +
      `<div class="crew-cd"></div>`;
    div.addEventListener('click', () => callbacks.crew && callbacks.crew(i));
    crewBox.appendChild(div);
  });
  // Weapon slots.
  const bar = $('weapon-bar');
  bar.innerHTML = '';
  G.weapons.forEach((w, i) => {
    const div = document.createElement('div');
    div.className = 'wslot';
    div.id = 'wslot-' + i;
    div.innerHTML = `<i>${i + 1}</i>${WEAPON_ICONS[w.id]}<span class="wammo"></span><span class="wlock">LOCKED</span>`;
    div.addEventListener('click', () => callbacks.weapon && callbacks.weapon(i));
    bar.appendChild(div);
  });
}

export function showScreen(name) {
  for (const el of document.querySelectorAll('.screen')) el.classList.add('hidden');
  if (name) {
    const el = $('screen-' + name);
    if (el) el.classList.remove('hidden');
  }
  $('hud').classList.toggle('hidden', name === 'title' || name === 'map');
  document.body.classList.toggle('shot-map', name === 'map');
}

export function setDialogue(who, role, text, dur) {
  G.dialogue = { who, role, text, until: G.time + (dur || 6) };
}

export function toast(msg, dur) {
  G.message = msg;
  G.messageUntil = G.time + (dur || 3);
}

function fmtTime(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

function gearFor(speed) {
  const kmh = Math.abs(speed) * 3.6;
  if (kmh < 1) return 'N';
  if (kmh < 25) return '1';
  if (kmh < 50) return '2';
  if (kmh < 80) return '3';
  if (kmh < 115) return '4';
  return '5';
}

export function updateHud(world) {
  const m = currentMission();
  const p = G.player;
  const obj = world.objective;
  const dist = obj ? Math.round(Math.hypot(obj.x - p.x, obj.z - p.z)) : 0;
  setText('mission-title', `MISSION ${G.missionIdx + 1}/12 — ${m.name}`);
  setText('mission-brief', m.brief);
  setText('mission-timer', `◷ ${fmtTime(G.missionTime)} · ${dist}m`);
  setText('mission-next', 'NEXT: ' + (MISSIONS[G.missionIdx + 1] ? MISSIONS[G.missionIdx + 1].name.toUpperCase() : 'FREE ROAM'));
  const fill = $('mission-fill');
  if (fill) fill.style.width = Math.max(4, Math.min(100, world.objectiveProgress * 100)) + '%';
  setText('cash', '$' + G.cash.toLocaleString('en-US'));
  setText('stars', '★'.repeat(G.wanted) + '☆'.repeat(5 - G.wanted));
  const hh = Math.floor(G.clockMin / 60) % 24;
  const mm = Math.floor(G.clockMin % 60);
  setText('clock', `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · DAY ${G.day}`);
  setText('radio-name', AudioSys.stationName());
  setText('radio-track', AudioSys.trackName() + (AudioSys.muted ? ' · MUTED' : ''));
  const eq = document.querySelectorAll('#eq-bars i');
  eq.forEach((bar, i) => {
    bar.style.height = Math.round(4 + AudioSys.eqLevel(i, G.shotMode ? 1.7 : G.time) * 12) + 'px';
  });
  // WPD response panel.
  const rows = world.police ? world.police.unitsForHud(p) : [];
  const wpd = $('wpd-rows');
  if (wpd) {
    const html = rows.map((r) => `<div><span>${r.name}</span><b>${r.dist}m</b><em class="st-${r.status}">${r.status}</em></div>`).join('');
    if (lastHud.wpd !== html) {
      lastHud.wpd = html;
      wpd.innerHTML = html || '<div><span>NO ACTIVE UNITS</span></div>';
    }
  }
  // Crew cards + cooldowns.
  G.crew.forEach((c, i) => {
    const card = $('crew-' + i);
    if (!card) return;
    const cd = card.querySelector('.crew-cd');
    if (c.cd > 0) {
      cd.textContent = Math.ceil(c.cd) + 's';
      card.classList.add('cooling');
    } else {
      cd.textContent = '';
      card.classList.remove('cooling');
    }
  });
  // Weapon slots.
  G.weapons.forEach((w, i) => {
    const slot = $('wslot-' + i);
    if (!slot) return;
    slot.classList.toggle('active', i === G.weaponIdx);
    slot.classList.toggle('locked', w.locked);
    const ammo = slot.querySelector('.wammo');
    const txt = w.locked ? '' : w.mag === Infinity ? '∞' : `${w.mag} / ${w.reserve}`;
    if (ammo.textContent !== txt) ammo.textContent = txt;
  });
  const w = G.weapons[G.weaponIdx];
  setText('weapon-name', G.reload > 0 ? 'RELOADING…' : w.name);
  // Speedometer and condition.
  setText('speed-num', String(Math.round(Math.abs(p.speed) * 3.6)));
  setText('speed-gear', gearFor(p.speed));
  setText('speed-car', G.car.model);
  const cond = $('speed-cond');
  if (cond) cond.style.width = Math.max(0, G.car.condition) + '%';
  // Bars under the minimap.
  const bh = $('bar-health');
  if (bh) bh.style.width = G.health + '%';
  const ba = $('bar-armor');
  if (ba) ba.style.width = G.armor + '%';
  const br = $('bar-rep');
  if (br) br.style.width = Math.min(100, G.rep % 400) / 4 + '%';
  setText('rep-label', `REP ${levelTitle()} · ${G.rep}`);
  const d = districtAt(p.x, p.z);
  setText('minimap-district', d.name);
  setText('minimap-street', 'Jl. ' + (Math.abs(p.x) < Math.abs(p.z) ? 'Merdeka' : 'Pantai Utara'));
  setText('watermark', d.name);
  // Dialogue + dispatch + toast.
  const dlg = $('dialogue');
  if (G.dialogue.text && G.time < G.dialogue.until) {
    dlg.classList.remove('hidden');
    setText('dlg-who', G.dialogue.who);
    setText('dlg-role', G.dialogue.role);
    setText('dlg-text', G.dialogue.text);
    setText('dlg-portrait', G.dialogue.who[0] || '?');
  } else {
    dlg.classList.add('hidden');
  }
  setText('dispatch-line', G.dispatch ? 'WPD DISPATCH: ' + G.dispatch : '');
  const toastEl = $('toast');
  if (G.message && G.time < G.messageUntil) {
    toastEl.classList.remove('hidden');
    setText('toast', G.message);
  } else {
    toastEl.classList.add('hidden');
  }
  $('vignette').style.opacity = G.health < 30 ? String(0.5 + 0.3 * Math.sin(G.time * 4)) : '0';
  // Objective arrow at the screen edge.
  updateArrow(world, obj);
  drawMinimap(world);
  if (G.mode === 'map') drawMapScreen(world);
}

function project(world, x, y, z) {
  const cam = world.camera;
  const proj = mPerspective(cam.fov, cam.w / cam.h, 0.1, 900);
  const view = mLookAt(cam.eye, cam.target, [0, 1, 0]);
  const pv = mMul(proj, view);
  const cx = pv[0] * x + pv[4] * y + pv[8] * z + pv[12];
  const cy = pv[1] * x + pv[5] * y + pv[9] * z + pv[13];
  const cw = pv[3] * x + pv[7] * y + pv[11] * z + pv[15];
  return { x: cx / cw, y: cy / cw, behind: cw < 0 };
}

function updateArrow(world, obj) {
  const arrow = $('objective-arrow');
  if (!obj || G.mode !== 'play') {
    arrow.classList.add('hidden');
    return;
  }
  const p = project(world, obj.x, 8, obj.z);
  let nx = p.x;
  let ny = p.y;
  if (p.behind) {
    nx = -nx;
    ny = -1;
  }
  const margin = 0.08;
  const cx = Math.max(-1 + margin, Math.min(1 - margin, nx));
  const cy = Math.max(-1 + margin, Math.min(1 - margin, ny));
  const onScreen = !p.behind && Math.abs(nx) < 0.92 && Math.abs(ny) < 0.88;
  arrow.classList.remove('hidden');
  arrow.style.left = ((cx * 0.5 + 0.5) * 100) + '%';
  arrow.style.top = ((-cy * 0.5 + 0.5) * 100) + '%';
  arrow.style.opacity = onScreen ? '1' : '0.85';
  const dist = Math.round(Math.hypot(obj.x - G.player.x, obj.z - G.player.z));
  setText('obj-dist', dist + 'm');
}

// --- Minimap (circular 2D canvas) ---------------------------------------

function worldToMini(x, z, size) {
  return [(x / 280 + 0.5) * size, (z / 280 + 0.5) * size];
}

export function drawMinimap(world) {
  const cv = $('minimap');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const S = cv.width;
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = '#101018';
  ctx.fillRect(0, 0, S, S);
  // District blocks.
  for (let gx = 0; gx < 6; gx++) {
    for (let gz = 0; gz < 6; gz++) {
      const wx = -108 + gx * 36;
      const wz = -108 + gz * 36;
      const d = districtAt(wx + 18, wz + 18);
      const [px, pz] = worldToMini(wx, wz, S);
      ctx.fillStyle = d.color;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(px, pz, S * 36 / 280, S * 36 / 280);
      ctx.globalAlpha = 1;
    }
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  for (const r of [-108, -72, -36, 0, 36, 72, 108]) {
    const [px] = worldToMini(r, 0, S);
    const [, pz] = worldToMini(0, r, S);
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, S);
    ctx.moveTo(0, pz);
    ctx.lineTo(S, pz);
    ctx.stroke();
  }
  // Sea strip.
  ctx.fillStyle = '#1d4e6e';
  ctx.fillRect(0, 0, S * 24 / 280, S);
  // Route: L-shaped dashed line to the objective.
  const obj = world.objective;
  const p = G.player;
  if (obj) {
    const [x0, z0] = worldToMini(p.x, p.z, S);
    const [x1, z1] = worldToMini(obj.x, obj.z, S);
    ctx.strokeStyle = '#ffc83e';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(x0, z0);
    ctx.lineTo(x1, z0);
    ctx.lineTo(x1, z1);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffc83e';
    ctx.beginPath();
    ctx.arc(x1, z1, 4, 0, 7);
    ctx.fill();
  }
  // Search zone ring while wanted.
  if (G.wanted > 0) {
    const [x0, z0] = worldToMini(p.x, p.z, S);
    ctx.strokeStyle = 'rgba(255,60,60,0.8)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(x0, z0, 26, 0, 7);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // Blips: police, helicopter, traffic.
  if (world.police) {
    ctx.fillStyle = '#4e8eff';
    for (const car of world.police.cars) {
      const [x, z] = worldToMini(car.x, car.z, S);
      ctx.beginPath();
      ctx.arc(x, z, 3, 0, 7);
      ctx.fill();
    }
    if (world.police.heli.active) {
      const [x, z] = worldToMini(world.police.heli.x, world.police.heli.z, S);
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - 3, z - 3, 6, 6);
    }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  for (const t of world.traffic || []) {
    const [x, z] = worldToMini(t.x, t.z, S);
    ctx.fillRect(x - 1.5, z - 1.5, 3, 3);
  }
  // Player arrow.
  const [px, pz] = worldToMini(p.x, p.z, S);
  ctx.save();
  ctx.translate(px, pz);
  ctx.rotate(Math.atan2(Math.sin(p.heading), -Math.cos(p.heading)) + Math.PI);
  ctx.fillStyle = '#ffc83e';
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(5, 5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px Arial';
  ctx.fillText('N', S / 2 - 3, 12);
}

// --- Full map screen -----------------------------------------------------

function drawStar(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function drawEmblem(ctx, kind, x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, 7);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  if (kind === 'anchor') {
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.55);
    ctx.lineTo(0, r * 0.5);
    ctx.moveTo(-r * 0.4, -r * 0.3);
    ctx.lineTo(r * 0.4, -r * 0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, r * 0.15, r * 0.45, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else if (kind === 'flower') {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4, r * 0.32, 0, 7);
      ctx.fill();
    }
    ctx.fillStyle = '#ffc83e';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.28, 0, 7);
    ctx.fill();
  } else if (kind === 'star') {
    drawStar(ctx, 0, 0, r * 0.62, '#fff');
  } else if (kind === 'coin') {
    ctx.font = `bold ${Math.round(r)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 0, 1);
  } else if (kind === 'diamond') {
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.6);
    ctx.lineTo(r * 0.5, 0);
    ctx.lineTo(0, r * 0.6);
    ctx.lineTo(-r * 0.5, 0);
    ctx.closePath();
    ctx.fill();
  } else {
    // Lantern: rounded body with a cap and glow lines.
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.5, 0, 7);
    ctx.fill();
    ctx.fillRect(-r * 0.18, -r * 0.75, r * 0.36, r * 0.25);
  }
  ctx.restore();
}

const POIS = [
  { x: -108, z: 72, label: 'WAREHOUSE', kind: 'diamond', color: '#e07f3f' },
  { x: -90, z: 126, label: 'DOCKS', kind: 'anchor', color: '#3f7fbf' },
  { x: -54, z: 126, label: 'SAFEHOUSE', kind: 'star', color: '#3fbfa8' },
  { x: 18, z: 54, label: 'GARAGE', kind: 'coin', color: '#3fbfa8' },
  { x: 54, z: 54, label: 'MARKET', kind: 'coin', color: '#e07f3f' },
  { x: 54, z: -90, label: 'MANSION', kind: 'star', color: '#a86fd8' },
  { x: -72, z: -108, label: 'CASINO', kind: 'star', color: '#d8a83f' },
];

export function drawMapScreen(world) {
  const cv = $('map-canvas');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.width;
  const H = cv.height;
  const toX = (x) => ((x + 150) / 300) * W;
  const toZ = (z) => ((z + 140) / 280) * H;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0e1420';
  ctx.fillRect(0, 0, W, H);
  // Sea + sand on the west edge.
  const seaW = toX(-126);
  const grad = ctx.createLinearGradient(0, 0, seaW, 0);
  grad.addColorStop(0, '#123a56');
  grad.addColorStop(1, '#1d5a7e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, seaW, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1.5;
  for (let y = 20; y < H; y += 34) {
    ctx.beginPath();
    for (let x = 6; x < seaW - 8; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.3 + y) * 2.5);
    ctx.stroke();
  }
  ctx.fillStyle = '#d9b380';
  ctx.fillRect(seaW, 0, toX(-118) - seaW, H);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px Arial';
  ctx.fillText('N ↑', 12, 20);
  ctx.save();
  ctx.translate(18, H / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('LAUT JAWA', 0, 4);
  ctx.restore();
  // District blocks.
  for (let gx = 0; gx < 6; gx++) {
    for (let gz = 0; gz < 6; gz++) {
      const wx = -108 + gx * 36;
      const wz = -108 + gz * 36;
      const d = districtAt(wx + 18, wz + 18);
      ctx.fillStyle = d.color;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(toX(wx), toZ(wz), toX(wx + 36) - toX(wx) - 3, toZ(wz + 36) - toZ(wz) - 3);
      ctx.globalAlpha = 1;
    }
  }
  // Boundary arcs: dashed circles around each district heart.
  const phase = G.shotMode ? 0 : G.time * 0.6;
  ctx.setLineDash([6, 5]);
  ctx.lineDashOffset = -phase * 8;
  for (const [cx, cz, color] of [[-72, -72, '#a86fd8'], [0, 0, '#6f7fe8'], [90, 0, '#d8a83f'], [-72, 90, '#3f7fbf'], [0, 90, '#e07f3f'], [-90, 0, '#3fbfa8']]) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(toX(cx), toZ(cz), 74, 0, 7);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
  // Route to the objective.
  const obj = world.objective;
  const p = G.player;
  if (obj) {
    ctx.strokeStyle = '#ffc83e';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(toX(p.x), toZ(p.z));
    ctx.lineTo(toX(obj.x), toZ(p.z));
    ctx.lineTo(toX(obj.x), toZ(obj.z));
    ctx.stroke();
    ctx.setLineDash([]);
    drawStar(ctx, toX(obj.x), toZ(obj.z), 10, '#ffc83e');
  }
  // District emblems + labels.
  const emblems = [
    { x: -90, z: 90, kind: 'anchor', label: 'PELABUHAN SEGARA', color: '#3f7fbf' },
    { x: 0, z: 0, kind: 'diamond', label: 'ALUN-ALUN', color: '#6f7fe8' },
    { x: -90, z: 0, kind: 'flower', label: 'PANTAI KIDUL', color: '#3fbfa8' },
    { x: 18, z: 90, kind: 'coin', label: 'PASAR SENJA', color: '#e07f3f' },
    { x: -36, z: -90, kind: 'flower', label: 'KAMPUNG BATIK', color: '#a86fd8' },
    { x: 72, z: -72, kind: 'lantern', label: 'LORONG EMAS', color: '#d8a83f' },
  ];
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  for (const e of emblems) {
    const x = toX(e.x);
    const y = toZ(e.z);
    drawEmblem(ctx, e.kind, x, y - 8, 17, e.color);
    const w = ctx.measureText(e.label).width + 14;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y + 14, w, 18, 9);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(e.label, x, y + 27);
  }
  // POI symbols with pulsing rings.
  for (const poi of POIS) {
    const x = toX(poi.x);
    const y = toZ(poi.z);
    const pulse = G.shotMode ? 0.5 : (Math.sin(G.time * 2 + poi.x) + 1) / 2;
    ctx.strokeStyle = poi.color;
    ctx.globalAlpha = 0.35 + pulse * 0.45;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 12 + pulse * 6, 0, 7);
    ctx.stroke();
    ctx.globalAlpha = 1;
    drawEmblem(ctx, poi.kind, x, y, 10, poi.color);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 10px Arial';
    ctx.fillText(poi.label, x, y + 24);
  }
  // Radar ring + search-zone circle around the player.
  const [px, pz] = [toX(p.x), toZ(p.z)];
  ctx.strokeStyle = '#ffc83e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(px, pz, 20, 0, 7);
  ctx.stroke();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(255,80,80,0.8)';
  ctx.beginPath();
  ctx.arc(px, pz, 46, 0, 7);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.save();
  ctx.translate(px, pz);
  ctx.rotate(Math.atan2(Math.sin(p.heading), -Math.cos(p.heading)) + Math.PI);
  ctx.fillStyle = '#ffc83e';
  ctx.beginPath();
  ctx.moveTo(0, -11);
  ctx.lineTo(8, 8);
  ctx.lineTo(-8, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Side panels: stats, missions, gauge.
  setText('map-story-pct', storyPct() + '%');
  const gauge = $('map-gauge-arc');
  if (gauge) gauge.style.strokeDashoffset = String(220 * (1 - storyPct() / 100));
  setText('stat-story', storyPct() + '%');
  setText('stat-rep', levelTitle() + ' · ' + G.rep);
  setText('stat-cash', '$' + G.cash.toLocaleString('en-US'));
  setText('stat-kills', String(G.stats.kills));
  setText('stat-stolen', String(G.stats.stolen));
  const hh = Math.floor(G.clockMin / 60) % 24;
  const mm = Math.floor(G.clockMin % 60);
  setText('stat-clock', `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · DAY ${G.day}`);
  setText('stat-wanted', '★'.repeat(G.wanted) + '☆'.repeat(5 - G.wanted));
  const list = $('map-missions');
  if (list) {
    const html = MISSIONS.map((mm2, i) => {
      const st = i < G.missionIdx || G.done.includes(i) ? 'DONE' : i === G.missionIdx ? 'ACTIVE' : '';
      const cls = st === 'DONE' ? 'done' : st === 'ACTIVE' ? 'active' : '';
      return `<div class="${cls}"><span>${i + 1}</span><b>${mm2.name}</b><em>${st}</em></div>`;
    }).join('');
    if (lastHud.mapMissions !== html) {
      lastHud.mapMissions = html;
      list.innerHTML = html;
    }
  }
}

// --- Screens -------------------------------------------------------------

export function showPassed(mission, reward) {
  setText('passed-title', 'MISSION PASSED');
  setText('passed-name', mission.name.toUpperCase());
  setText('passed-reward', `+$${reward}  ·  +${mission.rep} REP`);
  setText('passed-outro', mission.outro);
  showScreen('passed');
}

export function showSaves() {
  const box = $('save-slots');
  if (box) {
    box.innerHTML = [0, 1, 2].map((i) => {
      const has = hasSave(i);
      return `<button class="menu-btn" data-action="load" data-slot="${i}">${has ? 'SLOT ' + (i + 1) + ' — ' + saveSummary(i) : 'SLOT ' + (i + 1) + ' — EMPTY'}</button>`;
    }).join('');
  }
  showScreen('saves');
}

export function refreshGarage() {
  const box = $('garage-options');
  if (!box) return;
  const c = G.car;
  box.innerHTML = [
    `<button class="menu-btn" data-action="buy-engine">ENGINE LV ${c.engine} — $800 ${c.engine >= 3 ? '(MAX)' : ''}</button>`,
    `<button class="menu-btn" data-action="buy-armor">ARMOR LV ${c.armorUp} — $600 ${c.armorUp >= 3 ? '(MAX)' : ''}</button>`,
    `<button class="menu-btn" data-action="buy-paint">REPAINT — $300</button>`,
    `<button class="menu-btn" data-action="buy-spoiler">SPOILER — ${c.spoiler ? 'FITTED' : '$200'}</button>`,
    `<button class="menu-btn" data-action="repair">REPAIR — $${Math.round((100 - c.condition) * 4)}</button>`,
    `<button class="menu-btn" data-action="leave-garage">LEAVE GARAGE</button>`,
  ].join('');
  setText('garage-cash', '$' + G.cash.toLocaleString('en-US'));
}
