import { ArrowUpRight, Clock, Users, Coins, ShieldCheck, RefreshCw, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface StatusCitation {
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  reason?: string | null;
  confidence?: string | null;
  checkedAt?: string | null;
}

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
  /** Verifiable citation for the live status. */
  citation?: StatusCitation;
  /** Re-check handler (shows a refresh button when provided). */
  onRecheck?: () => void;
  rechecking?: boolean;
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

function timeAgo(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return null;
  const mins = Math.round((Date.now() - d) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function OpportunityCard({ opp }: { opp: OppCardData }) {
  const checked = timeAgo(opp.citation?.checkedAt);
  return (
    <div className="group flex flex-col rounded-2xl border border-border/60 bg-gradient-card p-5 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-elegant">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-primary-glow">{opp.category}</p>
          <h3 className="mt-1 font-display text-lg font-semibold leading-snug">
            {opp.url ? (
              <a href={opp.url} target="_blank" rel="noopener noreferrer" className="hover:text-primary-glow">
                {opp.title}
              </a>
            ) : (
              opp.title
            )}
          </h3>
          <p className="text-sm text-muted-foreground">{opp.org}</p>
        </div>
        {opp.url && (
          <a href={opp.url} target="_blank" rel="noopener noreferrer" aria-label="Open official page">
            <ArrowUpRight className="h-5 w-5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
          </a>
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
          {opp.onRecheck && (
            <button
              onClick={opp.onRecheck}
              disabled={opp.rechecking}
              className="ml-auto flex items-center gap-1 rounded-full border border-border/60 px-2.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-60"
            >
              <RefreshCw className={cn("h-3 w-3", opp.rechecking && "animate-spin")} />
              {opp.rechecking ? "Checking…" : "Re-check"}
            </button>
          )}
        </div>
      )}
      {opp.statusNote && <p className="mt-1.5 text-xs text-muted-foreground">{opp.statusNote}</p>}

      {/* Verifiable source citation */}
      {opp.citation?.sourceUrl && (
        <div className="mt-2.5 rounded-xl border border-border/50 bg-card/50 p-2.5 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-foreground/80">
            <ShieldCheck className="h-3.5 w-3.5 text-success" />
            Verified from source
            {opp.citation.confidence && (
              <span className="text-muted-foreground">· {opp.citation.confidence} confidence</span>
            )}
            {checked && <span className="ml-auto text-muted-foreground">{checked}</span>}
          </div>
          {opp.citation.reason && (
            <p className="mt-1 leading-relaxed text-muted-foreground">“{opp.citation.reason}”</p>
          )}
          <a
            href={opp.citation.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-primary-glow hover:underline"
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span className="truncate">{opp.citation.sourceTitle || opp.citation.sourceUrl}</span>
          </a>
        </div>
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
    </div>
  );
}
