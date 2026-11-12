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

## Phase 3 — Make it secure

The core problem: **the only identity was the session id, and every id was
public** (the poll response lists everyone). Ranked by impact:

| # | Issue | Impact | Status |
|---|---|---|---|
| 1 | Anyone could act as anyone. `poll?id=` drained another user's mailbox, `signal` trusted the `fromId` in the body, `leave` deleted whatever id it was given, and `join` upserted a client-chosen id. | Read other people's requests and SDP, spoof requests and hang-ups, kick everyone off the map, move other people's dots. | Fixed |
| 2 | No server-side connection state. `accept`, `end`, `offer` etc. were delivered between any two users. | Mark strangers busy, end other people's calls, push SDP to someone you're not talking to. | Fixed |
| 3 | No rate limits. | Spam strangers with connection prompts, flood the tables, fill the map with fake dots. | Fixed |
| 4 | No security headers. | Clickjacking (the page could be framed), no CSP, no camera/mic policy. | Fixed |
| 5 | WebRTC with STUN shows each side the other's public IP. | A stranger can get a rough location from the IP, which works against the 1–3 km offset. | Documented |
| 6 | Each join gets a fresh random offset, so many sessions from the same spot could be averaged to narrow down the real location. | Low; it needs a lot of patient sampling. | Documented |
| 7 | The Mapbox token is public by design. | Anyone can reuse it against my quota. | Restrict it to the Vercel domain in the Mapbox dashboard |

What I changed:

- **Session tokens (1).** `join` now creates the id on the server and returns a
  random 32-byte token. Only its sha256 is stored. Every other endpoint looks
  the caller up by token (a header, or the body for `sendBeacon`). The client
  never sends its own id, and the poll still only shows public ids. If the
  session is gone (say the tab slept past the 15 s timeout), poll returns 401
  and the app goes back to the entry screen instead of freezing.
- **Who is talking to whom (2).** `Presence.peerId` records who you're
  requesting or connected to. `signal` only delivers what fits that state:
  accept and decline only answer a real request, WebRTC messages only go
  between two connected peers, and end only goes to your own peer. The updates
  are conditional (`updateMany` with a `where`), so two racing requests can't
  both win; I avoided transactions over the Neon pooler. When someone leaves
  or goes stale, the server frees their partner and sends them an `end`. That
  replaced the client-side beacon from Phase 1, which could lose a race with
  `leave`.
- **Rate limits (3).** A small `RateLimit` table with one-minute windows,
  counted in Postgres so every serverless instance agrees:
  - 60 joins per IP (the IP is hashed, never stored);
  - 300 signals per session (a call setup is about 20–40);
  - 10 connection requests per session.
- **Headers (4).** A CSP that allows only what Mapbox needs (`*.mapbox.com`
  and a blob: worker), `frame-ancestors 'none'`, a Permissions-Policy limiting
  camera, mic and location to this site, `no-referrer`, `nosniff`, and
  `no-store` on the API. I also removed a leftover ngrok host from
  `allowedDevOrigins`.

How I checked it: a small script that attacks the API the old way (reading
someone else's mailbox, kicking by id, spoofing `fromId`, accepting without a
request, two accepts at once, request and join floods) and expects 401, 409 or
429. Then the full two-browser flow again, against a production build.

Trade-offs:

- Requests keep being refused with 409 instead of being queued. That's simpler,
  and the UI recovers from it.
- For 5, the real fix is TURN with `iceTransportPolicy: "relay"`. That needs an
  external relay service, which the brief rules out, so I documented it
  instead.
- The schema changes are additive and nullable, so `prisma db push` on the
  live database never broke the running version. I followed the README and
  used `db push`; `prisma/migrations` still only has the initial migration.

## Phase 2 — Make it good

The idea: Pulse is "a living globe", so the globe should be the hero and
everything else should get out of its way.

- **The globe is always there.** The map now renders behind the entry screen
  as a slowly spinning 3D globe (Mapbox `projection: "globe"` with a night-sky
  fog), and flies down to you when you join. Before, it was a plain landing
  page followed by a flat map.
- **One accent colour.** Dark-only theme, a "pulse" pink for every primary
  action, and the Geist font that was loaded but never used (the body was
  hard-coded to Arial). Every overlay uses the same frosted `glass` style.
- **Dots that feel alive.** Each person gets a colour from their id, with a
  soft glow and a pulse ring. Busy people are dimmed and stop pulsing. Taps get
  a 32px target on phones. The old hover scale never worked, because Mapbox
  positions the marker element with `transform`, so the styling now lives on
  an inner span. Your own spot is a white dot with a pink halo instead of a 📍.
- **Context in the prompts.** "Someone wants to talk · About 570 km away",
  shown in that person's colour. The distance is rounded, and both points are
  already fuzzy. The video prompt says your camera stays off unless you
  accept.
- **Chat as a bottom sheet on phones**, so the map stays visible, and as a
  side panel on desktop. Bubbles, an icon-only header with labels for screen
  readers, and a send button.
- **Video screen:** the stranger full-screen, a mirrored self-view, and a
  floating control bar.
- Small things: a top bar with the live count ("Nobody else here yet. Share
  the link!" when you're alone), status toasts instead of grey pills,
  `prefers-reduced-motion` respected, and the theme colour set for mobile
  browsers.

I kept the existing component structure. It's a restyle, not a rewrite, and no
UI library was added (the icons are a few inline SVGs).
