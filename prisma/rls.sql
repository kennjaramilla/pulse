-- Row-level security for the Signal mailbox. Prisma can't express policies,
-- so this runs after `prisma db push` (npm run db:rls). Safe to re-run.
--
-- Request handlers switch to pulse_app inside a transaction and set
-- pulse.session_id to the caller (lib/db-session.ts). Postgres then only lets
-- them see signals sent to or by that session, so a bug in a `where` can't
-- leak someone else's SDP or ICE candidates. Server cleanup (stale sessions,
-- expired signals) runs as the table owner, which RLS doesn't apply to.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pulse_app') THEN
    CREATE ROLE pulse_app NOLOGIN;
  END IF;
END
$$;

GRANT pulse_app TO CURRENT_USER;
GRANT USAGE ON SCHEMA public TO pulse_app;
GRANT SELECT, INSERT, DELETE ON "Signal" TO pulse_app;

ALTER TABLE "Signal" ENABLE ROW LEVEL SECURITY;

-- The sender can see what it sent too: Prisma's create returns the new row.
DROP POLICY IF EXISTS signal_read ON "Signal";
CREATE POLICY signal_read ON "Signal" FOR SELECT TO pulse_app
  USING (current_setting('pulse.session_id', true) IN ("toId", "fromId"));

DROP POLICY IF EXISTS signal_send ON "Signal";
CREATE POLICY signal_send ON "Signal" FOR INSERT TO pulse_app
  WITH CHECK ("fromId" = current_setting('pulse.session_id', true));

-- Only the recipient drains a mailbox.
DROP POLICY IF EXISTS signal_drain ON "Signal";
CREATE POLICY signal_drain ON "Signal" FOR DELETE TO pulse_app
  USING ("toId" = current_setting('pulse.session_id', true));
