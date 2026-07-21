# OpenAI Build Week submission — Tidbyts

## Submission fields

- **Title:** Tidbyts: A quiet status wall for Codex
- **Track:** Developer Tools
- **Tagline:** Four tiny screens show what Codex is doing, what finished, and
  what needs me. No dashboard. No notification. I just look up.
- **Built with:** Codex Desktop, GPT-5.6 Sol, TypeScript, Cloudflare Workers,
  D1, Pixlet, Starlark, Vitest, Wrangler
- **YouTube title:** I Gave Codex Four Tiny Screens
- **YouTube description opener:** Codex can be working on several tasks while
  I’m focused somewhere else. Tidbyts turns four old pixel displays into a
  quiet status wall: one glance tells me what is running, what finished, and
  what needs me.
- **Repository:** `https://github.com/joncooper/tidbyts`
- **Live demo:** https://tidbyts.jon-cooper.workers.dev/demo/
- **YouTube:** https://youtu.be/Xzd62OyThJ4
- **Devpost:** https://devpost.com/software/tidbyts-a-quiet-status-wall-for-codex

## Devpost gallery order

Lead with the polished software view, then use the real-hardware photographs as
proof that the product runs in the room:

1. `docs/screenshots/hardware/all-clear-on-hardware.jpg` — “When nothing needs
   attention, the display stays calm.”
2. `docs/screenshots/submission/demo-control-16x9.png` — “Current work, recent
   activity, background jobs, and the one task waiting for me.”
3. `docs/screenshots/hardware/landed-prs-on-hardware.jpg` — “Merged work becomes
   visible without checking GitHub.”
4. `docs/screenshots/submission/demo-exception-16x9.png` — “The monitor can
   evolve; the display still only needs to say what changed.”

Every gallery asset is 16:9, sRGB, and under 1 MB. Publish only these prepared
derivatives. The hardware photographs have been resized and stripped of GPS,
device, capture-time, and other source metadata. Do not upload the original HEIC
files or unsanitized conversions.

## YouTube upload copy

**Title:** I Gave Codex Four Tiny Screens

**Description:**

> Codex can be working on several tasks while I’m focused somewhere else.
> Tidbyts turns four old pixel displays into a quiet status wall: one glance
> tells me what is running, what finished, and what needs me.
>
> Codex had two jobs here. First, it helped me build the Worker, collectors,
> Pixlet apps, and tests with GPT-5.6. Its second job is a recurring local
> automation that checks the system and refreshes the wall every fifteen
> minutes. Prompts, code, transcripts, tool calls, and file paths stay out of
> the shared service.
>
> Live demo: https://tidbyts.jon-cooper.workers.dev/demo/
>
> Source: https://github.com/joncooper/tidbyts
>
> 0:00 Four tiny displays<br>
> 0:18 One useful fact from across the room<br>
> 0:37 Codex’s second job<br>
> 0:58 Work made visible<br>
> 1:17 Quiet until something breaks<br>
> 1:50 More signals, without exposing the work<br>
> 2:10 Built with GPT-5.6; refreshed by Codex<br>
> 2:31 When something needs me, I just look up

The published video uses `renders/build-week/youtube-thumbnail.png` as its
thumbnail. The live demo URL belongs above the source link in the description.

## Project description

Codex can be working on several tasks while I’m focused somewhere else. One
may be running, waiting for a decision, or quietly stuck. Tidbyts turns
four old pixel displays into a quiet status wall: one glance tells me what is
running, what finished, and what needs me.

Tidbyts puts that state on four tiny displays around my office. In my normal
setup, a Codex Desktop automation runs every fifteen minutes, checks current
Codex work plus machine and project health, renders a new 64×32 view, and sends
it to the displays. Control Tower shows what is active and what needs me.
Exception Screen stays quiet until something breaks. Glint makes progress and
completion visible without demanding attention.

Tidbyts never copies prompts, code, transcripts, tool calls, file paths, PR
titles, or PR bodies into its Worker, D1 database, or Tidbyt payloads. The
optional shared service receives small usage records—timestamps, model/provider
IDs, and token counts—plus pull-request totals and explicitly entered household
scores. Pixlet renders locally and uses stock Tidbyt firmware; no paid
private-app hosting or custom firmware is required.

Codex has two jobs here. It helped me build the Worker, collectors, Pixlet apps,
and tests. Then a continuing local Codex automation took over the refresh loop:
every fifteen minutes it checks the system and redraws the wall. I can teach
that same task a new check as my setup changes while the displays remain simple.
Tidbyts answers one question from across the room: does anything need me right
now?

## How Codex and GPT-5.6 were used

The July 18 core-build Codex session is
`019f76ab-6b0a-7d73-a7dd-7e3bc30bb31f`. Its session metadata records the model
as `gpt-5.6-sol`.

The Build Week submission asks for the primary Codex task's Session ID. The UUID
above is that value. To confirm it in Codex, open the July 18 task and run
`/status`.

> I used Codex with **GPT-5.6 (`gpt-5.6-sol`)** in session
> **`019f76ab-6b0a-7d73-a7dd-7e3bc30bb31f`** to build the Worker/D1 path,
> local collectors, Pixlet apps, and render tests. I decided what stays local,
> which problems earn the whole screen, and how each state fits into 64×32
> pixels. In normal use, a recurring local Codex automation runs the refresh
> loop every fifteen minutes.

