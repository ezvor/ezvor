import { CheckCircle2, Circle, CircleDot } from "lucide-react";

import type { ProblemStatus } from "@/lib/progress/stats";
import { cn } from "@/lib/utils";

export function StatusIcon({ status, className }: { status: ProblemStatus; className?: string }) {
  if (status === "solved") {
    return (
      <CheckCircle2
        className={cn("h-4 w-4 text-success", className)}
        aria-label="Solved"
        role="img"
      />
    );
  }
  if (status === "attempted") {
    return (
      <CircleDot
        className={cn("h-4 w-4 text-warning", className)}
        aria-label="Attempted"
        role="img"
      />
    );
  }
  return (
    <Circle
      className={cn("h-4 w-4 text-muted-foreground/40", className)}
      aria-label="Not started"
      role="img"
    />
  );
}
