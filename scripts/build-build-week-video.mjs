#!/usr/bin/env node

import { access, cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(scriptDirectory, "..");
const demoAssetsDirectory = join(projectDirectory, "public", "demo", "assets");
const screenshotDirectory = join(projectDirectory, "docs", "screenshots");
const narrationPath = join(projectDirectory, "docs", "build-week-narration.txt");
const outputDirectory = join(projectDirectory, "renders", "build-week");
const defaultVoiceId = "iP95p4xoKVk53GoZ742B"; // ElevenLabs Chris.
const frameRate = 30;
const captionHeight = 138;
const finalHoldSeconds = 1.25;
const subtitleLineLength = 42;
const subtitleMinimumWords = 5;
const subtitleMaximumWords = 14;
const subtitleMaximumDuration = 6;
const fontCandidates = [
  "/System/Library/Fonts/Supplemental/Arial.ttf",
  "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
  "/Library/Fonts/Arial.ttf",
];

function fail(message) {
  throw new Error(message);
}

function childProcessEnvironment() {
  const environment = { ...process.env };
  delete environment.ELEVENLABS_API_KEY;
  return environment;
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: projectDirectory,
      env: childProcessEnvironment(),
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let stdout = "";
    let stderr = "";
    if (options.capture) {
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.stderr.on("data", (chunk) => { stderr += chunk; });
    }
    child.on("error", (error) => rejectPromise(error));
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
      } else {
        rejectPromise(new Error(`${command} exited with status ${code}`));
      }
    });
  });
}

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function sha256File(path) {
  return sha256(await readFile(path));
}

async function readJsonIfPresent(path) {
  if (!(await exists(path))) return null;
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

async function commandVersion(command, args) {
  const { stdout, stderr } = await run(command, args, { capture: true });
  const firstLine = `${stdout}\n${stderr}`.split("\n").map((line) => line.trim()).find(Boolean);
  return firstLine || "unknown";
}

async function fileMetadata(path) {
  const details = await stat(path);
  return {
    file: basename(path),
    bytes: details.size,
    sha256: await sha256File(path),
  };
}

async function requireCommand(command, checkArgs = ["-version"]) {
  try {
    await run(command, checkArgs, { capture: true });
  } catch {
    fail(`Missing required command: ${command}`);
  }
}

async function chooseFont() {
  for (const candidate of fontCandidates) {
    if (await exists(candidate)) return candidate;
  }
  fail("No supported system font was found for FFmpeg text overlays.");
}

function filterEscape(value) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(":", "\\:")
    .replaceAll("'", "\\'")
    .replaceAll(",", "\\,")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]");
}

async function renderPixlet(name, app, args, options = {}) {
  const output = join(demoAssetsDirectory, name);
  await run("pixlet", ["render", app, ...args, ...(options.gif ? ["--gif"] : []), "--output", output]);
  return output;
}

async function prepareDemoAssets() {
  await requireCommand("pixlet", ["--help"]);
  await mkdir(demoAssetsDirectory, { recursive: true });

  await renderPixlet("control-tower-active.webp", "apps/codex-control-tower/control_tower.star", [
    "live=3", "warm=6", "jobs=2", "needs=0", "attention_reason=",
  ]);
  await renderPixlet("control-tower-attention.webp", "apps/codex-control-tower/control_tower.star", [
    "live=1", "warm=8", "jobs=2", "needs=1", "attention_reason=READY",
  ]);
  await renderPixlet("control-tower-calm.webp", "apps/codex-control-tower/control_tower.star", [
    "live=0", "warm=2", "jobs=0", "needs=0", "attention_reason=",
  ]);
  await renderPixlet("exception-critical.webp", "apps/exception-screen/exception_screen.star", [
    "count=2", "label_1=CI", "value_1=FAILED", "severity_1=critical",
    "label_2=PR DATA", "value_2=STALE", "severity_2=warn",
  ]);
  await renderPixlet("exception-critical.gif", "apps/exception-screen/exception_screen.star", [
    "count=2", "label_1=CI", "value_1=FAILED", "severity_1=critical",
    "label_2=PR DATA", "value_2=STALE", "severity_2=warn",
  ], { gif: true });
  await renderPixlet("exception-healthy.webp", "apps/exception-screen/exception_screen.star", ["count=0"]);
  await renderPixlet("glint-working.gif", "apps/glint/glint.star", [
    "mode=working", "working=2", "ready=0", "completed=0", "shipped=0",
  ], { gif: true });
  await renderPixlet("glint-ready.gif", "apps/glint/glint.star", [
    "mode=ready", "working=1", "ready=1", "completed=0", "shipped=0",
  ], { gif: true });
  await renderPixlet("glint-complete.gif", "apps/glint/glint.star", [
    "mode=complete", "working=2", "ready=0", "completed=1", "shipped=0",
  ], { gif: true });

  await cp(join(screenshotDirectory, "landed-prs.png"), join(demoAssetsDirectory, "landed-prs.png"));
  await cp(join(screenshotDirectory, "token-use.png"), join(demoAssetsDirectory, "token-use.png"));
  await cp(join(screenshotDirectory, "billable-week.png"), join(demoAssetsDirectory, "billable-week.png"));
  console.log("Prepared hardware-free demo assets in public/demo/assets.");
}

async function ffprobeSeconds(path) {
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path,
  ], { capture: true });
  const duration = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) fail(`Could not determine duration for ${path}`);
  return duration;
}

async function ffprobeMediaSpecs(path) {
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration,size,bit_rate,format_name:stream=index,codec_type,codec_name,profile,width,height,r_frame_rate,pix_fmt,color_range,color_space,color_transfer,color_primaries,sample_rate,channels,channel_layout:stream_tags=language",
    "-of", "json",
    path,
  ], { capture: true });
  return JSON.parse(stdout);
}

async function collectToolVersions(localVoice) {
  const entries = await Promise.all([
    ["ffmpeg", commandVersion("ffmpeg", ["-version"])],
    ["ffprobe", commandVersion("ffprobe", ["-version"])],
    ["imagemagick", commandVersion("magick", ["-version"])],
    ["pixlet", commandVersion("pixlet", ["version"])],
    ...(localVoice ? [["espeakNg", commandVersion("espeak-ng", ["--version"])]] : []),
  ].map(async ([name, promise]) => [name, await promise]));
  return Object.fromEntries(entries);
}

