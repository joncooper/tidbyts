#!/usr/bin/env node

import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";

const DEFAULT_LOOKBACK_HOURS = 2;
const BATCH_SIZE = 100;

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function lookbackMs() {
  const daysArg = process.argv.find((arg) => arg.startsWith("--days="));
  if (daysArg) {
    const days = Number(daysArg.slice("--days=".length));
    if (!Number.isFinite(days) || days <= 0 || days > 365) {
      throw new Error("--days must be between 1 and 365");
    }
    return days * 24 * 60 * 60 * 1000;
  }

  const hoursArg = process.argv.find((arg) => arg.startsWith("--hours="));
  const hours = hoursArg
    ? Number(hoursArg.slice("--hours=".length))
    : DEFAULT_LOOKBACK_HOURS;
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24 * 31) {
    throw new Error("--hours must be between 1 and 744");
  }
  return hours * 60 * 60 * 1000;
}

async function jsonlFiles(root, cutoff) {
  const files = [];
  async function visit(path) {
    let entries;
    try {
      entries = await readdir(path, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) {
        await visit(child);
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        const info = await stat(child);
        if (info.mtimeMs >= cutoff) files.push(child);
      }
    }
  }
  await visit(root);
  return files;
}

async function lines(path, callback) {
  const input = createReadStream(path, { encoding: "utf8" });
  const reader = createInterface({ input, crlfDelay: Infinity });
  for await (const line of reader) {
    if (!line) continue;
    let value;
    try {
      value = JSON.parse(line);
    } catch {
      continue;
    }
    callback(value);
  }
}

function nonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

async function collectCodex(root, cutoff) {
  const roots = [join(root, "sessions"), join(root, "archived_sessions")];
  const files = (
    await Promise.all(roots.map((path) => jsonlFiles(path, cutoff - 24 * 60 * 60 * 1000)))
  ).flat();
  const events = new Map();

  for (const path of files) {
    let sessionId = null;
    let isSubagent = false;
    let metadataSeen = false;
    await lines(path, (entry) => {
      if (!isRecord(entry)) return;
      if (!metadataSeen && entry.type === "session_meta" && isRecord(entry.payload)) {
        metadataSeen = true;
        sessionId = typeof entry.payload.id === "string" ? entry.payload.id : null;
        isSubagent = isRecord(entry.payload.source) && "subagent" in entry.payload.source;
        return;
      }
      if (isSubagent || sessionId === null || entry.type !== "event_msg") return;
      if (typeof entry.timestamp !== "string" || Date.parse(entry.timestamp) < cutoff) return;
      if (!isRecord(entry.payload) || entry.payload.type !== "token_count") return;
      const info = entry.payload.info;
      if (!isRecord(info) || !isRecord(info.last_token_usage)) return;
      const usage = info.last_token_usage;
      const inputTokens = nonNegativeInteger(usage.input_tokens);
      const outputTokens = nonNegativeInteger(usage.output_tokens);
      const totalTokens = nonNegativeInteger(usage.total_tokens);
      if (inputTokens + outputTokens === 0) return;
      const id = `codex:${sessionId}:${entry.timestamp}:${totalTokens}`;
      events.set(id, {
        id,
        provider: "codex",
        observedAt: entry.timestamp,
        inputTokens,
        outputTokens,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      });
    });
  }
  return [...events.values()];
}

async function collectClaude(root, cutoff) {
  const files = await jsonlFiles(
    join(root, "projects"),
    cutoff - 24 * 60 * 60 * 1000,
  );
  const events = new Map();
  for (const path of files) {
    await lines(path, (entry) => {
      if (!isRecord(entry) || entry.type !== "assistant") return;
      if (typeof entry.timestamp !== "string" || Date.parse(entry.timestamp) < cutoff) return;
      if (!isRecord(entry.message) || !isRecord(entry.message.usage)) return;
      const messageId = entry.message.id;
      if (typeof messageId !== "string") return;
      const usage = entry.message.usage;
      const event = {
        id: `claude:${messageId}`,
        provider: "claude",
        observedAt: entry.timestamp,
        inputTokens: nonNegativeInteger(usage.input_tokens),
        outputTokens: nonNegativeInteger(usage.output_tokens),
        cacheReadTokens: nonNegativeInteger(usage.cache_read_input_tokens),
        cacheWriteTokens: nonNegativeInteger(usage.cache_creation_input_tokens),
        model: typeof entry.message.model === "string" ? entry.message.model : undefined,
      };
      if (
        event.inputTokens +
          event.outputTokens +
          event.cacheReadTokens +
          event.cacheWriteTokens ===
        0
      ) {
        return;
      }
      events.set(event.id, event);
    });
  }
  return [...events.values()];
}

async function upload(events, apiUrl, ingestToken) {
  let accepted = 0;
  for (let offset = 0; offset < events.length; offset += BATCH_SIZE) {
    const batch = events.slice(offset, offset + BATCH_SIZE);
    const response = await fetch(`${apiUrl.replace(/\/$/, "")}/api/usage/events`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ingestToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ events: batch }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Usage upload failed with HTTP ${response.status}: ${body}`);
    }
    accepted += batch.length;
  }
  return accepted;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const apiUrl = process.env.TIDBYTS_API_URL;
  const ingestToken = process.env.TIDBYTS_INGEST_TOKEN;
  if (!dryRun && (!apiUrl || !ingestToken)) {
    throw new Error("TIDBYTS_API_URL and TIDBYTS_INGEST_TOKEN are required");
  }
  const cutoff = Date.now() - lookbackMs();
  const userHome = homedir();
  const codexRoot = process.env.TIDBYTS_CODEX_DIR || join(userHome, ".codex");
  const claudeRoot = process.env.TIDBYTS_CLAUDE_DIR || join(userHome, ".claude");
  const [codex, claude] = await Promise.all([
    collectCodex(codexRoot, cutoff),
    collectClaude(claudeRoot, cutoff),
  ]);
  const events = [...codex, ...claude].sort((a, b) =>
    a.observedAt.localeCompare(b.observedAt),
  );
  const uploaded = dryRun || events.length === 0
    ? 0
    : await upload(events, apiUrl, ingestToken);
  console.log(
    JSON.stringify({
      message: "usage collection complete",
      dry_run: dryRun,
      codex_events: codex.length,
      claude_events: claude.length,
      discovered_events: events.length,
      uploaded_events: uploaded,
      cutoff: new Date(cutoff).toISOString(),
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
