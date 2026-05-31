// Server-only helpers that talk to a free, no-key, sandboxed code-execution
// engine (Paiza.io). It compiles + runs code in many languages with stdin.
// Flow: create a run -> poll status -> fetch details.

const PAIZA_BASE = "https://api.paiza.io/runners";
const API_KEY = "guest";

export type LangKey =
  | "python"
  | "javascript"
  | "typescript"
  | "cpp"
  | "c"
  | "java"
  | "go"
  | "rust";

// Map our editor language keys to the Paiza language identifier.
const LANG_MAP: Record<LangKey, string> = {
  python: "python3",
  javascript: "javascript",
  typescript: "typescript",
  cpp: "cpp",
  c: "c",
  java: "java",
  go: "go",
  rust: "rust",
};

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
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function emptyResult(error: string | null = null): RunResult {
  return {
    ok: false,
    stdout: "",
    stderr: "",
    compileOutput: "",
    output: "",
    exitCode: null,
    signal: null,
    timedOut: false,
    error,
    timeMs: null,
    memoryKb: null,
  };
}

export async function runCode(opts: {
  language: LangKey;
  source: string;
  stdin?: string;
  runTimeoutMs?: number;
}): Promise<RunResult> {
  const paizaLang = LANG_MAP[opts.language];
  if (!paizaLang) return emptyResult(`Unsupported language: ${opts.language}`);

  try {
    // 1) Create the run.
    const createBody = new URLSearchParams({
      source_code: opts.source,
      language: paizaLang,
      input: opts.stdin ?? "",
      api_key: API_KEY,
    });
    const createRes = await fetch(`${PAIZA_BASE}/create`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: createBody.toString(),
    });
    if (!createRes.ok) {
      const t = await createRes.text();
      return emptyResult(`Runner error (${createRes.status}): ${t.slice(0, 200)}`);
    }
    const created = (await createRes.json()) as { id?: string; error?: string };
    if (created.error || !created.id) {
      return emptyResult(created.error || "Failed to start the runner.");
    }
    const id = created.id;

    // 2) Poll for completion (compiled languages may take a few seconds).
    const deadline = Date.now() + (opts.runTimeoutMs ?? 28000);
    let status = "running";
    let wait = 350;
    while (Date.now() < deadline) {
      await sleep(wait);
      wait = Math.min(wait + 250, 1200); // gentle backoff
      const statusRes = await fetch(
        `${PAIZA_BASE}/get_status?id=${id}&api_key=${API_KEY}`,
      );
      if (!statusRes.ok) continue;
      const s = (await statusRes.json()) as { status?: string };
      status = s.status ?? "running";
      if (status === "completed") break;
    }
    if (status !== "completed") {
      return emptyResult("The runner timed out. Please try again.");
    }

    // 3) Fetch details.
    const detailsRes = await fetch(
      `${PAIZA_BASE}/get_details?id=${id}&api_key=${API_KEY}`,
    );
    if (!detailsRes.ok) {
      return emptyResult(`Runner error (${detailsRes.status}).`);
    }
    const d = (await detailsRes.json()) as {
      stdout?: string | null;
      stderr?: string | null;
      build_stderr?: string | null;
      build_result?: string | null;
      exit_code?: string | null;
      result?: string | null;
      time?: string | null;
      memory?: string | null;
    };

    const buildFailed = d.build_result && d.build_result !== "success";
    const compileOutput = buildFailed ? d.build_stderr ?? "Compilation failed." : "";
    const timedOut = d.result === "timeout";
    const exitCode = d.exit_code != null ? parseInt(d.exit_code, 10) : null;
    const timeSec = d.time != null ? parseFloat(d.time) : NaN;
    const memBytes = d.memory != null ? parseInt(d.memory, 10) : NaN;

    return {
      ok: d.result === "success" && !compileOutput && !timedOut,
      stdout: d.stdout ?? "",
      stderr: d.stderr ?? "",
      compileOutput,
      output: (d.stdout ?? "") + (d.stderr ?? ""),
      exitCode: Number.isNaN(exitCode as number) ? null : exitCode,
      signal: null,
      timedOut,
      timeMs: Number.isNaN(timeSec) ? null : Math.round(timeSec * 1000),
      memoryKb: Number.isNaN(memBytes) ? null : Math.round(memBytes / 1024),
      error: null,
    };
  } catch (e) {
    return emptyResult(e instanceof Error ? e.message : "Unknown execution error");
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