async function writeSlide(path, title, subtitle, label, details, fontFile) {
  const args = [
    "-size", "1920x1080", "xc:#071019",
    "-fill", "#123631", "-draw", "rectangle 1200,0 1920,1080",
    "-fill", "#142d45", "-draw", "rectangle 0,820 720,1080",
    "-font", fontFile,
    "-fill", "#69E7EA", "-pointsize", "25", "-gravity", "NorthWest", "-annotate", "+180+185", label,
    "-fill", "#F6F2E8", "-pointsize", "88", "-annotate", "+180+300", title,
    "-fill", "#A7B1BF", "-pointsize", "38", "-annotate", "+180+420", subtitle,
    "-fill", "#69E7EA", "-pointsize", "27", "-annotate", "+180+950", "TIDBYTS · REAL PIXLET OUTPUT · LOCAL BY DEFAULT",
  ];
  for (const [index, detail] of details.entries()) {
    const x = 270 + index * 470;
    const border = index === 0 ? "#69E7EA" : index === 1 ? "#FFAF5B" : "#B6ED62";
    args.push("-fill", "#0D1B29", "-stroke", "none", "-draw", `roundrectangle ${x},650 ${x + 390},814 18,18`);
    args.push("-fill", "none", "-stroke", border, "-strokewidth", "3", "-draw", `roundrectangle ${x},650 ${x + 390},814 18,18`);
    args.push("-stroke", "none", "-fill", "#F6F2E8", "-pointsize", "28", "-annotate", `+${x + 28}+702`, detail.title);
    args.push("-fill", "#A7B1BF", "-pointsize", "21", "-annotate", `+${x + 28}+750`, detail.text);
  }
  args.push(path);
  await run("magick", args);
}

async function writeCaption(path, title, caption, fontFile) {
  await run("magick", [
    "-size", "1920x138", "xc:#071019",
    "-font", fontFile,
    "-fill", "#F6F2E8", "-pointsize", "48", "-gravity", "NorthWest", "-annotate", "+76+28", title,
    "-fill", "#A7B1BF", "-pointsize", "25", "-annotate", "+78+91", caption,
    path,
  ]);
}

async function writeGallerySlide(path, frames, fontFile) {
  const placements = [
    { x: 150, y: 235, label: "CODEX WORK" },
    { x: 995, y: 235, label: "SYSTEM HEALTH" },
    { x: 150, y: 625, label: "MOMENTUM" },
    { x: 995, y: 625, label: "DELIVERY" },
  ];
  const args = ["-size", "1920x1080", "xc:#071019"];
  for (const [index, frame] of frames.entries()) {
    const { x, y } = placements[index];
    args.push("(", frame, "-filter", "point", "-resize", "680x340!", ")", "-geometry", `+${x}+${y}`, "-composite");
  }
  args.push("-font", fontFile, "-gravity", "NorthWest");
  for (const [index, placement] of placements.entries()) {
    args.push(
      "-fill", index % 2 === 0 ? "#69E7EA" : "#B6ED62",
      "-pointsize", "19", "-annotate", `+${placement.x}+${placement.y - 30}`, placement.label,
    );
  }
  args.push(path);
  await run("magick", args);
}

async function writeYoutubeThumbnail(path, screen, fontFile) {
  await run("magick", [
    "-size", "1280x720", "xc:#071019",
    "-fill", "#123631", "-stroke", "none", "-draw", "rectangle 850,0 1280,720",
    "-fill", "#142D45", "-draw", "rectangle 0,626 620,720",
    "-fill", "#0D1B29", "-draw", "roundrectangle 550,160 1240,560 34,34",
    "-fill", "#020508", "-draw", "roundrectangle 575,185 1215,535 20,20",
    "(", screen, "-filter", "point", "-resize", "600x300!", ")", "-geometry", "+595+210", "-composite",
    "-font", fontFile, "-gravity", "NorthWest",
    "-fill", "#69E7EA", "-pointsize", "24", "-annotate", "+70+86", "TIDBYTS × CODEX",
    "-fill", "#F6F2E8", "-pointsize", "92", "-annotate", "+66+190", "JUST",
    "-annotate", "+66+304", "LOOK",
    "-fill", "#B6ED62", "-annotate", "+66+418", "UP.",
    "-fill", "#A7B1BF", "-pointsize", "24", "-annotate", "+70+650", "THE STATUS WALL THAT KNOWS WHAT MATTERS",
    path,
  ]);
}

async function rasterizeFirstFrame(source, destination) {
  await run("magick", [`${source}[0]`, destination]);
  return destination;
}

function parseNarrationSections(source) {
  const sections = [];
  let current = null;
  for (const line of source.split("\n")) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      if (current) sections.push({ ...current, text: current.lines.join("\n").trim() });
      current = { id: heading[1].trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push({ ...current, text: current.lines.join("\n").trim() });
  if (sections.length === 0 || sections.some((section) => !section.text)) {
    fail("Narration must contain non-empty sections introduced by ## headings.");
  }
  return sections;
}

function speechText(value) {
  return value.replaceAll(/\[([^\]]+)\]/g, "").replaceAll(/\s+/g, " ").trim();
}

function narrationConfiguration(localVoice) {
  if (localVoice) {
    return {
      engine: "espeak-ng",
      model: "espeak-ng",
      voice: process.env.TIDBYTS_LOCAL_VOICE || "en-us+f3",
      settings: {
        rateWordsPerMinute: 154,
        outputFormat: "wav",
      },
    };
  }
  const model = process.env.ELEVENLABS_MODEL_ID || "eleven_v3";
  return {
    engine: "elevenlabs",
    model,
    voice: process.env.ELEVENLABS_VOICE_ID || defaultVoiceId,
    settings: {
      outputFormat: "mp3_44100_128",
      voiceSettings: model === "eleven_v3" ? null : {
        stability: 0.52,
        similarity_boost: 0.72,
        style: 0.12,
        use_speaker_boost: true,
      },
    },
  };
}

function narrationCacheKey(section, configuration) {
  return sha256(JSON.stringify({
    schemaVersion: 1,
    section: {
      id: section.id,
      text: section.text,
    },
    engine: configuration.engine,
    model: configuration.model,
    voice: configuration.voice,
    settings: configuration.settings,
  }));
}

function alignmentCacheKey(section, audioSha256) {
  return sha256(JSON.stringify({
    schemaVersion: 1,
    sourceText: speechText(section.text),
    audioSha256,
  }));
}

