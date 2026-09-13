# C2b — Narrated hotspot clips: video-model bake-off, TTS + ambience audio pipeline, one exemplar live — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the (correctly-but-uselessly) still silent loops with short narrated clips that visibly move and tell the visitor what they are looking at: pick the video model by a measured bake-off on one hotspot (motion, fidelity, cost — with a cheap candidate kept in the running), produce the narration by text-to-speech from our own vetted captions, layer the model's native ambience and a light click under it, and ship one exemplar (the stepped well) through the existing gallery — play once, hold the last frame, Replay; muted autoplay, "Listen" unmutes. The 14-clip scale-up is a separate plan once the model and voice are chosen and priced.

**Architecture:** Everything from C2 stays (encode/import tooling, gallery lifecycle, checks). `tools/media-lib.mjs` gains an audio layer (`synthClick`, `loudness`, `mixNarration`) and `import-ai-video.mjs` learns `audio: true, loop: false`. `viewer/gallery.js` renders a non-looping clip with a Listen button (unmute + restart) and a Replay button on `ended`. The bake-off is a scratch pipeline over the media-lib helpers writing a decision matrix; the model cards below are the disclosure the owner's rule requires and every credit is preflighted against a ceiling.

**Tech Stack:** Higgsfield MCP — `generate_video` (candidates below), `generate_audio` (`seed_audio`, `text2speech_v2`), `list_voices`, `media_import_url`, `job_status`; ffmpeg 6.1 (`ssim`, `sidechaincompress`, `loudnorm`, `ebur128`, `aevalsrc`, `amix`); HTML5 video.

