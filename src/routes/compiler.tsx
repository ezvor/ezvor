import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Loader2,
  RotateCcw,
  Copy,
  Check,
  Download,
  Terminal,
  Clock,
  MemoryStick,
  Trash2,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

import { CodeEditor } from "@/components/CodeEditor";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { LangKey } from "@/lib/judge.server";
import { executeCode } from "@/lib/judge.functions";
import type { RunResult } from "@/lib/judge.server";

export const Route = createFileRoute("/compiler")({
  head: () => ({
    meta: [
      { title: "Code Compiler — Write, Compile & Run Online | Ezvor" },
      {
        name: "description",
        content:
          "A powerful free online compiler for C++, Python, Java, JavaScript, C, Go, Rust & TypeScript. Write code, add input, compile and run instantly with accurate output.",
      },
      { property: "og:title", content: "Code Compiler — Online IDE | Ezvor" },
      {
        property: "og:description",
        content:
          "Write, compile and run code in 8 languages right in your browser. Fast, accurate, and free.",
      },
    ],
  }),
  component: CompilerPage,
});

type Lang = {
  key: LangKey;
  label: string;
  monaco: string;
  ext: string;
  starter: string;
};

const LANGS: Lang[] = [
  {
    key: "cpp",
    label: "C++",
    monaco: "cpp",
    ext: "cpp",
    starter: `#include <iostream>
using namespace std;

int main() {
    cout << "Hello Salman";
    return 0;
}
`,
  },
  {
    key: "c",
    label: "C",
    monaco: "c",
    ext: "c",
    starter: `#include <stdio.h>

int main() {
    printf("Hello Salman");
    return 0;
}
`,
  },
  {
    key: "python",
    label: "Python 3",
    monaco: "python",
    ext: "py",
    starter: `print("Hello Salman")
`,
  },
  {
    key: "java",
    label: "Java",
    monaco: "java",
    ext: "java",
    starter: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello Salman");
    }
}
`,
  },
  {
    key: "javascript",
    label: "JavaScript (Node)",
    monaco: "javascript",
    ext: "js",
    starter: `console.log("Hello Salman");
`,
  },
  {
    key: "typescript",
    label: "TypeScript",
    monaco: "typescript",
    ext: "ts",
    starter: `const name: string = "Salman";
console.log(\`Hello \${name}\`);
`,
  },
  {
    key: "go",
    label: "Go",
    monaco: "go",
    ext: "go",
    starter: `package main

import "fmt"

func main() {
    fmt.Println("Hello Salman")
}
`,
  },
  {
    key: "rust",
    label: "Rust",
    monaco: "rust",
    ext: "rs",
    starter: `fn main() {
    println!("Hello Salman");
}
`,
  },
];

const STORAGE_PREFIX = "ezvor.compiler.";

