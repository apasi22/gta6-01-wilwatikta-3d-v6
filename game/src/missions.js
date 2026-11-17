// The story: twelve missions across Wilwatikta, from a welcome errand to a
// cross-city finale. Each mission names its giver, its objective type, its
// target points, its timer and reward, and the dialogue Sugeng hears. The
// main loop interprets the types; this file only holds the story.

import { G } from './state.js';

export const MISSIONS = [
  {
    name: 'Selamat Datang',
    giver: 'AGUS',
    type: 'goto',
    points: [{ x: 18, z: -18, label: 'Alun-Alun' }],
    timer: 180,
    reward: 400,
    rep: 120,
    brief: 'Meet Agus at the old square and learn the city.',
    dialogue: [
      { who: 'AGUS', role: 'FIXER', text: 'Selamat datang, Sugeng. Wilwatikta runs on drivers who keep their mouth shut.' },
      { who: 'SUGENG', role: 'DRIVER', text: 'I drive. I do not talk. Where to first?' },
    ],
    outro: 'Agus smiles. The city is open now — and it is watching.',
  },
  {
    name: 'Hot Wheels',
    giver: 'AGUS',
    type: 'steal',
    points: [
      { x: 90, z: -90, label: 'Kencana S', car: 'hero', color: 0xe8c838 },
      { x: 18, z: 62, label: 'Bengkel Bambang' },
    ],
    timer: 240,
    reward: 700,
    rep: 160,
    brief: 'Steal the gold Kencana S from Lorong Emas and deliver it to the garage.',
    dialogue: [
      { who: 'AGUS', role: 'FIXER', text: 'A gold Kencana S sits outside the casino. Bring it to Bambang — quietly.' },
      { who: 'SUGENG', role: 'DRIVER', text: 'Quietly is my middle name. Mostly.' },
    ],
    outro: 'Bambang whistles at the paint. "Gold suits you, Sugeng."',
  },
  {
    name: 'Antar Paket',
    giver: 'RATNA',
    type: 'goto',
    points: [{ x: -90, z: 90, label: 'Gudang 7, Pelabuhan Segara' }],
    timer: 150,
    reward: 500,
    rep: 140,
    brief: 'Deliver Ratna’s package to warehouse 7 at the docks. Do not open it.',
    dialogue: [
      { who: 'RATNA', role: 'PELARI', text: 'Package goes to the docks. Fast. And Sugeng — do NOT open it.' },
      { who: 'SUGENG', role: 'DRIVER', text: 'I never open anything. I only drive.' },
    ],
    outro: 'The dockworker nods once. The package is gone. So is the question.',
  },
  {
    name: 'Tagihan Pasar',
    giver: 'AGUS',
    type: 'goto',
    points: [{ x: -18, z: 90, label: 'Pasar Senja' }],
    timer: 200,
    reward: 550,
    rep: 150,
    brief: 'Collect the market debt from the stalls at Pasar Senja.',
    dialogue: [
      { who: 'AGUS', role: 'FIXER', text: 'Three stalls owe the crew. Collect, smile, leave. No broken noses today.' },
      { who: 'SUGENG', role: 'DRIVER', text: 'Smiling costs extra.' },
    ],
    outro: 'The envelopes are fat. The market keeps its secrets.',
  },
  {
    name: 'Mata-Mata',
    giver: 'KOMISARIS WANTO',
    type: 'chase',
    points: [{ x: 54, z: 18, label: 'Mobil mata-mata' }],
    timer: 240,
    reward: 800,
    rep: 200,
    brief: 'A spy car is tailing the crew. Ram it until it stops.',
    dialogue: [
      { who: 'KOMISARIS WANTO', role: 'WPD', text: 'Wibowo. A spy car follows my people. End it — and I owe you one.' },
      { who: 'SUGENG', role: 'DRIVER', text: 'A cop asking me for a favor. The city really is upside down.' },
    ],
    outro: 'The spy car smokes by the curb. Wanto owes Sugeng one.',
  },
  {
    name: 'Balapan Senja',
    giver: 'BAMBANG',
    type: 'race',
    points: [
      { x: -108, z: -54, label: 'Pantai Kidul' },
      { x: 36, z: -108, label: 'Lorong Emas' },
      { x: 108, z: 54, label: 'Gerbang Timur' },
    ],
    timer: 210,
    reward: 900,
    rep: 220,
    brief: 'Sunset race: three checkpoints, one city, no brakes.',
    dialogue: [
      { who: 'BAMBANG', role: 'MEKANIK', text: 'I tuned your Garuda myself. Win the sunset race and the whole strip talks.' },
      { who: 'SUGENG', role: 'DRIVER', text: 'Talk is cheap. Speed is not.' },
    ],
    outro: 'First across the line. The strip talks all night.',
  },
  {
    name: 'Gudang Segara',
    giver: 'RATNA',
    type: 'steal',
    points: [
      { x: -90, z: 108, label: 'Van Gudang', car: 'van', color: 0x4e6e8e },
      { x: 18, z: 62, label: 'Bengkel Bambang' },
    ],
    timer: 260,
    reward: 850,
    rep: 200,
    brief: 'Steal the warehouse van from the docks and bring it to the garage.',
    dialogue: [
      { who: 'RATNA', role: 'PELARI', text: 'A van full of "spare parts" waits at the docks. Bring it home, Sugeng.' },
      { who: 'SUGENG', role: 'DRIVER', text: 'Spare parts. Right. Heavy spare parts.' },
    ],
    outro: 'The van’s cargo stays a mystery. The pay is not.',
  },
  {
    name: 'Kabur dari WPD',
    giver: 'AGUS',
    type: 'escape',
    points: [{ x: -108, z: -108, label: 'Ujung Pantai' }],
    timer: 200,
    reward: 750,
    rep: 240,
    brief: 'Three stars and rising. Break line of sight and lose the heat.',
    dialogue: [
      { who: 'AGUS', role: 'FIXER', text: 'The whole department is on you. Break line of sight — alleys, sand, anywhere.' },
      { who: 'SUGENG', role: 'DRIVER', text: 'They can chase. They cannot catch.' },
    ],
    outro: 'Sirens fade behind the palms. Sugeng breathes again.',
  },
  {
    name: 'Heat Wave',
    giver: 'KOMISARIS WANTO',
    type: 'escape',
    points: [{ x: -108, z: 108, label: 'Dermaga' }],
    timer: 240,
    reward: 1100,
    rep: 300,
    brief: 'Outrun the helicopter — reach the docks!',
    dialogue: [
      { who: 'AGUS', role: 'FIXER', text: 'Roadblock on Pantai road! Ram it or cut through the sand — your call, Sugeng.' },
      { who: 'KOMISARIS WANTO', role: 'WPD', text: 'Air support is on you, Wibowo. The whole city is watching.' },
    ],
    outro: 'The helicopter circles empty sand. Sugeng is already gone.',
  },
  {
    name: 'Kencana Hilang',
    giver: 'BAMBANG',
    type: 'steal',
    points: [
      { x: -54, z: -90, label: 'Kencana curian', car: 'hero', color: 0x38a8c8 },
      { x: 18, z: 62, label: 'Bengkel Bambang' },
    ],
    timer: 260,
    reward: 1000,
    rep: 260,
    brief: 'Someone stole Bambang’s own Kencana. Take it back.',
    dialogue: [
      { who: 'BAMBANG', role: 'MEKANIK', text: 'They took my Kencana from Kampung Batik! Bring her home, Sugeng.' },
      { who: 'SUGENG', role: 'DRIVER', text: 'Nobody steals from family. Not in my city.' },
    ],
    outro: 'Bambang hugs the bumper. "She missed you too, sayang."',
  },
  {
    name: 'Double Cross',
    giver: 'RATNA',
    type: 'combat',
    points: [{ x: 90, z: -54, label: 'Kasino Lorong Emas' }],
    timer: 300,
    reward: 1400,
    rep: 340,
    brief: 'The casino crew set you up. Settle it — four of them, one of you.',
    dialogue: [
      { who: 'RATNA', role: 'PELARI', text: 'It was a setup, Sugeng. Four guns wait at the casino. End it.' },
      { who: 'SUGENG', role: 'DRIVER', text: 'Four guns. One driver. Fair odds.' },
    ],
    outro: 'The casino goes quiet. Wilwatikta learns a name tonight.',
  },
  {
    name: 'The Last Ride',
    giver: 'AGUS',
    type: 'race',
    points: [
      { x: -108, z: 108, label: 'Dermaga' },
      { x: 18, z: -18, label: 'Alun-Alun' },
      { x: 108, z: -108, label: 'Gerbang Timur' },
      { x: -108, z: -108, label: 'Ujung Pantai' },
    ],
    timer: 300,
    reward: 2500,
    rep: 500,
    brief: 'Cross the city and vanish into the sunset.',
    dialogue: [
      { who: 'AGUS', role: 'FIXER', text: 'One last ride, Sugeng. Cross the city. Vanish into the sunset.' },
      { who: 'KOMISARIS WANTO', role: 'WPD', text: 'Sugeng Wibowo, pull over! The whole city is watching tonight.' },
    ],
    outro: 'Legenda Wilwatikta. The sunset keeps the secret.',
  },
];

export function currentMission() {
  return MISSIONS[Math.min(G.missionIdx, MISSIONS.length - 1)];
}
