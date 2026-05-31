// Server-only helpers that talk to a code-execution engine (Piston).
// Piston is a free, sandboxed, multi-language code runner.
// Docs: https://github.com/engineer-man/piston

const PISTON_BASE = "https://emkc.org/api/v2/piston";

export type LangKey = "python" | "javascript" | "typescript" | "cpp" | "c" | "java" | "go" | "rust";

type Runtime = { language: string; version: string; aliases: string[] };

// Map our editor language keys to the Piston language identifier + a source filename.
const LANG_CONFIG: Record<
  LangKey,
  { piston: string; aliases: string[]; filename: string }
> = {
  python: { piston: "python", aliases: ["py", "python3"], filename: "main.py" },
  javascript: { piston: "javascript", aliases: ["js", "node-javascript"], filename: "main.js" },
  typescript: { piston: "typescript", aliases: ["ts"], filename: "main.ts" },
  cpp: { piston: "c++", aliases: ["cpp", "g++"], filename: "main.cpp" },
  c: { piston: "c", aliases: ["gcc"], filename: "main.c" },
  java: { piston: "java", aliases: [], filename: "Main.java" },
  go: { piston: "go", aliases: ["golang"], filename: "main.go" },
  rust: { piston: "rust", aliases: ["rs"], filename: "main.rs" },
};

let runtimeCache: { at: number; runtimes: Runtime[] } | null = null;

async function getRuntimes(): Promise<Runtime[]> {
  // Cache for 10 minutes — runtime versions rarely change.
  if (runtimeCache && Date.now() - runtimeCache.at < 10 * 60 * 1000) {
    return runtimeCache.runtimes;
  }
  const res = await fetch(`${PISTON_BASE}/runtimes`);
  if (!res.ok) throw new Error(`Failed to load runtimes (${res.status})`);
  const runtimes = (await res.json()) as Runtime[];
  runtimeCache = { at: Date.now(), runtimes };
  return runtimes;
}

function pickVersion(runtimes: Runtime[], lang: LangKey): { language: string; version: string } {
  const cfg = LANG_CONFIG[lang];
  const candidates = runtimes.filter(
    (r) =>
      r.language === cfg.piston ||
      cfg.aliases.includes(r.language) ||
      r.aliases.some((a) => a === cfg.piston || cfg.aliases.includes(a)),
  );
  if (candidates.length === 0) {
    throw new Error(`Language "${lang}" is not available on the runner.`);
  }
  // Prefer the highest semver version.
  candidates.sort((a, b) => compareSemver(b.version, a.version));
  return { language: candidates[0].language, version: candidates[0].version };
}

function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

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
};

export async function runCode(opts: {
  language: LangKey;
  source: string;
  stdin?: string;
  runTimeoutMs?: number;
}): Promise<RunResult> {
  const empty: RunResult = {
    ok: false,
    stdout: "",
    stderr: "",
    compileOutput: "",
    output: "",
    exitCode: null,
    signal: null,
    timedOut: false,
    error: null,
  };

  try {
    const cfg = LANG_CONFIG[opts.language];
    if (!cfg) return { ...empty, error: `Unsupported language: ${opts.language}` };

    const runtimes = await getRuntimes();
    const { language, version } = pickVersion(runtimes, opts.language);

    const res = await fetch(`${PISTON_BASE}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language,
        version,
        files: [{ name: cfg.filename, content: opts.source }],
        stdin: opts.stdin ?? "",
        compile_timeout: 10000,
        run_timeout: opts.runTimeoutMs ?? 8000,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ...empty, error: `Runner error (${res.status}): ${text.slice(0, 300)}` };
    }

    const data = (await res.json()) as {
      compile?: { stdout: string; stderr: string; output: string; code: number | null; signal: string | null };
      run?: { stdout: string; stderr: string; output: string; code: number | null; signal: string | null };
    };

    const run = data.run ?? { stdout: "", stderr: "", output: "", code: null, signal: null };
    const compile = data.compile;
    const compileOutput = compile?.stderr || compile?.output || "";
    const timedOut = run.signal === "SIGKILL";

    return {
      ok: (run.code === 0 || run.code === null) && !timedOut && !compileOutput,
      stdout: run.stdout ?? "",
      stderr: run.stderr ?? "",
      compileOutput,
      output: run.output ?? "",
      exitCode: run.code,
      signal: run.signal,
      timedOut,
      error: null,
    };
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : "Unknown execution error" };
  }
}

export function normalizeOutput(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/g, ""))
    .join("\n")
    .replace(/\n+$/g, "")
    .trim();
}
