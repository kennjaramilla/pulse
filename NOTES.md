# Notes

Live: https://kenn-pulse.vercel.app

## Phase 1 — Make it run

How I worked: followed the README setup on a fresh clone, then tested with two
browser profiles (and a small Playwright script with two fake users) through the
whole flow: see each other, request, accept, chat both ways, video, hang up,
reconnect, close a tab.

What was broken, in the order I hit it:

1. **Fresh clone didn't run.** Every API call returned 500 (`Cannot find module
   '.prisma/client/default'`). Prisma 7 no longer generates the client on
   `db push`, and `npm run dev` never ran `prisma generate`.
   Fix: `postinstall: prisma generate`.
2. **Dots never disappeared** (the example from the README). The heartbeat in
   `/api/poll` was `updateMany({ where: {} })`, so every poll refreshed
   *everyone's* `lastSeen` and nobody ever went stale.
   Fix: only update the caller's row.
3. **Accepting never connected.** Chat stayed on "Connecting…". ICE candidates
   that arrived before the offer were queued, then flushed *before*
   `setRemoteDescription`, so `addIceCandidate` threw (inside an empty catch)
   and they were lost. Found it by logging the signaling order.
   Fix: set the remote description first, then flush.
4. **Chat messages never showed up.** `sendChat` sent `{ t: "msg" }` but the
   receiver only handles `t: "chat"`.
5. **Couldn't connect again after hanging up.** Only `decline` cleared the
   `busy` flag, not `end`, so both users stayed busy and every new request was
   auto-declined.
6. **Closing a tab left the other person in a dead chat** (and still busy).
   Fix: beacon an `end`/`decline` on `pagehide`, and treat the data channel
   closing as a disconnect. (In Phase 3 this moved to the server.)
7. **Missing token hint never showed.** `WorldMap` fell back to a fake Mapbox
   token, so `!TOKEN` was never true and the map just failed silently.

Setup decisions: Postgres is Neon (Singapore), created through the Vercel
integration so the same `DATABASE_URL` is in local `.env` and the Vercel
project.