### Dated Build Week evidence

This repository began during the Build Week submission period on July 18. Its
history makes the relevant work easy to review:

| Date (ET) | Commit | Meaningful work added |
| --- | --- | --- |
| July 18, 2026 | `fe5fe4c` | Initial Tidbyt dashboard prototypes |
| July 18, 2026 | `990116b` | Stateful, resilient Worker and dashboard behavior |
| July 18, 2026 | `f9590be` | Public project documentation |
| July 19, 2026 | `bfe1610` | Deterministic Worker tests in CI |
| July 19, 2026 | `51e10eb` | Glint and Exception Screen polish |
| July 19, 2026 | `a5fc8b6` | README gallery alignment |
| July 21, 2026 | `c719f11` | Judge demo, film package, copy, tests, and submission assets |

The submitted Session ID is the July 18 core-build task shown above.

## Judge testing instructions

### No hardware or credentials

1. Open the deployed `/demo/` route. It is static, uses no private metrics, and
   presents the product states directly.
2. Watch the public demo video for the complete product flow.

### Supported platforms and no-rebuild path

- Full local setup: tested on macOS with Codex Desktop, Node.js 22+, Pixlet,
  `jq`, `sqlite3`, Wrangler, and authenticated `gh`.
- Worker and judge demo: Cloudflare Workers and any modern browser.

The checked-in static demo assets need no rebuild, Tidbyt, API key, or private
Codex history. To launch them locally:

```bash
npm ci
npm run dev
# open http://localhost:8787/demo/
```

### Local verification

```bash
npm ci
npm test
npm run test:pixlet
npm run demo:assets
```

`npm test` verifies the Worker and isolated D1 behavior. `npm run test:pixlet`
checks representative normal, event, alert, and maximum-width display states.
The last command regenerates the static demo assets from the real Pixlet apps.

## Hardware and privacy note

Each production display is an original 64×32 Tidbyt. Physical hardware is
not needed to evaluate the software: the static demo, generated product images,
render scripts, and test suite show the core states and their behavior. Live
installations require a Tidbyt API key, but no credentials, prompts, local
paths, transcript text, or private operational data are included in this
repository or submission. Tidbyts does not forward those private fields to its
Worker, D1 database, or Tidbyt payloads.

## Final Creator preflight

The final Creator master and its publication assets passed independent creative,
copy, accessibility, decode, and format reviews. Superseded outputs remain under
the ignored `renders/build-week/stale-pre-polish/` directory.

- [x] Visual QA master is 1920×1080 H.264/AAC, exact 30 fps, fast-start,
  fully tagged BT.709, free of edit-list atoms, and decodes without errors.
- [x] Frame review found no black frames, text collisions, clipped headings,
  duplicated browser seams, damaged cuts, or semantic timing errors.
- [x] The 56-cue phrase-level SRT uses ElevenLabs forced alignment, has no
  overlaps or orphan cues, uses at most two 42-character lines, and ends before
  the intentional closing hold.
- [x] Every static demo route and asset returned HTTP 200, all interactive
  states were exercised, and the browser console remained clean.
- [x] `npm run check`, `npm run test:pixlet`, and `npm run demo:assets` pass.
- [x] Secret scanning found only documented placeholder values. Generated
  narration, video, thumbnails, local snapshots, and runtime secrets remain
  ignored.
- [x] Creator narration generated with Eleven v3 and voice
  `iP95p4xoKVk53GoZ742B`; the API credential stayed outside the repository and
  was never logged.
- [x] Final MP4: `161.316667` seconds (2:41.317), 27,172,957 bytes, SHA-256
  `33e4f18eeb0ff308374cd5dfe5280ccfbe049f98e5b9deb525f1dbda352ba2de`.
- [x] Audio: −16.6 LUFS integrated, 2.5 LU range, −0.9 dBFS true peak. The
  longest silence is the intentional 1.947-second closing hold; no black
  intervals were detected.
- [x] Captions: 56 forced-aligned cues, 1.420–5.221 seconds each, no overlaps,
  maximum two lines and 42 characters per line. SRT SHA-256:
  `12716eb98409d0369b67adaae6904282af51eabdbdf677e3daca63d639a010d1`.
- [x] Thumbnail: 1280×720, fully opaque and readable at 320×180. SHA-256:
  `353bf4431f306f7b9a9c75c719b70b070275bf9d3217a8e5cd436242cf413244`.
- [x] Real-hardware gallery derivatives are tightly cropped, visually checked,
  and contain no GPS, device, capture-time, EXIF, XMP, or ICC metadata.
- [x] Final chapter starts: 0:00, 0:18, 0:37, 0:58, 1:17, 1:50, 2:10,
  and 2:31.

## Submission record

- [x] Public repository pushed at commit `c719f11` with an MIT license and
  passing CI.
- [x] Static judge demo deployed and verified in signed-out desktop and mobile
  browsers, including every screen and state control.
- [x] Final 2:41 film published as **Public** with its custom 16:9 thumbnail,
  English captions, chapters, and a clean copyright check.
- [x] Devpost entry submitted to **Developer Tools** with the live demo, public
  film, repository, testing instructions, and core-build Session ID.
- [x] Submission published July 21, 2026 at 7:10 p.m. ET, before the 8:00 p.m.
  ET deadline: https://devpost.com/software/tidbyts-a-quiet-status-wall-for-codex
