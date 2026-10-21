import type { Metadata } from "next";
import { getPublicBooking, getPublicServices, getPublicStudio } from "@/server/public-data";
import { Container, SectionHeading } from "@/components/site/section";
import { ButtonLink } from "@/components/ui/button";
import { Paragraphs } from "@/components/ui/feedback";
import { formatCents } from "@/lib/money";

export const metadata: Metadata = {
  title: "Serviços",
  description: "Tipos de atendimento, duração das sessões e políticas do estúdio.",
  alternates: { canonical: "/servicos" },
};

function duration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h} h` : "", m ? `${m} min` : ""].filter(Boolean).join(" ");
}

export default async function ServicesPage() {
  const [services, booking, studio] = await Promise.all([getPublicServices(), getPublicBooking(), getPublicStudio()]);
  return (
    <Container className="py-16 md:py-24">
      <SectionHeading as="h1" eyebrow="Serviços" title={<>Atendimento <em className="text-bone-dim">sob medida</em></>}>
        <p>Valores finais dependem do projeto e são informados após a avaliação, exceto quando indicado.</p>
      </SectionHeading>

      <div className="mt-16 md:ml-[25%]">
        {services.length ? (
          <ul>
            {services.map((s) => (
              <li key={s.id} className="grid gap-4 border-t border-ink-700 py-8 last:border-b sm:grid-cols-[1fr_auto]">
                <div>
                  <h2 className="display text-4xl">{s.name}</h2>
                  {s.description ? <Paragraphs text={s.description} className="mt-3 max-w-xl leading-relaxed text-mute" /> : null}
                  <p className="mt-4 text-sm text-faint">Duração aproximada: {duration(s.durationMinutes)}</p>
                </div>
                <div className="flex flex-col items-start gap-3 sm:items-end">
                  <p className="text-lg text-bone tabular-nums">
                    {s.priceType === "fixed" && s.priceCents != null
                      ? formatCents(s.priceCents)
                      : s.priceType === "from" && s.priceCents != null
                        ? `a partir de ${formatCents(s.priceCents)}`
                        : "Sob avaliação"}
                  </p>
                  {booking.onlineBookingEnabled && s.bookableOnline ? (
                    <ButtonLink href={`/agendar?servico=${s.slug}`} size="sm" variant="secondary">
                      Agendar
                    </ButtonLink>
                  ) : (
                    <ButtonLink href="/orcamento" size="sm" variant="secondary">
                      Solicitar orçamento
                    </ButtonLink>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-mute">Os serviços serão publicados em breve. Envie sua ideia pelo formulário de orçamento.</p>
        )}

        {studio.depositPolicy || studio.cancellationPolicyText ? (
          <div className="mt-20 grid gap-10 sm:grid-cols-2">
            {studio.depositPolicy ? (
              <section>
                <h2 className="eyebrow mb-4">Sinal e reserva</h2>
                <Paragraphs text={studio.depositPolicy} className="leading-relaxed text-bone-dim" />
              </section>
            ) : null}
            {studio.cancellationPolicyText ? (
              <section>
                <h2 className="eyebrow mb-4">Cancelamento e reagendamento</h2>
                <Paragraphs text={studio.cancellationPolicyText} className="leading-relaxed text-bone-dim" />
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </Container>
  );
}
