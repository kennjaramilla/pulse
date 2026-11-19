import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Runs queries as the pulse_app role with the caller's session id set, so the
// row-level security policies in prisma/rls.sql apply. SET LOCAL only lasts
// for the transaction, so the pooled connection goes back clean.
export function asSession<T>(
  sessionId: string,
  run: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL ROLE pulse_app`;
    await tx.$queryRaw`SELECT set_config('pulse.session_id', ${sessionId}, true)`;
    return run(tx);
  });
}
