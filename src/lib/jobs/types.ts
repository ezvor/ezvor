// Shared types for the job-search pipeline (server + JobCard).

export type JobSource =
  | "Greenhouse"
  | "Lever"
  | "Ashby"
  | "Remotive"
  | "RemoteOK"
  | "Arbeitnow"
  | "Hacker News"
  | "LinkedIn"
  | "Indeed"
  | "Glassdoor"
  | "YC"
  | "Remote"
  | "Web";

export type WorkModeValue = "Remote" | "Onsite" | "Hybrid" | "Unspecified";

export interface JobResult {
  title: string;
  company: string;
  location: string;
  source: JobSource;
  workMode: WorkModeValue;
  url: string;
  description: string;
  /** Human "posted" label, e.g. "2 days ago". */
  postedText?: string;
  /** ISO timestamp when the source reports one. */
  postedAt?: string;
  salary?: string;
  /** 0-100: how sure we are this is a relevant, open posting. */
  confidence?: number;
  /** True when the posting came straight from a job API / the company's own board. */
  direct?: boolean;
}

export type Timeframe = "Any time" | "Past 24 hours" | "Past 3 days" | "Past week" | "Past month";
export type WorkModeFilter = "Any" | "Remote" | "Onsite" | "Hybrid";

export interface JobSearchArgs {
  query: string;
  timeframe: Timeframe;
  workMode: WorkModeFilter;
  location: string;
  sources?: string[];
}

/** A normalised posting from a structured feed, before query matching. */
export interface FeedJob {
  source: JobSource;
  title: string;
  company: string;
  location: string;
  /** Extra location strings (secondary offices, country). Used only for matching. */
  locations?: string[];
  /** Number of additional offices beyond `location` (display only). */
  moreLocations?: number;
  workMode: WorkModeValue;
  url: string;
  description: string;
  /** Epoch ms, when known. */
  postedAt?: number;
  salary?: string;
  tags?: string[];
  /** Hacker News posts: the "Company | Role | Location" header line. */
  header?: string;
}
