#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFile, mkdir, rename, statfs, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = dirname(scriptDirectory);
const outputPath = join(projectDirectory, ".local", "prototype-status.json");
const codexThreadStatusPath = join(projectDirectory, ".local", "codex-thread-status.json");
const refreshStatusPath = join(projectDirectory, ".local", "refresh-status.json");
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

async function collectCodex(now) {
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

  const exact = await readJson(codexThreadStatusPath);
  const exactTimestamp = Date.parse(exact?.generatedAt);
  const exactFresh = Number.isFinite(exactTimestamp) && now - exactTimestamp < 45 * 60 * 1000;
  const live = exactFresh ? number(exact.live) : number(activity.live);
  const warm = exactFresh ? number(exact.warm) : number(activity.warm);
  const ready = exactFresh ? number(exact.ready) : 0;
  const failedJobs = number(jobs.needs_attention);

  return {
    live: Math.min(99, live),
    warm: Math.min(99, warm),
    ready: Math.min(99, ready),
    jobs: Math.min(99, number(jobs.running)),
    completed: Math.min(99, number(jobs.completed)),
    needsAttention: Math.min(99, ready + failedJobs),
    attentionReason: ready > 0 ? "READY" : (failedJobs > 0 ? "JOB FAILED" : ""),
    exactNeedsAttention: exactFresh,
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

function collectCi(now) {
  if (process.env.TIDBYTS_MONITOR_CI === "0") {
    return { configured: false, available: true, failing: false };
  }
  const repository = process.env.TIDBYTS_GITHUB_REPOSITORY || "joncooper/tidbyts";
  try {
    const output = execFileSync(
      "gh",
      ["api", `repos/${repository}/actions/runs?per_page=10`],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 8000,
      },
    );
    const parsed = JSON.parse(output);
    const runs = Array.isArray(parsed?.workflow_runs) ? parsed.workflow_runs : [];
    const latest = runs.find((run) => isRecord(run) && run.status === "completed");
    if (!latest) return { configured: true, available: true, failing: false };
    const updatedAt = Date.parse(latest.updated_at);
    const recent = Number.isFinite(updatedAt) && now - updatedAt < 48 * 60 * 60 * 1000;
    const good = ["success", "neutral", "skipped"].includes(latest.conclusion);
    return {
      configured: true,
      available: true,
      failing: recent && !good,
      conclusion: typeof latest.conclusion === "string" ? latest.conclusion : "failed",
    };
  } catch {
    return { configured: true, available: false, failing: false };
  }
}

async function collectServices() {
  const specification = process.env.TIDBYTS_HEALTHCHECKS || "";
  const checks = specification.split(",").map((value) => value.trim()).filter(Boolean);
  const results = [];
  for (const check of checks.slice(0, 6)) {
    const separator = check.indexOf("=");
    if (separator <= 0) continue;
    const name = check.slice(0, separator).trim().slice(0, 10);
    const url = check.slice(separator + 1).trim();
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      results.push({ name, healthy: response.ok });
    } catch {
      results.push({ name, healthy: false });
    }
  }
  return results;
}

function collectAwsSpend(now) {
  const budget = Number(process.env.TIDBYTS_AWS_MONTHLY_BUDGET_USD);
  if (!Number.isFinite(budget) || budget <= 0) return { configured: false };
  const start = new Date(now);
  start.setUTCDate(1);
  const end = new Date(now + 24 * 60 * 60 * 1000);
  const date = (value) => value.toISOString().slice(0, 10);
  try {
    const output = execFileSync(
      "aws",
      [
        "ce", "get-cost-and-usage",
        "--time-period", `Start=${date(start)},End=${date(end)}`,
        "--granularity", "MONTHLY",
        "--metrics", "UnblendedCost",
        "--output", "json",
      ],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 10000,
      },
    );
    const parsed = JSON.parse(output);
    const amount = Number(parsed?.ResultsByTime?.[0]?.Total?.UnblendedCost?.Amount);
    return {
      configured: true,
      available: Number.isFinite(amount),
      amount: Number.isFinite(amount) ? amount : 0,
      budget,
    };
  } catch {
    return { configured: true, available: false, amount: 0, budget };
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
  return { severity, label: label.slice(0, 10), value: value.slice(0, 7) };
}

