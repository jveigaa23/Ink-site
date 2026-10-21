import type { ReactNode } from "react";

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-10 ${className}`}>{children}</div>;
}

/** Cabeçalho editorial de página/seção: numeração, rótulo e título em serifa. */
export function SectionHeading({
  index,
  eyebrow,
  title,
  children,
  as: Tag = "h2",
}: {
  index?: string;
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
  as?: "h1" | "h2";
}) {
  return (
    <div className="grid gap-6 md:grid-cols-12">
      <div className="md:col-span-3">
        <p className="eyebrow flex items-center gap-3">
          {index ? <span className="text-faint tabular-nums">{index}</span> : null}
          <span aria-hidden="true" className="h-px w-8 bg-ink-600" />
          {eyebrow}
        </p>
      </div>
      <div className="md:col-span-9">
        <Tag className="display text-5xl text-bone sm:text-6xl lg:text-7xl">{title}</Tag>
        {children ? <div className="mt-6 max-w-2xl text-lg leading-relaxed text-mute">{children}</div> : null}
      </div>
    </div>
  );
}
