// Import selected AI clips into <project>/postcards: encode H.264 (≤1.5 MB silent loops, ≤4 MB narrated clips), poster from frame 0, manifest 'ai-video' entries (media-lib owns the kind), provenance in ai-log.json.
// usage: node tools/import-ai-video.mjs projects/<slug> selection-video.json
// selection: { credit, model, settings:{…}, prompts:{id: prompt}, measures:{id:{…}}, picks:{ id: "/abs/path.mp4#jobId" | { src, jobId, audio:true, loop:false, narration, voice:{…}, credit? } } }
// a string pick is a silent seamless loop (C2); an object pick with audio:true is a narrated clip (C2b): audio kept, last frame kept, loop:false, narration text carried for the viewer + the log
import fs from 'node:fs'; import path from 'node:path';
import { readManifest, writeManifest, mergeOwned, ffprobe, encodeH264, posterFrom, hasAudio } from './media-lib.mjs';
const [proj, selPath] = process.argv.slice(2); const sel = JSON.parse(fs.readFileSync(selPath, 'utf8'));
const out = path.join(proj, 'postcards'); let manifest = readManifest(out);
const logP = path.join(out, 'ai-log.json'); const log = fs.existsSync(logP) ? JSON.parse(fs.readFileSync(logP, 'utf8')) : [];
for (const [id, spec] of Object.entries(sel.picks)) {
  const pick = typeof spec === 'string' ? (([src, jobId]) => ({ src, jobId }))(spec.split('#')) : spec;
  const narrated = !!pick.audio, file = `ai-${id}.mp4`, poster = `ai-${id}-poster.jpg`;
  const enc = encodeH264(pick.src, path.join(out, file), narrated ? { audio: true, maxBytes: 4e6 } : { dropLastFrame: true }); posterFrom(path.join(out, file), path.join(out, poster), 0);
  if (narrated && !hasAudio(path.join(out, file))) throw new Error(`${file}: narrated pick has no audio stream after encode`);
  const p = ffprobe(path.join(out, file));
  const entry = { file, poster, kind: 'ai-video', duration: +p.duration.toFixed(2), width: p.width, height: p.height, loop: !narrated, from: `ai-${id}.jpg`, jobId: pick.jobId, credit: pick.credit || sel.credit };
  if (narrated) { entry.audio = true; entry.narration = pick.narration; }
  manifest = mergeOwned(manifest, ['ai-video'], { [id]: [entry] });
  log.push({ id, kind: 'ai-video', file, poster, jobId: pick.jobId, model: pick.model || sel.model, settings: pick.settings || sel.settings, prompt: sel.prompts[id], measures: sel.measures?.[id], ...(narrated ? { audio: true, narration: pick.narration, voice: pick.voice, mix: pick.mix } : {}), encode: enc, date: new Date().toISOString().slice(0, 10) });
  console.log('imported', file, enc.bytes, 'bytes at crf', enc.crf, narrated ? '(narrated)' : '(loop)');
}
writeManifest(out, manifest); fs.writeFileSync(logP, JSON.stringify(log, null, 2) + '\n');
