import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { LeetProblem } from "./leetcode.server";

export type { LeetProblem };

/**
 * Full problem statement + official starter code by slug.
 * Served from the shared cache after the first fetch from LeetCode.
 */
export const getLeetProblem = createServerFn({ method: "GET" })
  .validator((input) =>
    z
      .object({
        slug: z
          .string()
          .trim()
          .min(1)
          .max(120)
          .regex(/^[a-z0-9-]+$/),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<LeetProblem> => {
    const { getStatement } = await import("./problem-source.server");
    return getStatement(data.slug);
  });