**Spec / rulings — what changes and why:** ruling 6 (Kling 3.0 silent seamless loops, 12×2 batch) is **superseded by the owner on 2026-09-13** after seeing the pilot: frames one second apart were 99.7 % identical (motion index 0.0027) — the loop recipe (locked-off, ≤2° drift, start = end frame, "keep every line") produced a still. New brief: visible motion + narration; narration by TTS from our captions (owner's choice), a music bed only from a licensed track the owner supplies, model chosen by bake-off with a cheap door open, clips play once / hold / Replay. Ruling 13 (muted autoplay behind a gate) stands; unmuted audio is tap-only in every browser anyway. Ruling 4's ranking stands (`ai-video` above AI stills). The C3 batch spec is re-planned after this sub-phase with the winner's real cost.

## Context

C2 (branch `arc2-c2`, 9 commits, unmerged) built and verified the playback lifecycle and tooling; the two Kling loops that ride on it read as stills. The owner wants clips a visitor recognises as video and that speak — "what am I looking at" per hotspot — with music/effects for immersion. Platform facts that shape the design (verified 2026-09-13): Higgsfield's audio tool is **speech only** (`seed_audio`, `text2speech_v2` with `elevenlabs|minimax|seed_speech|vibe_voice|cozy_voice`, `qwen_audio_tts`); its music and SFX models are locked to the game pipeline and must not be used — so ambience comes from the video model's own native audio track, a click is synthesised in ffmpeg, and a music bed needs a licensed file from the owner. Video candidates with image-to-video and native audio: **Gemini Omni Flash 1.1** (`gemini_omni_flash_1_1`, Google; `mode image-to-video`, `start_image`, 3–10 s, 360p–4K, 16:9/9:16, native audio), **Seedance 2.5** (`seedance_2_5`; `mode omni_reference`, `start_image`, 4–30 s, 480p–1080p, `generate_audio`), **Wan 3.0** (`wan3_0`; `start_image`, 2–30 s, `generate_audio`, `enable_thinking`), and the cheap doors **Seedance 2.0 Mini** (`seedance_2_0_mini`, 720p, `generate_audio`) and **Kling 3.0 Turbo** (`kling3_0_turbo`, `start_image`, 720p, silent). Prices are not in the catalogue — only `get_cost` tells; the C2 Kling pro clip was 7.5 credits per 5 s. Balance ≈ 5,890.

## Model cards (the disclosure — approving this plan approves them; each is restated in one line before its call; every card's cost is preflighted first and compared with the ceiling)

**Video bake-off — one postcard (`ai-stepped-well-plaza.jpg`, media `419cf3ec-33f0-4439-b243-e6ae34ffe75e` already imported), one clip per model, 8 s, 720p, 16:9 (the model recomposes the 3:2 postcard — measured), `count 1`, `use_unlim: false`:**
| model | settings | capability / limits |
|---|---|---|
| `gemini_omni_flash_1_1` | `mode: 'image-to-video'`, `duration 8`, `resolution '720p'`, `aspect_ratio '16:9'`, `medias [{start_image}]` | reference-driven i2v with native audio (ambience is free); no audio-off switch; strong prompt following expected; geometry not guaranteed |
| `seedance_2_5` | `mode: 'omni_reference'`, `duration 8`, `resolution '720p'`, `generate_audio true`, `aspect_ratio '16:9'`, `medias [{start_image}]` | multimodal reference i2v; native ambience on request; identity-consistent; geometry not guaranteed |
| `wan3_0` | `duration 8`, `resolution '720p'`, `generate_audio true`, `enable_thinking true`, `aspect_ratio '16:9'`, `medias [{start_image}]` | first-frame i2v with native audio; "thinking" improves prompt adherence at the cost of time |
| `seedance_2_0_mini` (cheap door) | `duration 8`, `resolution '720p'`, `generate_audio true`, `aspect_ratio '16:9'`, `medias [{start_image}]` | budget variant; if it clears the fidelity bar at a fraction of the cost it wins the scale-up |
| `kling3_0_turbo` (cheap door, silent) | `duration 8`, `resolution '720p'`, `aspect_ratio '16:9'`, `medias [{start_image}]` | fast/cheap single-frame animation; no audio (ambience would then be absent) |

Preflight all five with `get_cost: true`; generate the three main candidates plus the **cheapest** of the two doors (4 clips). **Ceiling: 200 credits for the whole video bake-off** — if the four preflights sum above it, STOP and ask which to drop. No retries without asking.

**Motion-forward prompt (verbatim, all candidates):**
> Slow cinematic push-in: from this exact viewpoint the camera glides forward about three metres over eight seconds, keeping the horizon level. Ripples spread across the pool and its reflections shimmer; the palms and planting sway in a light breeze; the two people on the steps turn to each other and talk; the couple by the pool gestures gently. Soft afternoon light, constant exposure. Keep every building, tree, path and line where it is; no new buildings, text, signs or logos. Natural ambient sound only: water, birds, a light breeze; no music, no speech.

**Text-to-speech (two engines, one line, the owner picks by ear):**
- `seed_audio` (ByteDance Seed Audio 1.0): `format 'wav'`, `sample_rate 48000`, default voice (no `voice_id`) — cheapest path.
- `text2speech_v2` `variant 'elevenlabs'`, `voice_type 'preset'`, `voice_id '30fc8796-ceb6-4a66-b3a7-4a145ef7f346'` (preset "Arthur", male; preview `https://d1xarpci4ikg0w.cloudfront.net/audio_voice_preset/preview/080fcbab-8be3-4d60-8156-3c3040421e0f.mp3`) — the owner may swap the voice after listening to the previews from `list_voices` (e.g. "Isla" `7367e919-3069-5a0b-939e-dfb1c0fd91b4`, "Holden" `3c9d6053-6334-592c-8997-4e325286af3f`).
- Capability/limits: speech only; no music, no SFX; wording is exact (our text); pronunciation of names is the risk ("Belvedere" — write it as "Bel-vuh-deer" if the first take mangles it).
- **Script (from the vetted caption, ≤ 8 s at a calm pace):** "The stepped-well plaza: a sunken circle of steps descending to a small pool, in the manner of a traditional stepped well. A place to sit low, out of the wind."
- **Ceiling: 10 credits for both takes.**

**Audio design (ffmpeg, no generation):** voice normalised to −16 LUFS integrated (`loudnorm=I=-16:TP=-1.5:LRA=11`); the model's native ambience ducked under speech (`sidechaincompress` threshold 0.03, ratio 8, attack 20 ms, release 400 ms) and held at ≈ −26 LUFS; a synthesised click (`aevalsrc`, 60 ms filtered noise burst, −20 dBFS) at t = 0; an optional music bed **only if the owner supplies a licensed file** (`--music <file>`, −24 LUFS, ducked like the ambience; licence line recorded in PROVENANCE). Output AAC 96 kbps 48 kHz stereo; video as in C2 (`libx264`, 1280 wide) with a **4 MB** ceiling for narrated clips.

## Global Constraints

- Nothing generated without its card restated and its cost preflighted; ceilings: video 200, TTS 10 (this sub-phase).
- Honesty: narration text = the caption + public facts already in `site.json`, never model-authored; label "AI clip · indicative"; credit "AI visualisation via Higgsfield · narration from the published legend and public facts"; a music bed only with a recorded licence.
- Playback: muted autoplay behind the C2 gate; `loop: false`; on `ended` hold the last frame and show Replay; "Listen" (🔊) unmutes and restarts from 0; one decoder at a time; poster + play button on refusal; unchanged on phones otherwise.
- `check.mjs` alone in the background (1500 s; the machine was at load 12 today — if the high tier misses its 180 s boot again, rerun once before blaming the viewer); screenshots and review strips read as images; explicit `q=` in shot URLs.
- Branch: continue on `arc2-c2` (the lifecycle work lives there); merge after the owner's phone gate.

## File structure

| File | Responsibility |
|---|---|
| `viewer/media-kinds.js` (modify) | `KIND_LABEL['ai-video'] = 'AI clip · indicative'`. |
| `tools/media-lib.mjs` (modify) | `+ synthClick(dst)`, `loudness(file)` → LUFS, `hasAudio(file)`, `mixNarration({ video, voice, ambience?, music?, click?, out })`. |
| `tests/media-lib.test.mjs` (modify) | audio-layer tests on synthetic inputs. |
| `tools/import-ai-video.mjs` (modify) | per pick `{ audio, loop }`; `encodeH264(..., { audio: true, maxBytes: 4e6 })` when narrated; entry gains `audio: true, loop: false, narration: <script>`. |
| `viewer/gallery.js`, `viewer/style.css`, `viewer/app.js` (modify) | non-looping clip, Listen + Replay buttons, `ended` hold. |
| `tools/check.mjs` (modify) | narrated entry has an audio stream (ffprobe on the downloaded file), `loop:false`, Listen/Replay behaviour. |
| `tools/_c2b-bakeoff.mjs`, `tools/_c2b-tts.mjs`, `tools/_c2b-smoke.mjs`, `tools/_c2b-shots.mjs` (gitignored) | bake-off measurement, TTS probing, playback smoke, shots. |
| `projects/belvedere/source/ai-clips/` (untracked, `.gitignore`) | raw clips, frames, strips, voice takes, mixes. |
| `docs/checkpoints/c2b/` | `bakeoff.json` (matrix), review strips, voice-take facts, viewer shots. |
| `docs/superpowers/plans/2026-09-13-c2b-narrated-clips-bakeoff.md`, README, guide §4b (rewrite) | plan + docs. |

---

### Task 0: plan file + housekeeping

- [ ] On `arc2-c2`: copy this plan to `docs/superpowers/plans/2026-09-13-c2b-narrated-clips-bakeoff.md`; append `projects/*/source/ai-clips/` to `.gitignore`; `mkdir -p docs/checkpoints/c2b projects/belvedere/source/ai-clips`; commit "C2b plan (narrated clips): bake-off + TTS + audio pipeline, cards and ceilings".

---

### Task 1: audio layer in `media-lib` + label (node-tested)

**Interfaces (produced):**
- `hasAudio(file)` → boolean (ffprobe `a:0` stream present).
- `loudness(file)` → integrated LUFS (number) via `ebur128` (`-af ebur128=peak=true -f null -`, parse `I:` from the summary).
- `synthClick(dst, { ms = 60, gainDb = -20 } = {})` → a short filtered noise burst WAV (`anoisesrc=d=0.06:c=pink:r=48000`, `afade=t=out:d=0.05`, `volume=<gain>dB`).
- `mixNarration({ video, voice, ambience = null, music = null, click = null, out, voiceLufs = -16, bedLufs = -26 })` → writes `out` (mp4, video copied from `video`, audio = voice + ducked bed(s) + click, AAC 96k 48 kHz stereo, trimmed to the video's duration with `-shortest`); returns `{ lufs, duration, bytes }`. Filter graph: voice → `loudnorm=I=-16:TP=-1.5:LRA=11[v]`; bed(s) → `volume` to `bedLufs` then `sidechaincompress` keyed by `[v]` → `[b]`; click → `adelay=0` → `[c]`; `[v][b][c]amix=inputs=N:normalize=0`.

- [ ] **Step 1: failing tests** — append to `tests/media-lib.test.mjs`:
```js
import { hasAudio, loudness, synthClick, mixNarration } from '../tools/media-lib.mjs';
const voice = path.join(tmp, 'voice.wav'), bed = path.join(tmp, 'bed.wav'), click = path.join(tmp, 'click.wav'), narrated = path.join(tmp, 'narrated.mp4');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=1:sample_rate=48000', voice]);          // a 1 s tone stands in for speech
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anoisesrc=d=1:c=pink:r=48000:a=0.05', bed]);                        // quiet pink noise stands in for ambience
test('hasAudio / loudness / synthClick', () => {
  assert.equal(hasAudio(synth), false); assert.equal(hasAudio(voice), true);
  const l = loudness(voice); assert.ok(l < 0 && l > -40, 'LUFS in a sane range: ' + l);
  synthClick(click); assert.ok(hasAudio(click)); assert.ok(ffprobeDuration(click) < 0.2);
});
test('mixNarration: muxes voice + ducked bed + click onto the video, normalised near -16 LUFS, audio stream present, duration = video', () => {
  const r = mixNarration({ video: synth, voice, ambience: bed, click, out: narrated });
  assert.ok(hasAudio(narrated)); assert.ok(Math.abs(r.duration - 1) < 0.15); assert.ok(r.lufs > -20 && r.lufs < -12, 'mix LUFS ' + r.lufs); assert.ok(r.bytes > 1000);
});
```
(add `const ffprobeDuration = f => +JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', f], { encoding: 'utf8' })).format.duration;` above the tests.)
- [ ] **Step 2: run → fails.**
- [ ] **Step 3: helpers** — append to `tools/media-lib.mjs`:
```js
// ---- audio layer (C2b): probe, loudness, a synthesised click, and the narration mix (voice + ducked ambience/music + click) ----
export function hasAudio(file) { const j = JSON.parse(run('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_name', '-of', 'json', file])); return !!(j.streams && j.streams.length); }
export function loudness(file) { const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' }); const m = String(r.stderr).match(/I:\s*(-?[0-9.]+) LUFS/); if (!m) throw new Error('loudness: no result\n' + r.stderr); return +m[1]; }
export function synthClick(dst, { ms = 60, gainDb = -20 } = {}) { run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `anoisesrc=d=${ms / 1000}:c=pink:r=48000`, '-af', `highpass=f=1500,afade=t=out:st=0:d=${ms / 1000},volume=${gainDb}dB`, '-ar', '48000', '-ac', '2', dst]); return dst; }
export function mixNarration({ video, voice, ambience = null, music = null, click = null, out, voiceLufs = -16, bedLufs = -26 }) {
  const inputs = ['-i', video, '-i', voice], beds = [], labels = []; let idx = 2;
  const addBed = f => { inputs.push('-i', f); beds.push(idx++); };
  if (ambience) addBed(ambience); if (music) addBed(music); if (click) { inputs.push('-i', click); }
  const clickIdx = click ? idx++ : null;
  let fg = `[1:a]aresample=48000,loudnorm=I=${voiceLufs}:TP=-1.5:LRA=11,asplit=${beds.length + 1}[v]` + beds.map((_, i) => `[k${i}]`).join('') + ';';
  beds.forEach((b, i) => { fg += `[${b}:a]aresample=48000,loudnorm=I=${bedLufs}:TP=-2:LRA=7[bd${i}];[bd${i}][k${i}]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[b${i}];`; labels.push(`[b${i}]`); });
  if (clickIdx !== null) { fg += `[${clickIdx}:a]aresample=48000,apad[c];`; labels.push('[c]'); }
  fg += `[v]${labels.join('')}amix=inputs=${1 + labels.length}:normalize=0:duration=first[a]`;
  run('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', fg, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '96k', '-ar', '48000', '-ac', '2', '-shortest', '-movflags', '+faststart', out]);
  return { lufs: loudness(out), duration: ffprobe(out).duration, bytes: fs.statSync(out).size };
}
```
`asplit` feeds the voice to `amix` and to each compressor's sidechain; `amix ... duration=first` and `-shortest` pin the length to the video. If `sidechaincompress` rejects a stereo/mono mismatch, add `aformat=channel_layouts=stereo` after each `aresample`.
- [ ] **Step 4: label** — `viewer/media-kinds.js`: `'ai-video': 'AI clip · indicative'` (tests still pass: they assert `/indicative/`).
- [ ] **Step 5: pass + commit** — `node --test tests/*.test.mjs`; commit "C2b: media-lib audio layer (hasAudio, loudness, synthClick, mixNarration) + tests; 'AI clip · indicative'".

---

### Task 2: video bake-off (4 clips, measured, matrix → owner picks)

- [ ] **Step 1: preflights** — for each of the five cards, `generate_video` with `get_cost: true` (declining the preset notice if it appears, as in C2) → record credits. Choose the cheaper of the two doors. If the four chosen sum > 200, STOP and ask.
- [ ] **Step 2: generate** — one line per model restating its card, then `generate_video` (4 calls). `jobs_wait` → `result_url` → `curl` to `source/ai-clips/bake-<model>.mp4`.
- [ ] **Step 3: measure** — `tools/_c2b-bakeoff.mjs`: per clip `ffprobe` (size, fps, duration, audio stream), **motion index** = mean(1 − SSIM(frame t, frame t+1 s)) for t = 0..duration−1 (C2 loops: 0.0027; a clip that visibly moves should read ≥ 0.02), **aspect** = SSIM(frame 0 vs postcard centre-cropped 16:9 / vs squashed / vs padded-letterbox) → how the 3:2 postcard was recomposed, **fidelity** = review strip at 0 / mid / end read as an image (towers, steps, pool intact? people plausible? text/logos?), **ambience** = `hasAudio` + `loudness`, cost, wall time. Write `docs/checkpoints/c2b/bakeoff.json` + `review-<model>.png`.
- [ ] **Step 4: decision** — rule: among clips that pass fidelity (read, not scored), rank by motion index; a cheap door within 70 % of the best motion at ≤ 50 % of its cost wins. Present the matrix (model · credits · motion · aspect · ambience · fidelity notes) with the strips to the owner via AskUserQuestion — the owner confirms or overrides the pick before any further spend. Commit "C2b bake-off: 4 clips measured — matrix" (JSON + strips; raw clips stay untracked).

---

### Task 3: narration takes (2), owner picks by ear

- [ ] **Step 1: preflights** — `generate_audio` `get_cost: true` for `seed_audio` and `text2speech_v2/elevenlabs` with the script. Sum ≤ 10 or STOP.
- [ ] **Step 2: generate both** (cards restated), download to `source/ai-clips/voice-<engine>.wav|mp3`, probe `duration` (≤ 8.5 s; if longer, `speech_rate +10` on seed_audio / shorten the script by one clause and re-run ONE take), `loudness`. Convert to 48 kHz WAV.
- [ ] **Step 3: hand the owner both takes** (`SendUserFile`) with durations; AskUserQuestion: which voice/engine (or a different preset voice from the previews). Record the pick in `docs/checkpoints/c2b/voice.json`.

---

### Task 4: the exemplar — mix, import, viewer, checks, deploy, gate

- [ ] **Step 1: mix** — `synthClick(source/ai-clips/click.wav)`; extract the winner's native ambience (`ffmpeg -i clip -vn -acodec pcm_s16le ambience.wav`; skip if the winner is silent); `mixNarration({ video: winner, voice: pick, ambience, click, out: source/ai-clips/stepped-well-plaza-narrated.mp4 })` → LUFS ≈ −16, `hasAudio` true. If the owner has supplied a licensed music file, pass `music` and append its licence line to PROVENANCE; otherwise no music (say so).
- [ ] **Step 2: import** — extend `tools/import-ai-video.mjs`: selection picks may be objects `{ src, jobId, audio: true, loop: false, narration: '<script>', model, settings }`; when `audio`, encode with `encodeH264(src, dst, { audio: true, maxBytes: 4e6 })` (no `dropLastFrame`), entry `{ …, audio: true, loop: false, narration }`, credit "AI visualisation via Higgsfield · narration from the published legend and public facts". Run it for the stepped well → `postcards/ai-stepped-well-plaza.mp4` (replaces the still loop; `mergeOwned` owns `ai-video`) + poster + manifest + `ai-log.json` (model, settings, prompt, voice engine/voice_id, script, motion index, cost).
- [ ] **Step 3: viewer** — `viewer/gallery.js` `renderMedia` video branch: `v.loop = entry.loop !== false` (already) → for `loop:false` add a Replay button (`.replaybtn`, hidden) shown on `ended` (`v.pause()` holds the last frame; click → `v.currentTime = 0; v.play()`), and when `entry.audio` a Listen button (`.listenbtn` 🔊, visible while muted; click → `v.muted = false; v.currentTime = 0; v.play()`; toggles to 🔇 → `v.muted = true`). Deactivation resets `muted = true`. `style.css`: `.listenbtn { position:absolute; right:10px; bottom:10px; … }`, `.replaybtn` centred like `.playbtn` with a ↻ glyph. `app.js` unchanged.
- [ ] **Step 4: checks** — `tools/check.mjs`: (a) for entries with `audio: true` download the file (`p.request.get` → buffer → tmp file) and assert `hasAudio` via ffprobe in node + `loop === false`; (b) in the plain context: select the hotspot, wait for `currentTime > 0.2`, assert `video.loop === false`, Listen button visible, then `v.currentTime = v.duration - 0.05` → wait `ended` → Replay visible and `paused`; click Replay → `currentTime < 0.5 && !paused`. Mutation: `renderMedia` forces `v.loop = true` → both fail. Smoke (`_c2b-smoke.mjs`) first, then the full suite alone in the background → 32/32.
- [ ] **Step 5: docs** — guide §4b rewritten around narrated clips (cards, script rule, mix, import), README kinds line ("AI clip · indicative … narration from the published legend"). Commit.
- [ ] **Step 6: deploy + live + evidence + gate** — `tools/deploy.sh belvedere`; live suite → 32/32; shots: desktop stepped well at 2 s / at end (Replay visible) / Listen state; phone; `docs/checkpoints/c2b/`; commit; memory; hand-off: the matrix, the voice pick, the exemplar, and the scale-up estimate (14 × (winner + TTS) credits) as the next decision.

## Verification (end to end)

1. `node --test tests/*.test.mjs` → all green (+2 audio tests).
2. Bake-off: 5 preflights recorded; ≤ 4 clips ≤ 200 credits; `bakeoff.json` with motion index (Kling C2 baseline 0.0027 in the table for comparison), aspect, ambience, cost; strips read; owner confirmed the pick.
3. TTS: 2 takes ≤ 10 credits; durations ≤ 8.5 s; owner picked by ear.
4. Exemplar: `hasAudio`, LUFS −16 ± 2, ≤ 4 MB; dev smoke (plays muted, Listen unmutes, ends → Replay); dev check 32/32 (mutation-proved); live 32/32; owner phone gate: "does it read as video, is the narration clear on tap, does it hold and offer Replay?"

## Self-review

- **Owner brief coverage:** visible motion (motion-forward prompt + measured index), narration by TTS from captions (T3, exact wording), music only with a licence (T4 step 1), click/immersion (synthClick), cheap models kept in play (two doors preflighted, one generated, rule favours it), proper evaluation (matrix + strips + owner confirmation), play-once/hold/Replay (T4 step 3).
- **Rules honoured:** every model named with capability/resources/prompt before any call; preflight ceilings; honesty labels; nothing invented in the narration; the C2 lifecycle reused rather than rebuilt.
- **Placeholders:** none. **Type consistency:** `mixNarration` returns `{ lufs, duration, bytes }`; `import-ai-video` reads `{ src, jobId, audio, loop, narration }` picks; the entry shape gains `audio`, `loop:false`, `narration`; gallery reads `entry.audio`/`entry.loop`; check reads the same.
