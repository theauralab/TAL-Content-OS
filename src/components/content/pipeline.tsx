import type { ContentStatus } from "@prisma/client";
import { PIPELINE_STEPS, pipelineState } from "@/lib/content";

/** The five-step journey with the two client gates, shown at the top of every content page. */
export function Pipeline({ status }: { status: ContentStatus }) {
  const { index, attention } = pipelineState(status);
  if (index < 0) return null;
  return (
    <ol aria-label="Progress" className="flex overflow-x-auto rounded-lg border border-neutral bg-white p-1 text-xs">
      {PIPELINE_STEPS.map((label, i) => {
        const done = i < index;
        const current = i === index;
        const gate = i === 1 || i === 3;
        const tone = current
          ? attention ? "bg-red-100 text-red-700" : "bg-primary text-white"
          : done ? "bg-green-50 text-green-800" : "text-primary/50";
        return (
          <li
            key={label}
            aria-current={current ? "step" : undefined}
            className={`flex min-w-[7.5rem] flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 font-medium ${tone}`}
          >
            <span aria-hidden>{done ? "✓" : i + 1}</span>
            <span>{label}</span>
            {gate && <span className="rounded bg-white/25 px-1 text-[9px] uppercase tracking-wide">client</span>}
          </li>
        );
      })}
    </ol>
  );
}
