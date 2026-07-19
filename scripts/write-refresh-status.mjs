#!/usr/bin/env node

import { readFile, mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputPath = join(dirname(scriptDirectory), ".local", "refresh-status.json");
const step = process.argv[2];
const result = process.argv[3];
const allowedSteps = new Set(["usage", "prs", "apps", "prototypes", "prototypePush"]);

async function main() {
  if (!allowedSteps.has(step) || !["ok", "failed"].includes(result)) {
    throw new Error("Usage: write-refresh-status.mjs <step> <ok|failed>");
  }
  let current = {};
  try {
    current = JSON.parse(await readFile(outputPath, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const snapshot = {
    updatedAt: new Date().toISOString(),
    steps: {
      ...(current.steps || {}),
      [step]: { ok: result === "ok", at: new Date().toISOString() },
    },
  };
  await mkdir(dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
  await rename(temporaryPath, outputPath);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
