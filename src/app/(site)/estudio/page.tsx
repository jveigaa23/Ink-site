import type { Metadata } from "next";
import Image from "next/image";
import { getPublicStudio } from "@/server/public-data";
import { Container, SectionHeading } from "@/components/site/section";
import { ButtonLink } from "@/components/ui/button";
import { Paragraphs } from "@/components/ui/feedback";

export async function generateMetadata(): Promise<Metadata> {
  const studio = await getPublicStudio();
  return {
    title: "O estúdio",
    description: `Conheça ${studio.name}${studio.artistName ? ` e ${studio.artistName}` : ""}.`,
    alternates: { canonical: "/estudio" },
  };
}

export default async function StudioPage() {
  const s = await getPublicStudio();
  const hasContent = s.studioStory || s.artistBio || s.attendanceInfo || s.studioPhotos.length || s.specialties.length;

  return (
    <>
      <Container className="py-16 md:py-24">
        <SectionHeading as="h1" eyebrow="O estúdio" title={<>{s.name}</>}>
          {s.tagline ? <p>{s.tagline}</p> : null}
        </SectionHeading>
      </Container>

      {!hasContent ? (
        <Container className="pb-24">
          <p className="max-w-xl border-l-2 border-ink-600 pl-4 text-mute md:ml-[25%]">
            Em breve, a história do estúdio e de quem tatua estará aqui.
          </p>
        </Container>
      ) : null}

      {s.studioStory ? (
        <section className="border-t border-ink-700 py-20" aria-labelledby="historia">
          <Container className="grid gap-8 md:grid-cols-12">
            <h2 id="historia" className="eyebrow md:col-span-3">
              História
            </h2>
            <Paragraphs text={s.studioStory} className="text-xl leading-relaxed text-bone-dim md:col-span-7" />
          </Container>
        </section>
      ) : null}

      {s.artistBio || s.artistPhoto ? (
        <section className="border-t border-ink-700 py-20" aria-labelledby="artista">
          <Container className="grid items-start gap-10 md:grid-cols-12">
            <div className="md:col-span-3">
              <h2 id="artista" className="eyebrow">
                Artista
              </h2>
            </div>
            {s.artistPhoto ? (
              <div className="relative aspect-[3/4] md:col-span-4">
                <Image src={s.artistPhoto.url} alt={s.artistPhoto.alt || s.artistName} fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover" />
              </div>
            ) : null}
            <div className={s.artistPhoto ? "md:col-span-5" : "md:col-span-7"}>
              {s.artistName ? <p className="display text-5xl">{s.artistName}</p> : null}
              {s.artistBio ? <Paragraphs text={s.artistBio} className="mt-6 leading-relaxed text-mute" /> : null}
              {s.specialties.length ? (
                <ul className="mt-8 flex flex-wrap gap-2" aria-label="Especialidades">
                  {s.specialties.map((sp) => (
                    <li key={sp} className="rounded-full border border-ink-600 px-3 py-1 text-sm text-bone-dim">
                      {sp}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </Container>
        </section>
      ) : null}

      {s.studioPhotos.length ? (
        <section className="border-t border-ink-700 py-20" aria-labelledby="ambiente">
          <Container>
            <h2 id="ambiente" className="eyebrow mb-10">
              Ambiente
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {s.studioPhotos.map((p, i) => (
                <div key={p.key} className={`relative overflow-hidden ${i % 3 === 0 ? "aspect-[4/5]" : "aspect-square"}`}>
                  <Image src={p.url} alt={p.alt} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover" />
                </div>
              ))}
            </div>
          </Container>
        </section>
      ) : null}

      {s.attendanceInfo ? (
        <section className="border-t border-ink-700 py-20" aria-labelledby="atendimento">
          <Container className="grid gap-8 md:grid-cols-12">
            <h2 id="atendimento" className="eyebrow md:col-span-3">
              Atendimento
            </h2>
            <div className="md:col-span-7">
              <Paragraphs text={s.attendanceInfo} className="leading-relaxed text-bone-dim" />
              <ButtonLink href="/orcamento" variant="secondary" className="mt-8">
                Enviar minha ideia
              </ButtonLink>
            </div>
          </Container>
        </section>
      ) : null}
    </>
  );
}
