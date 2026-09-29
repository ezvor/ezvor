import type { ReactNode } from "react";

import type { LcDifficulty } from "@/data/leetcodeCatalog";
import { cn } from "@/lib/utils";

import { DIFF_VAR } from "./Difficulty";

/** Single-value circular progress (0..1). */
export function ProgressRing({
  value,
  size = 56,
  stroke = 5,
  color = "var(--success)",
  className,
  children,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  className?: string;
  children?: ReactNode;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `${Math.round(v * 100)}% complete`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${v * c} ${c}`}
          className="transition-[stroke-dasharray] duration-700 ease-out"
          opacity={v > 0 ? 1 : 0}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      )}
    </div>
  );
}

/**
 * LeetCode-style ring: the circle is split into Easy/Medium/Hard arcs sized by
 * how many problems exist in each; each arc fills with what you've solved.
 */
export function DifficultyRing({
  solved,
  totals,
  size = 168,
  stroke = 10,
  children,
}: {
  solved: Record<LcDifficulty, number>;
  totals: Record<LcDifficulty, number>;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const order: LcDifficulty[] = ["Easy", "Medium", "Hard"];
  const grand = order.reduce((n, d) => n + totals[d], 0) || 1;
  // Round caps extend by stroke/2 on each end, so the visible gap is `gap - stroke`.
  const gap = stroke + 5;
  // Leave a 20% opening at the bottom like a gauge.
  const span = c * 0.8;
  let offset = c * 0.1;
  const arcs = order.map((d) => {
    const len = Math.max(0, (totals[d] / grand) * span - gap);
    const fill = totals[d] ? Math.min(1, solved[d] / totals[d]) * len : 0;
    const a = { d, start: offset, len, fill };
    offset += len + gap;
    return a;
  });
  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={order.map((d) => `${d}: ${solved[d]} of ${totals[d]}`).join(", ")}
    >
      {/* rotate so the opening points down */}
      <svg width={size} height={size} style={{ transform: "rotate(90deg)" }} aria-hidden>
        {arcs.map((a) => (
          <g key={a.d}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={DIFF_VAR[a.d]}
              strokeOpacity={0.16}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${a.len} ${c}`}
              strokeDashoffset={-a.start}
            />
            {a.fill > 0 && (
              <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={DIFF_VAR[a.d]}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={`${Math.max(a.fill, 0.5)} ${c}`}
                strokeDashoffset={-a.start}
                className="transition-[stroke-dasharray] duration-700 ease-out"
              />
            )}
          </g>
        ))}
      </svg>
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
      )}
    </div>
  );
}
