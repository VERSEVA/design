#!/usr/bin/env node
// Builds the studio's public 3D library from the VERSEVA asset library on disk:
//   studio/public/library/{glb,thumb}/  GLB objects + loops and their thumbnails (committed)
//   studio/src/data/library.json        the manifest the studio reads
// With --stage <dir>: writes the public release set (GLB, PNG renders, loop WebM/MP4/posters).
// Only the 3D is public (operator ruling 2026-10-13). Photography, video, Blender and MOV
// sources never leave disk. Local only (needs the asset library and cwebp).
// Rewrites a file only when its bytes change.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const studio = path.resolve(here, '..');
const LIB = path.resolve(process.env.VERSEVA_LIBRARY || path.join(studio, '../../../../../verseva-asset-library'));
const D3 = path.join(LIB, '3d');
const OUT = path.join(studio, 'public/library');
const MANIFEST = path.join(studio, 'src/data/library.json');
export const RELEASE_TAG = 'library-2026.10';
export const RELEASE_BASE = `https://github.com/verseva/design/releases/download/${RELEASE_TAG}/`;

const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'vsv-lib-'));
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

let written = 0;
let kept = 0;
function put(rel, buf) {
  const dest = path.join(OUT, rel);
  if (fs.existsSync(dest) && sha(fs.readFileSync(dest)) === sha(buf)) { kept++; return; }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  written++;
}
function webp(src, width, q) {
  const t = path.join(tmp, `w${written + kept}.webp`);
  execFileSync('cwebp', ['-quiet', '-q', String(q), '-resize', String(width), '0', '-metadata', 'none', src, '-o', t], { stdio: ['ignore', 'ignore', 'pipe'] });
  return fs.readFileSync(t);
}

export function buildManifest({ catalog, motion }) {
  const objects = catalog.assets.map((a) => ({
    id: a.id,
    name: a.name,
    title: a.name.replace(/-/g, ' '),
    family: a.family,
    edition: a.edition,
    uses: a.use_cases.split(',').map((s) => s.trim()),
    glb: `/library/glb/${a.id}.glb`,
    thumb: `/library/thumb/${a.id}.webp`,
    downloads: {
      png: `${RELEASE_BASE}${a.id}_${a.name}.png`,
      glb: `${RELEASE_BASE}${a.id}_${a.name}.glb`,
    },
  }));
  const loops = motion.assets.map((m) => {
    const stem = `${m.id}_${m.name}__${m.motion}`;
    return {
      id: m.id,
      name: m.name,
      motion: m.motion,
      title: `${m.name.replace(/-/g, ' ')}, ${m.motion.replace(/-/g, ' ')}`,
      seconds: m.duration_seconds,
      glb: `/library/glb/${stem}.glb`,
      thumb: `/library/thumb/${stem}.webp`,
      downloads: {
        glb: `${RELEASE_BASE}${stem}.glb`,
        webm: `${RELEASE_BASE}${stem}.webm`,
        mp4: `${RELEASE_BASE}${stem}.mp4`,
        poster: `${RELEASE_BASE}${stem}.png`,
      },
    };
  });
  return { tag: RELEASE_TAG, objects, loops };
}

function load() {
  const catalog = JSON.parse(fs.readFileSync(path.join(D3, 'catalog.json'), 'utf8'));
  const motion = JSON.parse(fs.readFileSync(path.join(D3, 'motion-01/manifest.json'), 'utf8'));
  return { catalog, motion };
}

function derive({ catalog, motion }) {
  for (const a of catalog.assets) {
    const buf = fs.readFileSync(path.join(D3, a.model));
    if (a.sha256 && sha(buf) !== a.sha256) throw new Error(`build-library: ${a.id} GLB sha256 does not match catalog.json`);
    put(`glb/${a.id}.glb`, buf);
    put(`thumb/${a.id}.webp`, webp(path.join(D3, a.render), 512, 80));
  }
  const dir = path.join(D3, 'motion-01');
  for (const m of motion.assets) {
    const stem = `${m.id}_${m.name}__${m.motion}`;
    put(`glb/${stem}.glb`, fs.readFileSync(path.join(dir, m.glb)));
    put(`thumb/${stem}.webp`, webp(path.join(dir, m.poster), 512, 80));
  }
}

function stage({ catalog, motion }, dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const cp = (from, name) => fs.copyFileSync(from, path.join(dir, name));
  for (const a of catalog.assets) {
    cp(path.join(D3, a.model), `${a.id}_${a.name}.glb`);
    cp(path.join(D3, a.render), `${a.id}_${a.name}.png`);
  }
  const d = path.join(D3, 'motion-01');
  for (const m of motion.assets) {
    const stem = `${m.id}_${m.name}__${m.motion}`;
    cp(path.join(d, m.glb), `${stem}.glb`);
    cp(path.join(d, m.webm), `${stem}.webm`);
    cp(path.join(d, m.preview), `${stem}.mp4`);
    cp(path.join(d, m.poster), `${stem}.png`);
  }
  const bad = fs.readdirSync(dir).filter((f) => !/\.(glb|png|webm|mp4)$/i.test(f));
  if (bad.length) throw new Error(`build-library: unexpected formats in release set: ${bad.join(', ')}`);
  const sums = fs.readdirSync(dir).sort().map((f) => `${sha(fs.readFileSync(path.join(dir, f)))}  ${f}`).join('\n');
  fs.writeFileSync(path.join(dir, 'SHA256SUMS.txt'), sums + '\n');
  console.log(`build-library: staged ${fs.readdirSync(dir).length} files -> ${dir}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const src = load();
  const manifest = buildManifest(src);
  const stageAt = process.argv.indexOf('--stage');
  if (stageAt > -1) stage(src, path.resolve(process.argv[stageAt + 1] || path.join(studio, '../../library-release')));
  else {
    for (const gone of ['photo', 'poster', 'preview']) fs.rmSync(path.join(OUT, gone), { recursive: true, force: true });
    derive(src);
    fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`build-library: ${manifest.objects.length} objects, ${manifest.loops.length} loops; ${written} written, ${kept} unchanged`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}
