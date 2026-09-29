import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { optionalSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CompanyIntel } from "./company.server";

export type { CompanyIntel, IntelResource, IntelFocusArea } from "./company.server";

/**
 * Public (no auth) company + role intelligence. Grounds on a web search and
 * the company's Wikipedia summary, then distills a compact hiring brief.
 */
export const getCompanyIntel = createServerFn({ method: "POST" })
  .middleware([optionalSupabaseAuth])
  .validator((input) =>
    z
      .object({
        company: z.string().trim().min(2).max(80),
        role: z.string().trim().min(2).max(80),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<CompanyIntel> => {
    const [{ enforceRateLimit }, { buildCompanyIntel }] = await Promise.all([
      import("./rate-limit.server"),
      import("./company.server"),
    ]);
    enforceRateLimit("search", { userId: context.userId as string | null });
    return buildCompanyIntel(data.company, data.role);
  });
