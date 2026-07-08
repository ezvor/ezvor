import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { buildCompanyIntel, type CompanyIntel } from "./company.server";

export type { CompanyIntel, IntelResource, IntelFocusArea } from "./company.server";

/**
 * Public (no auth) company + role intelligence. Researches the web with
 * Firecrawl and distills a compact hiring brief with the AI gateway.
 */
export const getCompanyIntel = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        company: z.string().trim().min(2).max(80),
        role: z.string().trim().min(2).max(80),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<CompanyIntel> => {
    return buildCompanyIntel(data.company, data.role);
  });
