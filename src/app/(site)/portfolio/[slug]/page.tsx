import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getPublicPortfolio } from "@/server/public-data";
import { Container } from "@/components/site/section";
import { DemoTag } from "@/components/site/work-figure";
import { ButtonLink } from "@/components/ui/button";
import { Paragraphs } from "@/components/ui/feedback";

type Props = { params: Promise<{ slug: string }> };

async function findWork(slug: string) {
  const { items } = await getPublicPortfolio();
  const index = items.findIndex((i) => i.slug === slug);
  return { work: index >= 0 ? items[index] : null, items, index };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { work } = await findWork(slug);
  if (!work) return { title: "Trabalho não encontrado" };
  return {
    title: work.title,
    description: work.description || work.altText,
    alternates: { canonical: `/portfolio/${work.slug}` },
    openGraph: { images: [{ url: work.imageUrl, width: work.width, height: work.height, alt: work.altText }] },
  };
}

export default function WorkPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="min-h-[70vh]" />}>
      <WorkContent params={params} />
    </Suspense>
  );
}

async function WorkContent({ params }: Props) {
  const { slug } = await params;
  const { work, items, index } = await findWork(slug);
  if (!work) notFound();
  const prev = items[(index - 1 + items.length) % items.length];
  const next = items[(index + 1) % items.length];

  return (
    <Container className="py-10 md:py-16">
      <nav aria-label="Trilha" className="eyebrow mb-10">
        <Link href="/portfolio" className="hover:text-bone">
          ← Portfólio
        </Link>
      </nav>
      <article className="grid gap-10 lg:grid-cols-12">
        <div className="relative lg:col-span-8">
          {work.isDemo ? <DemoTag /> : null}
          <Image
            src={work.imageUrl}
            alt={work.altText}
            width={work.width}
            height={work.height}
            priority
            sizes="(min-width: 1024px) 66vw, 100vw"
            placeholder={work.blurDataUrl ? "blur" : "empty"}
            blurDataURL={work.blurDataUrl ?? undefined}
            className="h-auto max-h-[85vh] w-full object-contain object-left"
          />
        </div>
        <div className="lg:col-span-4 lg:pt-4">
          {work.category ? <p className="eyebrow mb-4">{work.category.name}</p> : null}
          <h1 className="display text-5xl sm:text-6xl">{work.title}</h1>
          {work.isDemo ? (
            <p className="mt-6 border-l-2 border-warning/60 pl-3 text-sm text-warning">
              Imagem demonstrativa — não representa um trabalho real do estúdio.
            </p>
          ) : null}
          {work.description ? <Paragraphs text={work.description} className="mt-6 leading-relaxed text-mute" /> : null}
          <ButtonLink href="/orcamento" className="mt-10">
            Quero algo nesse estilo
          </ButtonLink>
          {items.length > 1 ? (
            <div className="mt-14 flex justify-between gap-4 border-t border-ink-700 pt-6 text-sm">
              <Link href={`/portfolio/${prev.slug}`} className="text-bone-dim hover:text-bone">
                ← {prev.title}
              </Link>
              <Link href={`/portfolio/${next.slug}`} className="text-right text-bone-dim hover:text-bone">
                {next.title} →
              </Link>
            </div>
          ) : null}
        </div>
      </article>
    </Container>
  );
}
