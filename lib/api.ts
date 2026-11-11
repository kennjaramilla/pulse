// Client-side helpers for talking to the coordination API.
import type { PollResponse, SignalType } from "@/lib/types";

const TOKEN_HEADER = "x-session-token"; // must match lib/auth.ts

// Returns the secret session token. Keep it in memory only.
export async function join(lat: number, lng: number): Promise<string> {
  const res = await fetch("/api/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lng }),
  });
  if (!res.ok) throw new Error(`join failed: ${res.status}`);
  return (await res.json()).token;
}

export class SessionExpiredError extends Error {}

export async function poll(token: string): Promise<PollResponse> {
  const res = await fetch("/api/poll", {
    cache: "no-store",
    headers: { [TOKEN_HEADER]: token },
  });
  if (res.status === 401) throw new SessionExpiredError();
  if (!res.ok) throw new Error(`poll failed: ${res.status}`);
  return res.json();
}

export async function sendSignal(
  token: string,
  toId: string,
  type: SignalType,
  payload?: string,
): Promise<boolean> {
  try {
    const res = await fetch("/api/signal", {
      method: "POST",
      headers: { "Content-Type": "application/json", [TOKEN_HEADER]: token },
      body: JSON.stringify({ toId, type, payload }),
    });
    return res.ok; // false when the server refuses (e.g. they already left)
  } catch {
    return false;
  }
}

// Fire-and-forget POST that survives the tab closing. sendBeacon can't set
// headers, so the token goes in the body.
function beacon(url: string, data: unknown): void {
  const body = JSON.stringify(data);
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon(url, body);
  } else {
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  }
}

export function leave(token: string): void {
  beacon("/api/leave", { token });
}
