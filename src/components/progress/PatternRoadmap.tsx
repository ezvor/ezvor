import { NEETCODE_ROADMAP_EDGES } from "@/data/lists";
import type { SectionProgress } from "@/lib/progress/stats";
import { cn } from "@/lib/utils";

/** Layout for the NeetCode pattern DAG: row index + horizontal centre (0-100%). */
const LAYOUT: Record<string, { row: number; x: number; label?: string }> = {
  "Arrays & Hashing": { row: 0, x: 50 },
  "Two Pointers": { row: 1, x: 34 },
  Stack: { row: 1, x: 70 },
  "Sliding Window": { row: 2, x: 12 },
  "Binary Search": { row: 2, x: 34 },
  "Linked List": { row: 2, x: 56 },
  Trees: { row: 3, x: 45 },
  Tries: { row: 4, x: 16 },
  "Heap / Priority Queue": { row: 4, x: 45, label: "Heap / PQ" },
  Backtracking: { row: 4, x: 74 },
  Intervals: { row: 5, x: 10 },
  Greedy: { row: 5, x: 28 },
  Graphs: { row: 5, x: 60 },
  "1-D Dynamic Programming": { row: 5, x: 86, label: "1-D DP" },
  "Advanced Graphs": { row: 6, x: 40, label: "Adv. Graphs" },
  "Math & Geometry": { row: 6, x: 57, label: "Math & Geo" },
  "2-D Dynamic Programming": { row: 6, x: 74, label: "2-D DP" },
  "Bit Manipulation": { row: 6, x: 91, label: "Bit Manip." },
};

const ROW_H = 96;
const NODE_H = 54;
const NODE_W = 150;

export function PatternRoadmap({
  sections,
  onSelect,
  className,
}: {
  sections: SectionProgress[];
  onSelect?: (title: string) => void;
  className?: string;
}) {
  const byTitle = new Map(sections.map((s) => [s.title, s]));
  const nodes = sections.filter((s) => LAYOUT[s.title]);
  const rows = Math.max(...nodes.map((n) => LAYOUT[n.title].row)) + 1;
  const height = (rows - 1) * ROW_H + NODE_H;

  return (
    <div className={cn("overflow-x-auto", className)}>
      <div className="relative mx-auto min-w-[820px] max-w-4xl" style={{ height }}>
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 100 ${height}`}
          preserveAspectRatio="none"
          aria-hidden
        >
          {NEETCODE_ROADMAP_EDGES.map(([from, to]) => {
            const a = LAYOUT[from];
            const b = LAYOUT[to];
            if (!a || !b) return null;
            const src = byTitle.get(from);
            const complete = src ? src.total > 0 && src.done === src.total : false;
            const y1 = a.row * ROW_H + NODE_H;
            const y2 = b.row * ROW_H;
            const mid = (y1 + y2) / 2;
            return (
              <path
                key={`${from}->${to}`}
                d={`M ${a.x} ${y1} C ${a.x} ${mid}, ${b.x} ${mid}, ${b.x} ${y2}`}
                fill="none"
                stroke={complete ? "var(--success)" : "var(--border)"}
                strokeOpacity={complete ? 0.8 : 1}
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>

        {nodes.map((s) => {
          const pos = LAYOUT[s.title];
          const pct = s.total ? s.done / s.total : 0;
          const complete = s.total > 0 && s.done === s.total;
          return (
            <button
              key={s.title}
              type="button"
              onClick={() => onSelect?.(s.title)}
              className={cn(
                "absolute flex -translate-x-1/2 flex-col justify-center gap-1.5 rounded-xl border bg-card px-3 text-left shadow-soft transition-colors hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                complete ? "border-success/60" : "border-border/70",
              )}
              style={{ left: `${pos.x}%`, top: pos.row * ROW_H, width: NODE_W, height: NODE_H }}
              aria-label={`${s.title}: ${s.done} of ${s.total} solved`}
              title={s.title}
            >
              <span className="flex items-center justify-between gap-1">
                <span className="truncate text-[12px] font-medium">{pos.label ?? s.title}</span>
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  {s.done}/{s.total}
                </span>
              </span>
              <span className="block h-1 w-full overflow-hidden rounded-full bg-muted">
                <span
                  className={cn(
                    "block h-full rounded-full",
                    complete ? "bg-success" : "bg-foreground/60",
                  )}
                  style={{ width: `${pct * 100}%` }}
                />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
