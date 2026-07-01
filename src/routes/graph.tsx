import { createFileRoute, redirect } from "@tanstack/react-router";

// Skill graphs are now unified into the Roadmaps hub.
export const Route = createFileRoute("/graph")({
  beforeLoad: () => {
    throw redirect({ to: "/roadmaps" });
  },
});
