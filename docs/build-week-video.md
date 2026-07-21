# Tidbyts — A quiet status wall for Codex

The video source is [`build-week-narration.txt`](build-week-narration.txt). The
build script generates narration through ElevenLabs and pairs it with actual
Pixlet renders and a capture of the working judge demo. Every display state can
be reproduced from the repository.

The story is simple: Codex had two jobs. It helped build Tidbyts with GPT-5.6,
then became the recurring local automation that checks the system and refreshes
the wall. The film closes on the product promise: **When something needs me, I
just look up.**

| Exact time | Visual | Purpose |
| --- | --- | --- |
| 0:00.000–0:17.550 | Four real display states | Four reused displays. |
| 0:17.550–0:37.100 | Working judge demo | One useful fact from across the room. |
| 0:37.100–0:57.690 | Local Codex loop | Codex's second job: running the wall. |
| 0:57.690–1:16.840 | Control Tower and Glint | Work made visible. |
| 1:16.840–1:49.510 | Exception Screen | Quiet until something breaks. |
| 1:49.510–2:10.180 | Delivery, usage, and privacy | More signals without exposing private content. |
| 2:10.180–2:30.770 | Judge demo and proof | Built with GPT-5.6; kept current by Codex. |
| 2:30.770–2:41.317 | Calm state and close | When something needs me, I just look up. |

## Build locally

Install these command-line prerequisites before building:

- FFmpeg, including `ffmpeg` and `ffprobe`
- ImageMagick 7, exposed as `magick`
- Pixlet
- eSpeak NG (`espeak-ng`) only for the optional local-voice fallback

The ElevenLabs key never belongs in this repository. Export it from an
external environment file, then run the Creator-quality build:

```bash
set -a
. "${ELEVENLABS_ENV_FILE:?set ELEVENLABS_ENV_FILE to your local credential file}"
set +a
npm run video:build-week
```

The narration is generated as eight timed chapters so each visual follows the
spoken idea instead of drifting against a single long recording. Optionally set
`ELEVENLABS_VOICE_ID` or `ELEVENLABS_MODEL_ID`; otherwise the script uses Chris
with Eleven v3. The API key is used only by the ElevenLabs HTTPS request; the
script never logs it and removes it from the environment inherited by Pixlet,
FFmpeg, ffprobe, ImageMagick, and eSpeak NG.

ElevenLabs synthesis is not byte-for-byte deterministic. Once a take is
accepted, keep and reuse the ignored narration cache. `--reuse-narration`
checks a SHA-256 cache key made from each section's exact text plus the engine,
model, voice, and settings, and it also verifies the cached audio checksum.
Unchanged chapters make no API request. A stale, missing, or damaged chapter is
regenerated and can consume credits:

```bash
npm run video:build-week -- --reuse-narration
```

For the Creator build, the script also sends each accepted audio chapter and
its plain narration text to ElevenLabs forced alignment. Character-level timing
drives the SRT, so expressive pauses do not make captions run ahead of the
voice. Alignment responses are cached by narration-audio SHA-256 plus source
text; unchanged chapters do not make another alignment request.

The Creator build writes these ignored outputs under `renders/build-week/`:

- `tidbyts-build-week.mp4` — 1080p H.264/AAC video with the audio language
  tagged `eng`
- `youtube-thumbnail.png` — 1280×720 upload thumbnail
- `tidbyts-build-week.en.srt` — English phrase-level captions, capped at two
  short lines and timed to the narration
- `tidbyts-build-week.manifest.json` — narration section durations and hashes,
  tool versions, final media specs, and SHA-256 checksums
- `narration/creator-manifest.json` — the chapter-level accepted-take cache

To rebuild only the crop-safe YouTube/Devpost thumbnail from the checked-in
Control Tower render, without touching the accepted film or narration, run:

```bash
node scripts/build-build-week-video.mjs --thumbnail-only
```

Final publication master:

- Public video: https://youtu.be/Xzd62OyThJ4
- Duration: 161.316667 seconds
- MP4 SHA-256: `33e4f18eeb0ff308374cd5dfe5280ccfbe049f98e5b9deb525f1dbda352ba2de`
- SRT SHA-256: `12716eb98409d0369b67adaae6904282af51eabdbdf677e3daca63d639a010d1`

The video cycles through focused Control Tower and Exception Screen demo
captures when `build-week-demo-control.png` and `build-week-demo-exception.png`
are present. It uses the legacy
`build-week-demo.png` only when none of those state captures exists.

For a no-network narration fallback, run
`npm run video:build-week:local`. It uses eSpeak NG and writes distinct
`tidbyts-build-week-local.*` media, `youtube-thumbnail-local.png`, and
`narration/local-manifest.json`, so it cannot overwrite the accepted Creator
render or narration cache.
