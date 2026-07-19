#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFile, mkdir, rename, statfs, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = dirname(scriptDirectory);
const outputPath = join(projectDirectory, ".local", "prototype-status.json");
const timecardPath = process.env.TIDBYTS_TIMECARD_PATH
  || join(homedir(), "Library", "Application Support", "Timecard", "timecard.json");
const codexStatePath = process.env.TIDBYTS_CODEX_STATE_PATH
  || join(homedir(), ".codex", "state_5.sqlite");

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function number(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

async function readJson(path, fallback = null) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

function sqliteRows(sql) {
  try {
    const output = execFileSync(
      "sqlite3",
      ["-readonly", "-json", codexStatePath, sql],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    return output ? JSON.parse(output) : [];
  } catch {
    return [];
  }
}

function collectCodex() {
  const activity = sqliteRows(`
    SELECT
      COALESCE(SUM(CASE
        WHEN recency_at_ms >= (unixepoch('now') - 3600) * 1000 THEN 1
        ELSE 0 END), 0) AS live,
      COALESCE(SUM(CASE
        WHEN recency_at_ms < (unixepoch('now') - 3600) * 1000
         AND recency_at_ms >= (unixepoch('now') - 86400) * 1000 THEN 1
        ELSE 0 END), 0) AS warm
    FROM threads
    WHERE archived = 0
      AND preview <> ''
      AND source NOT LIKE '%subagent%';
  `)[0] ?? {};
  const jobs = sqliteRows(`
    SELECT
      COALESCE(SUM(CASE
        WHEN status IN ('running', 'in_progress', 'pending', 'queued') THEN 1
        ELSE 0 END), 0) AS running,
      COALESCE(SUM(CASE
        WHEN status IN ('failed', 'error', 'blocked') THEN 1
        ELSE 0 END), 0) AS needs_attention,
      COALESCE(SUM(CASE
        WHEN status IN ('completed', 'complete', 'succeeded')
         AND updated_at >= unixepoch('now') - 86400 THEN 1
        ELSE 0 END), 0) AS completed
    FROM agent_jobs;
  `)[0] ?? {};

  return {
    live: Math.min(99, number(activity.live)),
    warm: Math.min(99, number(activity.warm)),
    jobs: Math.min(99, number(jobs.running)),
    completed: Math.min(99, number(jobs.completed)),
    needsAttention: Math.min(99, number(jobs.needs_attention)),
    exactNeedsAttention: false,
  };
}

function mondayStart(now) {
  const value = new Date(now);
  value.setHours(0, 0, 0, 0);
  value.setDate(value.getDate() - ((value.getDay() + 6) % 7));
  return value;
}

async function collectBillable(now) {
  const data = await readJson(timecardPath);
  const targetHours = Math.max(
    1,
    number(Number(process.env.TIDBYTS_BILLABLE_TARGET_HOURS), 20),
  );
  if (!isRecord(data)) {
    return {
      available: false,
      weekTenths: 0,
      targetTenths: Math.round(targetHours * 10),
      active: false,
      sessionSeconds: 0,
    };
  }

  const weekStart = mondayStart(now).getTime();
  const nextWeek = weekStart + 7 * 24 * 60 * 60 * 1000;
  let weekSeconds = 0;
  for (const entry of Array.isArray(data.entries) ? data.entries : []) {
    if (!isRecord(entry)) continue;
    const startedAt = Date.parse(entry.startedAt);
    if (startedAt >= weekStart && startedAt < nextWeek) {
      weekSeconds += Math.max(0, number(entry.activeSeconds));
    }
  }

  const session = isRecord(data.activeSession) ? data.activeSession : null;
  let sessionSeconds = session ? Math.max(0, number(session.accumulatedActiveSeconds)) : 0;
  const active = session?.state === "running";
  if (active) {
    const lastUpdatedAt = Date.parse(session.lastUpdatedAt);
    if (Number.isFinite(lastUpdatedAt)) {
      sessionSeconds += Math.max(0, (now - lastUpdatedAt) / 1000);
    }
  }
  if (session !== null) {
    const sessionStartedAt = Date.parse(session.startedAt);
    if (sessionStartedAt >= weekStart && sessionStartedAt < nextWeek) {
      weekSeconds += sessionSeconds;
    }
  }

  return {
    available: true,
    weekTenths: Math.max(0, Math.round(weekSeconds / 360)),
    targetTenths: Math.round(targetHours * 10),
    active,
    sessionSeconds: Math.round(sessionSeconds),
  };
}

async function fetchJson(url, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function collectCloud() {
  const apiUrl = process.env.TIDBYTS_API_URL?.replace(/\/$/, "");
  if (!apiUrl) return { configured: false, healthy: false, prs: null };
  try {
    const [health, prs] = await Promise.all([
      fetchJson(`${apiUrl}/health`),
      fetchJson(`${apiUrl}/api/prs`, process.env.TIDBYTS_READ_TOKEN),
    ]);
    return {
      configured: true,
      healthy: health?.ok === true,
      prs: isRecord(prs) ? prs : null,
    };
  } catch {
    return { configured: true, healthy: false, prs: null };
  }
}

async function collectDisk() {
  try {
    const info = await statfs("/");
    const freeBytes = Number(info.bavail) * Number(info.bsize);
    const totalBytes = Number(info.blocks) * Number(info.bsize);
    return {
      available: true,
      freeGb: Math.round(freeBytes / 1_000_000_000),
      freePercent: totalBytes > 0 ? Math.round((freeBytes / totalBytes) * 100) : 100,
    };
  } catch {
    return { available: false, freeGb: 0, freePercent: 0 };
  }
}

function exception(severity, label, value) {
  return { severity, label: label.slice(0, 10), value: value.slice(0, 12) };
}

function collectExceptions({ billable, cloud, disk }) {
  const alerts = [];
  if (!billable.available) alerts.push(exception("warn", "TIMECARD", "NO DATA"));
  if (!disk.available) {
    alerts.push(exception("warn", "DISK", "UNKNOWN"));
  } else if (disk.freeGb < 10 || disk.freePercent < 2) {
    alerts.push(exception("critical", "LOW DISK", `${disk.freeGb}G FREE`));
  } else if (disk.freeGb < 20 || disk.freePercent < 5) {
    alerts.push(exception("warn", "DISK", `${disk.freeGb}G FREE`));
  }
  if (!cloud.configured) {
    alerts.push(exception("warn", "CLOUD", "NOT SET"));
  } else if (!cloud.healthy) {
    alerts.push(exception("critical", "CLOUD", "OFFLINE"));
  } else if (cloud.prs?.stale === true) {
    alerts.push(exception("warn", "PR DATA", "STALE"));
  }
  return alerts.slice(0, 4);
}

function collectGlint(now, codex, cloud, previous) {
  const previousKnown = previous?.glint?.prCountKnown === true;
  const currentKnown = isRecord(cloud.prs);
  const previousPrCount = Math.max(0, number(previous?.glint?.lastPrCount));
  const currentPrCount = currentKnown
    ? Math.max(0, number(cloud.prs.trailing_24h))
    : previousPrCount;
  let celebrateUntil = number(previous?.glint?.celebrateUntil, 0);
  let shipped = number(previous?.glint?.shipped, 0);
  if (previousKnown && currentKnown && currentPrCount > previousPrCount) {
    shipped = currentPrCount - previousPrCount;
    celebrateUntil = now + 60 * 60 * 1000;
  } else if (!previousKnown) {
    celebrateUntil = 0;
    shipped = 0;
  }
  const celebrating = celebrateUntil > now;
  return {
    mode: celebrating ? "celebrate" : "working",
    working: codex.live,
    shipped: celebrating ? shipped : 0,
    lastPrCount: currentPrCount,
    prCountKnown: previousKnown || currentKnown,
    celebrateUntil,
  };
}

async function main() {
  const now = Date.now();
  const previous = await readJson(outputPath, {});
  const [billable, cloud, disk] = await Promise.all([
    collectBillable(now),
    collectCloud(),
    collectDisk(),
  ]);
  const codex = collectCodex();
  const glint = collectGlint(now, codex, cloud, previous);
  const snapshot = {
    generatedAt: new Date(now).toISOString(),
    codex,
    glint,
    billable,
    disk,
    exceptions: collectExceptions({ billable, cloud, disk }),
  };

  await mkdir(dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, {
    mode: 0o600,
  });
  await rename(temporaryPath, outputPath);
  console.log(JSON.stringify({
    message: "prototype collection complete",
    live_codex_tasks: codex.live,
    warm_codex_tasks: codex.warm,
    billable_week_tenths: billable.weekTenths,
    billable_active: billable.active,
    exceptions: snapshot.exceptions.length,
    glint_mode: glint.mode,
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
