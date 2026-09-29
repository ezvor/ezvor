// Browser-side entry point for running code. Picks the fastest engine:
//   Python / JavaScript / TypeScript → in-browser Web Worker (instant, unlimited)
//   everything else, or if the browser runtime fails → remote runners.

import { executeCode, runTests } from "../judge.functions";
import type { JudgeLang, LangKey } from "./languages";
import type { BatchRunResult, RunResult } from "./types";

const BROWSER = new Set<LangKey>(["python", "javascript", "typescript"]);

function browserCapable(lang: LangKey): boolean {
  return typeof window !== "undefined" && typeof Worker !== "undefined" && BROWSER.has(lang);
}

export function runsInBrowser(lang: LangKey): boolean {
  return browserCapable(lang);
}

/** Warm up the in-browser runtime for `lang` (downloads Pyodide once). */
export async function preload(lang: LangKey): Promise<void> {
  if (!browserCapable(lang)) return;
  const mod = await import("./browser");
  mod.preloadBrowserRuntime(lang);
}

/** Run a complete program once with stdin. */
export async function runProgram(opts: {
  language: LangKey;
  source: string;
  stdin: string;
  onChunk?: (c: { stream: "out" | "err"; text: string }) => void;
}): Promise<RunResult> {
  if (browserCapable(opts.language)) {
    const mod = await import("./browser");
    const res = await mod.browserExecute({ ...opts, timeoutMs: 10_000 });
    if (!res.error) return res;
  }
  return executeCode({ data: { language: opts.language, source: opts.source, stdin: opts.stdin } });
}

/** Run the user's code inside a problem harness against the given inputs ("Run"). */
export async function runWithHarness(opts: {
  language: JudgeLang;
  harness: string;
  code: string;
  inputs: string[];
}): Promise<BatchRunResult> {
  if (browserCapable(opts.language)) {
    const mod = await import("./browser");
    const res = await mod.browserRunBatch({
      language: opts.language,
      harness: opts.harness,
      userCode: opts.code,
      inputs: opts.inputs,
    });
    if (!res.error) return res;
  }
  return runTests({
    data: { language: opts.language, harness: opts.harness, code: opts.code, inputs: opts.inputs },
  });
}
