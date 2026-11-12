"use client";

export default function TopBar({ online }: { online: number }) {
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-4">
      <div className="glass pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold">
        <span className="size-2 rounded-full bg-pulse" />
        Pulse
      </div>
      <div className="glass pointer-events-auto max-w-[60%] rounded-full px-4 py-2 text-right text-sm text-zinc-300">
        {online === 0 ? (
          "Nobody else here yet. Share the link!"
        ) : (
          <>
            <span className="mr-2 inline-block size-2 rounded-full bg-emerald-400" />
            <span className="font-semibold text-white">{online}</span> online
            <span className="hidden sm:inline"> · tap a dot to say hi</span>
          </>
        )}
      </div>
    </header>
  );
}
