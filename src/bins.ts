import {
  HttpError,
  isRecord,
  jsonResponse,
  readBoundedJson,
  requiredString,
} from "./http";

const MAX_BODY_BYTES = 20_000;

interface MemberRow {
  id: string;
  name: string;
}

interface BinRow {
  id: string;
  member_id: string;
  label: string;
  dealt: number;
  created_at: number;
  updated_at: number;
  dealt_at: number | null;
}

interface MemberSummary {
  id: string;
  name: string;
  total: number;
  dealt: number;
  remaining: number;
}

export interface BinsState {
  members: MemberSummary[];
  bins: Array<{
    id: string;
    member_id: string;
    label: string;
    dealt: boolean;
    created_at: string;
    updated_at: string;
    dealt_at: string | null;
  }>;
  as_of: string;
}

function memberId(value: unknown): "a" | "b" {
  if (value !== "a" && value !== "b") {
    throw new HttpError(400, "memberId must be a or b");
  }
  return value;
}

function optionalLabel(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    return "";
  }
  return requiredString(value, "label", 40).trim();
}

export async function binsState(env: Env): Promise<BinsState> {
  const [membersResult, binsResult] = await Promise.all([
    env.DB.prepare("SELECT id, name FROM household_members ORDER BY sort_order").all<MemberRow>(),
    env.DB.prepare(
      `SELECT id, member_id, label, dealt, created_at, updated_at, dealt_at
       FROM junk_bins
       ORDER BY dealt ASC, created_at ASC`,
    ).all<BinRow>(),
  ]);
  const members = membersResult.results;
  const bins = binsResult.results;

  return {
    members: members.map((member) => {
      const owned = bins.filter((bin) => bin.member_id === member.id);
      const dealt = owned.filter((bin) => bin.dealt === 1).length;
      return {
        id: member.id,
        name: member.name,
        total: owned.length,
        dealt,
        remaining: owned.length - dealt,
      };
    }),
    bins: bins.map((bin) => ({
      id: bin.id,
      member_id: bin.member_id,
      label: bin.label,
      dealt: bin.dealt === 1,
      created_at: new Date(bin.created_at).toISOString(),
      updated_at: new Date(bin.updated_at).toISOString(),
      dealt_at: bin.dealt_at === null ? null : new Date(bin.dealt_at).toISOString(),
    })),
    as_of: new Date().toISOString(),
  };
}

export async function createBin(request: Request, env: Env): Promise<Response> {
  const body = await readBoundedJson(request, MAX_BODY_BYTES);
  if (!isRecord(body)) {
    throw new HttpError(400, "Body must be an object");
  }
  const id = crypto.randomUUID();
  const owner = memberId(body.memberId);
  const label = optionalLabel(body.label);
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO junk_bins
       (id, member_id, label, dealt, created_at, updated_at)
     VALUES (?, ?, ?, 0, ?, ?)`,
  )
    .bind(id, owner, label, now, now)
    .run();
  return jsonResponse({ id }, 201);
}

export async function updateBin(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  const body = await readBoundedJson(request, MAX_BODY_BYTES);
  if (!isRecord(body)) {
    throw new HttpError(400, "Body must be an object");
  }
  const existing = await env.DB.prepare("SELECT id FROM junk_bins WHERE id = ?")
    .bind(id)
    .first<{ id: string }>();
  if (existing === null) {
    throw new HttpError(404, "Bin not found");
  }

  const now = Date.now();
  if (typeof body.dealt === "boolean") {
    await env.DB.prepare(
      "UPDATE junk_bins SET dealt = ?, dealt_at = ?, updated_at = ? WHERE id = ?",
    )
      .bind(body.dealt ? 1 : 0, body.dealt ? now : null, now, id)
      .run();
  }
  if (body.memberId !== undefined) {
    await env.DB.prepare("UPDATE junk_bins SET member_id = ?, updated_at = ? WHERE id = ?")
      .bind(memberId(body.memberId), now, id)
      .run();
  }
  if (body.label !== undefined) {
    await env.DB.prepare("UPDATE junk_bins SET label = ?, updated_at = ? WHERE id = ?")
      .bind(optionalLabel(body.label), now, id)
      .run();
  }
  return new Response(null, { status: 204 });
}

export async function deleteBin(env: Env, id: string): Promise<Response> {
  const result = await env.DB.prepare("DELETE FROM junk_bins WHERE id = ?").bind(id).run();
  if ((result.meta.changes ?? 0) === 0) {
    throw new HttpError(404, "Bin not found");
  }
  return new Response(null, { status: 204 });
}

export async function updateMember(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  const owner = memberId(id);
  const body = await readBoundedJson(request, MAX_BODY_BYTES);
  if (!isRecord(body)) {
    throw new HttpError(400, "Body must be an object");
  }
  const name = requiredString(body.name, "name", 12).trim().toUpperCase();
  if (name.length === 0) {
    throw new HttpError(400, "name cannot be blank");
  }
  await env.DB.prepare("UPDATE household_members SET name = ? WHERE id = ?")
    .bind(name, owner)
    .run();
  return new Response(null, { status: 204 });
}
