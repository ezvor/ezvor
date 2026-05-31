import { ArrowUpRight, Clock, Users, Coins } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface OppCardData {
  title: string;
  org: string;
  category: string;
  blurb: string;
  timing: string;
  eligibility: string;
  difficulty: string;
  stipend?: string;
  url?: string;
  tags?: string[];
  status?: "Open" | "Closed" | "Upcoming" | "Rolling";
  statusNote?: string;
  region?: "Global" | "Pakistan";
}

const statusStyle: Record<string, string> = {
  Open: "bg-success/15 text-success border-success/30",
  Closed: "bg-destructive/15 text-destructive border-destructive/30",
  Upcoming: "bg-warning/15 text-warning border-warning/30",
  Rolling: "bg-primary/15 text-primary-glow border-primary/30",
};

const difficultyStyle: Record<string, string> = {
  Beginner: "bg-success/15 text-success border-success/30",
  Intermediate: "bg-warning/15 text-warning border-warning/30",
  Advanced: "bg-destructive/15 text-destructive border-destructive/30",
};

export function OpportunityCard({ opp }: { opp: OppCardData }) {
  const Wrapper = opp.url ? "a" : "div";
  return (
    <Wrapper
      {...(opp.url ? { href: opp.url, target: "_blank", rel: "noopener noreferrer" } : {})}
      className="group flex flex-col rounded-2xl border border-border/60 bg-gradient-card p-5 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-elegant"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-primary-glow">
            {opp.category}
          </p>
          <h3 className="mt-1 font-display text-lg font-semibold leading-snug">{opp.title}</h3>
          <p className="text-sm text-muted-foreground">{opp.org}</p>
        </div>
        {opp.url && (
          <ArrowUpRight className="h-5 w-5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
        )}
      </div>

      {(opp.status || opp.region === "Pakistan") && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {opp.status && (
            <Badge variant="outline" className={cn("rounded-full", statusStyle[opp.status])}>
              {opp.status}
            </Badge>
          )}
          {opp.region === "Pakistan" && (
            <Badge variant="secondary" className="rounded-full text-[11px] font-normal">
              🇵🇰 Pakistan
            </Badge>
          )}
        </div>
      )}
      {opp.statusNote && (
        <p className="mt-1.5 text-xs text-muted-foreground">{opp.statusNote}</p>
      )}

      <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{opp.blurb}</p>

      <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-primary/70" /> {opp.timing}
        </span>
        <span className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-primary/70" /> {opp.eligibility}
        </span>
        {opp.stipend && (
          <span className="flex items-center gap-2">
            <Coins className="h-3.5 w-3.5 text-primary/70" /> {opp.stipend}
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={cn("rounded-full", difficultyStyle[opp.difficulty])}>
          {opp.difficulty}
        </Badge>
        {opp.tags?.slice(0, 3).map((t) => (
          <Badge key={t} variant="secondary" className="rounded-full text-[11px] font-normal">
            {t}
          </Badge>
        ))}
      </div>
    </Wrapper>
  );
}
