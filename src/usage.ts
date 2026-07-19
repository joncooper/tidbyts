import {
  HttpError,
  isRecord,
  jsonResponse,
  readBoundedJson,
  requiredString,
} from "./http";

const MAX_BODY_BYTES = 1_000_000;
const MAX_EVENTS = 200;
const MAX_TOKENS_PER_EVENT = 10_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;

type Provider = "codex" | "claude";
type TokenType = "input" | "output" | "cache_read" | "cache_write";

interface NormalizedTokenRow {
  id: string;
  provider: Provider;
  observedAt: number;
  tokenType: TokenType;
  tokenCount: number;
  model: string | null;
}

interface UsageWindow {
  codex: number;
  claude: number;
  total: number;
}

export interface UsageCounts {
  trailing_24h: UsageWindow;
  trailing_7d: UsageWindow;
  trailing_30d: UsageWindow;
  as_of: string;
}

function provider(value: unknown): Provider {
  if (value !== "codex" && value !== "claude") {
    throw new HttpError(400, "provider must be codex or claude");
  }
  return value;
}

function tokenCount(value: unknown, field: string): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > MAX_TOKENS_PER_EVENT
  ) {
    throw new HttpError(400, `${field} must be a non-negative integer`);
  }
  return value;
}

function observedAt(value: unknown): number {
  if (typeof value !== "string") {
    throw new HttpError(400, "observedAt must be an ISO-8601 timestamp");
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new HttpError(400, "observedAt must be an ISO-8601 timestamp");
  }
  return timestamp;
}

function normalizedRows(body: unknown): NormalizedTokenRow[] {
  if (!isRecord(body) || !Array.isArray(body.events)) {
    throw new HttpError(400, "Body must contain an events array");
  }
  if (body.events.length === 0 || body.events.length > MAX_EVENTS) {
    throw new HttpError(400, `events must contain between 1 and ${MAX_EVENTS} items`);
  }

  const rows: NormalizedTokenRow[] = [];
  for (const value of body.events) {
    if (!isRecord(value)) {
      throw new HttpError(400, "Each event must be an object");
    }
    const eventId = requiredString(value.id, "id", 200);
    const eventProvider = provider(value.provider);
    const eventObservedAt = observedAt(value.observedAt);
    const model = value.model === undefined || value.model === null
      ? null
      : requiredString(value.model, "model", 100);
    const values: ReadonlyArray<[TokenType, string, unknown]> = [
      ["input", "inputTokens", value.inputTokens],
      ["output", "outputTokens", value.outputTokens],
      ["cache_read", "cacheReadTokens", value.cacheReadTokens],
      ["cache_write", "cacheWriteTokens", value.cacheWriteTokens],
    ];
    for (const [type, field, countValue] of values) {
      const count = tokenCount(countValue ?? 0, field);
      if (count > 0) {
        rows.push({
          id: `${eventId}:${type}`,
          provider: eventProvider,
          observedAt: eventObservedAt,
          tokenType: type,
          tokenCount: count,
          model,
        });
      }
    }
  }
  return rows;
}

async function writeRows(env: Env, rows: readonly NormalizedTokenRow[]): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }
  const statement = env.DB.prepare(
    `INSERT OR IGNORE INTO token_events
       (id, provider, observed_at, token_type, token_count, model)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const results = await env.DB.batch(
    rows.map((row) =>
      statement.bind(
        row.id,
        row.provider,
        row.observedAt,
        row.tokenType,
        row.tokenCount,
        row.model,
      ),
    ),
  );
  return results.reduce((sum, result) => sum + (result.meta.changes ?? 0), 0);
}

export async function ingestUsageEvents(request: Request, env: Env): Promise<Response> {
  const body = await readBoundedJson(request, MAX_BODY_BYTES);
  const rows = normalizedRows(body);
  const written = await writeRows(env, rows);
  return jsonResponse({ accepted_events: rows.length, rows_changed: written }, 202);
}

interface UsageRow {
  provider: string;
  h24: number;
  d7: number;
  d30: number;
}

function emptyWindow(): UsageWindow {
  return { codex: 0, claude: 0, total: 0 };
}

export async function usageCounts(env: Env): Promise<UsageCounts> {
  const now = Date.now();
  const cutoff24 = now - DAY_MS;
  const cutoff7 = now - 7 * DAY_MS;
  const cutoff30 = now - 30 * DAY_MS;
  const result = await env.DB.prepare(
    `SELECT
       provider,
       COALESCE(SUM(CASE WHEN observed_at >= ? THEN token_count ELSE 0 END), 0) AS h24,
       COALESCE(SUM(CASE WHEN observed_at >= ? THEN token_count ELSE 0 END), 0) AS d7,
       COALESCE(SUM(token_count), 0) AS d30
     FROM token_events
     WHERE observed_at >= ?
     GROUP BY provider`,
  )
    .bind(cutoff24, cutoff7, cutoff30)
    .all<UsageRow>();

  const windows = {
    trailing_24h: emptyWindow(),
    trailing_7d: emptyWindow(),
    trailing_30d: emptyWindow(),
  };
  for (const row of result.results) {
    if (row.provider !== "codex" && row.provider !== "claude") {
      continue;
    }
    windows.trailing_24h[row.provider] = row.h24;
    windows.trailing_7d[row.provider] = row.d7;
    windows.trailing_30d[row.provider] = row.d30;
  }
  for (const window of Object.values(windows)) {
    window.total = window.codex + window.claude;
  }
  return { ...windows, as_of: new Date(now).toISOString() };
}
