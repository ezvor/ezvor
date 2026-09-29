import { createFileRoute, Link } from "@tanstack/react-router";

import { PageHeader } from "@/components/PageHeader";
import { ListCard } from "@/components/progress/ListCard";
import { STUDY_LISTS } from "@/data/lists";
import { useCollection } from "@/lib/local/store";
import { useCatalog } from "@/lib/progress/catalog";

export const Route = createFileRoute("/lists")({
  head: () => ({
    meta: [
      { title: "Study Lists — Ezvor" },
      {
        name: "description",
        content:
          "Blind 75, NeetCode 150, Grind 75, LeetCode 75 and Top Interview 150, with progress tracking, a pattern roadmap and an in-browser judge for every problem.",
      },
    ],
  }),
  component: ListsPage,
});

const GUIDE: { when: string; pick: string; id: string }[] = [
  { when: "Interview in 2–4 weeks", pick: "Grind 75", id: "grind-75" },
  { when: "New to DSA", pick: "LeetCode 75", id: "leetcode-75" },
  { when: "Covering every pattern", pick: "NeetCode 150", id: "neetcode-150" },
  { when: "Broader, more classic set", pick: "Top Interview 150", id: "top-interview-150" },
];

function ListsPage() {
  const solved = useCollection("solved");
  const { bySlug } = useCatalog();

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Study lists"
        title="Follow a proven list"
        description="The interview lists most engineers use, solvable here with a real judge. Progress is tracked across lists, so a problem solved in one counts everywhere."
      />

      <div className="mx-auto w-full max-w-6xl space-y-8 px-4 pt-8 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STUDY_LISTS.map((l) => (
            <ListCard key={l.id} list={l} solved={solved} bySlug={bySlug} />
          ))}
        </div>

        <section
          aria-labelledby="which-list"
          className="rounded-2xl border border-border/60 bg-card/60 p-5"
        >
          <h2 id="which-list" className="font-display text-base font-semibold">
            Which list should I pick?
          </h2>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {GUIDE.map((g) => (
              <div
                key={g.id}
                className="flex items-baseline justify-between gap-3 border-b border-border/40 pb-2"
              >
                <dt className="text-muted-foreground">{g.when}</dt>
                <dd>
                  <Link
                    to="/lists/$listId"
                    params={{ listId: g.id }}
                    className="font-medium hover:underline"
                  >
                    {g.pick}
                  </Link>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
