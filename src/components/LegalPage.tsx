import type { ReactNode } from "react";

import { PageHeader } from "@/components/PageHeader";

export const LEGAL_UPDATED = "October 1, 2026";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="pb-16">
      <PageHeader eyebrow={`Last updated ${LEGAL_UPDATED}`} title={title} />
      <article className="mx-auto w-full max-w-3xl space-y-8 px-5 py-10 text-sm leading-relaxed text-foreground/90 sm:px-8 [&_a]:text-primary-glow [&_a:hover]:underline [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-2 [&_ul]:mt-2 [&_ul]:space-y-1">
        {children}
      </article>
    </div>
  );
}
