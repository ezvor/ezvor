// Client-callable server function that returns a runnable execution harness +
// test cases for any catalog problem, so it can be run/judged in-app. Generated
// on-demand via AI and cached per-slug in `problem_harnesses`.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { generateHarness, type HarnessData } from "./harness.server";

export type { HarnessData };

export const getProblemHarness = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        slug: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .regex(/^[a-z0-9-]+$/i, "invalid slug"),
        title: z.string().min(1).max(200),
        difficulty: z.string().max(20).default("Medium"),
        statement: z.string().max(30000).default(""),
        exampleTestcases: z.string().max(10000).default(""),
        pythonSignature: z.string().max(2000).default(""),
        refresh: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<HarnessData> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!data.refresh) {
      const { data: cached } = await supabaseAdmin
        .from("problem_harnesses")
        .select("data")
        .eq("slug", data.slug)
        .maybeSingle();
      if (cached?.data) return cached.data as HarnessData;
    }

    const harness = await generateHarness({
      slug: data.slug,
      title: data.title,
      difficulty: data.difficulty,
      statement: data.statement,
      exampleTestcases: data.exampleTestcases,
      pythonSignature: data.pythonSignature,
    });

    await supabaseAdmin
      .from("problem_harnesses")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert({ slug: data.slug, data: harness as any }, { onConflict: "slug" });

    return harness;
  });
