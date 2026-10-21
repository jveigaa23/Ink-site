import type { Metadata } from "next";
import { getPublicStudio } from "@/server/public-data";
import { Container, SectionHeading } from "@/components/site/section";
import { Paragraphs } from "@/components/ui/feedback";

export const metadata: Metadata = {
  title: "Cuidados com a tatuagem",
  description: "Orientações do estúdio para antes e depois da sessão.",
  alternates: { canonical: "/cuidados" },
};

export default async function AftercarePage() {
  const studio = await getPublicStudio();
  return (
    <Container className="py-16 md:py-24">
      <SectionHeading as="h1" eyebrow="Cuidados" title={<>Antes e <em className="text-bone-dim">depois</em></>} />
      <div className="mt-14 md:ml-[25%] md:max-w-2xl">
        {studio.aftercare ? (
          <Paragraphs text={studio.aftercare} className="text-lg leading-relaxed text-bone-dim" />
        ) : (
          <p className="text-mute">As orientações de cuidados serão publicadas em breve. Em caso de dúvida, fale com o estúdio.</p>
        )}
        <p className="mt-12 border-t border-ink-700 pt-6 text-sm text-faint">
          Estas orientações não substituem avaliação médica. Em caso de reação incomum, procure um profissional de saúde.
        </p>
      </div>
    </Container>
  );
}
