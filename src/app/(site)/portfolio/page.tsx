import type { Metadata } from "next";
import { getPublicPortfolio, getPublicStudio } from "@/server/public-data";
import { Gallery } from "@/components/site/gallery";
import { Container, SectionHeading } from "@/components/site/section";
import { ButtonLink } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const studio = await getPublicStudio();
  return {
    title: "Portfólio",
    description: `Trabalhos de tatuagem de ${studio.name}.`,
    alternates: { canonical: "/portfolio" },
  };
}

export default async function PortfolioPage() {
  const { items, categories } = await getPublicPortfolio();
  return (
    <Container className="py-16 md:py-24">
      <SectionHeading as="h1" eyebrow="Portfólio" title={<>Trabalhos <em className="text-bone-dim">na pele</em></>}>
        {items.length ? <p>Selecione um trabalho para ampliar. Filtre por estilo para encontrar referências próximas da sua ideia.</p> : null}
      </SectionHeading>
      <div className="mt-16">
        {items.length ? (
          <Gallery items={items} categories={categories} />
        ) : (
          <div className="grid gap-8 border-y border-ink-700 py-16 md:grid-cols-12">
            <p className="display text-4xl text-bone-dim md:col-span-6">Nenhum trabalho publicado ainda.</p>
            <div className="md:col-span-5 md:col-start-8">
              <p className="text-mute">O portfólio será publicado em breve. Você já pode enviar sua ideia para avaliação.</p>
              <ButtonLink href="/orcamento" variant="secondary" className="mt-6">
                Solicitar orçamento
              </ButtonLink>
            </div>
          </div>
        )}
      </div>
    </Container>
  );
}
