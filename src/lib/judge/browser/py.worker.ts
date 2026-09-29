/// <reference lib="webworker" />
// Python 3 in the browser via Pyodide (CPython compiled to WebAssembly).
// The runtime is fetched once from jsDelivr and then served from the HTTP cache.

declare const self: DedicatedWorkerGlobalScope;

export const PYODIDE_VERSION = "314.0.7";
const INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

type Job = { id: number; source: string; stdin: string } | { id: number; warmup: true };

type Pyodide = {
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdin: (opts: { stdin: () => string | null; isatty?: boolean }) => void;
  setStdout: (opts: { write: (buf: Uint8Array) => number }) => void;
  setStderr: (opts: { write: (buf: Uint8Array) => number }) => void;
};

let runtime: Promise<Pyodide> | null = null;

function load(): Promise<Pyodide> {
  if (!runtime) {
    runtime = (async () => {
      const mod = (await import(/* @vite-ignore */ `${INDEX_URL}pyodide.mjs`)) as {
        loadPyodide: (o: { indexURL: string }) => Promise<Pyodide>;
      };
      return mod.loadPyodide({ indexURL: INDEX_URL });
    })();
    runtime.catch(() => {
      runtime = null;
    });
  }
  return runtime;
}

self.onmessage = async (e: MessageEvent<Job>) => {
  const job = e.data;
  let py: Pyodide;
  try {
    py = await load();
  } catch (ex) {
    self.postMessage({
      id: job.id,
      type: "fatal",
      error: `Couldn't load the Python runtime (${ex instanceof Error ? ex.message : "network error"}).`,
    });
    return;
  }
  if ("warmup" in job) {
    self.postMessage({ id: job.id, type: "done" });
    return;
  }

  const outDec = new TextDecoder();
  const errDec = new TextDecoder();
  let fed = false;
  py.setStdin({
    stdin: () => {
      if (fed) return null;
      fed = true;
      return job.stdin;
    },
    isatty: false,
  });
  py.setStdout({
    write: (buf) => {
      self.postMessage({ id: job.id, type: "chunk", stream: "out", text: outDec.decode(buf, { stream: true }) });
      return buf.length;
    },
  });
  py.setStderr({
    write: (buf) => {
      self.postMessage({ id: job.id, type: "chunk", stream: "err", text: errDec.decode(buf, { stream: true }) });
      return buf.length;
    },
  });

  self.postMessage({ id: job.id, type: "started" });
  try {
    // Fresh namespace per job; our wrapper frame is hidden from tracebacks.
    const code = await py.runPythonAsync(`
import sys as _s, traceback as _t
_rc = 0
try:
    exec(compile(${JSON.stringify(job.source)}, "main.py", "exec"), {"__name__": "__main__"})
except SystemExit as _e:
    _rc = _e.code if isinstance(_e.code, int) else 0
except BaseException:
    _et, _ev, _tb = _s.exc_info()
    _t.print_exception(_et, _ev, _tb.tb_next if _tb else None, file=_s.stderr)
    _rc = 1
_s.stdout.flush()
_s.stderr.flush()
_rc
`);
    self.postMessage({ id: job.id, type: "exit", code: typeof code === "number" ? code : 0 });
  } catch (ex) {
    const msg = ex instanceof Error ? ex.message : String(ex);
    self.postMessage({ id: job.id, type: "chunk", stream: "err", text: `${msg}\n` });
    self.postMessage({ id: job.id, type: "exit", code: 1 });
  }
  self.postMessage({ id: job.id, type: "done" });
};
