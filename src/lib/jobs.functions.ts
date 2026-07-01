import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { searchJobsOnPlatforms, type JobResult } from "./jobs.server";

export type { JobResult } from "./jobs.server";

export const TIMEFRAMES = ["Any time", "Past 24 hours", "Past 3 days", "Past week", "Past month"] as const;
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

export const SOURCES = ["LinkedIn", "Indeed", "Glassdoor", "Remote boards"] as const;

const inputSchema = z.object({
  query: z.string().trim().min(2).max(120),
  timeframe: z.enum(TIMEFRAMES).default("Any time"),
  workMode: z.enum(WORK_MODES).default("Any"),
  location: z.enum(LOCATIONS).default("Anywhere"),
  sources: z.array(z.enum(SOURCES)).optional(),
});

export type JobSearchInput = z.infer<typeof inputSchema>;

/** Search live job postings across LinkedIn, Indeed, Glassdoor and remote boards. */
export const searchJobs = createServerFn({ method: "POST" })
  .inputValidator(inputSchema)
  .handler(async ({ data }): Promise<{ jobs: JobResult[]; query: string }> => {
    const jobs = await searchJobsOnPlatforms(data);
    return { jobs, query: data.query };
  });
