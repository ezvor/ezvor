// Session-scoped, in-memory caches keyed by problem slug. Once a problem's
// statement / harness / editorial has been fetched during this browser
// session, re-opening it is instant. The durable cache lives on the server.

import type { EditorialData } from "@/lib/editorial.functions";
import type { HarnessData } from "@/lib/harness.functions";
import type { LeetProblem } from "@/lib/leetcode.functions";

export const statementCache = new Map<string, LeetProblem>();
export const harnessCache = new Map<string, HarnessData>();
export const editorialCache = new Map<string, EditorialData>();
