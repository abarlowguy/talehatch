"use client";

interface Props {
  coveredCount: number;
  totalCount: number;
}

export default function ContributionMeter({ coveredCount, totalCount }: Props) {
  const pct = totalCount === 0 ? 0 : Math.round((coveredCount / totalCount) * 100);

  return (
    <div className="flex items-center gap-3 px-1 py-2">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-400 rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs font-medium text-slate-500 whitespace-nowrap">
        {coveredCount === 0
          ? "Story ingredients: 0 / 10"
          : `Story ingredients: ${coveredCount} / ${totalCount}`}
      </p>
    </div>
  );
}
