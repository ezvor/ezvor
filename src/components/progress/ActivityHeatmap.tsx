import { useEffect, useMemo, useRef, useState } from "react";

import { dayKey } from "@/lib/local/store";
import { cn } from "@/lib/utils";

const WEEKS = 53;
const CELL = 11;
const GAP = 3;
const STEP = CELL + GAP;
const LEFT = 28; // weekday labels
const TOP = 16; // month labels
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Cell = { key: string; date: Date; count: number; col: number; row: number; future: boolean };

function level(count: number, max: number): number {
  if (count <= 0) return 0;
  if (max <= 4) return Math.min(4, count);
  const r = count / max;
  return r > 0.75 ? 4 : r > 0.5 ? 3 : r > 0.25 ? 2 : 1;
}

const LEVEL_CLASS = [
  "fill-muted",
  "fill-success/25",
  "fill-success/45",
  "fill-success/70",
  "fill-success",
];

/**
 * GitHub-style 53-week activity grid (local calendar days, weeks start Sunday).
 * Render client-side only — it depends on the viewer's clock and time zone.
 */
export function ActivityHeatmap({
  activity,
  className,
}: {
  activity: Record<string, number>;
  className?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Cell | null>(null);

  const { cells, months, total, activeDays, max } = useMemo(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - today.getDay() - (WEEKS - 1) * 7);
    const out: Cell[] = [];
    const monthMarks: { col: number; label: string }[] = [];
    let total = 0;
    let activeDays = 0;
    let max = 0;
    const cursor = new Date(start);
    for (let col = 0; col < WEEKS; col++) {
      for (let row = 0; row < 7; row++) {
        const key = dayKey(cursor.getTime());
        const future = cursor.getTime() > today.getTime();
        const count = future ? 0 : (activity[key] ?? 0);
        if (row === 0 && cursor.getDate() <= 7) {
          monthMarks.push({ col, label: MONTHS[cursor.getMonth()] });
        }
        out.push({ key, date: new Date(cursor), count, col, row, future });
        if (count > 0) {
          total += count;
          activeDays++;
          max = Math.max(max, count);
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    // Drop a month label that would collide with the first column.
    if (monthMarks[0]?.col === 0 && monthMarks[1]?.col && monthMarks[1].col < 3) monthMarks.shift();
    return { cells: out, months: monthMarks, total, activeDays, max };
  }, [activity]);

  // Show the most recent weeks first on narrow screens.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  const width = LEFT + WEEKS * STEP;
  const height = TOP + 7 * STEP;
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <p>
          <span className="font-semibold tabular-nums">{total.toLocaleString()}</span>{" "}
          <span className="text-muted-foreground">
            submission{total === 1 ? "" : "s"} in the past year
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          Active days: <span className="tabular-nums text-foreground">{activeDays}</span>
        </p>
      </div>
      <div ref={scroller} className="relative overflow-x-auto pb-1">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block"
          role="img"
          aria-label={`${total} submissions on ${activeDays} days in the past year`}
          onMouseLeave={() => setHover(null)}
        >
          {months.map((m) => (
            <text
              key={`${m.col}-${m.label}`}
              x={LEFT + m.col * STEP}
              y={10}
              className="fill-muted-foreground text-[10px]"
            >
              {m.label}
            </text>
          ))}
          {[1, 3, 5].map((row) => (
            <text
              key={row}
              x={0}
              y={TOP + row * STEP + CELL - 2}
              className="fill-muted-foreground text-[9px]"
            >
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][row]}
            </text>
          ))}
          {cells.map((c) =>
            c.future ? null : (
              <rect
                key={c.key}
                x={LEFT + c.col * STEP}
                y={TOP + c.row * STEP}
                width={CELL}
                height={CELL}
                rx={2.5}
                className={cn(
                  LEVEL_CLASS[level(c.count, max)],
                  hover?.key === c.key && "stroke-foreground/70",
                )}
                strokeWidth={1}
                onMouseEnter={() => setHover(c)}
              >
                <title>{`${c.count} submission${c.count === 1 ? "" : "s"} on ${fmt(c.date)}`}</title>
              </rect>
            ),
          )}
        </svg>
        {hover && (
          <div
            className={cn(
              "pointer-events-none absolute z-10 whitespace-nowrap rounded-md border border-border/60 bg-popover px-2 py-1 text-[11px] text-popover-foreground shadow-md",
              // Keep the tooltip inside the scroll container (which clips overflow).
              hover.col < 10
                ? "translate-x-0"
                : hover.col > WEEKS - 10
                  ? "-translate-x-full"
                  : "-translate-x-1/2",
              hover.row < 3 ? "translate-y-0" : "-translate-y-full",
            )}
            style={{
              left: LEFT + hover.col * STEP + CELL / 2,
              top: hover.row < 3 ? TOP + (hover.row + 1) * STEP + 2 : TOP + hover.row * STEP - 4,
            }}
          >
            <span className="font-semibold">
              {hover.count} submission{hover.count === 1 ? "" : "s"}
            </span>{" "}
            <span className="text-muted-foreground">on {fmt(hover.date)}</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
        Less
        {LEVEL_CLASS.map((c) => (
          <svg key={c} width={CELL} height={CELL} aria-hidden>
            <rect width={CELL} height={CELL} rx={2.5} className={c} />
          </svg>
        ))}
        More
      </div>
    </div>
  );
}
