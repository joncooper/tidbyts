#!/usr/bin/env node

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DAY_MS = 24 * 60 * 60 * 1000;
const REPOSITORY = process.env.TIDBYTS_GITHUB_REPOSITORY || "dockett/mono-playground";

async function mergedCount(since) {
  const query = `repo:${REPOSITORY} is:pr is:merged merged:>=${since.toISOString()}`;
  const { stdout } = await execFileAsync(
    "gh",
    [
      "api",
      "--method",
      "GET",
      "search/issues",
      "-f",
      `q=${query}`,
      "-F",
      "per_page=1",
      "--jq",
      ".total_count",
    ],
    { maxBuffer: 1024 * 1024 },
  );
  const value = Number(stdout.trim());
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("GitHub returned an invalid PR count");
  }
  return value;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const apiUrl = process.env.TIDBYTS_API_URL;
  const ingestToken = process.env.TIDBYTS_INGEST_TOKEN;
  if (!dryRun && (!apiUrl || !ingestToken)) {
    throw new Error("TIDBYTS_API_URL and TIDBYTS_INGEST_TOKEN are required");
  }

  const observedAt = new Date();
  const [trailing24h, trailing7d, trailing30d] = await Promise.all([
    mergedCount(new Date(observedAt.getTime() - DAY_MS)),
    mergedCount(new Date(observedAt.getTime() - 7 * DAY_MS)),
    mergedCount(new Date(observedAt.getTime() - 30 * DAY_MS)),
  ]);
  const snapshot = {
    trailing24h,
    trailing7d,
    trailing30d,
    observedAt: observedAt.toISOString(),
  };

  if (!dryRun) {
    const response = await fetch(
      `${apiUrl.replace(/\/$/, "")}/api/prs/snapshot`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ingestToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(snapshot),
      },
    );
    if (!response.ok) {
      throw new Error(`PR snapshot upload failed with HTTP ${response.status}`);
    }
  }

  console.log(JSON.stringify({ message: "PR collection complete", dry_run: dryRun, ...snapshot }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
