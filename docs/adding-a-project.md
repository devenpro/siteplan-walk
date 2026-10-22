# Adding a project

Target: a new master plan becomes a live walkthrough in about a day, without touching `viewer/`.

## 0. Gather (30 min)

- The master plan image at the best resolution you can get (PNG/WebP/JPG). If the site is under ~1500 px wide in it, run a 4K upscale (Higgsfield `upscale_image`) and eyeball a crop side by side: geometry must be faithful; tiny legend digits may drift, the 3D pins carry the numbers.
- Developer renders (as many as exist), the amenity legend, public facts (acres, towers/floors, homes, phases, RERA), the developer's own page URL.
- Put originals in `projects/<slug>/source/` with a `PROVENANCE.md` (where each file came from, what is stock, what is public fact).

## 1. Trace (1–2 h)

```bash
python3 -m http.server 8765 --directory .
# open http://127.0.0.1:8765/tools/trace.html?img=../projects/<slug>/source/masterplan.png
```

Draw, in this order: the **site boundary** (polygon; set `scale.acres` in the exported JSON — the tracer derives metres-per-pixel from the boundary area), then each **volume** (towers, future blocks, clubhouse, services; set `kind`, `floors`, `heightM`), then **features** (courts as rects with `sport`, `rink` ellipse, `steppedWell` circle + `waterR`, `splash`, `plazaDisc`, `portal` rect, `dome`, `ramp`), then a **pin** per legend item (numbers must match the plan's own legend). Export → `projects/<slug>/site.json`.

Read the plan's north arrow and set `plan.northDeg` (screen angle of north, clockwise from image-up). Set `plan.crop` to the region that becomes the ground texture (site plus a small margin, legend excluded).

Do not invent: if the plan shows no pool at grade, there is no pool.

## 2. Fill in site.json (1 h)

Copy the shape of `projects/belvedere/site.json`:

- `name`, `developer`, `location`, `disclaimer`, `facts[]` (label/value; long values get the wide row).
- `visualisationLabel` (string, optional): the persistent pill shown top-left on every layout, over tours, the sheet and the intro, so nobody mistakes the model for the real thing. Belvedere: `3D visualisation from the published master plan · indicative`; a client build can say `…from the sanctioned plan · indicative`. Absent or blank = no label; no code change needed. No AI vendor or tool name belongs in anything the viewer displays (this field, `disclaimer`, `facts`, any manifest `credit`) — tool names live only in `postcards/ai-log.json`, which is never rendered.
- `themes[]` (six is right) and each hotspot's `theme`, `caption` (two sentences, from the legend and public facts only, no compass words unless you have checked the arrow), `view` (`radius`, `phiDeg`, `thetaDeg`, `targetY`; θ=0 puts the camera on the plan's bottom side, +90° on the right, ±180° on the top, −90° on the left — aim from outside the site so ghost towers do not sit between camera and subject).
- `developerRenders[]`: each render file → the hotspot ids it illustrates.
- `developerVideos[]` `{file, hotspots[], credit, title, poster?, trim?}` and `embeds[]` `{provider: youtube|vimeo, id, hotspots[], title, credit, start}` — **official developer channel only**, never broker or third-party videos; consumed by the C2/C3 tools (`make-videos.mjs`), labelled "Developer video" / "Developer video · YouTube" in the viewer.
- `facades` (optional), per volume kind: `{style: fins|stoneGlass|banded|ghost|plain, bayM, finW, finGap, recess, slabH, crownH, baseH, fin, band, glass, source}`. `fins` and `stoneGlass` build instanced fins, corner piers, slab rings and a crown from the traced footprint around a glazed core; `ghost` takes `rhythm: faint|none`. Without the block every volume renders as plain massing. If you read a rhythm off a developer render, say so in `source` and in the `disclaimer` — never present it as the architect's facade.
- `plan.sampleImage` (optional, default `plan.jpg`): the image the tree/hedge/lawn sampler reads. Keep it the published plan even if `plan.ground` becomes an AI reinterpretation.
- `tours[]`: keyframes `{t 0..1, pos [px,py], radius, phiDeg, thetaDeg, targetY?, hotspot?, overview?}`; keep consecutive θ differences under 180°; end with an `overview: true` frame.

## 3. Build assets (20 min)