function validateForcedAlignment(alignment, expectedText, rawDuration = null) {
  if (!alignment || !Array.isArray(alignment.characters) || alignment.characters.length === 0) {
    fail("ElevenLabs forced alignment did not return character timings.");
  }
  const alignedText = alignment.characters.map((character) => character.text).join("");
  if (alignedText !== expectedText) {
    fail("ElevenLabs forced alignment text does not match the narration source.");
  }
  let previousEnd = 0;
  for (const character of alignment.characters) {
    if (
      typeof character.text !== "string"
      || !Number.isFinite(character.start)
      || !Number.isFinite(character.end)
      || character.start < 0
      || character.end < character.start
      || character.start + 0.02 < previousEnd
    ) {
      fail("ElevenLabs forced alignment returned invalid or non-monotonic timings.");
    }
    previousEnd = character.end;
  }
  if (rawDuration != null && previousEnd > rawDuration + 0.1) {
    fail("ElevenLabs forced alignment extends beyond the narration audio.");
  }
  return alignment;
}

async function generateForcedAlignment(audioPath, text, rawDuration) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    fail("ELEVENLABS_API_KEY is required to align Creator narration captions.");
  }
  const body = new FormData();
  body.append("file", new Blob([await readFile(audioPath)]), basename(audioPath));
  body.append("text", text);
  const response = await fetch("https://api.elevenlabs.io/v1/forced-alignment", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body,
  });
  if (!response.ok) fail(`ElevenLabs forced alignment failed with HTTP ${response.status}.`);
  return validateForcedAlignment(await response.json(), text, rawDuration);
}

async function generateNarration(path, configuration, text) {
  if (configuration.engine === "espeak-ng") {
    await run("espeak-ng", [
      "-v", configuration.voice,
      "-s", String(configuration.settings.rateWordsPerMinute),
      "-w", path, speechText(text),
    ]);
    return;
  }
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    fail("ELEVENLABS_API_KEY is required. Source it from a local environment file before building the video.");
  }
  const body = {
    text: configuration.model === "eleven_v3"
      ? text.replaceAll(/\s+/g, " ").trim()
      : speechText(text),
    model_id: configuration.model,
  };
  if (configuration.settings.voiceSettings) {
    body.voice_settings = configuration.settings.voiceSettings;
  }
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(configuration.voice)}?output_format=${configuration.settings.outputFormat}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "audio/mpeg",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) fail(`ElevenLabs text-to-speech request failed with HTTP ${response.status}.`);
  await writeFile(path, Buffer.from(await response.arrayBuffer()));
}

async function prepareNarrationAudio({ sections, localVoice, reuseNarration, temporaryDirectory }) {
  const finalAudio = join(temporaryDirectory, "narration-final.m4a");
  const narrationDirectory = join(outputDirectory, "narration");
  await mkdir(narrationDirectory, { recursive: true });
  if (localVoice) await requireCommand("espeak-ng", ["--version"]);
  const configuration = narrationConfiguration(localVoice);
  const profile = localVoice ? "local" : "creator";
  const manifestPath = join(narrationDirectory, `${profile}-manifest.json`);
  const previousManifest = reuseNarration ? await readJsonIfPresent(manifestPath) : null;
  const previousChapters = Array.isArray(previousManifest?.chapters) ? previousManifest.chapters : [];
  const extension = localVoice ? "wav" : "mp3";
  const rawAudio = [];
  const chapterMetadata = [];
  for (const [index, section] of sections.entries()) {
    const cacheKey = narrationCacheKey(section, configuration);
    const safeId = section.id.toLowerCase().replaceAll(/[^a-z0-9-]+/g, "-");
    const file = `${profile}-${String(index + 1).padStart(2, "0")}-${safeId}-${cacheKey.slice(0, 16)}.${extension}`;
    const path = join(narrationDirectory, file);
    const previousChapter = previousChapters.find((chapter) => chapter.id === section.id);
    let cacheIsValid = false;
    if (
      reuseNarration
      && previousChapter?.cacheKey === cacheKey
      && previousChapter.file === file
      && await exists(path)
    ) {
      cacheIsValid = previousChapter.audioSha256 === await sha256File(path);
    }
    if (!cacheIsValid) {
      await generateNarration(path, configuration, section.text);
    }
    rawAudio.push(path);
    chapterMetadata.push({
      id: section.id,
      file,
      sourceTextSha256: sha256(section.text),
      cacheKey,
      audioSha256: await sha256File(path),
    });
  }
  const rawDurations = await Promise.all(rawAudio.map(ffprobeSeconds));
  const rawTotal = rawDurations.reduce((total, duration) => total + duration, 0);
  if (rawTotal > 174) {
    fail(`Natural narration is ${rawTotal.toFixed(1)} seconds. Trim the script before building so the voice is never speed-warped.`);
  }
  const targetTotal = Math.min(174, Math.max(160, rawTotal + 4));
  const totalPadding = Math.max(0, targetTotal - rawTotal);
  const paddedAudio = [];
  for (const [index, path] of rawAudio.entries()) {
    const tail = totalPadding / rawAudio.length;
    const output = join(temporaryDirectory, `narration-${String(index + 1).padStart(2, "0")}.m4a`);
    await run("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y", "-i", path,
      "-af", `apad=pad_dur=${tail.toFixed(5)}`,
      "-c:a", "aac", "-ar", "48000", "-b:a", "192k", output,
    ]);
    paddedAudio.push(output);
  }
  const durations = await Promise.all(paddedAudio.map(ffprobeSeconds));

  const alignments = [];
  for (const [index, section] of sections.entries()) {
    if (localVoice) {
      alignments.push(null);
      continue;
    }
    const expectedText = speechText(section.text);
    const audioSha256 = chapterMetadata[index].audioSha256;
    const cacheKey = alignmentCacheKey(section, audioSha256);
    const safeId = section.id.toLowerCase().replaceAll(/[^a-z0-9-]+/g, "-");
    const file = `creator-${String(index + 1).padStart(2, "0")}-${safeId}-${cacheKey.slice(0, 16)}.alignment.json`;
    const path = join(narrationDirectory, file);
    let alignment = reuseNarration ? await readJsonIfPresent(path) : null;
    try {
      if (alignment) validateForcedAlignment(alignment, expectedText, rawDurations[index]);
    } catch {
      alignment = null;
    }
    if (!alignment) {
      alignment = await generateForcedAlignment(rawAudio[index], expectedText, rawDurations[index]);
      await writeFile(path, `${JSON.stringify(alignment)}\n`);
    }
    alignments.push(alignment);
    chapterMetadata[index].alignment = {
      file,
      cacheKey,
      sha256: await sha256File(path),
      method: "ElevenLabs forced alignment",
    };
  }

  const concatPath = join(temporaryDirectory, "narration.ffconcat");
  await writeFile(concatPath, paddedAudio.map((path) => `file '${path.replaceAll("'", "'\\''")}'`).join("\n") + "\n");
  const joinedAudio = join(temporaryDirectory, "narration-joined.m4a");
  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", concatPath,
    "-c", "copy", joinedAudio,
  ]);
  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-i", joinedAudio,
    "-af", "loudnorm=I=-16:TP=-1.5:LRA=7", "-c:a", "aac", "-ar", "48000", "-b:a", "192k", finalAudio,
  ]);
  const chapters = chapterMetadata.map((chapter, index) => ({
    ...chapter,
    rawDurationSeconds: Number(rawDurations[index].toFixed(6)),
    sceneDurationSeconds: Number(durations[index].toFixed(6)),
  }));
  await writeFile(manifestPath, `${JSON.stringify({
    schemaVersion: 1,
    configuration,
    chapters,
  }, null, 2)}\n`);
  return {
    finalAudio,
    durations,
    chapters,
    configuration,
    cacheManifest: basename(manifestPath),
    alignments,
  };
}

