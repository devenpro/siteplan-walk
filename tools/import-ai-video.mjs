// Import selected AI loops into <project>/postcards: encode ≤1.5 MB H.264 loops, poster from frame 0, manifest 'ai-video' entries (media-lib owns the kind), provenance in ai-log.json.
// usage: node tools/import-ai-video.mjs projects/<slug> selection-video.json
// selection: { credit, model, settings:{…}, prompts:{id: prompt}, measures:{id:{aspect, seam, …}}, picks:{ id: "/abs/path.mp4#jobId" } }
import fs from 'node:fs'; import path from 'node:path';
import { readManifest, writeManifest, mergeOwned, ffprobe, encodeH264, posterFrom } from './media-lib.mjs';
const [proj, selPath] = process.argv.slice(2); const sel = JSON.parse(fs.readFileSync(selPath, 'utf8'));
const out = path.join(proj, 'postcards'); let manifest = readManifest(out);
const logP = path.join(out, 'ai-log.json'); const log = fs.existsSync(logP) ? JSON.parse(fs.readFileSync(logP, 'utf8')) : [];
for (const [id, spec] of Object.entries(sel.picks)) {
  const [src, jobId] = spec.split('#'); const file = `ai-${id}.mp4`, poster = `ai-${id}-poster.jpg`;
  const enc = encodeH264(src, path.join(out, file), { dropLastFrame: true }); posterFrom(path.join(out, file), path.join(out, poster), 0);
  const p = ffprobe(path.join(out, file));
  manifest = mergeOwned(manifest, ['ai-video'], { [id]: [{ file, poster, kind: 'ai-video', duration: +p.duration.toFixed(2), width: p.width, height: p.height, loop: true, from: `ai-${id}.jpg`, jobId, credit: sel.credit }] });
  log.push({ id, kind: 'ai-video', file, poster, jobId, model: sel.model, settings: sel.settings, prompt: sel.prompts[id], measures: sel.measures?.[id], encode: enc, date: new Date().toISOString().slice(0, 10) });
  console.log('imported', file, enc.bytes, 'bytes at crf', enc.crf);
}
writeManifest(out, manifest); fs.writeFileSync(logP, JSON.stringify(log, null, 2) + '\n');
