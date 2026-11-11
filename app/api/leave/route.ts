import type { NextRequest } from "next/server";
import { authenticate, readToken, unauthorized } from "@/lib/auth";
import { removeSessions } from "@/lib/remove-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/leave — body { token }. Removes the caller's session and tells
// whoever they were talking to. Called via navigator.sendBeacon on tab close,
// so the body may arrive as text — parse defensively.
export async function POST(request: NextRequest) {
  let body: unknown = null;
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {}

  const me = await authenticate(readToken(request, body));
  if (!me) return unauthorized();
  await removeSessions([me.id]);

  return Response.json({ ok: true });
}
