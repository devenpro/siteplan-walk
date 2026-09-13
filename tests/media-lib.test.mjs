import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { readManifest, writeManifest, entryKey, mergeOwned, countByKind } from '../tools/media-lib.mjs';
import { sortByRank } from '../viewer/media-kinds.js';

test('readManifest defaults, writeManifest round-trips', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ml-')); assert.deepEqual(readManifest(dir), { images: {} });
  writeManifest(dir, { images: { a: [{ file: 'x.jpg', kind: 'plan' }] } }); assert.deepEqual(readManifest(dir).images.a[0].file, 'x.jpg');
});
test('entryKey: files by name, embeds by provider+id', () => {
  assert.equal(entryKey({ kind: 'plan', file: 'p.jpg' }), 'file:p.jpg'); assert.equal(entryKey({ kind: 'embed', provider: 'youtube', id: 'abc' }), 'embed:youtube:abc');
});
test('mergeOwned: replaces only the owned kinds for the touched hotspots, keeps the rest, dedupes, sorts by rank', () => {
  const existing = { images: { a: [{ file: 'ai-a.jpg', kind: 'ai' }, { file: 'plan-a.jpg', kind: 'plan' }], b: [{ file: 'plan-b.jpg', kind: 'plan' }] } };
  const out = mergeOwned(existing, ['developer', 'plan'], { a: [{ file: 'dev-1.webp', kind: 'developer' }, { file: 'plan-a.jpg', kind: 'plan' }, { file: 'plan-a.jpg', kind: 'plan' }] });
  assert.deepEqual(out.images.a.map(e => e.kind), ['developer', 'ai', 'plan'], 'developer first (rank), ai kept, plan replaced once');
  assert.deepEqual(out.images.b, existing.images.b, 'untouched hotspot keeps everything');
  assert.deepEqual(existing.images.a.map(e => e.kind), ['ai', 'plan'], 'input not mutated');
  const emb = mergeOwned({ images: { a: [{ kind: 'embed', provider: 'youtube', id: 'X' }] } }, ['embed'], { a: [{ kind: 'embed', provider: 'youtube', id: 'X', title: 't' }] });
  assert.equal(emb.images.a.length, 1);
});
test('Belvedere fixture: a dry merge of the committed manifest reproduces it exactly (order included)', () => {
  const m = readManifest('projects/belvedere/postcards');
  const devPlan = Object.fromEntries(Object.entries(m.images).map(([id, l]) => [id, l.filter(e => e.kind === 'developer' || e.kind === 'plan')]));
  const out = mergeOwned(m, ['developer', 'plan'], devPlan);
  assert.deepEqual(out.images, Object.fromEntries(Object.entries(m.images).map(([id, l]) => [id, sortByRank(l)])));
  assert.deepEqual(countByKind(out), countByKind(m));
});

// ---- ffmpeg helpers (C2), exercised on a synthetic 1 s test-pattern clip ----
import { execFileSync } from 'node:child_process';
import { ffprobe, encodeH264, posterFrom, frameAt, ssim, cropCentre16x9, squashTo16x9, reviewStrip } from '../tools/media-lib.mjs';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ml-video-'));
const synth = path.join(tmp, 'synth.mp4');   // 1 s, 10 fps, 320x180 test pattern (deterministic)
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=duration=1:size=320x180:rate=10', '-pix_fmt', 'yuv420p', synth]);

test('ffprobe reads duration, size, codec, frames', () => { const p = ffprobe(synth); assert.ok(Math.abs(p.duration - 1) < 0.15); assert.equal(p.width, 320); assert.equal(p.height, 180); assert.equal(p.codec, 'h264'); assert.equal(p.frames, 10); });
test('encodeH264: 1280 wide, faststart, no audio, drops the last frame on request, re-encodes over the byte ceiling', () => {
  const out = path.join(tmp, 'out.mp4'); const r = encodeH264(synth, out, { dropLastFrame: true });
  const p = ffprobe(out); assert.equal(p.width, 1280); assert.equal(p.frames, 9); assert.equal(r.crf, 23); assert.ok(r.bytes > 1000);
  const tiny = encodeH264(synth, path.join(tmp, 'tiny.mp4'), { maxBytes: 10 }); assert.equal(tiny.crf, 25, 'one re-encode step when over the ceiling');
});
test('posterFrom / frameAt write images; ssim is 1 for identical frames and lower for different ones', () => {
  const f0 = path.join(tmp, 'f0.png'), f9 = path.join(tmp, 'f9.png'), jpg = path.join(tmp, 'poster.jpg');
  frameAt(synth, f0, 0); frameAt(synth, f9, 0.9); posterFrom(synth, jpg, 0);
  assert.ok(fs.statSync(jpg).size > 500); assert.ok(Math.abs(ssim(f0, f0) - 1) < 1e-3); assert.ok(ssim(f0, f9) < 0.99);
});
test('cropCentre16x9 / squashTo16x9 / reviewStrip produce the expected shapes', () => {
  const still = path.join(tmp, 'still.png'); execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=size=1024x683:rate=1', '-frames:v', '1', still]);
  const c = path.join(tmp, 'crop.png'); cropCentre16x9(still, c); assert.deepEqual([ffprobe(c).width, ffprobe(c).height], [1024, 576]);
  const s = path.join(tmp, 'squash.png'); squashTo16x9(still, s); assert.deepEqual([ffprobe(s).width, ffprobe(s).height], [1280, 720]);
  const strip = path.join(tmp, 'strip.png'); reviewStrip(synth, strip, [0, 0.5, 0.9]); assert.equal(ffprobe(strip).width, 1920);
});

// ---- audio layer (C2b) on synthetic inputs: a tone stands in for speech, quiet pink noise for ambience ----
import { hasAudio, loudness, synthClick, mixNarration } from '../tools/media-lib.mjs';
const ffprobeDuration = f => +JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', f], { encoding: 'utf8' })).format.duration;
const voice = path.join(tmp, 'voice.wav'), bed = path.join(tmp, 'bed.wav'), click = path.join(tmp, 'click.wav'), narrated = path.join(tmp, 'narrated.mp4');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=1:sample_rate=48000', voice]);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anoisesrc=d=1:c=pink:r=48000:a=0.05', bed]);
test('hasAudio / loudness / synthClick', () => {
  assert.equal(hasAudio(synth), false); assert.equal(hasAudio(voice), true);
  const l = loudness(voice); assert.ok(l < 0 && l > -40, 'LUFS in a sane range: ' + l);
  synthClick(click); assert.ok(hasAudio(click)); assert.ok(ffprobeDuration(click) < 0.2);
});
test('mixNarration: muxes voice + ducked bed + click onto the video, normalised near -16 LUFS, audio stream present, duration = video', () => {
  const r = mixNarration({ video: synth, voice, ambience: bed, click, out: narrated });
  assert.ok(hasAudio(narrated)); assert.ok(Math.abs(r.duration - 1) < 0.15); assert.ok(r.lufs > -20 && r.lufs < -12, 'mix LUFS ' + r.lufs); assert.ok(r.bytes > 1000);
});
