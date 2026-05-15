import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="ds-kicker">{eyebrow}</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight text-ink md:text-5xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
