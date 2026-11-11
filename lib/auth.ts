import { createHash, randomBytes, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

// Each session has a public id (shown to everyone on the map) and a secret
// token that only its own tab knows. The API trusts the token, never an id
// sent in the request.

export const TOKEN_HEADER = "x-session-token";

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function newSession() {
  const token = randomBytes(32).toString("base64url");
  return { id: randomUUID(), token, tokenHash: sha256(token) };
}

// Header for normal fetches; body field for sendBeacon, which can't set headers.
export function readToken(request: Request, body?: unknown) {
  const fromHeader = request.headers.get(TOKEN_HEADER);
  if (fromHeader) return fromHeader;
  const fromBody = (body as { token?: unknown } | null)?.token;
  return typeof fromBody === "string" ? fromBody : null;
}

export async function authenticate(token: string | null) {
  if (!token || token.length > 128) return null;
  return prisma.presence.findUnique({ where: { tokenHash: sha256(token) } });
}

export function unauthorized() {
  return Response.json({ error: "unknown session" }, { status: 401 });
}
