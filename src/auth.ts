import { HttpError } from "./http";

async function secureEqual(provided: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  return crypto.subtle.timingSafeEqual(providedHash, expectedHash);
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("Authorization");
  if (authorization === null || !authorization.startsWith("Bearer ")) {
    return null;
  }
  return authorization.slice("Bearer ".length);
}

export async function requireToken(request: Request, expected: string): Promise<void> {
  const provided = bearerToken(request);
  if (provided === null || !(await secureEqual(provided, expected))) {
    throw new HttpError(401, "Unauthorized");
  }
}

export async function requireAnyToken(
  request: Request,
  expectedTokens: readonly string[],
): Promise<void> {
  const provided = bearerToken(request);
  if (provided === null) {
    throw new HttpError(401, "Unauthorized");
  }

  const matches = await Promise.all(
    expectedTokens.map((expected) => secureEqual(provided, expected)),
  );
  if (!matches.some(Boolean)) {
    throw new HttpError(401, "Unauthorized");
  }
}

