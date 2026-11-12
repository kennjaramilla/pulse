"use client";

import { useEffect, useRef } from "react";
import { HangUpIcon } from "./icons";

export default function VideoPanel({
  localStream,
  remoteStream,
  revealed,
  theyRevealed,
  onReveal,
  onEnd,
}: {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  revealed: boolean; // we're sending the real camera
  theyRevealed: boolean;
  onReveal: () => void;
  onEnd: () => void;
}) {
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localRef.current && localRef.current.srcObject !== localStream) {
      localRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteRef.current && remoteRef.current.srcObject !== remoteStream) {
      remoteRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return (
    <div className="absolute inset-0 z-30 animate-pop bg-black">
      {/* Remote (full screen) */}
      <video
        ref={remoteRef}
        autoPlay
        playsInline
        className="size-full bg-ink object-cover"
      />
      {!remoteStream && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-zinc-400">
          <span className="size-4 animate-ping rounded-full bg-pulse" />
          Waiting for their video…
        </div>
      )}
      {remoteStream && !theyRevealed && (
        <p className="glass absolute left-4 top-4 max-w-[55%] rounded-2xl px-4 py-2 text-sm sm:left-1/2 sm:max-w-none sm:-translate-x-1/2 sm:rounded-full">
          They&rsquo;re still blurred. Say hi first 👋
        </p>
      )}

      {/* Local preview: exactly what they see (blurred until we reveal) */}
      <div className="absolute right-4 top-16 w-28 sm:top-4 sm:w-40">
        <video
          ref={localRef}
          autoPlay
          playsInline
          muted
          className="aspect-[3/4] w-full -scale-x-100 rounded-2xl bg-zinc-800 object-cover shadow-xl ring-1 ring-white/20"
        />
        {!revealed && (
          <p className="mt-2 text-center text-xs text-zinc-300">They only see a blur</p>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-wrap justify-center gap-3 bg-gradient-to-t from-black/70 to-transparent p-6 pb-8">
        {!revealed && (
          <button
            onClick={onReveal}
            className="rounded-full bg-pulse px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-pulse-soft"
          >
            Show my face
          </button>
        )}
        <button
          onClick={onEnd}
          className="flex items-center gap-2 rounded-full bg-red-500 px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-red-400"
        >
          <HangUpIcon />
          End video
        </button>
      </div>
    </div>
  );
}
