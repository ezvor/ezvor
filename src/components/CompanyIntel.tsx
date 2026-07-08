import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  Building2,
  Loader2,
  Search,
  Users,
  ClipboardList,
  Cpu,
  Wrench,
  Route as RouteIcon,
  Gauge,
  Rocket,
  Lightbulb,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getCompanyIntel, type CompanyIntel as Intel } from "@/lib/company.functions";
import { cn } from "@/lib/utils";

const importanceStyles: Record<string, string> = {
  High: "border-success/40 bg-success/10 text-success",
  Medium: "border-warning/40 bg-warning/10 text-warning",
  Low: "border-border/60 bg-muted/40 text-muted-foreground",
};

export function CompanyIntel({ role, company }: { role: string; company: string }) {
  const intelFn = useServerFn(getCompanyIntel);
  const [data, setData] = useState<Intel | null>(null);

  const mutation = useMutation({
    mutationFn: () => intelFn({ data: { company: company.trim(), role: role.trim() } }),
    onSuccess: (res) => setData(res),
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Couldn't research that company"),
  });

  const canRun = role.trim().length >= 2 && company.trim().length >= 2;

  return (
    <div className="rounded-2xl border border-border/60 bg-gradient-card p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary-glow">
            <Building2 className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold">Company intelligence</h2>
            <p className="text-sm text-muted-foreground">
              Live research on culture, hiring process, and exactly what to prepare.
            </p>
          </div>
        </div>
        <Button
          onClick={() => mutation.mutate()}
          disabled={!canRun || mutation.isPending}
          className="shrink-0 bg-gradient-primary shadow-glow"
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Researching…
            </>
          ) : (
            <>
              <Search className="h-4 w-4" /> {data ? "Refresh brief" : "Research this role"}
            </>
          )}
        </Button>
      </div>

      {!canRun && (
        <p className="mt-4 rounded-lg border border-dashed border-border/70 bg-background/40 px-4 py-3 text-sm text-muted-foreground">
          Pick a target role and type a company above to get an intelligent breakdown.
        </p>
      )}

      {mutation.isPending && !data && (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 animate-pulse text-primary-glow" />
          Reading blogs, interview write-ups and company sources…
        </div>
      )}

      {data && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 space-y-6"
        >
          {/* Header line */}
          <div className="rounded-xl border border-primary/25 bg-background/40 p-4">
            <p className="font-display text-base font-semibold">
              {data.role} <span className="text-muted-foreground">@</span> {data.company}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{data.overview}</p>
          </div>

          {/* Focus matrix — the small horizontal/vertical table */}
          <Section icon={Gauge} title="What they test (and how much)">
            <div className="overflow-hidden rounded-xl border border-border/60">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Area</th>
                    <th className="px-3 py-2 font-medium">Weight</th>
                    <th className="px-3 py-2 font-medium">What to expect</th>
                  </tr>
                </thead>
                <tbody>
                  {data.focus.map((f, i) => (
                    <tr key={f.area} className={cn(i % 2 === 1 && "bg-background/30")}>
                      <td className="whitespace-nowrap px-3 py-2 font-medium">{f.area}</td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium",
                            importanceStyles[f.importance] ?? importanceStyles.Low,
                          )}
                        >
                          {f.importance}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{f.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Interview process as a compact vertical table */}
          <Section icon={RouteIcon} title="Hiring & interview process">
            <div className="overflow-hidden rounded-xl border border-border/60">
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {data.interviewProcess.map((s, i) => (
                    <tr
                      key={s.stage}
                      className={cn("border-b border-border/50 last:border-0", i % 2 === 1 && "bg-background/30")}
                    >
                      <td className="w-10 px-3 py-2.5 text-center align-top font-display text-sm font-bold text-primary-glow">
                        {i + 1}
                      </td>
                      <td className="w-40 px-3 py-2.5 align-top font-medium">{s.stage}</td>
                      <td className="px-3 py-2.5 align-top text-muted-foreground">{s.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Two-column tag panels */}
          <div className="grid gap-5 sm:grid-cols-2">
            <TagPanel icon={Cpu} title="Technologies" items={data.techStack} />
            <TagPanel icon={Wrench} title="Skills expected" items={data.skills} />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <ListPanel icon={Users} title="Culture & values" items={data.culture} />
            <ListPanel icon={ClipboardList} title="Requirements" items={data.requirements} />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <ListPanel icon={Lightbulb} title="Tips to stand out" items={data.tips} />
            <Section icon={Rocket} title="Onboarding">
              <p className="rounded-xl border border-border/60 bg-background/40 p-4 text-sm leading-relaxed text-muted-foreground">
                {data.onboarding}
              </p>
            </Section>
          </div>

          {/* Resources */}
          {data.resources.length > 0 && (
            <Section icon={ExternalLink} title="Sources & further reading">
              <div className="flex flex-col gap-2">
                {data.resources.map((r) => (
                  <a
                    key={r.url}
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm transition-colors hover:border-primary/50"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary-glow" />
                    <span className="min-w-0 flex-1 truncate">{r.title}</span>
                  </a>
                ))}
              </div>
            </Section>
          )}
        </motion.div>
      )}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Gauge;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary-glow" /> {title}
      </h3>
      {children}
    </div>
  );
}

function TagPanel({
  icon: Icon,
  title,
  items,
}: {
  icon: typeof Gauge;
  title: string;
  items: string[];
}) {
  return (
    <Section icon={Icon} title={title}>
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-border/60 bg-background/40 p-4">
        {items.map((t) => (
          <span
            key={t}
            className="rounded-md border border-border/60 bg-card/70 px-2 py-1 text-xs text-foreground"
          >
            {t}
          </span>
        ))}
      </div>
    </Section>
  );
}

function ListPanel({
  icon: Icon,
  title,
  items,
}: {
  icon: typeof Gauge;
  title: string;
  items: string[];
}) {
  return (
    <Section icon={Icon} title={title}>
      <ul className="space-y-1.5 rounded-xl border border-border/60 bg-background/40 p-4 text-sm text-muted-foreground">
        {items.map((t) => (
          <li key={t} className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary-glow" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
