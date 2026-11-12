"use client";

import { useEffect, useRef } from "react";
import { HangUpIcon } from "./icons";

export default function VideoPanel({
  localStream,
  remoteStream,
  onEnd,
}: {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
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

      {/* Local (picture-in-picture), mirrored like a selfie camera */}
      <video
        ref={localRef}
        autoPlay
        playsInline
        muted
        className="absolute right-4 top-4 aspect-[3/4] w-28 -scale-x-100 rounded-2xl bg-zinc-800 object-cover shadow-xl ring-1 ring-white/20 sm:w-40"
      />

      <div className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/70 to-transparent p-6 pb-8">
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
