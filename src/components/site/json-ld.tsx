import { getPublicHours, getPublicStudio } from "@/server/public-data";
import { hasAddress, instagramUrl } from "@/lib/contact";
import { minutesToHHMM } from "@/lib/time";
import { env } from "@/server/env";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Dados estruturados (schema.org/TattooParlor) gerados SOMENTE a partir de informações
 * cadastradas. Campos vazios são omitidos — nada de avaliações ou endereço fictício.
 */
export async function JsonLd() {
  const [studio, hours] = await Promise.all([getPublicStudio(), getPublicHours()]);
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "TattooParlor",
    name: studio.name,
    url: env.appUrl,
    description: studio.seoDescription,
  };
  if (studio.heroImage) data.image = studio.heroImage.url;
  if (studio.contact.phoneDisplay) data.telephone = studio.contact.phoneDisplay;
  if (studio.contact.email) data.email = studio.contact.email;
  const sameAs = [instagramUrl(studio.contact.instagram), ...studio.contact.otherLinks.map((l) => l.url)].filter(Boolean);
  if (sameAs.length) data.sameAs = sameAs;
  if (hasAddress(studio.address)) {
    data.address = {
      "@type": "PostalAddress",
      streetAddress: [studio.address.line1, studio.address.line2].filter(Boolean).join(", "),
      addressLocality: studio.address.city,
      addressRegion: studio.address.state || undefined,
      postalCode: studio.address.postalCode || undefined,
      addressCountry: "BR",
    };
  }
  if (hours.length) {
    data.openingHoursSpecification = hours.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: DAYS[h.weekday],
      opens: minutesToHHMM(h.startMinute),
      closes: minutesToHHMM(Math.min(h.endMinute, 1439)),
    }));
  }
  // Escapa "<" para impedir fechamento prematuro da tag <script>.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
