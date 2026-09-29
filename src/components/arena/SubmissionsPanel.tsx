import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, CloudUpload, Copy, History, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { isLangKey, LANGUAGE_INFO, type LangKey } from "@/lib/judge/languages";
import { useCollection } from "@/lib/local/store";
import { listSubmissions, type SubmissionRow } from "@/lib/submissions.functions";
import { cn } from "@/lib/utils";
import { formatMemory, PanelTitle, timeAgo, verdictColor } from "./ui";

type HistoryRow = {
  id: string;
  status: string;
  language: string;
  passed: number;
  total: number;
  runtimeMs: number | null;
  memoryKb: number | null;
  at: number;
  code?: string;
  verified?: boolean;
};

const langLabel = (l: string) => (isLangKey(l) ? LANGUAGE_INFO[l].label : l);

/** Local history is the source of truth; cloud rows fill in other devices. */
function mergeHistory(local: HistoryRow[], cloud: SubmissionRow[]): HistoryRow[] {
  const rows = [...local];
  for (const c of cloud) {
    const dupe = local.some(
      (l) =>
        l.language === c.language &&
        l.passed === c.passed &&
        l.total === c.total &&
        Math.abs(l.at - c.when) < 120_000,
    );
    if (!dupe) {
      rows.push({
        id: `cloud-${c.id}`,
        status: c.status,
        language: c.language,
        passed: c.passed,
        total: c.total,
        runtimeMs: c.runtimeMs,
        memoryKb: c.memoryKb,
        at: c.when,
        code: c.code ?? undefined,
        verified: c.verified ?? true,
      });
    }
  }
  return rows.sort((a, b) => b.at - a.at);
}

export function SubmissionsPanel({
  slug,
  onLoadCode,
}: {
  slug: string;
  onLoadCode: (language: LangKey, code: string) => void;
}) {
  const { user } = useAuth();
  const all = useCollection("submissions");
  const local = useMemo<HistoryRow[]>(
    () =>
      all
        .filter((s) => s.slug === slug)
        .map((s) => ({
          id: s.id,
          status: s.status,
          language: s.language,
          passed: s.passed,
          total: s.total,
          runtimeMs: s.runtimeMs,
          memoryKb: s.memoryKb,
          at: s.at,
          code: s.code,
          verified: s.verified,
        })),
    [all, slug],
  );

  const listFn = useServerFn(listSubmissions);
  const [cloud, setCloud] = useState<SubmissionRow[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Refetch cloud history for signed-in users whenever a new local submission lands.
  useEffect(() => {
    if (!user) {
      setCloud([]);
      return;
    }
    let cancelled = false;
    setCloudLoading(true);
    listFn({ data: { slug } })
      .then((rows) => {
        if (!cancelled) setCloud(rows);
      })
      .catch(() => {
        /* local history still shows */
      })
      .finally(() => {
        if (!cancelled) setCloudLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, slug, local.length, listFn]);

  useEffect(() => setSelected(null), [slug]);

  const rows = useMemo(() => mergeHistory(local, cloud), [local, cloud]);
  const current = rows.find((r) => r.id === selected) ?? null;

  if (current) {
    return (
      <div className="flex h-full flex-col">
        <div className="space-y-3 border-b border-border/60 p-4">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All submissions
          </button>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className={cn("font-display text-lg font-bold", verdictColor(current.status))}>
              {current.status}
            </span>
            <span className="text-xs text-muted-foreground">
              {current.passed} / {current.total} testcases passed
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{langLabel(current.language)}</span>
            <span>Runtime {current.runtimeMs != null ? `${current.runtimeMs} ms` : "—"}</span>
            <span>Memory {formatMemory(current.memoryKb)}</span>
            <span title={new Date(current.at).toLocaleString()}>{timeAgo(current.at)}</span>
            {current.verified === false && <span className="text-warning">Unverified tests</span>}
          </div>
          {current.code && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="h-7 gap-1.5 text-xs"
                onClick={() => {
                  if (!isLangKey(current.language) || !current.code) return;
                  onLoadCode(current.language, current.code);
                }}
              >
                <CloudUpload className="h-3.5 w-3.5" /> Load into editor
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5 text-xs"
                onClick={() => {
                  void navigator.clipboard?.writeText(current.code ?? "");
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-success" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                Copy
              </Button>
            </div>
          )}
        </div>
        {current.code ? (
          <pre className="min-h-0 flex-1 overflow-auto bg-[#1e1e1e] p-4 font-mono text-[12px] leading-relaxed text-[#d4d4d4]">
            {current.code}
          </pre>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">
            The source code of this submission isn't available on this device.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-5 text-sm">
      <PanelTitle
        icon={<History className="h-4 w-4 text-primary" />}
        right={
          cloudLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : null
        }
      >
        Submissions
      </PanelTitle>
      {rows.length === 0 ? (
        <p className="mt-4 text-muted-foreground">
          No submissions yet. Press <span className="font-semibold text-foreground">Submit</span> to
          judge your solution against the full test set; your history appears here.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Language</th>
                <th className="px-3 py-2 text-left font-medium">Runtime</th>
                <th className="px-3 py-2 text-left font-medium">Memory</th>
                <th className="px-3 py-2 text-right font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr
                  key={s.id}
                  tabIndex={0}
                  onClick={() => setSelected(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(s.id);
                    }
                  }}
                  className="cursor-pointer border-t border-border/50 transition-colors hover:bg-muted/30 focus-visible:bg-muted/40 focus-visible:outline-none"
                >
                  <td
                    className={cn(
                      "whitespace-nowrap px-3 py-2 font-semibold",
                      verdictColor(s.status),
                    )}
                  >
                    {s.status}
                    <span className="ml-1 font-normal text-muted-foreground">
                      {s.passed}/{s.total}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {langLabel(s.language)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                    {s.runtimeMs != null ? `${s.runtimeMs} ms` : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                    {formatMemory(s.memoryKb)}
                  </td>
                  <td
                    className="whitespace-nowrap px-3 py-2 text-right text-muted-foreground"
                    title={new Date(s.at).toLocaleString()}
                  >
                    {timeAgo(s.at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
