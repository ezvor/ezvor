// Output comparison used by every judge path (browser + server).
//
// 1. Exact match after whitespace normalisation (what LeetCode effectively does).
// 2. Structural match: both sides parse as JSON-like values (arrays, numbers,
//    strings, booleans, null) and are deep-equal, with a 1e-5 tolerance for
//    floats. This absorbs harmless formatting differences such as "[1, 2]" vs
//    "[1,2]" or Node's "[ 'a', 'b' ]" vs '["a","b"]'.

export function normalizeOutput(s: string): string {
  return s
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/g, ""))
    .join("\n")
    .replace(/\n+$/g, "")
    .trim();
}

const FLOAT_EPS = 1e-5;

function parseLoose(text: string): { ok: true; value: unknown } | { ok: false } {
  const t = text.trim();
  if (!t) return { ok: false };
  try {
    return { ok: true, value: JSON.parse(t) };
  } catch {
    /* fall through */
  }
  // Python / Node inspect style: single quotes, True/False/None.
  if (/^[[{('"\-\d]|^(True|False|None|true|false|null)$/.test(t)) {
    const converted = t
      .replace(/\bTrue\b/g, "true")
      .replace(/\bFalse\b/g, "false")
      .replace(/\bNone\b/g, "null")
      .replace(/^\(/, "[")
      .replace(/\)$/, "]")
      .replace(/'((?:[^'\\]|\\.)*)'/g, (_, inner: string) => JSON.stringify(inner.replace(/\\'/g, "'")));
    try {
      return { ok: true, value: JSON.parse(converted) };
    } catch {
      /* not structured */
    }
  }
  return { ok: false };
}

function numbersClose(a: number, b: number): boolean {
  if (a === b) return true;
  const diff = Math.abs(a - b);
  return diff <= FLOAT_EPS || diff <= FLOAT_EPS * Math.max(Math.abs(a), Math.abs(b));
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (typeof a === "number" && typeof b === "number") return numbersClose(a, b);
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  return ka.every((k) =>
    deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  );
}

/** Whitespace-separated tokens, compared with float tolerance for numeric tokens. */
function tokensEqual(a: string, b: string): boolean {
  const ta = a.split(/\s+/).filter(Boolean);
  const tb = b.split(/\s+/).filter(Boolean);
  if (ta.length !== tb.length || ta.length === 0) return false;
  return ta.every((x, i) => {
    if (x === tb[i]) return true;
    const nx = Number(x);
    const ny = Number(tb[i]);
    return Number.isFinite(nx) && Number.isFinite(ny) && numbersClose(nx, ny);
  });
}

export function outputsMatch(got: string, expected: string): boolean {
  const g = normalizeOutput(got);
  const e = normalizeOutput(expected);
  if (g === e) return true;

  const gLines = g.split("\n");
  const eLines = e.split("\n");
  if (gLines.length !== eLines.length) return false;

  return gLines.every((line, i) => {
    const other = eLines[i];
    if (line === other) return true;
    const pg = parseLoose(line);
    const pe = parseLoose(other);
    if (pg.ok && pe.ok) return deepEqual(pg.value, pe.value);
    return tokensEqual(line, other);
  });
}