function narrationSentences(value) {
  const text = speechText(value);
  return Array.from(text.matchAll(/.*?(?:[.!?]+(?=\s|$)|$)/gs), (match) => match[0].trim()).filter(Boolean);
}

function subtitlePhrases(value) {
  const clauses = [];
  for (const sentence of narrationSentences(value)) {
    const parts = sentence.match(/.*?(?:[,;:]\s+|\s+[—–]\s+|$)/g)?.map((part) => part.trim()).filter(Boolean) || [sentence];
    clauses.push(...parts);
  }
  const phrases = [];
  for (const clause of clauses) {
    const words = clause.split(/\s+/).filter(Boolean);
    let current = [];
    for (const word of words) {
      const candidate = [...current, word].join(" ");
      if (
        current.length > 0
        && (
          current.length >= subtitleMaximumWords
          || candidate.length > subtitleLineLength * 2
          || subtitleWrapCandidate(candidate) == null
        )
      ) {
        phrases.push(current.join(" "));
        current = [word];
      } else {
        current.push(word);
      }
    }
    if (current.length > 0) phrases.push(current.join(" "));
  }
  const merged = [];
  for (let index = 0; index < phrases.length; index += 1) {
    let phrase = phrases[index];
    let wordCount = phrase.split(/\s+/).length;
    while (wordCount < subtitleMinimumWords && index + 1 < phrases.length) {
      const candidate = `${phrase} ${phrases[index + 1]}`;
      const candidateWordCount = candidate.split(/\s+/).length;
      if (candidateWordCount > subtitleMaximumWords || subtitleWrapCandidate(candidate) == null) break;
      phrase = candidate;
      wordCount = candidateWordCount;
      index += 1;
    }
    if (wordCount < subtitleMinimumWords && merged.length > 0) {
      const previous = merged[merged.length - 1];
      const candidate = `${previous} ${phrase}`;
      if (
        candidate.split(/\s+/).length <= subtitleMaximumWords
        && subtitleWrapCandidate(candidate) != null
      ) {
        merged[merged.length - 1] = candidate;
        continue;
      }

      const combinedWords = candidate.split(/\s+/);
      const balancedSplits = [];
      for (
        let split = subtitleMinimumWords;
        split <= combinedWords.length - subtitleMinimumWords;
        split += 1
      ) {
        const first = combinedWords.slice(0, split).join(" ");
        const second = combinedWords.slice(split).join(" ");
        if (
          split <= subtitleMaximumWords
          && combinedWords.length - split <= subtitleMaximumWords
          && subtitleWrapCandidate(first) != null
          && subtitleWrapCandidate(second) != null
        ) {
          balancedSplits.push({ first, second, difference: Math.abs(split - (combinedWords.length - split)) });
        }
      }
      if (balancedSplits.length > 0) {
        balancedSplits.sort((left, right) => left.difference - right.difference);
        merged[merged.length - 1] = balancedSplits[0].first;
        phrase = balancedSplits[0].second;
      }
    }
    merged.push(phrase);
  }
  return merged;
}

function subtitleWrapCandidate(value) {
  if (value.length <= subtitleLineLength) return value;
  const breakpoints = Array.from(value.matchAll(/\s+/g), (match) => match.index).filter((index) => index != null);
  const candidates = breakpoints.map((index) => ({
    index,
    first: value.slice(0, index).trim(),
    second: value.slice(index).trim(),
  })).filter(({ first, second }) => first.length <= subtitleLineLength && second.length <= subtitleLineLength);
  if (candidates.length === 0) return null;
  candidates.sort((left, right) => (
    Math.abs(left.first.length - left.second.length) - Math.abs(right.first.length - right.second.length)
  ));
  return `${candidates[0].first}\n${candidates[0].second}`;
}

function wrapSubtitlePhrase(value) {
  const wrapped = subtitleWrapCandidate(value);
  if (wrapped == null) fail(`Subtitle phrase cannot fit two ${subtitleLineLength}-character lines: ${value}`);
  return wrapped;
}

function srtTimestamp(seconds) {
  const totalMilliseconds = Math.max(0, Math.round(seconds * 1000));
  const milliseconds = totalMilliseconds % 1000;
  const totalSeconds = Math.floor(totalMilliseconds / 1000);
  const second = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minute = totalMinutes % 60;
  const hour = Math.floor(totalMinutes / 60);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")},${String(milliseconds).padStart(3, "0")}`;
}

