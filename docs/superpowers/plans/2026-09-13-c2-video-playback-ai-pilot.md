# C2 — Video playback lifecycle + AI loop pilot (Kling 3.0, 2 loops) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the gallery play video the way the spec says (muted, gated autoplay, one decoder at a time, poster + play button when autoplay is refused, pause when hidden), build the ffmpeg-backed tooling that turns a generated clip into a ≤1.5 MB looping MP4 + poster + manifest entry, and run the two-loop Kling pilot that decides the aspect route for C3's batch — with every number (cost, aspect SSIM, loop seam SSIM) recorded.

**Architecture:** `tools/media-lib.mjs` gains ffmpeg helpers (`ffprobe`, `encodeH264`, `posterFrom`, `frameAt`, `ssim`, `cropCentre16x9`, `reviewStrip`), node-tested on a synthetic clip. `tools/import-ai-video.mjs` mirrors `import-ai.mjs`: selection → encode → poster → `mergeOwned(…, ['ai-video'], …)` → `ai-log.json`. `viewer/gallery.js` renders `video|ai-video` as `<video muted playsinline preload="none">` with `data-src`, activates only the visible slide (src + `play()`), deactivates the others (`pause(); removeAttribute('src'); load()`), shows a play button when the gate or the browser refuses, pauses on `visibilitychange`, and exposes `playing`. `app.js` passes the tour state into the gate, clears the gallery on deselect, and slows the ring pulse to 20 fps while a video plays. The pilot itself is two `generate_video` calls after the model card and a `get_cost` preflight.

**Tech Stack:** ffmpeg 6.1 (`libx264`, `ssim`, `scale`, `crop`, `tile`), Higgsfield MCP (`media_import_url`, `generate_video` `kling3_0`, `job_status`), HTML5 video, Playwright/SwiftShader (H.264 decode probed OK).

**Spec:** `docs/superpowers/specs/2026-09-12-siteplan-arc2-render-media-design.md` §"C2 — AI loops" (model / capability / resources / prompt / aspect route / selection / post) + the playback lifecycle and autoplay gate from §"C3 — playback + embeds" (the sub-phase table puts `app.js (video lifecycle, gate)` in C2; embeds and `make-videos.mjs` stay in C3); rulings 6 (Kling 3.0 pro, silent, 5 s, 16:9, start=end frame; pilot 2 then batch 12×2; ceiling ≈270 cr) and 13 (muted autoplay with a gate). Owner rule: the video model card below precedes any generation call, preflight included ([[feedback-video-generation-model-card]]).

## Context

C1 is merged (`75b09a0`, live 26/26): the gallery already ranks `ai-video` between official embeds and AI stills, renders video kinds as poster + play glyph, and the tools own their kinds. Nothing plays yet and no loop exists. C2 turns two of the 14 AI postcards into 5-second loops and makes them play — and, more importantly, settles two questions for the 180-credit C3 batch with measurements rather than eyeballing: **does Kling crop or squash a 3:2 postcard into 16:9?** and **does start=end-frame conditioning actually close the loop?**

**Verified before planning (2026-09-13):** `kling3_0` = Kling v3.0 with `duration 3–15 (default 5)`, `mode std|pro|4k`, `sound on|off`, medias `start_image`/`end_image`, aspect `16:9|9:16|1:1`. ffmpeg 6.1 with `libx264`, `aac`, `ssim`, `psnr`, `xfade`, `crop`, `scale`; ImageMagick `convert`/`compare` present too. The live nginx already answers `Accept-Ranges: bytes`. Pilot postcards: `ai-stepped-well-plaza.jpg` (water) and `ai-yoga-lawn.jpg` (foliage), 1024×683, served live. Headless Chromium decodes H.264 (probed in arc-2 planning). Balance ≈ 5,910 credits.

**Two things stated so they are not mistaken for drift:** (1) the aspect route is measured with ffmpeg SSIM (frame 0 vs a centre 16:9 crop of the postcard, vs the postcard squashed to 16:9 — whichever matches better is what the model did) instead of ImageMagick RMSE — same decision, a bounded 0..1 number; (2) the loop-seam test is SSIM(frame 0, last frame) with the acceptance floor set *from the pilot* as the spec says (a clip that visibly returns home defines the bar; the plan proposes ≥ 0.85 and records what the pilot gives).