```bash
node tools/make-ground.mjs projects/<slug>/source/masterplan-4k.png projects/<slug>/site.json projects/<slug>/plan.jpg 2048
node tools/make-postcards.mjs projects/<slug>      # copies developer renders, cuts a plan-detail crop per hotspot, writes postcards/manifest.json
```

## 3b. AI ground — how to re-test (optional, measured)

The plan drawing can in principle be replaced by an AI photoreal "as built" top-down image, but only if nothing moves. `tools/trace.html` measures that: load the project (`?json=…`) and the candidate (`&img2=<file>&img2fit=crop` — generate the ground **crop** at the crop's aspect ratio, 3:4 for Belvedere), press `o` to blink, and run `window.__tracer.measureOverlay()` — it cross-correlates the plan's edge profile with the candidate's along every traced edge and reports `over6` (edges off by more than 6 px at the plan's width, ≈ 2 m) and `worst`. Acceptance: `over6 === 0`, no digits/labels/arrow, nothing invented (no pool that the plan does not draw). The metric is validated on the plan itself (must read 0) and a 10 px shifted copy (must read ≈ 10). Belvedere failed twice on semantics and text with geometry within 9 px — see `source/ai-ground-log.json`; a pass would ship as an opt-in ground with the plan as default.

## 4. AI postcards (1–2 h, optional but recommended)

Import two of the developer's renders into Higgsfield as style references (`media_import_url`). For each key place without a render, one prompt with the fixed style prefix (see `postcards/ai-log.json` for Belvedere's) and a subject sentence read off the plan; two candidates each (`generate_image_batch`, `nano_banana_pro`, 3:2, 1k). Download, lay out on a contact sheet, reject anything with text, wrong tower counts or impossible geometry, then:

```bash
node tools/import-ai.mjs projects/<slug> selection.json   # see tools/import-ai.mjs header for the selection shape
```

Every AI image is shown with the label "AI visualisation · indicative" and a credit line. Never present one as a developer render.

The manifest tools each own their kinds and keep everything else: `make-postcards.mjs` owns developer + plan entries, `import-ai.mjs` owns AI stills; each re-sorts every hotspot's list by provenance (`viewer/media-kinds.js`, ruling: developer video > developer render > official embed > AI loop > AI still > plan detail), so the first entry is always the most trustworthy and the viewer's gallery shows the rest as further slides.

## 4b. AI clips — narrated (optional; measured, ≈15.5 credits per clip)

Turn an AI postcard into a 10-second clip that visibly moves and says what the visitor is looking at. The silent seamless loops of the first pilot measured as stills (frames a second apart 99.7 % identical — motion index 0.0027) and were rejected on the phone; the model was then chosen by a bake-off on one hotspot (`docs/checkpoints/c2b/bakeoff.json`, strips alongside): Gemini Omni Flash 1.1 flattened the stepped well into a pond (FAIL), Wan 3.0 overshot the push-in, Seedance 2.5 was faithful at 4× the cost and ~18 min per clip, **Kling 3.0 Turbo passed at the lowest cost, kept the postcard's 3:2 and carried the loudest native ambience.**

**Model cards, stated before any call and preflighted with `get_cost`:**
- Video — `kling3_0_turbo` (Kling 3.0 Turbo, first-frame image-to-video, native ambience) · `duration 10` · `resolution 720p` · `aspect_ratio 16:9` (a 3:2 start image comes back 3:2, 1172×784) · `count 1` · `start_image` = the postcard (`media_import_url` of its live URL) — ≈15 credits. It cannot guarantee geometry and has no negative-prompt field; read the review strip.
- Narration — `text2speech_v2` · `variant elevenlabs` · preset "Arthur" (`30fc8796-ceb6-4a66-b3a7-4a145ef7f346`) — ≈0.5 credits per line. Speech only: no music, no effects. The alternative `seed_audio` inserts ~2.7 s silences at punctuation.

Motion prompt (verbatim in `postcards/ai-log.json`; say "about two metres" for the batch — "three" travelled a little far in ten seconds):

> Slow cinematic push-in: from this exact viewpoint the camera glides forward about three metres over ten seconds, keeping the horizon level. {SCENE: ripples spread across the pool and its reflections shimmer; the palms and planting sway in a light breeze; the two people on the steps turn to each other and talk; the couple by the pool gestures gently.} Soft afternoon light, constant exposure. Keep every building, tree, path and line where it is; no new buildings, text, signs or logos. Natural ambient sound only: water, birds, a light breeze; no music, no speech.

