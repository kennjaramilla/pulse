import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate, readToken, unauthorized } from "@/lib/auth";
import { allowSignal, tooMany } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/block — body { peerId }. For the rest of this session the two of
// you can't request each other and don't see each other's dots. Like
// everything else, it's gone when the session ends.
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const me = await authenticate(readToken(request, body));
  if (!me) return unauthorized();

  const { peerId } = (body ?? {}) as Record<string, unknown>;
  if (typeof peerId !== "string" || peerId === me.id || peerId.length > 64) {
    return Response.json({ error: "invalid peer" }, { status: 400 });
  }

  // Counts toward the normal signal limit, which also bounds the list size.
  if (!(await allowSignal(me.id, "block"))) return tooMany();

  if (!me.blockedIds.includes(peerId)) {
    await prisma.presence.update({
      where: { id: me.id },
      data: { blockedIds: { push: peerId } },
    });
  }
  return Response.json({ ok: true });
}