## Model card — video (the disclosure; approving this plan approves it; restated in one line before each call)

- **Model:** `kling3_0` — Kling v3.0 (Kling). Settings: `mode: 'pro'`, `sound: 'off'`, `duration: 5`, `aspect_ratio: '16:9'`, `count: 1`. `use_unlim: false` (credits).
- **Capability:** image-to-video with start **and** end frame conditioning — the clip is pulled back to the start frame, which is what makes a seamless loop possible; animates foliage, water, cloud shadows and small camera drift; cannot guarantee geometry (may bend fins, add people, change light); no negative-prompt field (the avoid-list lives in the prompt); 16:9 output from a 3:2 input means the model recomposes — crop or squash — which the pilot measures.
- **Resources:** two postcards imported by `media_import_url` from the live URLs `https://walk.csoul.cloud/belvedere/postcards/ai-stepped-well-plaza.jpg` and `…/ai-yoga-lawn.jpg`; each media_id used twice (`start_image` and `end_image`); no style references. Credits: `get_cost: true` first; spec estimate 15 for the pair; **ceiling 20 credits for the pilot** — above that, STOP and ask. Two generations, no retries without asking.
- **Prompt (verbatim; base + one class clause):**
  > One continuous locked-off shot from a fixed camera. The scene slowly comes alive: {CLASS}. Camera drift no more than two degrees, returning exactly to the starting composition so the clip loops seamlessly. Light, exposure and colour stay unchanged from the first frame to the last. Keep every building, tree, path and line exactly where it is; no new buildings, people, vehicles, text, signs or logos; no water unless it is visible in the frame. Silent.
  - `stepped-well-plaza` (water): `{CLASS}` = "ripples spread across the pool and its reflections shimmer, the surrounding planting sways lightly, a cloud shadow drifts across the stone steps"
  - `yoga-lawn` (foliage): `{CLASS}` = "leaves and palm fronds sway in a light breeze, the grass ripples, a cloud shadow drifts slowly across the lawn"
  - (for C3) plaza-court: "a light breeze moves the planting, a cloud shadow drifts across the paving"; portal-arrival: "the trees sway, a cloud shadow drifts along the boulevard".
- **Selection rule (spec):** reject invented elements, tower-count change, bent geometry, cuts or zooms, and a seam that does not close (SSIM(first, last) below the floor). Review = 3-frame strip (0 / 2.5 / 5 s) per candidate, read as an image.

## Global Constraints

- ≤2 generations in this sub-phase, `count: 1`, preflighted; no batch, no upscale. Rejected clips are not imported.
- Every loop is labelled "AI loop · indicative" with the credit "AI visualisation via Higgsfield · indicative, not a developer video"; never presented as footage.
- Playback: muted, `playsinline`, `preload="none"`, `src` only on the active slide (one decoder), autoplay only when the tab is visible, no `prefers-reduced-motion`, no `saveData`, no tour running; refusal → poster + play button; `visibilitychange` pauses/resumes. The render loop is untouched by playback except the ring pulse slowing to 20 fps while a video plays.
- Encoded loops ≤ 1.5 MB (CRF 23, then 25), 1280 wide, yuv420p, faststart, no audio; posters are frame 0 as JPEG.
- `check.mjs` runs alone in the background (1500 s); it already opens its main context with `reducedMotion: 'reduce'` — **the autoplay test uses a second, default context**. Screenshots and review strips are read as images. Explicit `q=` in shot URLs.
- Commit per task with the trailers; branch `arc2-c2` off master; merge after the owner's phone gate (autoplay + heat).

## File structure

