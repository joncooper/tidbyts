import {
  HttpError,
  isRecord,
  jsonResponse,
  readBoundedJson,
} from "./http";

const MAX_BODY_BYTES = 20_000;
const STALE_AFTER_MS = 30 * 60 * 1000;

export interface PullRequestCounts {
  repository: string;
  trailing_24h: number;
  trailing_7d: number;
  trailing_30d: number;
  as_of: string;
  stale: boolean;
}

interface SnapshotRow {
  value_json: string;
  updated_at: number;
}

function count(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new HttpError(400, `${field} must be a non-negative integer`);
  }
  return value;
}

function timestamp(value: unknown): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new HttpError(400, "observedAt must be an ISO-8601 timestamp");
  }
  return new Date(value).toISOString();
}

function isPullRequestCounts(value: unknown): value is PullRequestCounts {
  return (
    isRecord(value) &&
    typeof value.repository === "string" &&
    typeof value.trailing_24h === "number" &&
    typeof value.trailing_7d === "number" &&
    typeof value.trailing_30d === "number" &&
    typeof value.as_of === "string" &&
    typeof value.stale === "boolean"
  );
}

export async function ingestPullRequestCounts(
  request: Request,
  env: Env,
): Promise<Response> {
  const body = await readBoundedJson(request, MAX_BODY_BYTES);
  if (!isRecord(body)) {
    throw new HttpError(400, "Body must be an object");
  }
  const day = count(body.trailing24h, "trailing24h");
  const week = count(body.trailing7d, "trailing7d");
  const month = count(body.trailing30d, "trailing30d");
  if (day > week || week > month) {
    throw new HttpError(400, "PR counts must be monotonic across time windows");
  }
  const observedAt = timestamp(body.observedAt);
  const counts: PullRequestCounts = {
    repository: env.GITHUB_REPOSITORY,
    trailing_24h: day,
    trailing_7d: week,
    trailing_30d: month,
    as_of: observedAt,
    stale: false,
  };
  await env.DB.prepare(
    `INSERT INTO snapshots (key, value_json, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value_json = excluded.value_json,
       updated_at = excluded.updated_at`,
  )
    .bind("pr-counts", JSON.stringify(counts), Date.now())
    .run();
  return jsonResponse({ accepted: true }, 202);
}

export async function pullRequestCounts(env: Env): Promise<PullRequestCounts> {
  const row = await env.DB.prepare(
    "SELECT value_json, updated_at FROM snapshots WHERE key = ?",
  )
    .bind("pr-counts")
    .first<SnapshotRow>();
  if (row === null) {
    throw new HttpError(503, "PR metrics have not been collected yet");
  }

  const parsed: unknown = JSON.parse(row.value_json);
  if (!isPullRequestCounts(parsed)) {
    throw new HttpError(500, "Stored PR metrics are invalid");
  }
  return {
    ...parsed,
    stale: Date.now() - row.updated_at > STALE_AFTER_MS,
  };
}
