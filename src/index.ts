import { requireAnyToken, requireToken } from "./auth";
import {
  binsState,
  createBin,
  deleteBin,
  updateBin,
  updateMember,
} from "./bins";
import { ingestPullRequestCounts, pullRequestCounts } from "./github";
import { errorResponse, jsonResponse } from "./http";
import { ingestUsageEvents, usageCounts } from "./usage";

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/health") {
    return jsonResponse({ ok: true });
  }

  if (request.method === "GET" && url.pathname === "/api/prs") {
    await requireToken(request, env.READ_TOKEN);
    return jsonResponse(await pullRequestCounts(env));
  }

  if (request.method === "POST" && url.pathname === "/api/prs/snapshot") {
    await requireToken(request, env.INGEST_TOKEN);
    return ingestPullRequestCounts(request, env);
  }

  if (request.method === "GET" && url.pathname === "/api/usage") {
    await requireToken(request, env.READ_TOKEN);
    return jsonResponse(await usageCounts(env));
  }

  if (request.method === "POST" && url.pathname === "/api/usage/events") {
    await requireToken(request, env.INGEST_TOKEN);
    return ingestUsageEvents(request, env);
  }

  if (request.method === "GET" && url.pathname === "/api/bins") {
    await requireAnyToken(request, [env.READ_TOKEN, env.HOUSEHOLD_TOKEN]);
    return jsonResponse(await binsState(env));
  }

  if (request.method === "POST" && url.pathname === "/api/bins") {
    await requireToken(request, env.HOUSEHOLD_TOKEN);
    return createBin(request, env);
  }

  const binMatch = url.pathname.match(/^\/api\/bins\/([0-9a-f-]+)$/i);
  if (binMatch !== null) {
    await requireToken(request, env.HOUSEHOLD_TOKEN);
    const id = binMatch[1];
    if (id === undefined) {
      return jsonResponse({ error: "Not found" }, 404);
    }
    if (request.method === "PATCH") {
      return updateBin(request, env, id);
    }
    if (request.method === "DELETE") {
      return deleteBin(env, id);
    }
  }

  const memberMatch = url.pathname.match(/^\/api\/members\/(a|b)$/);
  if (memberMatch !== null && request.method === "PATCH") {
    await requireToken(request, env.HOUSEHOLD_TOKEN);
    const id = memberMatch[1];
    if (id === undefined) {
      return jsonResponse({ error: "Not found" }, 404);
    }
    return updateMember(request, env, id);
  }

  return jsonResponse({ error: "Not found" }, 404);
}

export default {
  async fetch(request, env): Promise<Response> {
    const path = new URL(request.url).pathname;
    try {
      return await route(request, env);
    } catch (error) {
      return errorResponse(error, path);
    }
  },
} satisfies ExportedHandler<Env>;
