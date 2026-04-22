"use client";

import { useEffect, useRef } from "react";

interface Props {
  story: string;
  isLoading: boolean;
  background: string;
}

export default function StoryBook({ story, isLoading, background }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [story]);

  const bgClasses: Record<string, string> = {
    default: "from-amber-50 to-orange-50",
    dark: "from-slate-800 to-slate-900",
    green: "from-emerald-50 to-green-100",
    ocean: "from-blue-50 to-cyan-100",
    night: "from-indigo-900 to-purple-900",
  };

  const textClass = background === "dark" || background === "night"
    ? "text-slate-100"
    : "text-slate-800";

  return (
    <div
      className={`relative flex-1 rounded-2xl bg-gradient-to-br ${bgClasses[background] ?? bgClasses.default} p-6 overflow-y-auto min-h-0 transition-all duration-700`}
    >
      {/* Book texture overlay */}
      <div className="absolute inset-0 rounded-2xl opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0wIDBoNDB2NDBIMHoiLz48cGF0aCBkPSJNMCAyMGg0MCIgc3Ryb2tlPSIjOTk5IiBzdHJva2Utd2lkdGg9Ii41Ii8+PC9nPjwvc3ZnPg==')] pointer-events-none" />

      {story ? (
        <p className={`relative z-10 font-serif text-lg leading-relaxed tracking-wide whitespace-pre-wrap animate-fade-in ${textClass}`}>
          {story}
        </p>
      ) : (
        <div className="flex items-center justify-center h-full">
          <p className="text-slate-400 text-center font-serif italic text-lg">
            Your story will appear here…
          </p>
        </div>
      )}

      {isLoading && (
        <div className="flex gap-1 mt-4">
          <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
