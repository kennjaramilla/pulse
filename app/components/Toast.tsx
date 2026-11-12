"use client";

// Small status pill under the top bar ("Request declined.", "Waiting…").
export default function Toast({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="status"
      className="glass absolute left-1/2 top-20 z-30 flex -translate-x-1/2 max-w-[calc(100%-2rem)] animate-rise items-center gap-3 rounded-full text-center px-4 py-2 text-sm shadow-lg"
    >
      {children}
    </div>
  );
}
