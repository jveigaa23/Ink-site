import type { Metadata } from "next";
import { getPublicBooking, getPublicHours, getPublicServices } from "@/server/public-data";
import { Container, SectionHeading } from "@/components/site/section";
import { BookingWizard } from "@/components/booking/booking-wizard";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Agendar sessão",
  description: "Escolha o atendimento, a data e um horário disponível na agenda do estúdio.",
  alternates: { canonical: "/agendar" },
};

export default async function BookingPage() {
  const [booking, services, hours] = await Promise.all([getPublicBooking(), getPublicServices(), getPublicHours()]);
  const bookable = services.filter((s) => s.bookableOnline);
  const available = booking.onlineBookingEnabled && bookable.length > 0 && hours.length > 0;

  return (
    <Container className="py-16 md:py-24">
      <SectionHeading as="h1" eyebrow="Agendamento" title={<>Reserve seu <em className="text-bone-dim">horário</em></>}>
        <p>
          Os horários exibidos são os realmente livres na agenda. Para projetos novos ou grandes, recomendamos{" "}
          <a href="/orcamento" className="text-bone underline underline-offset-4">
            solicitar um orçamento
          </a>{" "}
          antes.
        </p>
      </SectionHeading>
      <div className="mt-16 md:ml-[25%] md:max-w-4xl">
        {available ? (
          <BookingWizard
            services={bookable.map((s) => ({ id: s.id, slug: s.slug, name: s.name, description: s.description, durationMinutes: s.durationMinutes }))}
            config={{
              timezone: booking.timezone,
              maxAdvanceDays: booking.maxAdvanceDays,
              openWeekdays: Array.from(new Set(hours.map((h) => h.weekday))),
            }}
            holdMinutes={booking.holdMinutes}
            autoConfirm={booking.autoConfirm}
            depositRequired={booking.depositRequired}
          />
        ) : (
          <div className="space-y-6 border-y border-ink-700 py-12">
            <p className="display text-4xl text-bone-dim">O agendamento online está indisponível no momento.</p>
            <p className="text-mute">Envie sua ideia pelo formulário de orçamento e o estúdio retornará com as opções de data.</p>
            <ButtonLink href="/orcamento">Solicitar orçamento</ButtonLink>
          </div>
        )}
      </div>
    </Container>
  );
}
