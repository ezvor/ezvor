// Structured job feeds: fetch (cached), match locally, rank.

import { fetchAllBoards, COMPANY_BOARDS } from "./boards";
import { fetchArbeitnow, fetchHackerNews, fetchRemoteOK, fetchRemotive } from "./feeds";
import { withDeadline } from "./http";
import { parseQuery, scoreJob, timeAgo, type ParsedQuery } from "./match";
import type { SourceKey } from "./sources";
import type { FeedJob, JobResult, JobSearchArgs } from "./types";

export type { FeedJob, JobResult, JobSearchArgs, JobSource } from "./types";
export { SOURCE_KEYS, type SourceKey } from "./sources";
export { parseQuery, titleMatches, timeAgo } from "./match";

type Feed = { name: string; key: SourceKey; load: () => Promise<FeedJob[]> };

const FEEDS: Feed[] = [
  {
    name: `Company boards (${COMPANY_BOARDS.length})`,
    key: "Company career pages",
    load: fetchAllBoards,
  },
  { name: "Remotive", key: "Remote boards", load: fetchRemotive },
  { name: "RemoteOK", key: "Remote boards", load: fetchRemoteOK },
  { name: "Hacker News", key: "Hacker News", load: fetchHackerNews },
  { name: "Arbeitnow", key: "Arbeitnow (EU)", load: fetchArbeitnow },
];

export interface FeedReport {
  name: string;
  scanned: number;
  matched: number;
  ok: boolean;
}

export function wants(args: JobSearchArgs, key: SourceKey): boolean {
  return !args.sources || args.sources.length === 0 || args.sources.includes(key);
}

function displayLocation(job: FeedJob): string {
  return job.moreLocations ? `${job.location} +${job.moreLocations} more` : job.location;
}

function toResult(job: FeedJob, score: number): JobResult {
  return {
    title: job.title,
    company: job.company,
    location: displayLocation(job),
    source: job.source,
    workMode: job.workMode,
    url: job.url,
    description: job.description,
    postedAt: job.postedAt ? new Date(job.postedAt).toISOString() : undefined,
    postedText: job.postedAt ? timeAgo(job.postedAt) : undefined,
    salary: job.salary,
    confidence: score,
    direct: true,
  };
}

/**
 * Search every enabled structured feed. Feeds that are slow are abandoned after
 * `deadlineMs` for this request (they keep warming the cache for the next one).
 */
export async function searchFeeds(
  args: JobSearchArgs,
  opts: { deadlineMs?: number; query?: ParsedQuery } = {},
): Promise<{ jobs: JobResult[]; reports: FeedReport[] }> {
  const q = opts.query ?? parseQuery(args.query);
  const now = Date.now();
  const active = FEEDS.filter((f) => wants(args, f.key));

  const settled = await Promise.all(
    active.map(async (feed) => {
      const rows = await withDeadline(
        feed.load().then((r) => ({ rows: r, ok: true })),
        opts.deadlineMs ?? 14_000,
        { rows: [] as FeedJob[], ok: false },
      );
      const matched: JobResult[] = [];
      for (const job of rows.rows) {
        const score = scoreJob(job, q, args, now);
        if (score != null) matched.push(toResult(job, score));
      }
      const report: FeedReport = {
        name: feed.name,
        scanned: rows.rows.length,
        matched: matched.length,
        ok: rows.ok && rows.rows.length > 0,
      };
      return { matched, report };
    }),
  );

  return {
    jobs: settled.flatMap((s) => s.matched),
    reports: settled.map((s) => s.report),
  };
}