function alignedPhraseRanges(section, alignment) {
  const sourceText = speechText(section.text);
  validateForcedAlignment(alignment, sourceText);
  const phrases = subtitlePhrases(section.text);
  let cursor = 0;
  const ranges = phrases.map((phrase) => {
    const startIndex = sourceText.indexOf(phrase, cursor);
    if (startIndex < 0) fail(`Could not locate subtitle phrase in aligned narration: ${phrase}`);
    if (sourceText.slice(cursor, startIndex).trim()) {
      fail(`Uncaptioned narration text precedes subtitle phrase: ${phrase}`);
    }
    const endIndex = startIndex + phrase.length - 1;
    cursor = endIndex + 1;
    return {
      phrase,
      spokenStart: alignment.characters[startIndex].start,
      spokenEnd: alignment.characters[endIndex].end,
    };
  });
  if (sourceText.slice(cursor).trim()) fail("Uncaptioned narration text remains after the final subtitle phrase.");
  return ranges;
}

function proportionalPhraseRanges(section, duration) {
  const phrases = subtitlePhrases(section.text);
  const weights = phrases.map((phrase) => speechText(phrase).split(/\s+/).length);
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  let cursor = 0;
  return phrases.map((phrase, index) => {
    const spokenStart = cursor;
    const spokenEnd = index === phrases.length - 1
      ? duration
      : cursor + duration * (weights[index] / totalWeight);
    cursor = spokenEnd;
    return { phrase, spokenStart, spokenEnd };
  });
}

function captionRanges(phraseRanges, duration, forcedAlignment) {
  if (!forcedAlignment) {
    return phraseRanges.map((range) => ({
      phrase: range.phrase,
      start: range.spokenStart,
      end: range.spokenEnd,
    }));
  }
  const ranges = phraseRanges.map((range) => ({
    ...range,
    start: Math.max(0, range.spokenStart - 0.12),
    end: Math.min(duration, range.spokenEnd + 0.28),
  }));
  for (let index = 0; index + 1 < ranges.length; index += 1) {
    if (ranges[index].end < ranges[index + 1].start) continue;
    const boundary = (ranges[index].spokenEnd + ranges[index + 1].spokenStart) / 2;
    ranges[index].end = boundary;
    ranges[index + 1].start = boundary;
  }
  return ranges;
}

async function writeSubtitles(path, sections, durations, alignments) {
  const cues = [];
  let chapterStart = 0;
  for (const [sectionIndex, section] of sections.entries()) {
    const alignment = alignments[sectionIndex];
    const phraseRanges = alignment
      ? alignedPhraseRanges(section, alignment)
      : proportionalPhraseRanges(section, durations[sectionIndex]);
    const ranges = captionRanges(phraseRanges, durations[sectionIndex], alignment != null);
    const chapterEnd = chapterStart + durations[sectionIndex];
    for (const range of ranges) {
      const phraseStart = chapterStart + range.start;
      const phraseEnd = Math.min(chapterEnd, chapterStart + range.end);
      const text = wrapSubtitlePhrase(range.phrase);
      const lines = text.split("\n");
      if (lines.length > 2 || lines.some((line) => line.length > subtitleLineLength)) {
        fail(`Subtitle cue exceeds the authored two-line safe area: ${text}`);
      }
      if (phraseEnd - phraseStart > subtitleMaximumDuration + 0.05) {
        fail(`Subtitle cue exceeds ${subtitleMaximumDuration} seconds: ${text}`);
      }
      cues.push({ start: phraseStart, end: phraseEnd, text });
    }
    chapterStart = chapterEnd;
  }
  const source = cues.map((cue, index) => [
    String(index + 1),
    `${srtTimestamp(cue.start)} --> ${srtTimestamp(cue.end)}`,
    cue.text,
    "",
  ].join("\n")).join("\n");
  await writeFile(path, source);
  return cues.length;
}

async function makeClip({ source, duration, gif, smooth, safeBelowCaption, captionImage }, destination) {
  const frameCount = Math.max(1, Math.round(duration * frameRate));
  const motionFrameDenominator = Math.max(1, frameCount - 1);
  const input = gif
    ? ["-stream_loop", "-1", "-i", source]
    : ["-loop", "1", "-framerate", String(frameRate), "-i", source];
  const scaleFlags = smooth ? "lanczos" : "neighbor";
  const contentHeight = 1080 - captionHeight;
  let baseFilter;
  if (safeBelowCaption) {
    const fitted = `[0:v]scale=1920:${contentHeight}:force_original_aspect_ratio=decrease:flags=${scaleFlags},pad=1920:${contentHeight}:(ow-iw)/2:(oh-ih)/2:color=0x071019`;
    baseFilter = gif
      ? `${fitted},fps=${frameRate},pad=1920:1080:0:${captionHeight}:color=0x071019,format=yuv420p[base]`
      : smooth
        ? `${fitted},zoompan=z='1+0.018*on/${motionFrameDenominator}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frameCount}:s=1920x${contentHeight}:fps=${frameRate},pad=1920:1080:0:${captionHeight}:color=0x071019,format=yuv420p[base]`
        : `${fitted},fps=${frameRate},pad=1920:1080:0:${captionHeight}:color=0x071019,format=yuv420p[base]`;
  } else {
    const fitBox = smooth ? "1920:1080" : "1536:768";
    const fitted = `[0:v]scale=${fitBox}:force_original_aspect_ratio=decrease:flags=${scaleFlags},pad=1920:1080:(ow-iw)/2:(oh-ih):color=0x071019`;
    baseFilter = gif
      ? `${fitted},fps=${frameRate},format=yuv420p[base]`
      : smooth
        ? `${fitted},zoompan=z='1+0.028*on/${motionFrameDenominator}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frameCount}:s=1920x1080:fps=${frameRate},format=yuv420p[base]`
        : `${fitted},fps=${frameRate},format=yuv420p[base]`;
  }
  const filter = [
    baseFilter,
    `[1:v]scale=1920:${captionHeight}:flags=neighbor[caption]`,
    "[base][caption]overlay=0:0:shortest=1,format=yuv420p",
  ].join(";");
  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", ...input, "-loop", "1", "-framerate", String(frameRate), "-i", captionImage,
    "-t", duration.toFixed(3), "-filter_complex", filter,
    "-r", String(frameRate), "-c:v", "libx264", "-preset", "medium", "-crf", "18",
    "-g", "1", "-bf", "0", "-pix_fmt", "yuv420p", destination,
  ]);
}

