import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, children }: PageHeaderProps) {
  return (
    <div className="relative overflow-hidden border-b border-border/60 bg-gradient-hero">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        {eyebrow && (
          <span className="mb-3 inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary-glow">
            {eyebrow}
          </span>
        )}
        <h1 className="max-w-3xl text-3xl font-bold leading-tight sm:text-4xl">{title}</h1>
        {description && (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {description}
          </p>
        )}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </div>
  );
}
