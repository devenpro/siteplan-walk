// Shared manifest helpers for the postcard tools (node). Kinds and ranking come from viewer/media-kinds.js so the tools and the viewer cannot disagree.
import fs from 'node:fs'; import path from 'node:path';
import { sortByRank } from '../viewer/media-kinds.js';
export { RANK, KIND_LABEL, sortByRank } from '../viewer/media-kinds.js';
export const manifestPath = dir => path.join(dir, 'manifest.json');
export function readManifest(dir) { const p = manifestPath(dir); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : { images: {} }; }
export function writeManifest(dir, m) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(manifestPath(dir), JSON.stringify(m, null, 2) + '\n'); }
export const entryKey = e => e.kind === 'embed' ? `embed:${e.provider}:${e.id}` : `file:${e.file}`;
// A tool owns some kinds: for every hotspot it touches, its owned entries are replaced by what it produced now; every other kind is kept. Hotspots it does not mention keep everything.
export function mergeOwned(existing, ownedKinds, entriesById) {
  const owned = new Set(ownedKinds), out = { ...existing, images: { ...(existing.images || {}) } };
  for (const [id, entries] of Object.entries(entriesById)) {
    const kept = (out.images[id] || []).filter(e => !owned.has(e.kind)), seen = new Set(kept.map(entryKey)), add = [];
    for (const e of entries) { const k = entryKey(e); if (!seen.has(k)) { seen.add(k); add.push(e); } }
    out.images[id] = sortByRank([...kept, ...add]);
  }
  return out;
}
export const countByKind = m => Object.values(m.images).flat().reduce((a, e) => (a[e.kind] = (a[e.kind] || 0) + 1, a), {});

// ---- ffmpeg helpers (C2): probe, encode, posters, frames, similarity, aspect utilities, review strips. All synchronous; ffmpeg/ffprobe must be on PATH. ----
import { execFileSync, spawnSync } from 'node:child_process';
const run = (bin, args) => execFileSync(bin, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
export function ffprobe(file) {
  const j = JSON.parse(run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=width,height,codec_name,nb_read_frames:format=duration', '-of', 'json', file]));
  const s = j.streams[0] || {}; return { duration: +(j.format?.duration || 0), width: +s.width, height: +s.height, codec: s.codec_name, frames: +(s.nb_read_frames || 0) };
}
export function encodeH264(src, dst, { crf = 23, maxBytes = 1.5e6, dropLastFrame = false, audio = false, width = 1280 } = {}) {
  const frames = dropLastFrame ? ffprobe(src).frames - 1 : 0;
  const once = c => { run('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, ...(frames > 0 ? ['-frames:v', String(frames)] : []), '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', String(c), '-g', '48', '-movflags', '+faststart', '-vf', `scale=${width}:-2,format=yuv420p`, ...(audio ? ['-c:a', 'aac', '-b:a', '96k'] : ['-an']), dst]); return fs.statSync(dst).size; };
  let bytes = once(crf); if (bytes > maxBytes) { crf += 2; bytes = once(crf); }
  return { bytes, crf };
}
export function frameAt(src, dst, t = 0) { run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(t), '-i', src, '-frames:v', '1', dst]); return dst; }
export function posterFrom(src, dst, t = 0) { run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(t), '-i', src, '-frames:v', '1', '-q:v', '3', dst]); return dst; }
export function ssim(a, b, size = '1280x720') {   // the ssim filter prints its summary on stderr; spawnSync captures it whatever the exit code
  const r = spawnSync('ffmpeg', ['-loglevel', 'info', '-i', a, '-i', b, '-lavfi', `[0:v]scale=${size},format=yuv420p[a];[1:v]scale=${size},format=yuv420p[b];[a][b]ssim`, '-f', 'null', '-'], { encoding: 'utf8' });
  const m = String(r.stderr).match(/All:([0-9.]+)/); if (!m) throw new Error('ssim: no result\n' + r.stderr); return +m[1];
}
export function cropCentre16x9(src, dst) { const p = ffprobe(src); const h = Math.min(p.height, Math.round(p.width * 9 / 16)), w = Math.min(p.width, Math.round(h * 16 / 9)); run('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-vf', `crop=${w}:${h}`, dst]); return dst; }
export function squashTo16x9(src, dst, w = 1280) { run('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-vf', `scale=${w}:${Math.round(w * 9 / 16)}`, dst]); return dst; }
export function reviewStrip(src, dst, ts = [0, 2.5, 5]) {
  const p = ffprobe(src), fps = p.frames / Math.max(p.duration, 1e-6), sel = ts.map(t => `eq(n,${Math.min(p.frames - 1, Math.round(t * fps))})`).join('+');
  run('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-vf', `select='${sel}',scale=640:-2,tile=${ts.length}x1`, '-frames:v', '1', dst]); return dst;
}