function CompilerPage() {
  const [langKey, setLangKey] = useState<LangKey>("cpp");
  const [code, setCode] = useState<Record<LangKey, string>>(() => {
    const initial = {} as Record<LangKey, string>;
    for (const l of LANGS) initial[l.key] = l.starter;
    return initial;
  });
  const [stdin, setStdin] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [copied, setCopied] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  const lang = useMemo(() => LANGS.find((l) => l.key === langKey)!, [langKey]);
  const runFn = useServerFn(executeCode);

  // Restore saved code on mount (client only).
  useEffect(() => {
    setCode((prev) => {
      const next = { ...prev };
      for (const l of LANGS) {
        const saved = localStorage.getItem(STORAGE_PREFIX + l.key);
        if (saved != null) next[l.key] = saved;
      }
      return next;
    });
    const savedLang = localStorage.getItem(STORAGE_PREFIX + "lang");
    if (savedLang && LANGS.some((l) => l.key === savedLang)) {
      setLangKey(savedLang as LangKey);
    }
    const savedStdin = localStorage.getItem(STORAGE_PREFIX + "stdin");
    if (savedStdin != null) setStdin(savedStdin);
  }, []);

  const currentCode = code[langKey];

  const setCurrentCode = useCallback(
    (val: string) => {
      setCode((prev) => ({ ...prev, [langKey]: val }));
      localStorage.setItem(STORAGE_PREFIX + langKey, val);
    },
    [langKey],
  );

  const handleLangChange = (key: LangKey) => {
    setLangKey(key);
    localStorage.setItem(STORAGE_PREFIX + "lang", key);
  };

  const handleStdin = (val: string) => {
    setStdin(val);
    localStorage.setItem(STORAGE_PREFIX + "stdin", val);
  };

  const handleRun = useCallback(async () => {
    if (!currentCode.trim()) {
      toast.error("Write some code first.");
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      const res = await runFn({
        data: { language: langKey, source: currentCode, stdin },
      });
      setResult(res);
      requestAnimationFrame(() => {
        outputRef.current?.scrollTo({ top: 0 });
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Execution failed.");
    } finally {
      setRunning(false);
    }
  }, [currentCode, langKey, stdin, runFn]);

  // Ctrl/Cmd + Enter to run.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleRun();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleRun]);

  const handleReset = () => {
    setCurrentCode(lang.starter);
    toast.success("Reset to starter template.");
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = () => {
    const blob = new Blob([currentCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `main.${lang.ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-[calc(100dvh-3.5rem)] flex-col bg-background">
        {/* Top bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-card/40 px-4 py-2.5">
          <div className="flex items-center gap-2 pr-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
              <Terminal className="h-4 w-4 text-primary-foreground" />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Code Compiler</p>
              <p className="text-[11px] text-muted-foreground">
                Write, compile &amp; run — 8 languages
              </p>
            </div>
          </div>

          <Select value={langKey} onValueChange={(v) => handleLangChange(v as LangKey)}>
            <SelectTrigger className="h-9 w-[168px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGS.map((l) => (
                <SelectItem key={l.key} value={l.key}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleCopy}>
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy code</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleDownload}>
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download file</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleReset}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reset to template</TooltipContent>
            </Tooltip>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-[11px] text-muted-foreground sm:inline">
              Ctrl/⌘ + Enter
            </span>
            <Button
              onClick={handleRun}
              disabled={running}
              className="h-9 gap-1.5 bg-gradient-primary shadow-glow"
            >
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4 fill-current" />
              )}
              {running ? "Running…" : "Run"}
            </Button>
          </div>
        </div>

        {/* Editor + output */}
        <div className="min-h-0 flex-1">
          <ResizablePanelGroup orientation="horizontal">
            <ResizablePanel defaultSize={58} minSize={30}>
              <div className="flex h-full flex-col">
                <div className="flex items-center gap-2 border-b border-border/40 bg-card/20 px-4 py-1.5 text-xs text-muted-foreground">
                  <ChevronRight className="h-3.5 w-3.5" />
                  <span className="font-mono">main.{lang.ext}</span>
                </div>
                <div className="min-h-0 flex-1">
                  <ClientOnly
                    fallback={
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </div>
                    }
                  >
                    <CodeEditor
                      language={lang.monaco}
                      value={currentCode}
                      onChange={setCurrentCode}
                    />
                  </ClientOnly>
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize={42} minSize={24}>
              <ResizablePanelGroup orientation="vertical">
                {/* Input */}
                <ResizablePanel defaultSize={35} minSize={12}>
                  <div className="flex h-full flex-col">
                    <div className="flex items-center justify-between border-b border-border/40 bg-card/20 px-4 py-1.5">
                      <span className="text-xs font-medium text-muted-foreground">
                        Input
                      </span>
                      {stdin && (
                        <button
                          onClick={() => handleStdin("")}
                          className="text-muted-foreground transition-colors hover:text-destructive"
                          aria-label="Clear input"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <Textarea
                      value={stdin}
                      onChange={(e) => handleStdin(e.target.value)}
                      placeholder="Type input here before running (e.g. values your program reads with cin / input() / scanf)…"
                      className="min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent font-mono text-sm focus-visible:ring-0"
                    />
                  </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Output */}
                <ResizablePanel defaultSize={65} minSize={20}>
                  <div className="flex h-full flex-col">
                    <div className="flex items-center justify-between border-b border-border/40 bg-card/20 px-4 py-1.5">
                      <span className="text-xs font-medium text-muted-foreground">Output</span>
                      {result && (
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                          {result.timeMs != null && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {result.timeMs} ms
                            </span>
                          )}
                          {result.memoryKb != null && (
                            <span className="flex items-center gap-1">
                              <MemoryStick className="h-3 w-3" />
                              {formatMem(result.memoryKb)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div
                      ref={outputRef}
                      className="min-h-0 flex-1 overflow-auto bg-[#0b0e14] p-4 font-mono text-sm"
                    >
                      <OutputView running={running} result={result} />
                    </div>
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </TooltipProvider>
  );
}

function OutputView({
  running,
  result,
}: {
  running: boolean;
  result: RunResult | null;
}) {
  if (running) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Compiling &amp; running…
      </div>
    );
  }

  if (!result) {
    return (
      <div className="text-muted-foreground/70">
        Press <span className="text-foreground">Run</span> to compile your code. Output shows
        here.
      </div>
    );
  }

  if (result.error) {
    return <pre className="whitespace-pre-wrap text-destructive">{result.error}</pre>;
  }

  if (result.compileOutput) {
    return (
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-destructive">
          Compilation error
        </p>
        <pre className="whitespace-pre-wrap text-destructive">{result.compileOutput}</pre>
      </div>
    );
  }

  const empty = !result.stdout && !result.stderr;

  return (
    <div className="space-y-3">
      {result.stdout && (
        <pre className="whitespace-pre-wrap text-emerald-300">{result.stdout}</pre>
      )}
      {result.stderr && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-400">
            stderr
          </p>
          <pre className="whitespace-pre-wrap text-amber-300">{result.stderr}</pre>
        </div>
      )}
      {empty && (
        <p className="text-muted-foreground/70">
          Program finished with no output
          {result.exitCode != null ? ` (exit code ${result.exitCode})` : ""}.
        </p>
      )}
      {!empty && (
        <p className="text-[11px] text-muted-foreground">
          {result.timedOut
            ? "⏱ Timed out"
            : result.exitCode != null
              ? `Exited with code ${result.exitCode}`
              : "Finished"}
        </p>
      )}
    </div>
  );
}

function formatMem(kb: number): string {
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${kb} KB`;
}
