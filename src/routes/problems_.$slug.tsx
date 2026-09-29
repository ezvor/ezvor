import { createFileRoute } from "@tanstack/react-router";

import { Arena } from "@/components/arena/Arena";
import { arenaMeta, loadArenaData } from "@/components/arena/loader";

export const Route = createFileRoute("/problems_/$slug")({
  validateSearch: (search: Record<string, unknown>): { list?: string } => ({
    list: typeof search.list === "string" && search.list ? search.list.slice(0, 80) : undefined,
  }),
  loader: ({ params }) => loadArenaData(params.slug),
  head: ({ loaderData }) => {
    const { title, description } = arenaMeta(loaderData);
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: ProblemPage,
});

function ProblemPage() {
  const data = Route.useLoaderData();
  const { list } = Route.useSearch();
  return <Arena data={data} listId={list} />;
}
