import type { ReactNode } from "react";

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-bone sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-mute">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({ title, children, actions, className = "" }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-sm border border-ink-700 bg-ink-900 ${className}`}>
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-ink-700 px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold text-bone">{title}</h2>
          {actions}
        </div>
      ) : null}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, href }: { label: string; value: ReactNode; hint?: ReactNode; href?: string }) {
  const inner = (
    <>
      <p className="text-xs font-medium uppercase tracking-wider text-mute">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-bone">{value}</p>
      {hint ? <p className="mt-1 text-xs text-faint">{hint}</p> : null}
    </>
  );
  return href ? (
    <a href={href} className="block rounded-sm border border-ink-700 bg-ink-900 p-4 transition-colors hover:border-ink-600">
      {inner}
    </a>
  ) : (
    <div className="rounded-sm border border-ink-700 bg-ink-900 p-4">{inner}</div>
  );
}
