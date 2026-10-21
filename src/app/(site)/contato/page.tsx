import type { Metadata } from "next";
import { getPublicHours, getPublicStudio } from "@/server/public-data";
import { Container, SectionHeading } from "@/components/site/section";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { formatAddress, hasAddress, hoursByDay, instagramUrl, whatsappUrl } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Contato e localização",
  description: "Canais oficiais, endereço e horários de atendimento do estúdio.",
  alternates: { canonical: "/contato" },
};

export default async function ContactPage() {
  const [studio, hours] = await Promise.all([getPublicStudio(), getPublicHours()]);
  const c = studio.contact;
  const days = hoursByDay(hours);
  const anyHours = days.some((d) => d.intervals.length);

  return (
    <Container className="py-16 md:py-24">
      <SectionHeading as="h1" eyebrow="Contato" title={<>Vamos <em className="text-bone-dim">conversar</em></>}>
        <p>Para orçamentos, use o formulário — ele chega organizado ao estúdio e você acompanha o status pelo link.</p>
      </SectionHeading>

      <div className="mt-16 grid gap-14 md:ml-[25%] md:grid-cols-2">
        <section aria-labelledby="canais">
          <h2 id="canais" className="eyebrow mb-6">
            Canais oficiais
          </h2>
          <div className="flex flex-col gap-3">
            <ButtonLink href="/orcamento">Solicitar orçamento</ButtonLink>
            {c.whatsapp ? (
              <a href={whatsappUrl(c.whatsapp)} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
                WhatsApp{c.phoneDisplay ? ` · ${c.phoneDisplay}` : ""}
                <span className="sr-only"> (abre em nova aba)</span>
              </a>
            ) : null}
            {c.instagram ? (
              <a href={instagramUrl(c.instagram)} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
                Instagram @{c.instagram}
                <span className="sr-only"> (abre em nova aba)</span>
              </a>
            ) : null}
            {c.email ? (
              <a href={`mailto:${c.email}`} className={buttonClass("ghost")}>
                {c.email}
              </a>
            ) : null}
          </div>
        </section>

        <section aria-labelledby="local">
          <h2 id="local" className="eyebrow mb-6">
            Localização e horários
          </h2>
          {hasAddress(studio.address) ? (
            <address className="not-italic leading-relaxed text-bone-dim">
              {formatAddress(studio.address).map((l) => (
                <span key={l} className="block">
                  {l}
                </span>
              ))}
              {studio.address.mapsUrl ? (
                <a href={studio.address.mapsUrl} target="_blank" rel="noopener noreferrer" className="link-underline mt-3 inline-block text-sm text-bone">
                  Abrir no mapa<span className="sr-only"> (abre em nova aba)</span>
                </a>
              ) : null}
            </address>
          ) : (
            <p className="text-mute">Endereço informado no momento do agendamento.</p>
          )}
          {anyHours ? (
            <dl className="mt-8 divide-y divide-ink-700 border-y border-ink-700 text-sm">
              {days.map((d) => (
                <div key={d.weekday} className="flex justify-between py-2.5">
                  <dt className="text-mute">{d.label}</dt>
                  <dd className="tabular-nums text-bone-dim">{d.intervals.length ? d.intervals.join(" · ") : "Fechado"}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {studio.hoursNote ? <p className="mt-3 text-sm text-faint">{studio.hoursNote}</p> : null}
        </section>
      </div>
    </Container>
  );
}
