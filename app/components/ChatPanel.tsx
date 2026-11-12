"use client";

import { useEffect, useRef, useState } from "react";
import { BlockIcon, HangUpIcon, SendIcon, VideoIcon } from "./icons";

export interface ChatMessage {
  id: number;
  mine: boolean;
  text: string;
}

export default function ChatPanel({
  messages,
  connected,
  videoBusy,
  color,
  distance,
  onSend,
  onStartVideo,
  onBlock,
  onEnd,
}: {
  messages: ChatMessage[];
  connected: boolean;
  videoBusy: boolean;
  color?: string; // the stranger's dot colour
  distance?: string;
  onSend: (text: string) => void;
  onStartVideo: () => void;
  onBlock: () => void;
  onEnd: () => void;
}) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !connected) return;
    onSend(text);
    setDraft("");
  }

  // Bottom sheet on phones (the map stays visible above), side panel on desktop.
  return (
    <div className="glass absolute inset-x-0 bottom-0 z-20 flex h-[62dvh] animate-rise flex-col rounded-t-3xl shadow-2xl sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-20 sm:h-auto sm:w-96 sm:rounded-3xl">
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <span
          className="size-9 shrink-0 rounded-full"
          style={{ background: color, boxShadow: `0 0 18px -2px ${color}` }}
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Stranger</p>
          <p className="truncate text-xs text-zinc-400">
            {connected ? (distance ?? "Connected") : "Connecting…"}
          </p>
        </div>
        <button
          onClick={onStartVideo}
          disabled={!connected || videoBusy}
          aria-label="Video"
          title="Start a video call"
          className="grid size-10 place-items-center rounded-full bg-white/10 transition hover:bg-white/20 disabled:opacity-40"
        >
          <VideoIcon />
        </button>
        <button
          onClick={onBlock}
          aria-label="Block"
          title="Leave and block. They can't reach you again."
          className="grid size-10 place-items-center rounded-full bg-white/10 text-zinc-300 transition hover:bg-white/20 hover:text-white"
        >
          <BlockIcon />
        </button>
        <button
          onClick={onEnd}
          aria-label="End"
          title="End the conversation"
          className="grid size-10 place-items-center rounded-full bg-red-500 text-white transition hover:bg-red-400"
        >
          <HangUpIcon />
        </button>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="mt-8 text-center text-sm text-zinc-400">
            {connected ? "Say hello 👋" : "Connecting you directly…"}
            <br />
            <span className="text-xs text-zinc-500">
              Messages go straight to them and are never stored.
            </span>
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex animate-rise ${m.mine ? "justify-end" : "justify-start"}`}
          >
            <span
              className={`max-w-[80%] break-words rounded-2xl px-3.5 py-2 text-sm ${
                m.mine
                  ? "rounded-br-md bg-pulse text-white"
                  : "rounded-bl-md bg-white/10 text-zinc-100"
              }`}
            >
              {m.text}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="flex gap-2 border-t border-white/10 p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={connected ? "Type a message…" : "Connecting…"}
          disabled={!connected}
          maxLength={1000}
          className="min-w-0 flex-1 rounded-full bg-white/5 px-4 py-2.5 text-sm outline-none ring-1 ring-white/10 placeholder:text-zinc-500 focus:ring-pulse disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!connected || !draft.trim()}
          aria-label="Send"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-pulse text-white transition hover:bg-pulse-soft disabled:opacity-40"
        >
          <SendIcon />
        </button>
      </form>
    </div>
  );
}