**Script rule:** the narration is the hotspot's vetted `caption` from `site.json` (plus public facts already there), rephrased to ≤ 25 words — never model-authored. 25 words take ≈ 9 s at Arthur's pace; the raw take is tightened with `tightenPauses` (pauses capped at 0.35 s, 250 ms lead-in) so it ends with half a second of air.

Measure the clip with `tools/media-lib.mjs`: **motion index** = mean(1 − SSIM between frames 1 s apart) — a clip that reads as video scores ≳ 0.3 (Kling Turbo 0.38); the 4-frame strip (0 / 3.3 / 6.6 / 9.9 s) must show no invented elements, no bent geometry, no cut. Then the mix (no generation, ffmpeg only): voice `loudnorm` to −16 LUFS; the clip's own audio track extracted as the ambience bed at −26 LUFS, ducked under speech (`sidechaincompress` 0.03 / 8:1 / 20 ms / 400 ms); a synthesised 60 ms click at t = 0; a music bed **only** from a file the owner has licensed (`music:`) with its licence line in `PROVENANCE.md`:

```bash
node -e "import('./tools/media-lib.mjs').then(m => { m.tightenPauses('voice.mp3', 'voice-tight.wav'); m.synthClick('click.wav'); m.mixNarration({ video: 'clip.mp4', voice: 'voice-tight.wav', ambience: 'ambience.wav', click: 'click.wav', out: 'narrated.mp4' }) })"
node tools/import-ai-video.mjs projects/<slug> selection-narrated.json   # object picks { src, jobId, audio:true, loop:false, narration, voice, mix } → ≤4 MB H.264 + AAC 96k, poster, manifest entry { audio:true, loop:false, narration }, provenance in ai-log.json
```

Narrated clips are labelled "AI clip · indicative" with the credit "AI visualisation via Higgsfield · indicative, not a developer video · narration from the published legend and public facts". Playback: muted autoplay behind the same gate as before (tab visible, no reduced motion, no data saving, no tour; otherwise poster + play button), **plays once and holds its last frame with a Replay button**; a **Listen** button unmutes and restarts from the first word (sound is tap-only in every browser); moving to another slide or hotspot mutes again and releases the decoder. Silent 5-s loops (string picks, `loop:true`) still import through the same tool.

## 5. Deploy and verify (20 min)

```bash
tools/deploy.sh <slug>                                   # → https://walk.csoul.cloud/<slug>/  (hub index updates itself)
node tools/check.mjs https://walk.csoul.cloud/<slug>/    # must be all green (the count grows with each arc)
node tools/shoot.mjs "https://walk.csoul.cloud/<slug>/?autostart=1200" /tmp/<slug>   # then LOOK at both PNGs
```

Then open it on a phone: drag, pinch, play a tour. That is the performance gate; this server cannot measure it.

## Gotchas

- The tracer and viewer read `site.json` relative to their own folder in dev (`?project=../projects/<slug>/`); deployed, everything sits in one folder.
- ESM tools do not honour `NODE_PATH`; Playwright is symlinked into `tools/node_modules` (see README).
- Headless screenshots on this server take 25–55 s each; pass `timeout: 150000` to `page.screenshot`.
- `check.mjs` plays tours at 60× because the software renderer runs about one frame per second.
- Drawn canopies have light highlights, so the dark-green mask is a ring per tree; the sampler closes 1 cell before testing thinness (hedges = strips under ≈1.3 m at the 640-px sample). If a plan draws hedges wider than that, raise `openR` in `viewer/greenery.js`.
- On the software renderer always pass `q=` in shot URLs: a device-resolved `high` measures its own frame time and would drop AO / reload as `mid`.
- Serve the dev tree with `node tools/serve.mjs 8766` (byte ranges) when checking video: Python's `http.server` sends no `Accept-Ranges`, so a `<video>` cannot seek and the narrated-clip check (seek to the end → Replay) fails for the server's sake, not the viewer's.
- Run `check.mjs` on its own: with screenshot runs competing for the software renderer, a 60× tour can skip a keyframe between two one-second frames and the tours check reports fewer hotspots seen. It is a timing artefact of this host, not the viewer.
