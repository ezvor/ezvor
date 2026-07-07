import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { fetchLeetProblem, type LeetProblem } from "./leetcode.server";

export type { LeetProblem };

/**
 * Fetch a full LeetCode problem statement + starter code by slug.
 *
 * Statements never change, so we cache them per-slug in `problem_statements`.
 * The FIRST time any user opens a given problem we hit LeetCode and store the
 * result; every subsequent open (for that user or anyone else) is served from
 * our own database in a single fast read — no external round-trip. This is the
 * key to LeetCode-like instant loads for the ~4k catalog problems.
 */
export const getLeetProblem = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z.object({ slug: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data }): Promise<LeetProblem> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Serve from cache when we already have this statement.
    const { data: cached } = await supabaseAdmin
      .from("problem_statements")
      .select("data")
      .eq("slug", data.slug)
      .maybeSingle();
    if (cached?.data) return cached.data as unknown as LeetProblem;

    // 2) Cache miss — fetch the live statement from LeetCode.
    const problem = await fetchLeetProblem(data.slug);

    // 3) Cache it (best-effort; a failed write must not fail the request).
    await supabaseAdmin
      .from("problem_statements")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert({ slug: data.slug, data: problem as any }, { onConflict: "slug" })
      .then(
        () => undefined,
        () => undefined,
      );

    return problem;
  });
