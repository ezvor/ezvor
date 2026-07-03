// Client-callable server functions for problem editorials + worked solutions.
// Generates on-demand via AI and caches per-slug in `problem_solutions`.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { generateEditorial, type EditorialData } from "./editorial.server";

export type { EditorialData };

export const getProblemEditorial = createServerFn({ method: "POST" })
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
        refresh: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<EditorialData> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Serve from cache unless a refresh was explicitly requested.
    if (!data.refresh) {
      const { data: cached } = await supabaseAdmin
        .from("problem_solutions")
        .select("data")
        .eq("slug", data.slug)
        .maybeSingle();
      if (cached?.data) return cached.data as EditorialData;
    }

    // 2) Generate fresh.
    const editorial = await generateEditorial({
      slug: data.slug,
      title: data.title,
      difficulty: data.difficulty,
      statement: data.statement,
    });

    // 3) Cache (best-effort).
    await supabaseAdmin
      .from("problem_solutions")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert({ slug: data.slug, data: editorial as any }, { onConflict: "slug" });

    return editorial;
  });