async function makeSequenceScene(scene, sceneIndex, temporaryDirectory, fontFile) {
  const captionImage = join(temporaryDirectory, `caption-${String(sceneIndex + 1).padStart(2, "0")}.png`);
  await writeCaption(captionImage, scene.title, scene.caption, fontFile);
  const fixedDuration = scene.shots.reduce((total, shot) => total + (shot.seconds || 0), 0);
  if (fixedDuration > scene.duration) fail(`Scene ${sceneIndex + 1} assigns more fixed shot time than it has.`);
  const flexibleShots = scene.shots.filter((shot) => shot.seconds == null);
  const totalWeight = flexibleShots.reduce((total, shot) => total + (shot.weight || 1), 0);
  if (flexibleShots.length === 0 && Math.abs(fixedDuration - scene.duration) > 0.01) {
    fail(`Scene ${sceneIndex + 1} has no flexible shot to absorb its remaining time.`);
  }
  const flexibleDuration = scene.duration - fixedDuration;
  const shotDurations = scene.shots.map((shot) => (
    shot.seconds == null ? Math.max(0.5, flexibleDuration * ((shot.weight || 1) / totalWeight)) : shot.seconds
  ));
  const assigned = shotDurations.reduce((total, duration) => total + duration, 0);
  shotDurations[shotDurations.length - 1] += scene.duration - assigned;
  if (shotDurations.some((duration) => duration < 0.5)) {
    fail(`Scene ${sceneIndex + 1} contains a shot shorter than half a second.`);
  }
  const clips = [];
  for (const [shotIndex, shot] of scene.shots.entries()) {
    const clip = join(temporaryDirectory, `scene-${String(sceneIndex + 1).padStart(2, "0")}-shot-${String(shotIndex + 1).padStart(2, "0")}.mp4`);
    await makeClip({ ...shot, duration: shotDurations[shotIndex], captionImage }, clip);
    clips.push(clip);
  }
  if (clips.length === 1) return clips[0];
  const scenePath = join(temporaryDirectory, `scene-${String(sceneIndex + 1).padStart(2, "0")}.mp4`);
  const inputs = clips.flatMap((clip) => ["-i", clip]);
  const resetTimestamps = clips.map((_, index) => `[${index}:v]setpts=PTS-STARTPTS[v${index}]`);
  const concatInputs = clips.map((_, index) => `[v${index}]`).join("");
  // Each shot is a separate input so the decoder resets at every H.264 boundary.
  // A concat demuxer can otherwise carry prediction state across independently
  // encoded files, damaging a handful of frames at exact cuts.
  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", ...inputs,
    "-filter_complex", `${resetTimestamps.join(";")};${concatInputs}concat=n=${clips.length}:v=1:a=0[out]`,
    "-map", "[out]",
    "-an", "-r", String(frameRate), "-c:v", "libx264", "-preset", "medium", "-crf", "18",
    "-g", "1", "-bf", "0", "-pix_fmt", "yuv420p", scenePath,
  ]);
  return scenePath;
}

async function makeSoundDesign(path, totalDuration, accents) {
  const inputArguments = [];
  const filters = [];
  const labels = [];
  for (const [index, accent] of accents.entries()) {
    inputArguments.push(
      "-f", "lavfi",
      "-i", `sine=frequency=${accent.frequency}:duration=${accent.duration}:sample_rate=48000`,
    );
    const label = `tone${index}`;
    const delay = Math.max(0, Math.round(accent.at * 1000));
    filters.push(
      `[${index}:a]volume=${accent.volume},afade=t=out:st=0:d=${accent.duration},adelay=${delay}:all=1[${label}]`,
    );
    labels.push(`[${label}]`);
  }
  filters.push(
    `${labels.join("")}amix=inputs=${labels.length}:normalize=0:duration=longest,apad=pad_dur=${totalDuration.toFixed(3)},atrim=duration=${totalDuration.toFixed(3)},aformat=sample_rates=48000:channel_layouts=mono[out]`,
  );
  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", ...inputArguments,
    "-filter_complex", filters.join(";"), "-map", "[out]", "-c:a", "pcm_s16le", path,
  ]);
}

