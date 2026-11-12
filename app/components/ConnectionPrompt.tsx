"use client";

// Reusable centered prompt for "someone wants to connect" and
// "someone wants to start video".
export default function ConnectionPrompt({
  title,
  subtitle,
  color,
  icon,
  acceptLabel,
  declineLabel,
  onAccept,
  onDecline,
}: {
  title: string;
  subtitle?: string;
  color?: string; // the stranger's dot colour
  icon?: React.ReactNode;
  acceptLabel: string;
  declineLabel: string;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="absolute inset-0 z-20 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div
        role="dialog"
        aria-label={title}
        className="glass w-full max-w-sm animate-pop rounded-3xl p-6 text-center shadow-2xl"
      >
        <div
          className="mx-auto mb-4 grid size-14 place-items-center rounded-full text-ink"
          style={{
            background: color ?? "var(--color-pulse)",
            boxShadow: `0 0 32px -4px ${color ?? "var(--color-pulse)"}`,
          }}
        >
          {icon}
        </div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>}
        <div className="mt-6 flex gap-3">
          <button
            onClick={onDecline}
            className="flex-1 rounded-full border border-white/15 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-white/30 hover:text-white"
          >
            {declineLabel}
          </button>
          <button
            onClick={onAccept}
            className="flex-1 rounded-full bg-pulse px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-pulse-soft"
          >
            {acceptLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
