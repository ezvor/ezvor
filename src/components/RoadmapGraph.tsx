import { useState } from "react";
import { motion } from "motion/react";
import {
  Youtube,
  FileText,
  Dumbbell,
  GraduationCap,
  ListVideo,
  ArrowUpRight,
  X,
  type LucideIcon,
} from "lucide-react";

import type { GraphRoadmap, GraphNode, ResourceKind } from "@/data/graphData";
import { cn } from "@/lib/utils";

const ROW_GAP = 150; // px between layers

const kindIcon: Record<ResourceKind, LucideIcon> = {
  Video: Youtube,
  Playlist: ListVideo,
  Practice: Dumbbell,
  Docs: FileText,
  Course: GraduationCap,
};

export function RoadmapGraph({ graph }: { graph: GraphRoadmap }) {
  const [active, setActive] = useState<GraphNode | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  const maxRow = Math.max(...graph.nodes.map((n) => n.row));
  const rows = maxRow + 1;
  const height = rows * ROW_GAP;
  const nodeById = Object.fromEntries(graph.nodes.map((n) => [n.id, n]));
  const accent = `var(--${graph.accent})`;

  const toggleDone = (id: string) =>
    setDone((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="relative">
      <div
        className="relative mx-auto w-full max-w-3xl"
        style={{ height, perspective: "1200px" }}
      >
        {/* edges */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 100 ${rows * 100}`}
          preserveAspectRatio="none"
        >
          {graph.edges.map((e, i) => {
            const a = nodeById[e.from];
            const b = nodeById[e.to];
            if (!a || !b) return null;
            const x1 = a.col * 100;
            const y1 = (a.row + 0.5) * 100;
            const x2 = b.col * 100;
            const y2 = (b.row + 0.5) * 100;
            const my = (y1 + y2) / 2;
            return (
              <motion.path
                key={i}
                d={`M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`}
                fill="none"
                stroke={accent}
                strokeWidth={2}
                strokeOpacity={0.35}
                vectorEffect="non-scaling-stroke"
                initial={{ pathLength: 0, opacity: 0 }}
                whileInView={{ pathLength: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.05 }}
              />
            );
          })}
        </svg>

        {/* nodes */}
        {graph.nodes.map((n, i) => {
          const isDone = done.has(n.id);
          return (
            <motion.button
              key={n.id}
              onClick={() => setActive(n)}
              initial={{ opacity: 0, scale: 0.8, y: 12 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: i * 0.06 }}
              whileHover={{ scale: 1.06, rotateX: -6, rotateY: 4 }}
              className={cn(
                "group absolute z-10 flex w-[8.5rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-2xl border bg-card/90 px-3 py-3 text-center shadow-soft backdrop-blur transition-colors sm:w-40",
                isDone ? "border-success/60" : "border-border/60 hover:border-primary/60",
              )}
              style={{
                left: `${n.col * 100}%`,
                top: `${(n.row + 0.5) * ROW_GAP}px`,
                transformStyle: "preserve-3d",
                boxShadow: `0 10px 30px -16px ${accent}`,
              }}
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                style={{
                  background: isDone ? "var(--success)" : `color-mix(in oklab, ${accent} 22%, transparent)`,
                  color: isDone ? "var(--success-foreground)" : accent,
                }}
              >
                {isDone ? "✓" : i + 1}
              </span>
              <span className="font-display text-sm font-semibold leading-tight">{n.label}</span>
              {n.optional && (
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  optional
                </span>
              )}
              <span className="text-[10px] text-primary-glow opacity-0 transition-opacity group-hover:opacity-100">
                {n.resources.length} free resources
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* detail panel */}
      {active && (
        <NodeDetail
          node={active}
          accent={accent}
          done={done.has(active.id)}
          onToggleDone={() => toggleDone(active.id)}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
}

function NodeDetail({
  node,
  accent,
  done,
  onToggleDone,
  onClose,
}: {
  node: GraphNode;
  accent: string;
  done: boolean;
  onToggleDone: () => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-lg rounded-t-3xl border border-border/60 bg-card p-6 shadow-elegant sm:rounded-3xl"
        initial={{ y: 40, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <span
              className="text-xs font-medium uppercase tracking-wide"
              style={{ color: accent }}
            >
              Skill node
            </span>
            <h3 className="mt-1 font-display text-2xl font-bold">{node.label}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{node.desc}</p>

        <h4 className="mt-5 mb-2 text-sm font-semibold">Free resources</h4>
        <div className="space-y-2">
          {node.resources.map((r) => {
            const Icon = kindIcon[r.kind];
            return (
              <a
                key={r.url + r.label}
                href={r.url}
                target={r.url.startsWith("http") ? "_blank" : undefined}
                rel="noopener noreferrer"
                className="group flex items-center gap-3 rounded-xl border border-border/60 bg-gradient-card p-3 transition-colors hover:border-primary/50"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: `color-mix(in oklab, ${accent} 18%, transparent)`, color: accent }}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {r.provider} · {r.kind}
                  </span>
                </span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
              </a>
            );
          })}
        </div>

        <button
          onClick={onToggleDone}
          className={cn(
            "mt-5 w-full rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors",
            done
              ? "border-success/50 bg-success/15 text-success"
              : "border-border/70 hover:border-primary/50 hover:bg-primary/10",
          )}
        >
          {done ? "✓ Marked as completed" : "Mark as completed"}
        </button>
      </motion.div>
    </motion.div>
  );
}
