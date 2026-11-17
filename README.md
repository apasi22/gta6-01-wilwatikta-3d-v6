# WILWATIKTA 3D

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/apasi22/gta6-01-wilwatikta-3d-v6/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/apasi22/gta6-01-wilwatikta-3d-v6/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game in a sun-soaked Javanese coastal city, built
for the [make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01). You are
Sugeng Wibowo, a getaway driver working twelve story missions across six
districts of Wilwatikta — from the docks of Pelabuhan Segara to the casino
strip of Lorong Emas — while the WPD police, roadblocks and a helicopter hunt
you down.

Everything is original and generated in code: a from-scratch raw WebGL
renderer, a procedural city, Javanese characters, cars and story, synthesized
gamelan radio and sound effects. No Rockstar content, no libraries, no
downloaded assets, no network requests.

## Play

Serve `game/` with any static HTTP server and open `game/index.html` in
desktop Chrome, for example:

```
cd game && python3 -m http.server 8080
```

Keyboard: WASD drive / walk, E enter or exit a car, Space shoot, F punch,
R reload, Q / 1-4 weapons, Z X C crew abilities, T radio, G garage, Tab map,
P pause. Mouse drag looks around while driving.

## Contents

- `game/index.html` — canvas, HUD, menus and styles.
- `game/src/` — one module per system: renderer, city, vehicles, characters,
  police and helicopter, missions, HUD and minimap, audio, saves and staging.
- `screenshots/` — four staged captures of the game itself, taken in Chrome.
- `main.ts` — copies the game and screenshots to the output and writes the
  dossier with the kit's vendored library.

MIT licensed. An original game — all art, names and music made in code.
