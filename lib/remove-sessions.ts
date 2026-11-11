import { prisma } from "@/lib/prisma";

// Removes sessions (on leave, or when they stop polling) and frees anyone who
// was requesting or talking to them, with a signal so their UI updates too.
export async function removeSessions(ids: string[]) {
  if (ids.length === 0) return;

  const leaving = await prisma.presence.findMany({
    where: { id: { in: ids } },
    select: { id: true, peerId: true },
  });
  const partners = await prisma.presence.findMany({
    where: { peerId: { in: ids }, id: { notIn: ids } },
    select: { id: true, peerId: true, busy: true },
  });

  await prisma.signal.deleteMany({
    where: { OR: [{ toId: { in: ids } }, { fromId: { in: ids } }] },
  });
  await prisma.presence.deleteMany({ where: { id: { in: ids } } });
  await prisma.presence.updateMany({
    where: { id: { in: partners.map((p) => p.id) }, peerId: { in: ids } },
    data: { busy: false, peerId: null },
  });

  // In a call → "end". Waiting on our answer → "decline".
  const notices = partners.map((p) => ({
    fromId: p.peerId!,
    toId: p.id,
    type: p.busy ? "end" : "decline",
  }));
  // We were requesting someone who wasn't notified above: close their prompt.
  for (const l of leaving) {
    if (l.peerId && !ids.includes(l.peerId) && !partners.some((p) => p.id === l.peerId)) {
      notices.push({ fromId: l.id, toId: l.peerId, type: "end" });
    }
  }
  if (notices.length > 0) await prisma.signal.createMany({ data: notices });
}
