import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const API = "https://example.test";

function authenticated(path: string, token: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return new Request(`${API}${path}`, { ...init, headers });
}

async function json<T>(response: Response): Promise<T> {
  return response.json<T>();
}

describe("tidbyts worker", () => {
  it("serves health and protects private metrics", async () => {
    const health = await SELF.fetch(`${API}/health`);
    expect(health.status).toBe(200);
    await expect(json(health)).resolves.toEqual({ ok: true });
    expect(health.headers.get("X-Content-Type-Options")).toBe("nosniff");

    const unauthorized = await SELF.fetch(`${API}/api/usage`);
    expect(unauthorized.status).toBe(401);
    await expect(json(unauthorized)).resolves.toEqual({ error: "Unauthorized" });
  });

  it("ingests token events idempotently and aggregates both providers", async () => {
    const now = new Date().toISOString();
    const body = JSON.stringify({
      events: [
        {
          id: "codex:event-1",
          provider: "codex",
          observedAt: now,
          inputTokens: 100,
          outputTokens: 25,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
        {
          id: "claude:event-1",
          provider: "claude",
          observedAt: now,
          inputTokens: 50,
          outputTokens: 10,
          cacheReadTokens: 20,
          cacheWriteTokens: 5,
          model: "claude-test",
        },
      ],
    });
    const init = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    };

    const first = await SELF.fetch(
      authenticated("/api/usage/events", "ingest-test-token", init),
    );
    expect(first.status).toBe(202);
    await expect(json(first)).resolves.toMatchObject({ rows_changed: 6 });

    const duplicate = await SELF.fetch(
      authenticated("/api/usage/events", "ingest-test-token", init),
    );
    await expect(json(duplicate)).resolves.toMatchObject({ rows_changed: 0 });

    const response = await SELF.fetch(
      authenticated("/api/usage", "read-test-token"),
    );
    expect(response.status).toBe(200);
    const usage = await json<{
      trailing_24h: { codex: number; claude: number; total: number };
    }>(response);
    expect(usage.trailing_24h).toEqual({ codex: 125, claude: 85, total: 210 });
  });

  it("stores locally collected PR counts and serves the snapshot", async () => {
    const stored = await SELF.fetch(
      authenticated("/api/prs/snapshot", "ingest-test-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trailing24h: 4,
          trailing7d: 17,
          trailing30d: 43,
          observedAt: new Date().toISOString(),
        }),
      }),
    );
    expect(stored.status).toBe(202);

    const response = await SELF.fetch(
      authenticated("/api/prs", "read-test-token"),
    );
    expect(response.status).toBe(200);
    await expect(json(response)).resolves.toMatchObject({
      repository: "joncooper/tidbyts",
      trailing_24h: 4,
      trailing_7d: 17,
      trailing_30d: 43,
      stale: false,
    });
  });

  it("runs the complete household bin lifecycle", async () => {
    const create = async (memberId: "a" | "b", label: string): Promise<string> => {
      const response = await SELF.fetch(
        authenticated("/api/bins", "household-test-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memberId, label }),
        }),
      );
      expect(response.status).toBe(201);
      return (await json<{ id: string }>(response)).id;
    };

    const firstId = await create("a", "Garage books");
    await create("b", "Old cables");

    const toggled = await SELF.fetch(
      authenticated(`/api/bins/${firstId}`, "household-test-token", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealt: true }),
      }),
    );
    expect(toggled.status).toBe(204);

    const response = await SELF.fetch(
      authenticated("/api/bins", "read-test-token"),
    );
    const state = await json<{
      members: Array<{ id: string; total: number; dealt: number; remaining: number }>;
      bins: Array<{ id: string; dealt: boolean }>;
    }>(response);
    expect(state.members).toMatchObject([
      { id: "a", total: 1, dealt: 1, remaining: 0 },
      { id: "b", total: 1, dealt: 0, remaining: 1 },
    ]);
    expect(state.bins.find((bin) => bin.id === firstId)?.dealt).toBe(true);
  });
});
