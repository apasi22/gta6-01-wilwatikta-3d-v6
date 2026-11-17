// WILWATIKTA 3D — entry program for the make.fun GTA 6 bounty.
// Node 22, standard library only. It hands the game in: copies the static
// game/ folder and the screenshots/ folder beside this file into the output
// directory and writes dossier.json with the kit's vendored library, so the
// judge reads exactly what the scorer rebuilds. Run it twice and both runs
// write the same bytes: nothing here depends on time, randomness or the
// environment beyond the output directory override.
//
// Local check:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(root, 'game');
const shotsDir = join(root, 'screenshots');

mkdirSync(outDir, { recursive: true });
cpSync(gameDir, join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
}

// The scorer's caps: the text budget shapes the dossier bytes, the rest refuse
// an entry the scorer would refuse, so a bad build fails here, loudly.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
