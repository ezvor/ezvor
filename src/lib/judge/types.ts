import type { LangKey } from "./languages";

/** Result of executing one program once. */
export type RunResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
  compileOutput: string;
  output: string;
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  error: string | null;
  timeMs: number | null;
  memoryKb: number | null;
  /** Which engine executed the code (browser, wandbox, paiza, ...). */
  engine?: string;
};

export type CaseStatus = "ok" | "re" | "tle" | "skipped";

/** Raw per-test execution record parsed out of a batch run. */
export type CaseRun = {
  index: number;
  status: CaseStatus;
  stdout: string;
  stderr: string;
  timeMs: number | null;
  memoryKb: number | null;
};

export type BatchRunResult = {
  compileError: string | null;
  cases: CaseRun[];
  engine: string;
  /** Infrastructure failure (runner down, network, ...). Not the user's fault. */
  error: string | null;
};

export type Verdict =
  | "Accepted"
  | "Wrong Answer"
  | "Time Limit Exceeded"
  | "Runtime Error"
  | "Compile Error"
  | "Judge Error";

export type TestCaseResult = {
  index: number;
  passed: boolean;
  input: string;
  expected: string;
  got: string;
  stderr: string;
  hidden: boolean;
  status: CaseStatus;
  error: string | null;
  timedOut: boolean;
  timeMs: number | null;
};

export type SubmitResult = {
  verdict: Verdict;
  allPassed: boolean;
  passedCount: number;
  total: number;
  compileError: string | null;
  cases: TestCaseResult[];
  runtimeMs: number | null;
  memoryKb: number | null;
  engine: string;
  /** True when tests came from the server's trusted problem set, not the client. */
  verified: boolean;
  /** True when the result was recorded to the signed-in user's account. */
  recorded?: boolean;
  judgeError?: string | null;
};

export type JudgeTest = { input: string; expected: string; hidden?: boolean };

export type RunRequest = {
  language: LangKey;
  source: string;
  stdin?: string;
  timeoutMs?: number;
};
