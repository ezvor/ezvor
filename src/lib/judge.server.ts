// Server-only entry point for code execution (kept for existing imports).

export type { LangKey } from "./judge/languages";
export type { RunResult } from "./judge/types";
export { normalizeOutput } from "./judge/compare";

import type { LangKey } from "./judge/languages";
import { executeRemote } from "./judge/runners.server";
import type { RunResult } from "./judge/types";

export function runCode(opts: {
  language: LangKey;
  source: string;
  stdin?: string;
  runTimeoutMs?: number;
}): Promise<RunResult> {
  return executeRemote({
    language: opts.language,
    source: opts.source,
    stdin: opts.stdin,
    timeoutMs: opts.runTimeoutMs,
  });
}
