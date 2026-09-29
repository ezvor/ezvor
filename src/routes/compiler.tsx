import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OnMount } from "@monaco-editor/react";
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
  Link2,
  Cpu,
  Globe,
  Code2,
  Keyboard,
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
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-mobile";
import { preload, runProgram } from "@/lib/judge/client";
import { LANG_KEYS, LANGUAGE_INFO, isLangKey, type LangKey } from "@/lib/judge/languages";
import type { RunResult } from "@/lib/judge/types";

const LANG_COUNT = LANG_KEYS.length;

export const Route = createFileRoute("/compiler")({
  head: () => ({
    meta: [
      { title: "Online Compiler: Write, Compile & Run Code Free — Ezvor" },
      {
        name: "description",
        content: `A free online compiler and IDE for ${LANG_COUNT} languages: Python, JavaScript, TypeScript, C++, C, Java, Go, Rust, C#, Kotlin, Ruby, Swift and PHP. Add input, run instantly and share your code with a link.`,
      },
      { property: "og:title", content: "Online Compiler & IDE — Ezvor" },
      {
        property: "og:description",
        content: `Write, compile and run code in ${LANG_COUNT} languages, then share it with a link. Free, no sign-up.`,
      },
    ],
  }),
  component: CompilerPage,
});

/* ------------------------------------------------------------ templates */

// Every template reads one line of stdin so the Input panel is useful from the start.
const TEMPLATES: Record<LangKey, string> = {
  python: `import sys

name = sys.stdin.readline().strip() or "World"
print(f"Hello, {name}!")
`,
  javascript: `const input = require("fs").readFileSync(0, "utf8").trim();
const name = input.split("\\n")[0] || "World";
console.log(\`Hello, \${name}!\`);
`,
  typescript: `const input: string = require("fs").readFileSync(0, "utf8").trim();
const name: string = input.split("\\n")[0] || "World";
console.log(\`Hello, \${name}!\`);
`,
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    string name;
    if (!getline(cin, name) || name.empty()) name = "World";
    cout << "Hello, " << name << "!" << endl;
    return 0;
}
`,
  c: `#include <stdio.h>
#include <string.h>

int main(void) {
    char name[256] = "World";
    if (fgets(name, sizeof name, stdin)) {
        name[strcspn(name, "\\r\\n")] = '\\0';
        if (name[0] == '\\0') strcpy(name, "World");
    }
    printf("Hello, %s!\\n", name);
    return 0;
}
`,
  java: `import java.io.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        String name = in.readLine();
        if (name == null || name.isBlank()) name = "World";
        System.out.println("Hello, " + name.trim() + "!");
    }
}
`,
  go: `package main

import (
\t"bufio"
\t"fmt"
\t"os"
\t"strings"
)

func main() {
\treader := bufio.NewReader(os.Stdin)
\tname, _ := reader.ReadString('\\n')
\tname = strings.TrimSpace(name)
\tif name == "" {
\t\tname = "World"
\t}
\tfmt.Printf("Hello, %s!\\n", name)
}
`,
  rust: `use std::io::{self, BufRead};

fn main() {
    let mut name = String::new();
    io::stdin().lock().read_line(&mut name).ok();
    let name = match name.trim() {
        "" => "World",
        n => n,
    };
    println!("Hello, {}!", name);
}
`,
  csharp: `using System;

public class Program
{
    public static void Main()
    {
        string? name = Console.ReadLine()?.Trim();
        if (string.IsNullOrEmpty(name)) name = "World";
        Console.WriteLine($"Hello, {name}!");
    }
}
`,
  kotlin: `fun main() {
    val name = readLine()?.trim().orEmpty().ifEmpty { "World" }
    println("Hello, $name!")
}
`,
  ruby: `name = ($stdin.gets || "").strip
name = "World" if name.empty?
puts "Hello, #{name}!"
`,
  swift: `let line = readLine() ?? ""
