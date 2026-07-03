import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { fetchLeetProblem, type LeetProblem } from "./leetcode.server";

export type { LeetProblem };

/** Fetch a full LeetCode problem statement + starter code by slug. */
export const getLeetProblem = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z.object({ slug: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data }): Promise<LeetProblem> => {
    return fetchLeetProblem(data.slug);
  });
