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
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getCompanyIntel, type CompanyIntel as Intel } from "@/lib/company.functions";
import { cn } from "@/lib/utils";

const importanceStyles: Record<string, string> = {
  High: "border-sec-rose/40 bg-sec-rose/10 text-sec-rose",
  Medium: "border-sec-amber/40 bg-sec-amber/10 text-sec-amber",
  Low: "border-border/60 bg-muted/40 text-muted-foreground",
};

// Tasteful, desaturated accents so dense sections are scannable at a glance.
// Full class strings (no dynamic concatenation) so Tailwind keeps them.
type Accent = "blue" | "teal" | "amber" | "rose" | "green" | "plain";
const accentStyles: Record<
  Accent,
  { badge: string; text: string; bar: string; leftBorder: string; dot: string }
> = {
  blue: {
    badge: "bg-sec-blue/15 text-sec-blue",
    text: "text-sec-blue",
    bar: "border-sec-blue/25 bg-sec-blue/[0.07]",
    leftBorder: "border-l-sec-blue/50",
    dot: "bg-sec-blue",
  },
  teal: {
    badge: "bg-sec-teal/15 text-sec-teal",
    text: "text-sec-teal",
    bar: "border-sec-teal/25 bg-sec-teal/[0.07]",
    leftBorder: "border-l-sec-teal/50",
    dot: "bg-sec-teal",
  },
  amber: {
    badge: "bg-sec-amber/15 text-sec-amber",
    text: "text-sec-amber",
    bar: "border-sec-amber/25 bg-sec-amber/[0.07]",
    leftBorder: "border-l-sec-amber/50",
    dot: "bg-sec-amber",
  },
  rose: {
    badge: "bg-sec-rose/15 text-sec-rose",
    text: "text-sec-rose",
    bar: "border-sec-rose/25 bg-sec-rose/[0.07]",
    leftBorder: "border-l-sec-rose/50",
    dot: "bg-sec-rose",
  },
  green: {
    badge: "bg-sec-green/15 text-sec-green",
    text: "text-sec-green",
    bar: "border-sec-green/25 bg-sec-green/[0.07]",
    leftBorder: "border-l-sec-green/50",
    dot: "bg-sec-green",
  },
  plain: {
    badge: "bg-primary/12 text-primary-glow",
    text: "text-primary-glow",
    bar: "border-border/60 bg-card/50",
    leftBorder: "border-l-primary/40",
    dot: "bg-primary-glow",
  },
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
          className="mt-6 space-y-7"
        >
          {/* Unrecognized-company notice */}
          {!data.recognized && (
            <div className="flex items-start gap-3 rounded-xl border border-sec-amber/40 bg-sec-amber/10 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-sec-amber" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Couldn't verify this company
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {data.note} Everything below is solid, generic preparation for a{" "}
                  <span className="font-medium text-foreground">{data.role}</span> so you don't lose
                  momentum.
                </p>
              </div>
            </div>
          )}

          {/* Header line */}
          <div
            className={cn(
              "rounded-xl border p-4",
              data.recognized ? "border-primary/25 bg-background/40" : "border-border/60 bg-background/30",
            )}
          >
            <div className="flex items-center gap-2">
              <p className="font-display text-base font-semibold">
                {data.role} <span className="text-muted-foreground">@</span> {data.company}
              </p>
              {data.recognized && (
                <span className="rounded-full border border-sec-green/40 bg-sec-green/10 px-2 py-0.5 text-[11px] font-medium text-sec-green">
                  Verified
                </span>
              )}
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{data.overview}</p>
          </div>

          {/* Focus matrix — the small horizontal/vertical table */}
          <Section accent="blue" icon={Gauge} title="What they test (and how much)">
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
                    <tr
                      key={f.area}
                      className={cn(
                        "transition-colors hover:bg-sec-blue/[0.06]",
                        i % 2 === 1 && "bg-background/30",
                      )}
                    >
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
          <Section accent="teal" icon={RouteIcon} title="Hiring & interview process">
            <div className="overflow-hidden rounded-xl border border-border/60">
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {data.interviewProcess.map((s, i) => (
                    <tr
                      key={s.stage}
                      className={cn(
                        "border-b border-border/50 transition-colors last:border-0 hover:bg-sec-teal/[0.06]",
                        i % 2 === 1 && "bg-background/30",
                      )}
                    >
                      <td className="w-10 px-3 py-2.5 text-center align-top">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sec-teal/15 font-display text-xs font-bold text-sec-teal">
                          {i + 1}
                        </span>
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
            <TagPanel accent="rose" icon={Cpu} title="Technologies" items={data.techStack} />
            <TagPanel accent="amber" icon={Wrench} title="Skills expected" items={data.skills} />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <ListPanel accent="green" icon={Users} title="Culture & values" items={data.culture} />
            <ListPanel accent="blue" icon={ClipboardList} title="Requirements" items={data.requirements} />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <ListPanel accent="amber" icon={Lightbulb} title="Tips to stand out" items={data.tips} />
            <Section accent="teal" icon={Rocket} title="Onboarding">
              <p className="rounded-xl border border-l-2 border-border/60 border-l-sec-teal/50 bg-background/40 p-4 text-sm leading-relaxed text-muted-foreground">
                {data.onboarding}
              </p>
            </Section>
          </div>

          {/* Resources */}
          {data.resources.length > 0 && (
            <Section accent="rose" icon={ExternalLink} title="Sources & further reading">
              <div className="flex flex-col gap-2">
                {data.resources.map((r) => (
                  <a
                    key={r.url}
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm transition-colors hover:border-sec-rose/50 hover:bg-sec-rose/[0.06]"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-sec-rose" />
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

function SectionHeader({
  icon: Icon,
  title,
  accent,
}: {
  icon: typeof Gauge;
  title: string;
  accent: Accent;
}) {
  const a = accentStyles[accent];
  return (
    <div className={cn("mb-3 flex items-center gap-2.5 rounded-lg border px-3 py-2", a.bar)}>
      <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", a.badge)}>
        <Icon className="h-4 w-4" />
      </span>
      <h3 className={cn("font-display text-sm font-semibold tracking-tight", a.text)}>{title}</h3>
    </div>
  );
}

function Section({
  icon,
  title,
  accent = "plain",
  children,
}: {
  icon: typeof Gauge;
  title: string;
  accent?: Accent;
  children: React.ReactNode;
}) {
  return (
    <div>
      <SectionHeader icon={icon} title={title} accent={accent} />
      {children}
    </div>
  );
}

function TagPanel({
  icon,
  title,
  items,
  accent = "plain",
}: {
  icon: typeof Gauge;
  title: string;
  items: string[];
  accent?: Accent;
}) {
  const a = accentStyles[accent];
  return (
    <Section icon={icon} title={title} accent={accent}>
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-l-2 border-border/60 bg-background/40 p-4">
        <div className={cn("pointer-events-none absolute", a.leftBorder)} />
        {items.map((t) => (
          <span
            key={t}
            className={cn(
              "rounded-md border border-border/60 bg-card/70 px-2 py-1 text-xs text-foreground transition-colors",
            )}
          >
            {t}
          </span>
        ))}
      </div>
    </Section>
  );
}

function ListPanel({
  icon,
  title,
  items,
  accent = "plain",
}: {
  icon: typeof Gauge;
  title: string;
  items: string[];
  accent?: Accent;
}) {
  const a = accentStyles[accent];
  return (
    <Section icon={icon} title={title} accent={accent}>
      <ul
        className={cn(
          "space-y-2 rounded-xl border border-l-2 border-border/60 bg-background/40 p-4 text-sm text-muted-foreground",
          a.leftBorder,
        )}
      >
        {items.map((t) => (
          <li key={t} className="flex gap-2.5">
            <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", a.dot)} />
            <span className="leading-relaxed">{t}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
