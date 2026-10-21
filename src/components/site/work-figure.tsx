import Image from "next/image";
import Link from "next/link";
import type { PublicWork } from "@/server/public-data";

export function DemoTag() {
  return (
    <span className="absolute left-3 top-3 z-10 bg-ink-950/85 px-2 py-1 text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-warning">
      Imagem demonstrativa
    </span>
  );
}

/** Trabalho do portfólio com proporção real da imagem e legenda editorial. */
export function WorkFigure({
  work,
  sizes,
  priority = false,
  className = "",
  aspect,
}: {
  work: PublicWork;
  sizes: string;
  priority?: boolean;
  className?: string;
  aspect?: string;
}) {
  return (
    <figure className={`group ${className}`}>
      <Link href={`/portfolio/${work.slug}`} className="relative block overflow-hidden bg-ink-850">
        {work.isDemo ? <DemoTag /> : null}
        <div className="relative w-full" style={{ aspectRatio: aspect ?? `${work.width} / ${work.height}` }}>
          <Image
            src={work.imageUrl}
            alt={work.altText}
            fill
            sizes={sizes}
            priority={priority}
            placeholder={work.blurDataUrl ? "blur" : "empty"}
            blurDataURL={work.blurDataUrl ?? undefined}
            className="object-cover transition-transform duration-[1.2s] ease-(--ease-ink) group-hover:scale-[1.03]"
          />
        </div>
      </Link>
      <figcaption className="mt-3 flex items-baseline justify-between gap-4 text-sm">
        <span className="text-bone">{work.title}</span>
        {work.category ? <span className="eyebrow">{work.category.name}</span> : null}
      </figcaption>
    </figure>
  );
}
