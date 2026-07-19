export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
} as const;

export function jsonResponse(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: JSON_HEADERS });
}

export function errorResponse(error: unknown, path: string): Response {
  if (error instanceof HttpError) {
    return jsonResponse({ error: error.message }, error.status);
  }

  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ message: "request failed", error: message, path }));
  return jsonResponse({ error: "Internal server error" }, 500);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function requiredString(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) {
    throw new HttpError(400, `${field} must be between 1 and ${maxLength} characters`);
  }
  return value;
}

export async function readBoundedJson(request: Request, maxBytes: number): Promise<unknown> {
  const contentLength = request.headers.get("Content-Length");
  if (contentLength !== null && Number(contentLength) > maxBytes) {
    throw new HttpError(413, "Request body is too large");
  }

  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > maxBytes) {
    throw new HttpError(413, "Request body is too large");
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
}