async function buildVideo({ localVoice, reuseNarration }) {
  await Promise.all([requireCommand("ffmpeg"), requireCommand("ffprobe"), requireCommand("magick")]);
  const toolVersions = await collectToolVersions(localVoice);
  const fontFile = await chooseFont();
  const sections = parseNarrationSections(await readFile(narrationPath, "utf8"));
  if (sections.length !== 8) fail(`Expected 8 narration sections; found ${sections.length}.`);
  await mkdir(outputDirectory, { recursive: true });
  const outputStem = localVoice ? "tidbyts-build-week-local" : "tidbyts-build-week";
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "tidbyts-build-week-"));
  try {
    const gallerySlide = join(temporaryDirectory, "gallery.png");
    const agentSlide = join(temporaryDirectory, "agent.png");
    const evolutionSlide = join(temporaryDirectory, "evolution.png");
    const privacySlide = join(temporaryDirectory, "privacy.png");
    const proofSlide = join(temporaryDirectory, "proof.png");
    const closingSlide = join(temporaryDirectory, "closing.png");
    await writeSlide(agentSlide, "Codex keeps the wall current.", "In my normal setup, every fifteen minutes: check, choose, render, and send.", "LOCAL AUTOMATION", [
      { title: "CHECK", text: "Work · computer" },
      { title: "DECIDE", text: "What changed?" },
      { title: "SHOW", text: "One useful fact" },
    ], fontFile);
    await writeSlide(evolutionSlide, "Teach it what matters.", "The checks can change. The pixels stay simple.", "A MONITOR THAT EVOLVES", [
      { title: "BUILD", text: "This week" },
      { title: "SERVICE", text: "Next month" },
      { title: "BUDGET", text: "Whenever needed" },
    ], fontFile);
    await writeSlide(privacySlide, "Tidbyts keeps private content local.", "Its shared service gets stripped-down facts—not prompt or code content.", "A CLEAR BOUNDARY", [
      { title: "STAYS HERE", text: "Prompts · code · files" },
      { title: "CAN MOVE", text: "Usage · PR totals" },
      { title: "OPTIONAL", text: "Household scores" },
    ], fontFile);
    await writeSlide(proofSlide, "Codex built it—and now runs it.", "Static demo. Real Pixlet output. Working checks.", "OPENAI BUILD WEEK", [
      { title: "LOCAL CODEX", text: "Scheduled automation" },
      { title: "REAL OUTPUT", text: "Pixlet renders" },
      { title: "TESTED", text: "Worker + displays" },
    ], fontFile);
    await writeSlide(closingSlide, "When something needs me, I just look up.", "Fewer trips through dashboards. More useful awareness.", "TIDBYTS", [
      { title: "FOUR", text: "Old displays" },
      { title: "ONE", text: "Codex automation" },
      { title: "NOW", text: "The useful signal" },
    ], fontFile);

    const videoAssetDirectory = join(temporaryDirectory, "product-frames");
    await mkdir(videoAssetDirectory, { recursive: true });
    const productFrame = (name) => rasterizeFirstFrame(
      join(demoAssetsDirectory, name),
      join(videoAssetDirectory, `${name.replace(/\.[^.]+$/, "")}.png`),
    );
    const [
      controlActive,
      controlAttention,
      controlCalm,
      exceptionCritical,
      exceptionHealthy,
      glintComplete,
      landedPrs,
      tokenUse,
      billableWeek,
      binQuest,
    ] = await Promise.all([
      productFrame("control-tower-active.webp"),
      productFrame("control-tower-attention.webp"),
      productFrame("control-tower-calm.webp"),
      productFrame("exception-critical.webp"),
      productFrame("exception-healthy.webp"),
      productFrame("glint-complete.gif"),
      productFrame("landed-prs.png"),
      productFrame("token-use.png"),
      productFrame("billable-week.png"),
      rasterizeFirstFrame(join(screenshotDirectory, "bin-quest.png"), join(videoAssetDirectory, "bin-quest.png")),
    ]);
    await writeGallerySlide(gallerySlide, [controlActive, exceptionCritical, glintComplete, landedPrs], fontFile);

    const { finalAudio, durations, chapters, configuration, cacheManifest, alignments } = await prepareNarrationAudio({
      sections,
      localVoice,
      reuseNarration,
      temporaryDirectory,
    });
    const subtitles = join(outputDirectory, `${outputStem}.en.srt`);
    const subtitleCueCount = await writeSubtitles(subtitles, sections, durations, alignments);
    const demoScreenshotCandidates = [
      "build-week-demo-control.png",
      "build-week-demo-exception.png",
    ].map((name) => join(screenshotDirectory, name));
    const demoScreenshots = [];
    for (const path of demoScreenshotCandidates) {
      if (await exists(path)) demoScreenshots.push(path);
    }
    if (demoScreenshots.length === 0) {
      const fallbackScreenshot = join(screenshotDirectory, "build-week-demo.png");
      if (!(await exists(fallbackScreenshot))) fail(`Missing judge-demo screenshot: ${fallbackScreenshot}`);
      demoScreenshots.push(fallbackScreenshot);
    }
    const demoScreenshotShots = demoScreenshots.map((source) => ({
      source,
      smooth: true,
      safeBelowCaption: true,
    }));
    const scenes = [
      {
        title: "Four tiny displays. One useful answer.",
        caption: "What is Codex doing—and does anything need me?",
        duration: durations[0],
        shots: [
          { source: gallerySlide, smooth: true, seconds: 2.4 },
          { source: controlActive, seconds: 1.6 },
          { source: join(demoAssetsDirectory, "exception-critical.gif"), gif: true, seconds: 1.6 },
          { source: join(demoAssetsDirectory, "glint-working.gif"), gif: true, seconds: 1.6 },
          { source: landedPrs, seconds: 1.6 },
          { source: gallerySlide, smooth: true },
        ],
      },
      {
        title: "Tidbyts",
        caption: "One useful fact from across the room—not another dashboard to watch.",
        duration: durations[1],
        shots: [
          { source: gallerySlide, smooth: true },
          ...demoScreenshotShots,
        ],
      },
      {
        title: "Codex is the local operator",
        caption: "In my normal setup, every fifteen minutes it checks, chooses, renders, and sends.",
        duration: durations[2],
        shots: [
          { source: agentSlide, smooth: true, weight: 3 },
          { source: controlActive, weight: 1 },
          { source: exceptionHealthy, weight: 1 },
        ],
      },
      {
        title: "Work becomes visible",
        caption: "Working. Recently active. Waiting for you. Finished.",
        duration: durations[3],
        shots: [
          { source: controlActive, weight: 1.4 },
          { source: controlAttention, weight: 1.2 },
          { source: join(demoAssetsDirectory, "glint-working.gif"), gif: true, weight: 0.8 },
          { source: join(demoAssetsDirectory, "glint-ready.gif"), gif: true, weight: 0.7 },
          { source: join(demoAssetsDirectory, "glint-complete.gif"), gif: true, weight: 0.9 },
        ],
      },
      {
        title: "A monitor that can evolve",
        caption: "Builds, disk, services, spending—and whatever becomes important next.",
        duration: durations[4],
        shots: [
          { source: exceptionHealthy, weight: 6.1 },
          { source: join(demoAssetsDirectory, "exception-critical.gif"), gif: true, weight: 11.3 },
          { source: evolutionSlide, smooth: true, weight: 10.4 },
          { source: exceptionCritical, weight: 3 },
          { source: billableWeek, weight: 4.1 },
        ],
      },
      {
        title: "More signals, without exposing the work",
        caption: "Tidbyts keeps prompt and code content out of the shared service.",
        duration: durations[5],
        shots: [
          { source: landedPrs, seconds: 1.5 },
          { source: tokenUse, seconds: 1.5 },
          { source: billableWeek, seconds: 1.5 },
          { source: binQuest, seconds: 1.5 },
          { source: privacySlide, smooth: true },
        ],
      },
      {
        title: "Built with Codex—and now run by Codex",
        caption: "A no-hardware demo, real renders, and working checks make the loop visible.",
        duration: durations[6],
        shots: [
          ...demoScreenshotShots.map((shot) => ({ ...shot, seconds: 4 })),
          { source: proofSlide, smooth: true },
        ],
      },
      {
        title: "Four old Tidbyts. One local Codex automation.",
        caption: "When something needs me, I just look up.",
        duration: durations[7] + finalHoldSeconds,
        shots: [
          { source: controlCalm, seconds: 4.4 },
          { source: closingSlide, smooth: true },
        ],
      },
    ];
    const clips = [];
    for (const [index, scene] of scenes.entries()) {
      clips.push(await makeSequenceScene(scene, index, temporaryDirectory, fontFile));
    }
    const sceneStarts = [];
    let sceneCursor = 0;
    for (const scene of scenes) {
      sceneStarts.push(sceneCursor);
      sceneCursor += scene.duration;
    }
    const visualDuration = sceneCursor;
    const visualTrack = join(temporaryDirectory, "visual.mp4");
    const visualInputs = clips.flatMap((clip) => ["-i", clip]);
    const visualResetTimestamps = clips.map((_, index) => `[${index}:v]setpts=PTS-STARTPTS[v${index}]`);
    const visualConcatInputs = clips.map((_, index) => `[v${index}]`).join("");
    await run("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y", ...visualInputs,
      "-filter_complex", `${visualResetTimestamps.join(";")};${visualConcatInputs}concat=n=${clips.length}:v=1:a=0[out]`,
      "-map", "[out]",
      "-an", "-r", "30", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
      "-x264-params", "colorprim=bt709:transfer=bt709:colormatrix=bt709:range=tv",
      "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-movflags", "+faststart", visualTrack,
    ]);
    const soundDesign = join(temporaryDirectory, "sound-design.wav");
    const soundAccents = [
      { at: 0, frequency: 196, duration: 0.8, volume: 0.018 },
      { at: sceneStarts[4], frequency: 293.66, duration: 0.26, volume: 0.012 },
      { at: sceneStarts[5] + 6, frequency: 392, duration: 0.22, volume: 0.01 },
      { at: sceneStarts[7] + 4.4, frequency: 440, duration: 0.95, volume: 0.016 },
      { at: sceneStarts[7] + 4.4, frequency: 659.25, duration: 0.95, volume: 0.009 },
    ];
    await makeSoundDesign(soundDesign, visualDuration, soundAccents);
    const finalVideo = join(outputDirectory, `${outputStem}.mp4`);
    await run("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y", "-i", visualTrack, "-i", finalAudio, "-i", soundDesign,
      "-filter_complex", `[1:a]apad=pad_dur=${finalHoldSeconds},atrim=duration=${visualDuration.toFixed(3)}[voice];[voice][2:a]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.94,aformat=sample_rates=48000:channel_layouts=mono[audio]`,
      "-map", "0:v:0", "-map", "[audio]", "-c:v", "copy", "-c:a", "aac", "-ar", "48000", "-b:a", "192k",
      "-metadata:s:a:0", "language=eng", "-shortest", "-movflags", "+faststart",
      "-use_editlist", "0", "-t", visualDuration.toFixed(3), finalVideo,
    ]);
    const finalDuration = await ffprobeSeconds(finalVideo);
    if (finalDuration > 180) fail(`Video is ${finalDuration.toFixed(1)} seconds; it must remain below three minutes.`);
    if (finalDuration < 150) fail(`Video is only ${finalDuration.toFixed(1)} seconds; narration or chapter timing is incomplete.`);
    const thumbnail = join(outputDirectory, localVoice ? "youtube-thumbnail-local.png" : "youtube-thumbnail.png");
    await writeYoutubeThumbnail(thumbnail, controlAttention, fontFile);
    const mediaSpecs = await ffprobeMediaSpecs(finalVideo);
    const videoStream = mediaSpecs.streams.find((stream) => stream.codec_type === "video");
    const audioStream = mediaSpecs.streams.find((stream) => stream.codec_type === "audio");
    if (videoStream?.width !== 1920 || videoStream?.height !== 1080) {
      fail("Final video must be 1920x1080.");
    }
    if (videoStream?.codec_name !== "h264" || audioStream?.codec_name !== "aac") {
      fail("Final video must use H.264 video and AAC audio.");
    }
    if (videoStream?.r_frame_rate !== "30/1" || videoStream?.pix_fmt !== "yuv420p") {
      fail("Final video must be exact 30 fps YUV 4:2:0.");
    }
    if (
      videoStream?.color_primaries !== "bt709"
      || videoStream?.color_transfer !== "bt709"
      || videoStream?.color_space !== "bt709"
    ) {
      fail("Final video must carry complete BT.709 color metadata.");
    }
    if (audioStream?.sample_rate !== "48000") {
      fail("Final audio must use a 48 kHz sample rate.");
    }
    if (audioStream?.tags?.language !== "eng") {
      fail("Final audio stream is missing the eng language tag.");
    }
    const buildManifest = join(outputDirectory, `${outputStem}.manifest.json`);
    await writeFile(buildManifest, `${JSON.stringify({
      schemaVersion: 1,
      profile: localVoice ? "local-voice" : "creator",
      narration: {
        source: basename(narrationPath),
        configuration,
        cacheManifest,
        chapters,
      },
      subtitles: {
        language: "eng",
        format: "SubRip",
        cueCount: subtitleCueCount,
        timing: localVoice ? "Proportional fallback" : "ElevenLabs forced alignment",
        authoredMaximumLines: 2,
        authoredMaximumCharactersPerLine: subtitleLineLength,
        targetMaximumCueDurationSeconds: subtitleMaximumDuration,
      },
      visualSources: {
        judgeDemoScreenshots: demoScreenshots.map((path) => basename(path)),
      },
      edit: {
        captionSafeAreaPixels: captionHeight,
        finalHoldSeconds,
      },
      soundDesign: {
        method: "Deterministic FFmpeg sine synthesis; no sampled or licensed audio.",
        accents: soundAccents,
      },
      tools: toolVersions,
      media: {
        video: {
          ...await fileMetadata(finalVideo),
          specs: mediaSpecs,
        },
        thumbnail: {
          ...await fileMetadata(thumbnail),
          width: 1280,
          height: 720,
        },
        subtitles: await fileMetadata(subtitles),
      },
    }, null, 2)}\n`);
    console.log(`Build Week video ready: ${finalVideo}`);
    console.log(`YouTube thumbnail ready: ${thumbnail}`);
    console.log(`English subtitles ready: ${subtitles}`);
    console.log(`Build manifest ready: ${buildManifest}`);
    console.log(`Duration: ${finalDuration.toFixed(1)} seconds`);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function main() {
  const options = new Set(process.argv.slice(2));
  const supportedOptions = new Set(["--assets-only", "--local-voice", "--reuse-narration"]);
  const unknownOptions = [...options].filter((option) => !supportedOptions.has(option));
  if (unknownOptions.length > 0) fail(`Unknown option${unknownOptions.length === 1 ? "" : "s"}: ${unknownOptions.join(", ")}`);
  const assetsOnly = options.has("--assets-only");
  const localVoice = options.has("--local-voice");
  const reuseNarration = options.has("--reuse-narration");
  await prepareDemoAssets();
  if (assetsOnly) return;
  await buildVideo({ localVoice, reuseNarration });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
