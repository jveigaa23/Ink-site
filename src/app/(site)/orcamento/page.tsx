import type { Metadata } from "next";
import { getPublicPortfolio, getPublicStudio } from "@/server/public-data";
import { Container, SectionHeading } from "@/components/site/section";
import { QuoteForm } from "@/components/forms/quote-form";
import { privateStorageAvailable } from "@/server/env";

export const metadata: Metadata = {
  title: "Solicitar orçamento",
  description: "Envie sua ideia de tatuagem para avaliação do estúdio.",
  alternates: { canonical: "/orcamento" },
};

export default async function QuotePage() {
  const [studio, portfolio] = await Promise.all([getPublicStudio(), getPublicPortfolio()]);
  const styles = Array.from(new Set([...studio.specialties, ...portfolio.categories.map((c) => c.name)]));
  return (
    <Container className="py-16 md:py-24">
      <SectionHeading as="h1" eyebrow="Orçamento" title={<>Conte sua <em className="text-bone-dim">ideia</em></>}>
        <p>Quanto mais detalhes, melhor a avaliação. O retorno acontece pelo contato que você informar.</p>
      </SectionHeading>
      <div className="mt-16 md:ml-[25%] md:max-w-3xl">
        <QuoteForm styles={styles} referencesEnabled={privateStorageAvailable()} />
      </div>
    </Container>
  );
}
