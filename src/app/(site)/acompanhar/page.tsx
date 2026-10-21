import type { Metadata } from "next";
import { Container, SectionHeading } from "@/components/site/section";
import { LookupForm } from "@/components/forms/lookup-form";

export const metadata: Metadata = { title: "Acompanhar solicitação", robots: { index: false, follow: true } };

export default function LookupPage() {
  return (
    <Container className="py-16 md:py-24">
      <SectionHeading as="h1" eyebrow="Acompanhar" title={<>Status da <em className="text-bone-dim">solicitação</em></>}>
        <p>Informe o protocolo e o e-mail ou telefone usado no pedido.</p>
      </SectionHeading>
      <div className="mt-14 md:ml-[25%] md:max-w-2xl">
        <LookupForm />
      </div>
    </Container>
  );
}
