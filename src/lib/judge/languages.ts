// Language registry shared by the browser and the server.

export type LangKey =
  | "python"
  | "javascript"
  | "typescript"
  | "cpp"
  | "c"
  | "java"
  | "go"
  | "rust"
  | "csharp"
  | "kotlin"
  | "ruby"
  | "swift"
  | "php";

export const LANG_KEYS = [
  "python",
  "javascript",
  "typescript",
  "cpp",
  "c",
  "java",
  "go",
  "rust",
  "csharp",
  "kotlin",
  "ruby",
  "swift",
  "php",
] as const satisfies readonly LangKey[];

export type LanguageInfo = {
  key: LangKey;
  label: string;
  monaco: string;
  /** Runs fully in the browser (Web Worker) — instant, offline, unlimited. */
  browser: boolean;
  /** Supported by the arena's hidden-harness judge. */
  judge: boolean;
  fileName: string;
};

export const LANGUAGE_INFO: Record<LangKey, LanguageInfo> = {
  python: { key: "python", label: "Python 3", monaco: "python", browser: true, judge: true, fileName: "main.py" },
  javascript: { key: "javascript", label: "JavaScript", monaco: "javascript", browser: true, judge: true, fileName: "main.js" },
  typescript: { key: "typescript", label: "TypeScript", monaco: "typescript", browser: true, judge: false, fileName: "main.ts" },
  cpp: { key: "cpp", label: "C++ 17", monaco: "cpp", browser: false, judge: true, fileName: "main.cpp" },
  c: { key: "c", label: "C", monaco: "c", browser: false, judge: false, fileName: "main.c" },
  java: { key: "java", label: "Java", monaco: "java", browser: false, judge: true, fileName: "Main.java" },
  go: { key: "go", label: "Go", monaco: "go", browser: false, judge: false, fileName: "main.go" },
  rust: { key: "rust", label: "Rust", monaco: "rust", browser: false, judge: false, fileName: "main.rs" },
  csharp: { key: "csharp", label: "C#", monaco: "csharp", browser: false, judge: false, fileName: "Main.cs" },
  kotlin: { key: "kotlin", label: "Kotlin", monaco: "kotlin", browser: false, judge: false, fileName: "Main.kt" },
  ruby: { key: "ruby", label: "Ruby", monaco: "ruby", browser: false, judge: false, fileName: "main.rb" },
  swift: { key: "swift", label: "Swift", monaco: "swift", browser: false, judge: false, fileName: "main.swift" },
  php: { key: "php", label: "PHP", monaco: "php", browser: false, judge: false, fileName: "main.php" },
};

/** Languages offered in the problem arena (they have hidden harnesses). */
export const JUDGE_LANGS = ["python", "javascript", "cpp", "java"] as const satisfies readonly LangKey[];
export type JudgeLang = (typeof JUDGE_LANGS)[number];

export function isLangKey(v: unknown): v is LangKey {
  return typeof v === "string" && (LANG_KEYS as readonly string[]).includes(v);
}
