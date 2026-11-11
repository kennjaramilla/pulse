import { prisma } from "@/lib/prisma";
import { sha256 } from "@/lib/auth";

// Fixed one-minute windows, counted in Postgres so every serverless instance
// sees the same numbers.
const WINDOW_MS = 60_000;

async function hit(key: string, max: number) {
  const row = await prisma.rateLimit.findUnique({ where: { key } });
  const fresh = !row || Date.now() - row.windowStart.getTime() > WINDOW_MS;
  const { count } = await prisma.rateLimit.upsert({
    where: { key },
    create: { key, count: 1 },
    update: fresh ? { count: 1, windowStart: new Date() } : { count: { increment: 1 } },
  });
  return count <= max;
}

// 60 joins per IP per minute leaves room for people sharing one network.
// The IP is hashed so it's never stored. Vercel sets x-forwarded-for itself.
export function allowJoin(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  return hit(`join:${sha256(ip)}`, 60);
}

// A call setup sends ~20–40 ICE messages; 10 requests a minute stops someone
// spamming strangers with prompts.
export async function allowSignal(sessionId: string, type: string) {
  if (!(await hit(`signal:${sessionId}`, 300))) return false;
  return type !== "request" || hit(`request:${sessionId}`, 10);
}

export function tooMany() {
  return Response.json({ error: "too many requests" }, { status: 429 });
}

// Counters are useless once their window has passed. Called from the poll reaper.
export function deleteOldCounters() {
  return prisma.rateLimit.deleteMany({
    where: { windowStart: { lt: new Date(Date.now() - WINDOW_MS) } },
  });
}
