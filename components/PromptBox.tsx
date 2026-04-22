"use client";

interface Props {
  prompt: string;
  coveredCount: number;
  totalCount: number;
}

export default function PromptBox({ prompt, coveredCount, totalCount }: Props) {
  return (
    <div className="py-4 px-2">
      <div className="flex items-center gap-2 mb-3">
        {Array.from({ length: totalCount }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full flex-1 transition-all duration-500 ${
              i < coveredCount ? "bg-amber-400" : "bg-slate-200"
            }`}
          />
        ))}
      </div>
      <p className="text-xl font-semibold text-slate-700 leading-snug">
        {prompt}
      </p>
    </div>
  );
}
