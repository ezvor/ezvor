import { ArrowUpRight, Building2, Clock, MapPin, ShieldCheck, Wifi } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { JobResult } from "@/lib/jobs.functions";

const sourceStyle: Record<JobResult["source"], string> = {
  LinkedIn: "bg-[#0a66c2]/15 text-[#0a66c2] border-[#0a66c2]/30",
  Indeed: "bg-primary/15 text-primary-glow border-primary/30",
  Glassdoor: "bg-success/15 text-success border-success/30",
  Greenhouse: "bg-[#2e9e5b]/15 text-[#3fbf74] border-[#2e9e5b]/30",
  Lever: "bg-[#6d5ae0]/15 text-[#9b8cff] border-[#6d5ae0]/30",
  YC: "bg-[#ff6600]/15 text-[#ff8a3d] border-[#ff6600]/30",
  Remote: "bg-warning/15 text-warning border-warning/30",
};

const modeStyle: Record<JobResult["workMode"], string> = {
  Remote: "bg-success/15 text-success border-success/30",
  Onsite: "bg-primary/15 text-primary-glow border-primary/30",
  Hybrid: "bg-warning/15 text-warning border-warning/30",
  Unspecified: "hidden",
};

export function JobCard({ job }: { job: JobResult }) {
  return (
    <a
      href={job.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col rounded-2xl border border-border/60 bg-gradient-card p-5 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-elegant"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("rounded-full text-[11px]", sourceStyle[job.source])}>
              {job.source}
            </Badge>
            {job.workMode !== "Unspecified" && (
              <Badge variant="outline" className={cn("rounded-full text-[11px]", modeStyle[job.workMode])}>
                <Wifi className="mr-1 h-3 w-3" />
                {job.workMode}
              </Badge>
            )}
          </div>
          <h3 className="mt-2 font-display text-base font-semibold leading-snug group-hover:text-primary-glow">
            {job.title}
          </h3>
        </div>
        <ArrowUpRight className="h-5 w-5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
      </div>

      <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <Building2 className="h-3.5 w-3.5 text-primary/70" /> {job.company}
        </span>
        <span className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 text-primary/70" /> {job.location}
        </span>
      </div>

      {job.description && (
        <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">
          {job.description}
        </p>
      )}
    </a>
  );
}
