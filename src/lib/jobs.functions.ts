import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { optionalSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SOURCE_KEYS } from "./jobs/sources";
import type { JobSearchOutcome } from "./jobs.server";

export { SOURCE_HINTS } from "./jobs/sources";

export type { JobResult, JobSource, SourceReport, JobSearchOutcome } from "./jobs.server";

export const TIMEFRAMES = [
  "Any time",
  "Past 24 hours",
  "Past 3 days",
  "Past week",
  "Past month",
] as const;
export const WORK_MODES = ["Any", "Remote", "Onsite", "Hybrid"] as const;
export const LOCATIONS = [
  "Anywhere",
  "Pakistan",
  "United States",
  "United Kingdom",
  "Canada",
  "Germany",
  "United Arab Emirates",
  "India",
  "Australia",
  "Remote (Worldwide)",
] as const;

export const SOURCES = SOURCE_KEYS;

const inputSchema = z.object({
  query: z.string().trim().min(2).max(120),
  timeframe: z.enum(TIMEFRAMES).default("Any time"),
  workMode: z.enum(WORK_MODES).default("Any"),
  location: z.enum(LOCATIONS).default("Anywhere"),
  sources: z.array(z.enum(SOURCE_KEYS)).optional(),
});

export type JobSearchInput = z.infer<typeof inputSchema>;

/**
 * Search live postings: company career boards (Greenhouse / Lever / Ashby),
 * Remotive, RemoteOK, Arbeitnow, HN "Who is hiring?" and web results from
 * LinkedIn, Indeed, Glassdoor and YC. Free, no API keys required.
 */
export const searchJobs = createServerFn({ method: "POST" })
  .middleware([optionalSupabaseAuth])
  .validator(inputSchema)
  .handler(async ({ data, context }): Promise<JobSearchOutcome & { query: string }> => {
    const [{ enforceRateLimit }, { searchJobsOnPlatforms }] = await Promise.all([
      import("./rate-limit.server"),
      import("./jobs.server"),
    ]);
    enforceRateLimit("search", { userId: context.userId as string | null });
    const outcome = await searchJobsOnPlatforms(data);
    return { ...outcome, query: data.query };
  });
