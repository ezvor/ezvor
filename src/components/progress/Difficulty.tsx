import type { LcDifficulty } from "@/data/leetcodeCatalog";
import { cn } from "@/lib/utils";

export const DIFF_TEXT: Record<LcDifficulty, string> = {
  Easy: "text-success",
  Medium: "text-warning",
  Hard: "text-destructive",
};

export const DIFF_BG: Record<LcDifficulty, string> = {
  Easy: "bg-success",
  Medium: "bg-warning",
  Hard: "bg-destructive",
};

/** CSS colour for SVG strokes/fills. */
export const DIFF_VAR: Record<LcDifficulty, string> = {
  Easy: "var(--success)",
  Medium: "var(--warning)",
  Hard: "var(--destructive)",
};

export function DifficultyLabel({
  difficulty,
  className,
  short = false,
}: {
  difficulty: LcDifficulty;
  className?: string;
  short?: boolean;
}) {
  return (
    <span className={cn("font-medium", DIFF_TEXT[difficulty], className)}>
      {short ? (difficulty === "Medium" ? "Med." : difficulty) : difficulty}
    </span>
  );
}

/** Horizontal E/M/H split bar. */
export function DifficultySplit({
  easy,
  medium,
  hard,
  className,
}: {
  easy: number;
  medium: number;
  hard: number;
  className?: string;
}) {
  const total = easy + medium + hard || 1;
  return (
    <div
      className={cn("flex h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
      role="img"
      aria-label={`${easy} easy, ${medium} medium, ${hard} hard`}
    >
      <span className="bg-success" style={{ width: `${(easy / total) * 100}%` }} />
      <span className="bg-warning" style={{ width: `${(medium / total) * 100}%` }} />
      <span className="bg-destructive" style={{ width: `${(hard / total) * 100}%` }} />
    </div>
  );
}
