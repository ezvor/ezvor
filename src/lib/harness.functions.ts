// Returns the (verified) judge for a catalog problem, generating it on first use.
// Clients only send the slug; the server fetches the statement itself.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { optionalSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { HarnessData } from "./harness.server";

export type { HarnessData };

export type HarnessResponse =
  | { status: "ready"; harness: HarnessData }
  | { status: "unsupported"; reason: string }
  | { status: "error"; reason: string };

const inflight = new Map<string, Promise<HarnessData>>();

export const getProblemHarness = createServerFn({ method: "POST" })
  .middleware([optionalSupabaseAuth])
  .validator((input) =>
    z
      .object({
        slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/),
        /** Rebuild the judge (signed-in users only, e.g. after reporting a bad test). */
        refresh: z.boolean().optional(),
        /** Only return a cached judge; never generate. */
        cachedOnly: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<HarnessResponse> => {
    const [{ cacheGet, cacheSet }, harnessMod, { getStatement }, { enforceRateLimit, RateLimitError }] =
      await Promise.all([
        import("./cache.server"),
        import("./harness.server"),
        import("./problem-source.server"),
        import("./rate-limit.server"),
      ]);
    const { generateHarness, publicHarness, UnsupportedProblemError, HARNESS_VERSION } = harnessMod;
    const refresh = !!data.refresh && !!context.userId;

    if (!refresh) {
      const cached = await cacheGet<HarnessData>("problem_harnesses", data.slug);
      if (cached && (cached.version ?? 1) >= HARNESS_VERSION) {
        return { status: "ready", harness: publicHarness(cached) };
      }
    }
    if (data.cachedOnly) return { status: "error", reason: "not cached" };

    try {
      let job = inflight.get(data.slug);
      if (!job) {
        enforceRateLimit("generate", { userId: context.userId as string | null });
        job = (async () => {
          const problem = await getStatement(data.slug);
          const harness = await generateHarness(problem);
          // Unverified judges stay in this instance's memory only, so a later
          // generation (e.g. once the runners are back) can replace them.
          await cacheSet("problem_harnesses", data.slug, harness, { persist: !!harness.verified });
          return harness;
        })();
        inflight.set(data.slug, job);
        job.finally(() => inflight.delete(data.slug)).catch(() => undefined);
      }
      return { status: "ready", harness: publicHarness(await job) };
    } catch (e) {
      if (e instanceof UnsupportedProblemError) return { status: "unsupported", reason: e.message };
      if (e instanceof RateLimitError) return { status: "error", reason: e.message };
      console.error("[harness]", data.slug, e);
      return { status: "error", reason: "Couldn't prepare the judge for this problem right now." };
    }
  });
