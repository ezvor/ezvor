// Editorial + verified multi-language solutions, generated once per problem
// and shared by everyone through the cache.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { optionalSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { EditorialData } from "./editorial.server";

export type { EditorialData };

const inflight = new Map<string, Promise<EditorialData>>();

export const getProblemEditorial = createServerFn({ method: "POST" })
  .middleware([optionalSupabaseAuth])
  .validator((input) =>
    z
      .object({
        slug: z
          .string()
          .trim()
          .min(1)
          .max(120)
          .regex(/^[a-z0-9-]+$/),
        /** Regenerate (signed-in users only). */
        refresh: z.boolean().optional(),
        /** Return the cached editorial or null — never generate. */
        cachedOnly: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<EditorialData | null> => {
    const [{ cacheGet, cacheSet }, ed, src, { enforceRateLimit }] = await Promise.all([
      import("./cache.server"),
      import("./editorial.server"),
      import("./problem-source.server"),
      import("./rate-limit.server"),
    ]);
    const refresh = !!data.refresh && !!context.userId;

    if (!refresh) {
      const cached = await cacheGet<EditorialData>("problem_solutions", data.slug);
      if (cached && (cached.version ?? 1) >= ed.EDITORIAL_VERSION) return cached;
      if (data.cachedOnly) return cached ?? null;
    }

    let job = inflight.get(data.slug);
    if (!job) {
      enforceRateLimit("generate", { userId: context.userId as string | null });
      job = (async () => {
        const ctx = await src.getProblemContext(data.slug);
        const editorial = await ed.generateEditorial(ctx);
        const judge = await src.getJudge(data.slug);
        if (judge) await ed.verifyEditorial(editorial, judge);
        await cacheSet("problem_solutions", data.slug, editorial);
        return editorial;
      })();
      inflight.set(data.slug, job);
      job.finally(() => inflight.delete(data.slug)).catch(() => undefined);
    }
    return job;
  });
