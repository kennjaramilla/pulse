import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import type { SignalType } from "@/lib/types";
import { authenticate, readToken, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TYPES: SignalType[] = [
  "request",
  "accept",
  "decline",
  "offer",
  "answer",
  "ice",
  "end",
];

// Only WebRTC messages carry a payload. SDP grows with every video
// renegotiation, so keep the original 64 KB cap.
const WITH_PAYLOAD: SignalType[] = ["offer", "answer", "ice"];
const MAX_PAYLOAD = 64 * 1024;

// POST /api/signal — body { toId, type, payload? }.
//
// The server tracks who is talking to whom in Presence.peerId (busy = the
// connection was accepted) and only delivers messages that fit:
//   request  → both sides free; my peerId becomes the target
//   accept   → only if the target is requesting me
//   decline  → only if the target is requesting me
//   offer/answer/ice → only between two connected peers
//   end      → only to the person I'm requesting or connected to
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const me = await authenticate(readToken(request, body));
  if (!me) return unauthorized();
  const fromId = me.id;

  const { toId, type, payload } = (body ?? {}) as Record<string, unknown>;

  if (typeof toId !== "string" || toId === fromId) {
    return Response.json({ error: "invalid recipient" }, { status: 400 });
  }
  if (typeof type !== "string" || !VALID_TYPES.includes(type as SignalType)) {
    return Response.json({ error: "invalid type" }, { status: 400 });
  }
  const signalType = type as SignalType;
  const needsPayload = WITH_PAYLOAD.includes(signalType);
  const payloadOk = needsPayload
    ? typeof payload === "string" && payload.length <= MAX_PAYLOAD
    : payload == null;
  if (!payloadOk) {
    return Response.json({ error: "invalid payload" }, { status: 400 });
  }
  const payloadStr = needsPayload ? (payload as string) : null;

  const target = await prisma.presence.findUnique({
    where: { id: toId },
    select: { busy: true, peerId: true },
  });

  // The updates below are conditional (updateMany + where) so two requests
  // racing each other can't both win. No transactions over the pooler.
  switch (signalType) {
    case "request": {
      if (me.peerId) return conflict();
      // Target offline or already occupied: auto-decline instead of delivering.
      if (!target || target.peerId) {
        await deliver(toId, fromId, "decline");
        return Response.json({ ok: true, autoDeclined: true });
      }
      const claimed = await prisma.presence.updateMany({
        where: { id: fromId, peerId: null },
        data: { peerId: toId },
      });
      if (claimed.count === 0) return conflict();
      break;
    }

    case "accept": {
      const claimedMe = await prisma.presence.updateMany({
        where: { id: fromId, peerId: null },
        data: { peerId: toId, busy: true },
      });
      if (claimedMe.count === 0) return conflict();
      const claimedThem = await prisma.presence.updateMany({
        where: { id: toId, peerId: fromId, busy: false },
        data: { busy: true },
      });
      if (claimedThem.count === 0) {
        // They cancelled or left a moment ago. Undo and refuse.
        await free(fromId, toId);
        return conflict();
      }
      break;
    }

    case "decline": {
      const cleared = await prisma.presence.updateMany({
        where: { id: toId, peerId: fromId, busy: false },
        data: { peerId: null },
      });
      if (cleared.count === 0) return conflict();
      break;
    }

    case "offer":
    case "answer":
    case "ice": {
      const paired =
        me.busy && me.peerId === toId && target?.busy && target.peerId === fromId;
      if (!paired) return conflict();
      break;
    }

    case "end": {
      // Free both sides of whatever link exists between us.
      const freed = await prisma.presence.updateMany({
        where: {
          OR: [
            { id: fromId, peerId: toId },
            { id: toId, peerId: fromId },
          ],
        },
        data: { busy: false, peerId: null },
      });
      if (freed.count === 0) return conflict();
      // They're already gone, so there's nobody to deliver to.
      if (!target) return Response.json({ ok: true });
      break;
    }
  }

  await deliver(fromId, toId, signalType, payloadStr);
  return Response.json({ ok: true });
}

function conflict() {
  return Response.json({ error: "not allowed right now" }, { status: 409 });
}

function free(id: string, peerId: string) {
  return prisma.presence.updateMany({
    where: { id, peerId },
    data: { busy: false, peerId: null },
  });
}

function deliver(
  fromId: string,
  toId: string,
  type: SignalType,
  payload: string | null = null,
) {
  return prisma.signal.create({ data: { fromId, toId, type, payload } });
}
