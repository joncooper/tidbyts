#!/usr/bin/env node

import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputPath = join(dirname(scriptDirectory), ".local", "codex-thread-status.json");

function argument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function count(name) {
  const value = Number(argument(name));
  if (!Number.isSafeInteger(value) || value < 0 || value > 9999) {
    throw new Error(`--${name} must be an integer between 0 and 9999`);
  }
  return value;
}

async function main() {
  const snapshot = {
    generatedAt: new Date().toISOString(),
    live: count("live"),
    ready: count("ready"),
    warm: count("warm"),
  };
  await mkdir(dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
  await rename(temporaryPath, outputPath);
  console.log(JSON.stringify({ message: "Codex status updated", ...snapshot }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
