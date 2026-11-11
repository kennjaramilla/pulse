// Client-side helpers for talking to the coordination API.
import type { PollResponse, SignalType } from "@/lib/types";

export async function join(
  id: string,
  lat: number,
  lng: number,
): Promise<void> {
  await fetch("/api/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, lat, lng }),
  });
}

export async function poll(id: string): Promise<PollResponse> {
  const res = await fetch(`/api/poll?id=${encodeURIComponent(id)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`poll failed: ${res.status}`);
  return res.json();
}

export async function sendSignal(
  fromId: string,
  toId: string,
  type: SignalType,
  payload?: string,
): Promise<void> {
  await fetch("/api/signal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fromId, toId, type, payload }),
  });
}

// Fire-and-forget POST that survives the tab closing.
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

export function leave(id: string): void {
  beacon("/api/leave", { id });
}

// Tells the stranger we're gone before the tab closes, instead of leaving
// them waiting on a dead request or chat until something times out.
export function signalBeacon(
  fromId: string,
  toId: string,
  type: "decline" | "end",
): void {
  beacon("/api/signal", { fromId, toId, type });
}
