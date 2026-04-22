"use client";

import { useEffect, useRef } from "react";

interface Entry {
  prompt: string;
  answer: string;
}

interface Props {
  entries: Entry[];
  isLoading: boolean;
}

export default function AnswerLog({ entries, isLoading }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length, isLoading]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl border border-slate-100 bg-white px-6 py-5 space-y-5">
      {entries.length === 0 ? (
        <p className="text-slate-400 italic text-base text-center pt-4">
          Your answers will appear here as you go…
        </p>
      ) : (
        entries.map((entry, i) => (
          <div key={i} className="animate-fade-in space-y-1">
            <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider">
              {i + 1}. {entry.prompt}
            </p>
            <p className="text-slate-800 text-base leading-snug pl-1">
              {entry.answer}
            </p>
          </div>
        ))
      )}

      {isLoading && (
        <div className="flex gap-1 pl-1 pt-1">
          <span className="w-1.5 h-1.5 bg-amber-300 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 bg-amber-300 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 bg-amber-300 rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