| File | Responsibility |
|---|---|
| `tools/media-lib.mjs` (modify) | `+ ffprobe(file)`, `encodeH264(src, dst, opts)`, `posterFrom(src, dst, t)`, `frameAt(src, dst, t)`, `ssim(a, b)`, `cropCentre16x9(src, dst)`, `squashTo16x9(src, dst)`, `reviewStrip(src, dst)`. |
| `tests/media-lib.test.mjs` (modify) | ffmpeg helper tests on a synthetic `testsrc` clip. |
| `tools/import-ai-video.mjs` (new) | selection-video.json → `ai-<id>.mp4` + `ai-<id>-poster.jpg` + manifest (`ai-video`) + `ai-log.json`. |
| `viewer/gallery.js` (modify) | video rendering, activation/deactivation, gate, play button, visibility, `playing`, `clear()`. |
| `viewer/style.css` (modify) | `.media.video video`, `.playbtn`. |
| `viewer/app.js` (modify) | `canAutoplay: () => !tour`, `deselect()` → `gallery.clear()`, ring pulse 20 fps while playing. |
| `projects/belvedere/postcards/{ai-stepped-well-plaza.mp4, ai-stepped-well-plaza-poster.jpg, ai-yoga-lawn.mp4, ai-yoga-lawn-poster.jpg, manifest.json, ai-log.json}` | the pilot's outputs (only accepted clips). |
| `projects/belvedere/source/ai-loops/` (untracked; `.gitignore`) | raw downloads + frames + strips. |
| `tools/check.mjs` (modify) | ai-video data check, decode + Range check, autoplay gate check (two contexts). |
| `README.md`, `docs/adding-a-project.md` (modify) | §4b AI loops (model / settings / resources / prompt / pilot / review / import), playback rules. |
| `docs/superpowers/plans/2026-09-13-c2-video-playback-ai-pilot.md`, `docs/checkpoints/c2/` | plan + evidence (review strips, measurements JSON, viewer shots). |
| `tools/_c2-shots.mjs`, `tools/_c2-smoke.mjs` (gitignored) | shots + a 1-minute playback smoke test. |

---

### Task 0: branch + plan file

- [ ] `git switch -c arc2-c2`; copy this plan to `docs/superpowers/plans/2026-09-13-c2-video-playback-ai-pilot.md`; commit "C2 implementation plan (video playback lifecycle + Kling loop pilot, model card included)". `mkdir -p docs/checkpoints/c2 projects/belvedere/source/ai-loops`; append `projects/*/source/ai-loops/` to `.gitignore`.

---

### Task 1: ffmpeg helpers in `tools/media-lib.mjs` (node-tested on a synthetic clip)

