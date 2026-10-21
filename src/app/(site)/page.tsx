import Image from "next/image";
import Link from "next/link";
import { getPublicBooking, getPublicPortfolio, getPublicStudio } from "@/server/public-data";
import { ButtonLink } from "@/components/ui/button";
import { Paragraphs } from "@/components/ui/feedback";
import { InkDivider, InkStroke } from "@/components/site/ink";
import { Container, SectionHeading } from "@/components/site/section";
import { WorkFigure } from "@/components/site/work-figure";
import { JsonLd } from "@/components/site/json-ld";

export default async function HomePage() {
  const [studio, booking, portfolio] = await Promise.all([getPublicStudio(), getPublicBooking(), getPublicPortfolio()]);
  const featured = [...portfolio.items.filter((i) => i.featured), ...portfolio.items.filter((i) => !i.featured)].slice(0, 5);
  const primaryCta = booking.onlineBookingEnabled
    ? { href: "/agendar", label: "Agendar sessão" }
    : { href: "/orcamento", label: "Solicitar orçamento" };
  const styles = studio.specialties.length ? studio.specialties : portfolio.categories.map((c) => c.name);
  const showArtist = Boolean(studio.artistBio || studio.artistPhoto);
  // numeração editorial contínua, considerando apenas as seções exibidas
  let n = 1;
  const num = () => String(n++).padStart(2, "0");
  const idx = { work: num(), artist: showArtist ? num() : "", styles: styles.length ? num() : "", process: num() };

  return (
    <>
      <JsonLd />
      {/* ------------------------------ Hero ------------------------------ */}
      <section className="relative overflow-hidden">
        <Container className="grid min-h-[calc(100svh-4rem)] items-center gap-10 py-12 md:min-h-[calc(100svh-5rem)] md:grid-cols-12 md:py-20">
          <div className="relative z-10 md:col-span-7">
            <p className="eyebrow mb-8 flex items-center gap-3">
              <span aria-hidden="true" className="h-px w-10 bg-accent" />
              {studio.tagline}
            </p>
            <h1 className="display text-[clamp(3.4rem,11vw,9.5rem)] text-bone">
              {studio.heroTitle.split(" ").map((w, i, arr) =>
                i === arr.length - 1 ? (
                  <em key={i} className="text-bone-dim">
                    {w}
                  </em>
                ) : (
                  <span key={i}>{w} </span>
                ),
              )}
            </h1>
            <p className="mt-8 max-w-md text-lg leading-relaxed text-mute">{studio.heroSubtitle}</p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={primaryCta.href} size="lg">
                {primaryCta.label}
              </ButtonLink>
              <ButtonLink href="/portfolio" size="lg" variant="secondary">
                Ver portfólio
              </ButtonLink>
            </div>
          </div>
          <div className="relative md:col-span-5">
            {studio.heroImage ? (
              <div className="relative ml-auto aspect-[4/5] w-full max-w-md md:translate-y-10">
                <div aria-hidden="true" className="absolute -left-4 -top-4 h-full w-full border border-ink-600" />
                <Image
                  src={studio.heroImage.url}
                  alt={studio.heroImage.alt}
                  fill
                  priority
                  sizes="(min-width: 768px) 40vw, 100vw"
                  placeholder={studio.heroImage.blurDataUrl ? "blur" : "empty"}
                  blurDataURL={studio.heroImage.blurDataUrl}
                  className="object-cover"
                />
              </div>
            ) : (
              <InkStroke className="mx-auto w-full max-w-[300px] opacity-90 md:max-w-[520px]" />
            )}
          </div>
        </Container>
        <div aria-hidden="true" className="pointer-events-none absolute -right-60 top-1/4 size-[720px] bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--accent)_14%,transparent),transparent)]" />
      </section>

      {/* --------------------------- Trabalhos --------------------------- */}
      <section className="py-24 md:py-32" aria-labelledby="trabalhos">
        <Container>
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="eyebrow mb-4">{idx.work} — Portfólio</p>
              <h2 id="trabalhos" className="display text-5xl sm:text-6xl lg:text-7xl">
                Trabalhos <em className="text-bone-dim">selecionados</em>
              </h2>
            </div>
            {featured.length ? (
              <Link href="/portfolio" className="link-underline self-start text-sm text-bone-dim md:self-auto">
                Ver portfólio completo
              </Link>
            ) : null}
          </div>

          {featured.length ? (
            <div className="mt-14 grid grid-cols-1 gap-14 md:grid-cols-12 md:gap-x-8">
              {[
                { cls: "md:col-span-7", items: featured.filter((_, i) => i % 2 === 0), aspects: ["4 / 5", "4 / 3", "1 / 1"] },
                { cls: "md:col-span-4 md:col-start-9 md:pt-40", items: featured.filter((_, i) => i % 2 === 1), aspects: ["3 / 4", "4 / 5"] },
              ].map((col, c) => (
                <div key={c} className={`flex flex-col gap-14 md:gap-24 ${col.cls}`}>
                  {col.items.map((w, i) => (
                    <WorkFigure
                      key={w.id}
                      work={w}
                      aspect={col.aspects[i % col.aspects.length]}
                      priority={c === 0 && i === 0}
                      className={`reveal ${c === 0 && i === 1 ? "md:ml-[18%]" : ""}`}
                      sizes={c === 0 ? "(min-width: 768px) 58vw, 100vw" : "(min-width: 768px) 33vw, 100vw"}
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-14 grid gap-6 border-y border-ink-700 py-16 md:grid-cols-12">
              <p className="display text-4xl text-bone-dim md:col-span-6">O portfólio está sendo preparado.</p>
              <p className="text-mute md:col-span-5 md:col-start-8">
                Enquanto isso, conte sua ideia: cada projeto é avaliado individualmente antes do agendamento.
              </p>
            </div>
          )}
        </Container>
      </section>

      {/* ---------------------------- Artista ---------------------------- */}
      {showArtist ? (
        <section className="border-t border-ink-700 py-24 md:py-32" aria-labelledby="artista">
          <Container className="grid items-start gap-12 md:grid-cols-12">
            {studio.artistPhoto ? (
              <div className="relative aspect-[3/4] md:col-span-5">
                <Image
                  src={studio.artistPhoto.url}
                  alt={studio.artistPhoto.alt || studio.artistName}
                  fill
                  sizes="(min-width: 768px) 40vw, 100vw"
                  className="object-cover grayscale"
                />
              </div>
            ) : null}
            <div className={studio.artistPhoto ? "md:col-span-6 md:col-start-7" : "md:col-span-8 md:col-start-4"}>
              <p className="eyebrow mb-4">{idx.artist} — Artista</p>
              <h2 id="artista" className="display text-5xl sm:text-6xl">
                {studio.artistName || "Quem tatua"}
              </h2>
              {studio.artistBio ? (
                <Paragraphs text={studio.artistBio.split(/\n{2,}/).slice(0, 2).join("\n\n")} className="mt-8 text-lg leading-relaxed text-mute" />
              ) : null}
              <Link href="/estudio" className="link-underline mt-8 inline-block text-sm text-bone">
                Conhecer o estúdio
              </Link>
            </div>
          </Container>
        </section>
      ) : null}

      {/* ---------------------------- Estilos ---------------------------- */}
      {styles.length ? (
        <section className="border-t border-ink-700 py-24 md:py-32" aria-labelledby="estilos">
          <Container>
            <SectionHeading index={idx.styles} eyebrow="Especialidades" title={<span id="estilos">Estilos</span>} />
            <ol className="mt-14 md:ml-[25%]">
              {styles.map((s, i) => (
                <li key={s} className="reveal group flex items-baseline gap-6 border-t border-ink-700 py-6 last:border-b">
                  <span className="w-8 text-xs tabular-nums text-faint">{String(i + 1).padStart(2, "0")}</span>
                  <span className="display text-4xl text-bone-dim transition-colors duration-500 group-hover:text-bone sm:text-5xl">
                    {s}
                  </span>
                </li>
              ))}
            </ol>
          </Container>
        </section>
      ) : null}

      {/* ---------------------------- Processo --------------------------- */}
      <section className="border-t border-ink-700 bg-ink-900 py-24 md:py-32" aria-labelledby="processo">
        <Container>
          <SectionHeading index={idx.process} eyebrow="Como funciona" title={<span id="processo">Da ideia à pele</span>} />
          <div className="mt-16 grid gap-12 md:grid-cols-3 md:gap-8">
            {[
              { t: "Envie sua ideia", d: "Conte o que imagina, o local do corpo e o tamanho. Referências visuais ajudam." },
              { t: "Avaliação", d: "O estúdio analisa o projeto e retorna com orientações e a estimativa, quando aplicável." },
              { t: "Sessão", d: "Escolha um horário disponível na agenda. Você acompanha o status pelo link recebido." },
            ].map((s, i) => (
              <div key={s.t} className="reveal">
                <p className="display text-7xl text-accent/80">{i + 1}</p>
                <InkDivider className="my-6" />
                <h3 className="text-lg font-semibold text-bone">{s.t}</h3>
                <p className="mt-2 leading-relaxed text-mute">{s.d}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ------------------------------ CTA ------------------------------ */}
      <section className="py-28 md:py-40" aria-labelledby="cta">
        <Container className="text-center">
          <h2 id="cta" className="display mx-auto max-w-4xl text-[clamp(3rem,8vw,7rem)]">
            Pronto para <em className="text-bone-dim">começar?</em>
          </h2>
          <div className="mt-12 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href={primaryCta.href} size="lg">
              {primaryCta.label}
            </ButtonLink>
            {booking.onlineBookingEnabled ? (
              <ButtonLink href="/orcamento" size="lg" variant="secondary">
                Solicitar orçamento
              </ButtonLink>
            ) : null}
          </div>
        </Container>
      </section>
    </>
  );
}
