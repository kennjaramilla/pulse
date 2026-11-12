"use client";

import { useState } from "react";

export default function EntryGate({
  onReady,
}: {
  onReady: (lat: number, lng: number) => Promise<void>;
}) {
  const [status, setStatus] = useState<"idle" | "locating" | "error">("idle");
  const [error, setError] = useState<string>("");

  function enter() {
    if (!("geolocation" in navigator)) {
      setStatus("error");
      setError("Your browser doesn't support location access.");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onReady(pos.coords.latitude, pos.coords.longitude).catch(() => {
          setStatus("error");
          setError("Couldn't join right now. Please try again in a moment.");
        });
      },
      (err) => {
        setStatus("error");
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission is required to place you on the map."
            : "Couldn't get your location. Please try again.",
        );
      },
      // High accuracy + maximumAge:0 forces a fresh fix (Wi-Fi/GPS scan)
      // instead of reusing the browser's cached IP-based location.
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-end bg-[radial-gradient(ellipse_at_center,rgb(7_9_16/0.45)_20%,rgb(7_9_16/0.9)_75%)] px-6 pb-16 sm:justify-center sm:pb-6">
      <div className="flex max-w-md animate-rise flex-col items-center text-center">
        <h1 className="flex items-center gap-3 text-5xl font-semibold tracking-tight sm:text-6xl">
          <span className="relative flex size-3">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-pulse opacity-75" />
            <span className="relative inline-flex size-3 rounded-full bg-pulse" />
          </span>
          Pulse
        </h1>
        <p className="mt-4 text-lg text-zinc-300">
          A living globe of anonymous strangers.
          <br />
          Tap a dot, say hello.
        </p>

        <button
          onClick={enter}
          disabled={status === "locating"}
          className="mt-8 rounded-full bg-pulse px-9 py-3.5 font-semibold text-white shadow-[0_0_40px_-6px] shadow-pulse transition hover:scale-[1.03] hover:bg-pulse-soft active:scale-100 disabled:opacity-60"
        >
          {status === "locating" ? "Finding you…" : "Enter Pulse"}
        </button>

        {status === "error" && (
          <p className="mt-4 text-sm text-red-300">{error}</p>
        )}

        <p className="mt-8 text-xs leading-relaxed text-zinc-400">
          No sign-up. Your dot sits 1–3&nbsp;km from where you really are.
          <br />
          Nothing is stored. Close the tab and you&rsquo;re gone.
        </p>
      </div>
    </div>
  );
}
