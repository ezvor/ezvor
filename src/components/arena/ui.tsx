// Small presentational building blocks shared by the arena panels.

import { forwardRef, type ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Difficulty } from "@/data/problems";
import { cn } from "@/lib/utils";

export function diffColor(d: Difficulty) {
  if (d === "Easy") return "text-success";
  if (d === "Medium") return "text-warning";
  return "text-destructive";
}

export function diffPill(d: Difficulty) {
  if (d === "Easy") return "bg-success/15 text-success";
  if (d === "Medium") return "bg-warning/15 text-warning";
  return "bg-destructive/15 text-destructive";
}

/** Tailwind text color for a judge verdict. */
export function verdictColor(verdict: string) {
  if (verdict === "Accepted") return "text-success";
  if (verdict === "Time Limit Exceeded") return "text-warning";
  if (verdict === "Finished") return "text-foreground";
  return "text-destructive";
}

export function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function formatMemory(kb: number | null | undefined): string {
  return kb != null && kb > 0 ? `${(kb / 1024).toFixed(1)} MB` : "—";
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

type IconBtnProps = {
  children: ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  className?: string;
};

/** Square icon button with a tooltip; `label` doubles as the aria-label. */
export const IconBtn = forwardRef<HTMLButtonElement, IconBtnProps>(function IconBtn(
  { children, label, onClick, disabled, active, className, ...rest },
  ref,
) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            ref={ref}
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            aria-pressed={active}
            className={cn(
              "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
              active && "text-foreground",
              className,
            )}
            {...rest}
          >
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

export function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-1.5">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-xs font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export function LabeledBox({
  label,
  text,
  tone = "muted",
}: {
  label: string;
  text: string;
  tone?: "muted" | "good" | "bad" | "error";
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      <pre
        className={cn(
          "mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md p-2.5 font-mono text-xs",
          tone === "bad" && "bg-destructive/10 text-destructive",
          tone === "error" && "bg-destructive/10 text-destructive",
          tone === "good" && "bg-success/10 text-foreground/90",
          tone === "muted" && "bg-muted/40 text-foreground/90",
        )}
      >
        {text}
      </pre>
    </div>
  );
}

export function PanelTitle({
  icon,
  children,
  right,
}: {
  icon: ReactNode;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="font-display text-lg font-bold">{children}</h2>
      </div>
      {right}
    </div>
  );
}
