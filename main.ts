// Token Launch Radar — entrypoint (Node 22, standard library only).
//
// Reads the sealed snapshot (/input/snapshot.json, or --input <file|dir>),
// runs the radar-2 model in lib/model.ts, and writes into the output
// directory (/output, or MAKEFUN_OUTPUT_DIR, or --output):
//   board.json   the ranked board, one row per protocol
//   data.js      window.RADAR, everything the dashboard renders
//   dashboard/   a copy of this repo's static dashboard
//   screenshots/ a copy of this repo's screenshots
//   dossier.json built last with the vendored make.fun library, so the
//                scorer's rebuild of it from the same output matches.
//
// Local run:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const root = fileURLToPath(new URL('.', import.meta.url));

function readArg(name: string, fallback: string): string {
  const at = process.argv.indexOf('--' + name);
  if (at >= 0 && process.argv[at + 1]) return process.argv[at + 1]!;
  const eq = process.argv.find((a) => a.startsWith('--' + name + '='));
  return eq ? eq.slice(name.length + 3) : fallback;
}

const inputArg = readArg('input', '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write('token radar: no snapshot found at ' + inputFile + '\n');
  process.exit(2);
}
const outputDir = readArg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const problem = boardIssue(board, snapshot);
if (problem !== null) {
  process.stderr.write('token radar: refusing a board the gate would refuse: ' + problem + '\n');
  process.exit(1);
}

mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, 'board.json'), JSON.stringify({ rows: board }) + '\n');
writeFileSync(join(outputDir, 'data.js'), dataScript(radar));

function copyPlainFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const names: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const src = join(from, name);
    if (!statSync(src).isFile()) continue;
    copyFileSync(src, join(to, name));
    names.push(name);
  }
  return names;
}

copyPlainFiles(join(root, 'dashboard'), join(outputDir, 'dashboard'));
const shots = copyPlainFiles(join(root, 'screenshots'), join(outputDir, 'screenshots'));
if (shots.length < 3) {
  process.stderr.write('token radar: screenshots/ needs at least 3 images, found ' + shots.length + '\n');
  process.exit(1);
}
const NAME_OK = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;
for (const name of shots) {
  if (!NAME_OK.test(name)) {
    process.stderr.write('token radar: bad screenshot name ' + name + '\n');
    process.exit(1);
  }
}

writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 65536,
    screenshots: { max: 4, max_bytes: 524288 },
    dashboard: { max_files: 400, max_bytes: 4194304 },
  }),
);

process.stdout.write(
  'token radar: ' + snapshot.protocols.length + ' protocols scanned, ' + radar.pre_token + ' record no token, ' +
  board.length + ' ranked (' + radar.early_size + ' beyond the watchlist), ' + radar.live_size + ' live shown apart\n',
);
process.stdout.write('token radar: top row is ' + board[0]!.name + ' at $' + board[0]!.implied_value_usd.toLocaleString('en-US') + ' implied\n');
process.stdout.write(
  'token radar: ledger accounts for ' + radar.model.accounted + ' of ' + snapshot.protocols.length + ' protocols; held-out typical miss x' +
  radar.model.typical_miss + ' with ' + radar.model.within_3x_pct + '% of held-out protocols priced within 3x\n',
);