**Interfaces (produced):**
- `ffprobe(file)` → `{ duration: number (s), width, height, codec, frames: number }` (frames via `-count_frames`).
- `encodeH264(src, dst, { crf = 23, maxBytes = 1.5e6, dropLastFrame = false, audio = false, width = 1280 } = {})` → `{ bytes, crf }` — encodes at `crf`; if `bytes > maxBytes` re-encodes at `crf + 2` once; `-profile:v high -preset slow -g 48 -movflags +faststart -vf scale=<width>:-2,format=yuv420p`, `-an` unless `audio` (then `-c:a aac -b:a 96k`); `dropLastFrame` → `-frames:v (frames − 1)`.
- `posterFrom(src, dst, t = 0)` → writes a JPEG (`-q:v 3`); `frameAt(src, dst, t)` → PNG.
- `ssim(a, b, size = '1280x720')` → number 0..1 (both inputs scaled to `size`; parses `All:` from the `ssim` filter's stderr).
- `cropCentre16x9(src, dst)` → crops an image to a centred 16:9 window; `squashTo16x9(src, dst, w = 1280)` → non-uniform scale to `w × w·9/16`.
- `reviewStrip(src, dst, ts = [0, 2.5, 5])` → a 3-frame contact strip PNG (frames at the given times, tiled 3×1, each 640 wide).

- [ ] **Step 1: failing tests** — append to `tests/media-lib.test.mjs`:
```js
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
```
- [ ] **Step 2: run → fails** (missing exports).
- [ ] **Step 3: helpers** — append to `tools/media-lib.mjs`:
```js
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
```
- [ ] **Step 4: pass + commit** — `node --test tests/*.test.mjs`; commit "C2: media-lib ffmpeg helpers (probe, encode ≤1.5 MB, poster, frames, SSIM, 16:9 crop/squash, review strip) + synthetic-clip tests".

---

### Task 2: the pilot — card restated, preflight, two generations, measurements, review, import

**Files:** Create `tools/import-ai-video.mjs`; outputs into `projects/belvedere/postcards/` + `docs/checkpoints/c2/`; `.gitignore` for raw downloads.

- [ ] **Step 1: import tool** — `tools/import-ai-video.mjs`:
```js
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
```
`node --check`; commit "C2: import-ai-video.mjs (encode + poster + ai-video manifest entries + provenance)".
- [ ] **Step 2: references + preflight** — `media_import_url` × 2 (the live postcard URLs, type image) → media_ids; `generate_video` with the card's params, the stepped-well prompt, `medias: [{role:'start_image', value: id}, {role:'end_image', value: id}]`, `get_cost: true` → credits per clip. If 2 × cost > 20, STOP and ask.
- [ ] **Step 3: generate** — one line restating the card, then `generate_video` for `stepped-well-plaza`, then for `yoga-lawn` (each `count: 1`, `use_unlim: false`). Poll `job_status` (`sync: true`; video ≈ 60–180 s) → `results.rawUrl` → `curl` to `projects/belvedere/source/ai-loops/<id>.mp4`.
- [ ] **Step 4: measure (scratch script `tools/_c2-measure.mjs`, gitignored)** — per clip: `ffprobe` (duration, size); `frameAt` 0 and `duration − 1/fps` → `first.png`, `last.png`; `seam = ssim(first, last)`; aspect route: `cropCentre16x9(postcard)` → `crop.png`, `squashTo16x9(postcard)` → `squash.png`, `aCrop = ssim(first, crop)`, `aSquash = ssim(first, squash)` → `route = aCrop >= aSquash ? 'crop' : 'squash'` (with the margin `|aCrop − aSquash|` recorded); `reviewStrip` → `docs/checkpoints/c2/review-<id>.png`. Write `docs/checkpoints/c2/measure-pilot.json` `{ id: { duration, width, height, seam, aCrop, aSquash, route } }`. **Read each review strip as an image**: invented elements? tower/tree geometry bent? cut or zoom? does frame 5 s look like frame 0?
- [ ] **Step 5: verdict per clip** — accept when the visual review passes AND `seam ≥ 0.85` (record the pilot's actual values; if both clips return home visibly but read e.g. 0.80, set the floor at the lower accepted value and say so in the log — the spec says the threshold comes from the pilot). Rejected clips are not imported; if BOTH are rejected, STOP and report (the viewer work in Task 3 still lands, verified with a synthetic clip in a scratch manifest, but nothing AI ships).
- [ ] **Step 6: import** — write `selection-video.json` (scratch, gitignored) with credit `AI visualisation via Higgsfield · indicative, not a developer video`, model `kling3_0 (Kling v3.0), mode pro, sound off, 5 s, 16:9, start_image = end_image = the postcard`, prompts verbatim, measures, picks → `node tools/import-ai-video.mjs projects/belvedere selection-video.json` → `postcards/ai-<id>.mp4` (≤1.5 MB) + posters + manifest + `ai-log.json`. `node --test tests/*.test.mjs` (the manifest fixture still passes: `ai-video` is not an owned kind of the fixture merge). Commit "C2 pilot: <n> Kling loops imported — seam/aspect measured, route = <crop|squash>" with the review strips + measurement JSON + encoded loops.

---

### Task 3: playback in the gallery + app wiring

**Files:** Modify `viewer/gallery.js`, `viewer/style.css`, `viewer/app.js`.

- [ ] **Step 1: renderMedia video branch** — replace the `isVideoKind` branch in `viewer/gallery.js` with
```js
  if (entry.kind === 'embed') {   // official-channel facade: poster + provider word; the iframe lands in C3
    const wrap = document.createElement('div'); wrap.className = 'media poster embed';
    const im = document.createElement('img'); im.loading = 'lazy'; im.decoding = 'async'; im.src = base + 'postcards/' + entry.poster; im.alt = alt; wrap.appendChild(im);
    const play = document.createElement('span'); play.className = 'play'; play.setAttribute('aria-hidden', 'true'); wrap.appendChild(play); return wrap;
  }
  if (entry.kind === 'video' || entry.kind === 'ai-video') {   // muted, inline, no preload; src only while the slide is active (one decoder at a time)
    const wrap = document.createElement('div'); wrap.className = 'media video ' + entry.kind;
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'none'; v.poster = base + 'postcards/' + entry.poster; v.dataset.src = base + 'postcards/' + entry.file;
    v.loop = entry.loop !== false; if (entry.kind === 'video') v.controls = true; v.setAttribute('aria-label', alt); wrap.appendChild(v);
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'playbtn'; btn.hidden = true; btn.setAttribute('aria-label', 'Play'); btn.addEventListener('click', () => v.play().then(() => { btn.hidden = true; }).catch(() => {})); wrap.appendChild(btn);
    return wrap;
  }
```
- [ ] **Step 2: lifecycle** — in `createGallery({ …, canAutoplay = () => true })`:
```js
  const gate = () => document.visibilityState === 'visible' && !reduced.matches && !(navigator.connection && navigator.connection.saveData) && canAutoplay();
  const videoOf = i => strip.children[i] && strip.children[i].querySelector('video');
  const deactivate = v => { if (!v) return; v.pause(); if (v.getAttribute('src')) { v.removeAttribute('src'); v.load(); } const b = v.parentElement.querySelector('.playbtn'); if (b) b.hidden = true; };
  const activate = v => { if (!v) return; if (!v.getAttribute('src')) v.src = v.dataset.src; const b = v.parentElement.querySelector('.playbtn');
    if (gate()) v.play().then(() => { b.hidden = true; }).catch(() => { b.hidden = false; }); else b.hidden = false; };
```
In `setActive(i)` add `[...strip.children].forEach((s, k) => { if (k !== i) deactivate(s.querySelector('video')); }); activate(videoOf(i));` at the end. Add `function clear() { [...strip.children].forEach(s => deactivate(s.querySelector('video'))); if (io) io.disconnect(); strip.replaceChildren(); dots.replaceChildren(); entries = []; hotspot = null; }` and `document.addEventListener('visibilitychange', () => { const v = videoOf(index); if (!v) return; if (document.hidden) v.pause(); else if (gate() && v.getAttribute('src')) v.play().catch(() => {}); });`. Return also `clear, get playing() { const v = videoOf(index); return !!v && !!v.getAttribute('src') && !v.paused && !v.ended; }`.
- [ ] **Step 3: styles** — append to `viewer/style.css`:
```css
.postcard .video video { width: 100%; aspect-ratio: inherit; object-fit: cover; display: block; background: #000; }
.postcard .playbtn { position: absolute; left: 50%; top: 50%; width: 56px; height: 56px; margin: -28px 0 0 -28px; border: 0; border-radius: 50%; background: rgba(29,26,22,.72); cursor: pointer; }
.postcard .playbtn::after { content: ""; position: absolute; left: 22px; top: 16px; border-style: solid; border-width: 12px 0 12px 18px; border-color: transparent transparent transparent #fff; }
```
- [ ] **Step 4: app.js** — `createGallery({ …, canAutoplay: () => !tour })`; in `deselect()` add `gallery.clear();` before `showHome();`; in the loop replace `const animating = !!tween || (tour && !tour.paused) || ring.visible || now < dirtyUntil;` with `const busy = !!tween || (tour && !tour.paused) || now < dirtyUntil, animating = busy || ring.visible;` and the idle line `if (!dirty && !animating) { … }` gains a sibling right after it: `if (!dirty && !busy && ring.visible && gallery.playing && now - lastRender < 50) { prevBusy = false; return; }   // a loop is playing: the ring pulse drops to 20 fps so the phone's decoder and GPU are not both flat out`.
- [ ] **Step 5: smoke** — `tools/_c2-smoke.mjs`: default context (no reduced motion), dev url `q=low`, `select('stepped-well-plaza', false)`, wait 4 s → `{ playing: w.gallery.playing, src: !!video.getAttribute('src'), readyState, paused, currentTime }`; expect `playing true, currentTime > 0`; then `w.gallery.go(1)` → the video has no `src` any more (deactivated); `w.deselect()` → strip empty. Second run with `reducedMotion: 'reduce'` → `playing false`, play button visible (`!hidden`). Both must hold before the long check.
- [ ] **Step 6: commit** — "C2: gallery video lifecycle — muted inline playback, gated autoplay (visible, no reduced motion, no saveData, no tour), one decoder at a time, poster + play button on refusal, pause when hidden; ring pulse 20 fps while a loop plays".

---

### Task 4: checks (+ mutation), docs, deploy, evidence, STOP

- [ ] **Step 1: checks** — in `tools/check.mjs` (main page, after the hero-order check):
```js
  const loops = await p.evaluate(() => window.__walk.hotspots.flatMap(h => h.images.filter(e => e.kind === 'ai-video').map(e => ({ id: h.id, ...e }))));
  ok('AI loops: every ai-video entry has file + poster + ≈5 s + size + loop:true + the indicative credit', loops.length >= 1 && loops.every(e => e.file && e.poster && e.duration >= 4 && e.duration <= 6 && e.width >= 1200 && e.loop === true && /indicative/.test(e.credit)), JSON.stringify(loops.map(e => [e.id, e.file, e.duration, e.width + 'x' + e.height])));
  let rangeOk = true, decodeOk = true; for (const e of loops) { const h = await p.request.head(base + 'postcards/' + e.file); if (!/bytes/.test(h.headers()['accept-ranges'] || '')) rangeOk = false;
    const d = await p.evaluate(async src => new Promise(r => { const v = document.createElement('video'); v.muted = true; v.preload = 'metadata'; v.src = src; v.addEventListener('loadedmetadata', () => r({ duration: v.duration, w: v.videoWidth })); v.addEventListener('error', () => r(null)); setTimeout(() => r(null), 20000); }), base + 'postcards/' + e.file); if (!d || d.duration < 4 || d.w < 1200) decodeOk = false; }
  ok('loop files are served with Accept-Ranges and decode in the browser (loadedmetadata, ≈5 s, ≥1280 wide)', rangeOk && decodeOk, JSON.stringify({ rangeOk, decodeOk, n: loops.length }));
  const gateNo = await p.evaluate(async () => { const w = window.__walk; const h = w.hotspots.find(x => x.images.some(e => e.kind === 'ai-video')); if (!h) return { skipped: true }; w.select(h.id, false); await new Promise(r => setTimeout(r, 2500)); const v = document.querySelector('#dStrip .slide.active video'); return { id: h.id, playing: w.gallery.playing, btn: v ? !v.parentElement.querySelector('.playbtn').hidden : null, hasSrc: v ? !!v.getAttribute('src') : null }; });
  ok('autoplay gate: under prefers-reduced-motion the loop stays on its poster with a play button', gateNo.skipped || (gateNo.playing === false && gateNo.btn === true), JSON.stringify(gateNo));
```
and, in a **new default context** created after the tier loop (`const ctx2 = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p2 = await ctx2.newPage(); wire(p2);` boot the low page as the main one does):
```js
  const gateYes = await p2.evaluate(async () => { const w = window.__walk; const h = w.hotspots.find(x => x.images.some(e => e.kind === 'ai-video')); if (!h) return { skipped: true }; w.select(h.id, false); const t0 = Date.now(); while (!w.gallery.playing && Date.now() - t0 < 15000) await new Promise(r => setTimeout(r, 250));
    const v = document.querySelector('#dStrip .slide.active video'); await new Promise(r => setTimeout(r, 1500)); const t = v ? v.currentTime : -1; w.gallery.go(1); await new Promise(r => setTimeout(r, 600)); const srcAfter = v ? !!v.getAttribute('src') : null; w.deselect(); return { id: h.id, playing: t > 0.2, currentTime: +t.toFixed(2), srcAfterGo: srcAfter, stripEmpty: document.getElementById('dStrip').children.length === 0 }; });
  ok('autoplay: in a normal context the loop plays muted inline within 15 s, moving to another slide releases its decoder, deselect clears the strip', gateYes.skipped || (gateYes.playing && gateYes.srcAfterGo === false && gateYes.stripEmpty), JSON.stringify(gateYes));
```
Run alone (background) → **30/30**. Mutation (one combined run): (a) `gate` → `() => true` (reduced-motion check fails); (b) `activate` never sets `src`/never plays (normal-context check fails); expect exactly 2 failures → 28/30; restore → 30/30.
- [ ] **Step 2: docs** — guide §4b "AI loops": model card summary (model, settings, resources, prompt base + class clauses, cost per clip from the preflight), the pilot procedure (import → generate → `_c2-measure` → review strip → verdict → `import-ai-video.mjs`), the acceptance floor, the aspect route and what it means for the batch; README: playback rules (muted, gated autoplay, one decoder, "AI loop · indicative"), `ai-video` in the kinds list already. Commit.
- [ ] **Step 3: deploy + live + evidence** — `tools/deploy.sh belvedere`; live check (background) → 30/30; shots: desktop `q=high` `#h=stepped-well-plaza` after 5 s (loop playing — a still shows the frame + dots), the same with the play button forced (`reducedMotion` context), phone `q=mid` `#h=yoga-lawn`; save to `docs/checkpoints/c2/`; read; commit "C2: checkpoint evidence from the live URL".
- [ ] **Step 4: hand-off + STOP** — memory; send the owner the two review strips + the measurement numbers + a phone shot; gate: "On your phone open **11 Stepped well plaza** and **yoga lawn**: does the loop start on its own (muted), does it loop without a visible jump, does the phone stay cool over a minute, and does moving to the plan-detail slide stop it?" Also state the aspect route decided for C3.

## Verification (end to end)

1. `node --test tests/*.test.mjs` → all green (media-lib +4 ffmpeg tests on a synthetic clip).
2. Pilot: preflight cost recorded; 2 generations; `measure-pilot.json` with seam + aspect SSIMs + route; review strips read; verdict per clip in `ai-log.json`.
3. Smoke: normal context plays (`currentTime > 0`), reduced-motion context shows the play button; `go(1)` releases the decoder; `deselect` clears.
4. Dev check 30/30 (4 new checks; the two gate checks mutation-proved) → live 30/30 → shots → owner phone gate (autoplay + heat).

## Self-review

- **Spec coverage (§C2 + the C2 row):** model/capability/resources/prompt card (above; restated before calls); `media_import_url` of the live postcards, one media_id as start+end (T2); pilot = stepped-well + yoga-lawn, cost preflighted (T2); aspect route measured and decided (T2 step 4, hand-off); selection by 3-frame strip + seam floor from the pilot (T2 steps 4–5); post = drop the duplicated last frame, libx264 high/slow/crf 23/g 48/faststart/1280/yuv420p/-an, 1.5 MB ceiling → CRF 25, poster from frame 0 (T1 `encodeH264`, T2 import); `import-ai-video.mjs` mirrors `import-ai.mjs` and appends to `ai-log.json` (T2); `media-lib` ffmpeg helpers (T1); playback lifecycle + autoplay gate + single decoder + visibilitychange + native controls only for dev clips (T3); ring pulse 20 fps while playing (T3 step 4); checks incl. decode + Range (T4); evidence: two labelled loops live, owner on phone (T4). xfade: only "if RMSE high" — the seam SSIM is recorded and the floor gates acceptance instead; no xfade in C2 (revisit in C3 if the batch needs it).
- **Placeholders:** none.
- **Type consistency:** `encodeH264` returns `{ bytes, crf }`, `ffprobe` returns `{ duration, width, height, codec, frames }` — used that way by `import-ai-video.mjs` and the tests; `createGallery` gains `canAutoplay`, `clear`, `playing` — used by app.js and check.mjs; the `ai-video` entry shape `{ file, poster, kind, duration, width, height, loop, from, jobId, credit }` is what `renderMedia` and the checks read.
