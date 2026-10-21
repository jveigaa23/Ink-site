import type { ReactNode } from "react";

const tones = {
  info: "border-info/40 text-info",
  success: "border-success/40 text-success",
  warning: "border-warning/40 text-warning",
  danger: "border-danger/50 text-danger",
  neutral: "border-ink-600 text-bone-dim",
} as const;

export function Notice({
  tone = "neutral",
  title,
  children,
  role,
  className = "",
}: {
  tone?: keyof typeof tones;
  title?: ReactNode;
  children?: ReactNode;
  role?: "status" | "alert";
  className?: string;
}) {
  return (
    <div role={role} className={`border-l-2 bg-ink-850 px-4 py-3 text-sm ${tones[tone]} ${className}`}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={`text-bone-dim ${title ? "mt-1" : ""}`}>{children}</div> : null}
    </div>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 border border-dashed border-ink-600 px-6 py-10">
      <p className="display text-3xl text-bone">{title}</p>
      {children ? <div className="max-w-prose text-sm text-mute">{children}</div> : null}
      {action}
    </div>
  );
}

/** Texto longo editável no painel → parágrafos seguros (sem HTML). */
export function Paragraphs({ text, className = "" }: { text: string; className?: string }) {
  const parts = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className={`prose-studio ${className}`}>
      {parts.map((p, i) => (
        <p key={i} className="whitespace-pre-line">
          {p}
        </p>
      ))}
    </div>
  );
}

export function Spinner({ label = "Carregando" }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-mute">
      <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-ink-600 border-t-bone" />
      {label}
    </span>
  );
}