let trimmed = line.trimmingCharacters(in: .whitespaces)
let name = trimmed.isEmpty ? "World" : trimmed
print("Hello, \\(name)!")
`,
  php: `<?php
$name = trim((string) fgets(STDIN));
if ($name === "") $name = "World";
echo "Hello, {$name}!\\n";
`,
};

/* --------------------------------------------------------- persistence */

const STORAGE_PREFIX = "ezvor.compiler.";

function load(key: string): string | null {
  try {
    return localStorage.getItem(STORAGE_PREFIX + key);
  } catch {
    return null;
  }
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, value);
  } catch {
    /* storage full or blocked */
  }
}

/* -------------------------------------------------------- share links */

type SharePayload = { lang: LangKey; code: string; stdin: string };

function toB64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, transform: CompressionStream | DecompressionStream) {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** `z…` = deflate-raw + base64url; `p…` = plain base64url (browsers without CompressionStream). */
async function encodeShare(p: SharePayload): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify({ l: p.lang, c: p.code, i: p.stdin }));
  if (typeof CompressionStream !== "undefined") {
    return `z${toB64url(await pipe(bytes, new CompressionStream("deflate-raw")))}`;
  }
  return `p${toB64url(bytes)}`;
}

async function decodeShare(token: string): Promise<SharePayload | null> {
  try {
    const kind = token[0];
    let bytes = fromB64url(token.slice(1));
    if (kind === "z") bytes = await pipe(bytes, new DecompressionStream("deflate-raw"));
    else if (kind !== "p") return null;
    const obj = JSON.parse(new TextDecoder().decode(bytes)) as {
      l?: unknown;
      c?: unknown;
      i?: unknown;
    };
    if (!isLangKey(obj.l) || typeof obj.c !== "string") return null;
    return {
      lang: obj.l,
      code: obj.c.slice(0, 64_000),
      stdin: typeof obj.i === "string" ? obj.i.slice(0, 64_000) : "",
    };
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------- page */

// Protocol markers the in-browser JS runtime interleaves with program output.
const MARKERS = /@@EZ:[0-9a-f]+:(?:B:\d+\n?|E:\d+(?::\w+:[\d.]+:\d+)?\n?|C\n?)/g;

type Live = { out: string; err: string };
type MobileTab = "code" | "input" | "output";

function CompilerPage() {
  const mobile = useMediaQuery("(max-width: 767px)");
  const stacked = useMediaQuery("(max-width: 1023px)");
  const [langKey, setLangKey] = useState<LangKey>("python");
  const [code, setCode] = useState<Record<LangKey, string>>(() => ({ ...TEMPLATES }));
  const [stdin, setStdin] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [live, setLive] = useState<Live>({ out: "", err: "" });
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [tab, setTab] = useState<MobileTab>("code");
  const outputRef = useRef<HTMLDivElement>(null);

  const info = LANGUAGE_INFO[langKey];
  const inBrowser = info.browser;

  // Restore saved code, then apply a shared link (#s=…) if present.
  useEffect(() => {
    const next = { ...TEMPLATES };
    for (const k of LANG_KEYS) {
      const saved = load(k);
      if (saved != null) next[k] = saved;
    }
    setCode(next);
    const savedLang = load("lang");
    if (isLangKey(savedLang)) setLangKey(savedLang);
    const savedStdin = load("stdin");
    if (savedStdin != null) setStdin(savedStdin);

    const applyHash = () => {
      const token = /[#&]s=([A-Za-z0-9_-]+)/.exec(window.location.hash)?.[1];
      if (!token) return;
      void decodeShare(token).then((shared) => {
        if (!shared) {
          toast.error("That share link looks broken or incomplete.");
          return;
        }
        setLangKey(shared.lang);
        setCode((prev) => ({ ...prev, [shared.lang]: shared.code }));
        setStdin(shared.stdin);
        setResult(null);
        // Don't overwrite the visitor's saved code until they edit it.
        history.replaceState(null, "", window.location.pathname + window.location.search);
        toast.success(`Loaded shared ${LANGUAGE_INFO[shared.lang].label} snippet`);
      });
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  // Warm up the in-browser runtime (Pyodide downloads once) for instant runs.
  useEffect(() => {
    void preload(langKey).catch(() => undefined);
  }, [langKey]);

  const currentCode = code[langKey];

  const setCurrentCode = useCallback(
    (val: string) => {
      setCode((prev) => ({ ...prev, [langKey]: val }));
      save(langKey, val);
    },
    [langKey],
  );

  const handleLangChange = (key: LangKey) => {
    setLangKey(key);
    setResult(null);
    setLive({ out: "", err: "" });
    save("lang", key);
  };

  const handleStdin = (val: string) => {
    setStdin(val);
    save("stdin", val);
  };

  const handleRun = useCallback(async () => {
    if (running) return;
    if (!currentCode.trim()) {
      toast.error("Write some code first.");
      return;
    }
    setRunning(true);
    setResult(null);
    setLive({ out: "", err: "" });
    if (mobile) setTab("output");
    try {
      const res = await runProgram({
        language: langKey,
        source: currentCode,
        stdin,
        onChunk: ({ stream, text }) =>
          setLive((prev) =>
            stream === "out"
              ? { ...prev, out: (prev.out + text).slice(-200_000) }
              : { ...prev, err: (prev.err + text).slice(-50_000) },
          ),
      });
      setResult(res);
      requestAnimationFrame(() => outputRef.current?.scrollTo({ top: 0 }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Execution failed.";
      setResult({
        ok: false,
        stdout: "",
        stderr: "",
        compileOutput: "",
        output: "",
        exitCode: null,
        signal: null,
        timedOut: false,
        error: msg,
        timeMs: null,
        memoryKb: null,
      });
    } finally {
      setRunning(false);
    }
  }, [currentCode, langKey, stdin, running, mobile]);

  // Ctrl/Cmd + Enter anywhere on the page (the editor registers its own binding below).
  const runRef = useRef(handleRun);
  runRef.current = handleRun;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        void runRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onEditorMount = useCallback<OnMount>((editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => void runRef.current());
  }, []);

  const flash = (what: "code" | "link") => {
    setCopied(what);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleReset = () => {
    setCurrentCode(TEMPLATES[langKey]);
    toast.success("Reset to the starter template.");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentCode);
      flash("code");
    } catch {
      toast.error("Couldn't access the clipboard.");
    }
  };

  const handleShare = async () => {
    try {
      const token = await encodeShare({ lang: langKey, code: currentCode, stdin });
      const url = `${window.location.origin}${window.location.pathname}#s=${token}`;
      if (url.length > 32_000) {
        toast.error("This program is too large to fit in a link. Download the file instead.");
        return;
      }
      await navigator.clipboard.writeText(url);
      flash("link");
      toast.success("Share link copied — code and input are stored in the link itself.");
    } catch {
      toast.error("Couldn't create a share link in this browser.");
    }
  };

  const handleDownload = () => {
    const blob = new Blob([currentCode], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = info.fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const editorPanel = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border/40 bg-card/20 px-4 py-1.5 text-xs text-muted-foreground">
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-mono">{info.fileName}</span>
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
            language={info.monaco}
            value={currentCode}
            onChange={setCurrentCode}
            onMount={onEditorMount}
          />
        </ClientOnly>
      </div>
    </div>
  );

  const inputPanel = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border/40 bg-card/20 px-4 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">Input (stdin)</span>
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
        placeholder="Text your program reads from standard input (input(), cin, Scanner, readLine…). Try typing your name."
        spellCheck={false}
        className="min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent font-mono text-sm focus-visible:ring-0"
      />
    </div>
  );

  const outputPanel = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border/40 bg-card/20 px-4 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">Output</span>
        {result && !result.error && (
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            {result.timeMs != null && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {result.timeMs} ms
              </span>
            )}
            {result.memoryKb != null && result.memoryKb > 0 && (
              <span className="flex items-center gap-1">
                <MemoryStick className="h-3 w-3" />
                {formatMem(result.memoryKb)}
              </span>
            )}
            {result.engine && (
              <span className="hidden sm:inline">{engineLabel(result.engine)}</span>
            )}
          </div>
        )}
      </div>
      <div
        ref={outputRef}
        className="min-h-0 flex-1 overflow-auto bg-[#0b0e14] p-4 font-mono text-sm"
        aria-live="polite"
      >
        <OutputView running={running} result={result} live={live} inBrowser={inBrowser} />
      </div>
    </div>
  );

  const runButton = (
    <Button
      onClick={() => void handleRun()}
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
  );

  const iconButton = (label: string, onClick: () => void, icon: React.ReactNode) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={onClick}
          aria-label={label}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-[calc(100dvh-3.5rem)] flex-col bg-background">
        {/* Top bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-card/40 px-3 py-2 sm:px-4">
          <div className="hidden items-center gap-2 pr-2 sm:flex">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
              <Terminal className="h-4 w-4 text-primary-foreground" />
            </span>
            <div className="leading-tight">
              <h1 className="text-sm font-semibold">Compiler</h1>
              <p className="text-[11px] text-muted-foreground">
                Write, run &amp; share — {LANG_COUNT} languages
              </p>
            </div>
          </div>

          <Select value={langKey} onValueChange={(v) => isLangKey(v) && handleLangChange(v)}>
            <SelectTrigger className="h-9 w-[150px] sm:w-[168px]" aria-label="Language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANG_KEYS.map((k) => (
                <SelectItem key={k} value={k}>
                  {LANGUAGE_INFO[k].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "hidden items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] md:inline-flex",
                  inBrowser
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-border/60 bg-muted/30 text-muted-foreground",
                )}
              >
                {inBrowser ? <Cpu className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                {inBrowser ? "Runs in your browser" : "Runs on free cloud compilers"}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              {inBrowser
                ? "Executes instantly on your device in a sandboxed Web Worker — no server round-trip, no limits."
                : "Compiled and run on free public sandboxes (Wandbox / Paiza). Takes a few seconds; limited to about 90 runs per 10 minutes."}
            </TooltipContent>
          </Tooltip>

          <div className="flex items-center gap-0.5">
            {iconButton(
              copied === "link" ? "Link copied" : "Copy share link",
              () => void handleShare(),
              copied === "link" ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : (
                <Link2 className="h-4 w-4" />
              ),
            )}
            {iconButton(
              "Copy code",
              () => void handleCopy(),
              copied === "code" ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : (
                <Copy className="h-4 w-4" />
              ),
            )}
            {iconButton(
              `Download ${info.fileName}`,
              handleDownload,
              <Download className="h-4 w-4" />,
            )}
            {iconButton("Reset to template", handleReset, <RotateCcw className="h-4 w-4" />)}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-1 text-[11px] text-muted-foreground lg:flex">
              <Keyboard className="h-3 w-3" /> Ctrl/⌘ + Enter
            </span>
            {runButton}
          </div>
        </div>

        {/* Workspace */}
        {mobile ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex border-b border-border/60 bg-card/30" role="tablist">
              {(
                [
                  ["code", "Code", <Code2 key="c" className="h-3.5 w-3.5" />],
                  ["input", "Input", <Keyboard key="i" className="h-3.5 w-3.5" />],
                  ["output", "Output", <Terminal key="o" className="h-3.5 w-3.5" />],
                ] as const
              ).map(([id, label, icon]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2 text-xs font-medium transition-colors",
                    tab === id
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {icon}
                  {label}
                  {id === "output" && running && <Loader2 className="h-3 w-3 animate-spin" />}
                  {id === "input" && stdin && (
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                </button>
              ))}
            </div>
            {/* Panels stay mounted so the editor keeps its state between tabs. */}
            <div className={cn("min-h-0 flex-1", tab !== "code" && "hidden")}>{editorPanel}</div>
            <div className={cn("min-h-0 flex-1", tab !== "input" && "hidden")}>{inputPanel}</div>
            <div className={cn("min-h-0 flex-1", tab !== "output" && "hidden")}>{outputPanel}</div>
          </div>
        ) : (
          <div className="min-h-0 flex-1">
            <ResizablePanelGroup orientation={stacked ? "vertical" : "horizontal"}>
              <ResizablePanel defaultSize={stacked ? 55 : 58} minSize={20}>
                {editorPanel}
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={stacked ? 45 : 42} minSize={20}>
                <ResizablePanelGroup orientation={stacked ? "horizontal" : "vertical"}>
                  <ResizablePanel defaultSize={stacked ? 40 : 32} minSize={12}>
                    {inputPanel}
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                  <ResizablePanel defaultSize={stacked ? 60 : 68} minSize={20}>
                    {outputPanel}
                  </ResizablePanel>
                </ResizablePanelGroup>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

/* -------------------------------------------------------------- output */

function OutputView({
  running,
  result,
  live,
  inBrowser,
}: {
  running: boolean;
  result: RunResult | null;
  live: Live;
  inBrowser: boolean;
}) {
  if (running) {
    const out = live.out.replace(MARKERS, "");
    const err = live.err.replace(MARKERS, "");
    return (
      <div className="space-y-3">
        {out && <pre className="whitespace-pre-wrap break-words text-emerald-300">{out}</pre>}
        {err && <pre className="whitespace-pre-wrap break-words text-amber-300">{err}</pre>}
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {inBrowser ? "Running in your browser…" : "Compiling & running on a cloud sandbox…"}
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="space-y-1 text-muted-foreground/70">
        <p>
          Press <span className="text-foreground">Run</span> (or Ctrl/⌘ + Enter) to execute your
          code. Output shows here.
        </p>
        <p className="text-xs">
          Tip: type a name into Input first — every starter template reads one line of stdin.
        </p>
      </div>
    );
  }

  if (result.error) {
    return (
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-destructive">
          Couldn't run
        </p>
        <pre className="whitespace-pre-wrap break-words text-destructive">{result.error}</pre>
      </div>
    );
  }

  if (result.compileOutput) {
    return (
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-destructive">
          Compilation error
        </p>
        <pre className="whitespace-pre-wrap break-words text-destructive">
          {result.compileOutput}
        </pre>
      </div>
    );
  }

  const empty = !result.stdout && !result.stderr;
  const failed =
    result.timedOut || (result.exitCode != null && result.exitCode !== 0) || !!result.signal;

  return (
    <div className="space-y-3">
      {result.stdout && (
        <pre className="whitespace-pre-wrap break-words text-emerald-300">{result.stdout}</pre>
      )}
      {result.stderr && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-400">
            stderr
          </p>
          <pre className="whitespace-pre-wrap break-words text-amber-300">{result.stderr}</pre>
        </div>
      )}
      {empty && !failed && (
        <p className="text-muted-foreground/70">Program finished with no output.</p>
      )}
      <p
        className={cn(
          "border-t border-border/30 pt-2 text-[11px]",
          failed ? "text-amber-400" : "text-muted-foreground",
        )}
      >
        {result.timedOut
          ? "⏱ Time limit exceeded — the program was stopped."
          : result.signal
            ? `Terminated by signal ${result.signal}`
            : result.exitCode != null
              ? `Exited with code ${result.exitCode}`
              : "Finished"}
        {result.timeMs != null && ` · ${result.timeMs} ms`}
        {result.engine && ` · ${engineLabel(result.engine)}`}
      </p>
    </div>
  );
}

function engineLabel(engine: string): string {
  if (engine === "browser") return "ran in your browser";
  return `via ${engine.charAt(0).toUpperCase()}${engine.slice(1)}`;
}

function formatMem(kb: number): string {
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${kb} KB`;
}