function recentRefreshFailures(refresh, now) {
  if (!isRecord(refresh?.steps)) return [];
  const labels = {
    usage: ["USAGE", "warn"],
    prs: ["PR SYNC", "warn"],
    apps: ["APPS", "critical"],
    prototypes: ["STATUS", "warn"],
    prototypePush: ["TIDBYT", "critical"],
  };
  const failures = [];
  for (const [step, details] of Object.entries(refresh.steps)) {
    if (!isRecord(details) || details.ok !== false) continue;
    const timestamp = Date.parse(details.at);
    if (!Number.isFinite(timestamp) || now - timestamp > 2 * 60 * 60 * 1000) continue;
    const [label, severity] = labels[step] || ["REFRESH", "warn"];
    failures.push(exception(severity, label, "FAILED"));
  }
  return failures;
}

function collectExceptions({ billable, cloud, disk, ci, services, awsSpend, refresh, now }) {
  const alerts = [];
  alerts.push(...recentRefreshFailures(refresh, now));
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
  if (!ci.available) {
    alerts.push(exception("warn", "CI", "UNKNOWN"));
  } else if (ci.failing) {
    alerts.push(exception("critical", "CI", String(ci.conclusion || "FAILED").toUpperCase()));
  }
  for (const service of services) {
    if (!service.healthy) alerts.push(exception("critical", service.name || "SERVICE", "OFFLINE"));
  }
  if (awsSpend.configured && !awsSpend.available) {
    alerts.push(exception("warn", "AWS COST", "UNKNOWN"));
  } else if (awsSpend.configured && awsSpend.amount >= awsSpend.budget) {
    alerts.push(exception("critical", "AWS COST", `$${Math.round(awsSpend.amount)}`));
  } else if (awsSpend.configured && awsSpend.amount >= awsSpend.budget * 0.8) {
    alerts.push(exception("warn", "AWS COST", `$${Math.round(awsSpend.amount)}`));
  }
  alerts.sort((a, b) => (a.severity === b.severity ? 0 : (a.severity === "critical" ? -1 : 1)));
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
  let completionUntil = number(previous?.glint?.completionUntil, 0);
  let shipped = number(previous?.glint?.shipped, 0);
  let completed = number(previous?.glint?.completed, 0);
  if (previousKnown && currentKnown && currentPrCount > previousPrCount) {
    shipped = currentPrCount - previousPrCount;
    celebrateUntil = now + 60 * 60 * 1000;
  } else if (!previousKnown) {
    celebrateUntil = 0;
    shipped = 0;
  }
  const workingKnown = previous?.glint?.workingKnown === true;
  const previousWorking = number(previous?.glint?.working);
  if (workingKnown && codex.live < previousWorking) {
    completed = previousWorking - codex.live;
    completionUntil = now + 45 * 60 * 1000;
  }
  const celebrating = celebrateUntil > now;
  const completing = completionUntil > now;
  let mode = "idle";
  if (codex.live > 0) mode = "working";
  if (completing) mode = "complete";
  if (codex.needsAttention > 0) mode = "ready";
  if (celebrating) mode = "celebrate";
  return {
    mode,
    working: codex.live,
    ready: codex.needsAttention,
    completed: completing ? completed : 0,
    shipped: celebrating ? shipped : 0,
    lastPrCount: currentPrCount,
    prCountKnown: previousKnown || currentKnown,
    workingKnown: true,
    celebrateUntil,
    completionUntil,
  };
}

function enrichBillable(now, billable, previous) {
  let goalCelebrationUntil = number(previous?.billable?.goalCelebrationUntil, 0);
  const previousKnown = previous?.billable?.goalKnown === true;
  const previousWeek = number(previous?.billable?.weekTenths);
  if (
    previousKnown
    && previousWeek < billable.targetTenths
    && billable.weekTenths >= billable.targetTenths
  ) {
    goalCelebrationUntil = now + 60 * 60 * 1000;
  }
  if (billable.weekTenths < billable.targetTenths) goalCelebrationUntil = 0;
  return {
    ...billable,
    goalKnown: true,
    goalCelebrationUntil,
    celebrateGoal: goalCelebrationUntil > now,
  };
}

async function main() {
  const now = Date.now();
  const previous = await readJson(outputPath, {});
  const [billableRaw, cloud, disk, services, refresh] = await Promise.all([
    collectBillable(now),
    collectCloud(),
    collectDisk(),
    collectServices(),
    readJson(refreshStatusPath, {}),
  ]);
  const [codex, ci] = await Promise.all([collectCodex(now), Promise.resolve(collectCi(now))]);
  const awsSpend = collectAwsSpend(now);
  const billable = enrichBillable(now, billableRaw, previous);
  const glint = collectGlint(now, codex, cloud, previous);
  const snapshot = {
    generatedAt: new Date(now).toISOString(),
    codex,
    glint,
    billable,
    disk,
    exceptions: collectExceptions({
      billable,
      cloud,
      disk,
      ci,
      services,
      awsSpend,
      refresh,
      now,
    }),
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
