"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PublicWork } from "@/server/public-data";
import { DemoTag } from "./work-figure";

type Category = { slug: string; name: string };

/**
 * Galeria editorial em colunas (proporções reais preservadas), filtro por estilo
 * refletido na URL (?estilo=) e visualização ampliada em <dialog> acessível.
 */
export function Gallery({ items, categories }: { items: PublicWork[]; categories: Category[] }) {
  const [filter, setFilter] = useState<string>("");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("estilo") ?? "";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza com a URL apenas na montagem
    if (categories.some((c) => c.slug === initial)) setFilter(initial);
  }, [categories]);

  const visible = useMemo(() => (filter ? items.filter((i) => i.category?.slug === filter) : items), [items, filter]);

  function applyFilter(slug: string) {
    setFilter(slug);
    const url = new URL(window.location.href);
    if (slug) url.searchParams.set("estilo", slug);
    else url.searchParams.delete("estilo");
    window.history.replaceState(null, "", url);
  }

  return (
    <>
      {categories.length > 1 ? (
        <div role="group" aria-label="Filtrar por estilo" className="-mx-4 mb-12 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
          {[{ slug: "", name: "Todos" }, ...categories].map((c) => {
            const active = filter === c.slug;
            return (
              <button
                key={c.slug || "all"}
                type="button"
                aria-pressed={active}
                onClick={() => applyFilter(c.slug)}
                className={`min-h-10 shrink-0 rounded-full border px-4 text-sm transition-colors ${
                  active ? "border-bone bg-bone text-ink-950" : "border-ink-600 text-bone-dim hover:border-bone/60 hover:text-bone"
                }`}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {visible.length} {visible.length === 1 ? "trabalho exibido" : "trabalhos exibidos"}
      </p>

      {visible.length ? (
        <ul className={`gap-6 ${visible.length < 3 ? "grid sm:grid-cols-2 lg:max-w-4xl" : "columns-1 sm:columns-2 lg:columns-3"}`}>
          {visible.map((w, i) => (
            <li key={w.id} className="mb-10 break-inside-avoid">
              <button
                type="button"
                onClick={() => setOpenIndex(i)}
                className="group relative block w-full overflow-hidden bg-ink-850 text-left"
                aria-label={`${w.isDemo ? "Imagem demonstrativa. " : ""}Ampliar: ${w.title}`}
              >
                {w.isDemo ? <DemoTag /> : null}
                <Image
                  src={w.imageUrl}
                  alt={w.altText}
                  width={w.width}
                  height={w.height}
                  sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
                  placeholder={w.blurDataUrl ? "blur" : "empty"}
                  blurDataURL={w.blurDataUrl ?? undefined}
                  className="h-auto w-full transition-transform duration-[1.2s] ease-(--ease-ink) group-hover:scale-[1.03]"
                />
              </button>
              <div className="mt-3 flex items-baseline justify-between gap-4 text-sm">
                <Link href={`/portfolio/${w.slug}`} className="text-bone hover:underline">
                  {w.title}
                </Link>
                {w.category ? <span className="eyebrow">{w.category.name}</span> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-mute">Nenhum trabalho neste estilo ainda.</p>
      )}

      <Lightbox items={visible} index={openIndex} onChange={setOpenIndex} />
    </>
  );
}

function Lightbox({
  items,
  index,
  onChange,
}: {
  items: PublicWork[];
  index: number | null;
  onChange: (i: number | null) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const current = index != null ? items[index] : null;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (current && !d.open) d.showModal();
    if (!current && d.open) d.close();
  }, [current]);

  const step = useCallback(
    (delta: number) => {
      if (index == null || !items.length) return;
      onChange((index + delta + items.length) % items.length);
    },
    [index, items.length, onChange],
  );

  return (
    <dialog
      ref={ref}
      onClose={() => onChange(null)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") step(1);
        if (e.key === "ArrowLeft") step(-1);
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onChange(null);
      }}
      aria-label={current ? `Trabalho: ${current.title}` : "Visualização ampliada"}
      className="m-auto h-dvh max-h-none w-full max-w-none bg-transparent p-0 text-bone"
    >
      {current ? (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <p className="text-sm tabular-nums text-mute">
              {index! + 1} / {items.length}
            </p>
            <button type="button" onClick={() => onChange(null)} className="inline-flex min-h-11 min-w-11 items-center justify-center" autoFocus>
              <span className="sr-only">Fechar</span>
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M2 2l16 16M18 2L2 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="relative flex-1" onClick={(e) => e.target === e.currentTarget && onChange(null)}>
            <Image src={current.imageUrl} alt={current.altText} fill sizes="100vw" className="object-contain px-2 sm:px-20" />
            {current.isDemo ? <DemoTag /> : null}
            {items.length > 1 ? (
              <>
                <button type="button" onClick={() => step(-1)} className="absolute left-2 top-1/2 inline-flex size-12 -translate-y-1/2 items-center justify-center bg-ink-950/70 sm:left-4">
                  <span className="sr-only">Anterior</span>
                  <span aria-hidden="true">←</span>
                </button>
                <button type="button" onClick={() => step(1)} className="absolute right-2 top-1/2 inline-flex size-12 -translate-y-1/2 items-center justify-center bg-ink-950/70 sm:right-4">
                  <span className="sr-only">Próximo</span>
                  <span aria-hidden="true">→</span>
                </button>
              </>
            ) : null}
          </div>
          <div className="flex flex-col gap-1 px-4 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:px-6">
            <p className="display text-2xl">{current.title}</p>
            <Link href={`/portfolio/${current.slug}`} className="text-sm text-bone-dim underline underline-offset-4 hover:text-bone">
              Página do trabalho
            </Link>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
