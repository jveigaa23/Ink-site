import Link from "next/link";
import { getPublicHours, getPublicStudio } from "@/server/public-data";
import { formatAddress, hasAddress, hoursByDay, instagramUrl, whatsappUrl } from "@/lib/contact";
import { NAV } from "./nav-config";

export async function SiteFooter() {
  const [studio, hours] = await Promise.all([getPublicStudio(), getPublicHours()]);
  const c = studio.contact;
  const days = hoursByDay(hours).filter((d) => d.intervals.length);
  const channels = [
    c.instagram && { label: `Instagram @${c.instagram}`, href: instagramUrl(c.instagram) },
    c.whatsapp && { label: `WhatsApp${c.phoneDisplay ? ` ${c.phoneDisplay}` : ""}`, href: whatsappUrl(c.whatsapp) },
    c.email && { label: c.email, href: `mailto:${c.email}` },
    ...c.otherLinks.filter((l) => l.url).map((l) => ({ label: l.label, href: l.url })),
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <footer className="border-t border-ink-700 bg-ink-950">
      <div className="mx-auto grid max-w-[1400px] gap-12 px-4 py-16 sm:px-6 md:grid-cols-12 lg:px-10">
        <div className="md:col-span-5">
          <p className="display text-5xl text-bone sm:text-6xl">{studio.name}</p>
          {studio.tagline ? <p className="mt-3 text-mute">{studio.tagline}</p> : null}
        </div>

        <div className="md:col-span-2">
          <h2 className="eyebrow mb-4">Navegação</h2>
          <ul className="space-y-2 text-sm">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="text-bone-dim hover:text-bone">
                  {n.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/acompanhar" className="text-bone-dim hover:text-bone">
                Acompanhar solicitação
              </Link>
            </li>
          </ul>
        </div>

        <div className="md:col-span-3">
          <h2 className="eyebrow mb-4">Contato</h2>
          {channels.length ? (
            <ul className="space-y-2 text-sm">
              {channels.map((ch) => (
                <li key={ch.href}>
                  <a href={ch.href} className="text-bone-dim hover:text-bone" rel="noopener noreferrer" target={ch.href.startsWith("http") ? "_blank" : undefined}>
                    {ch.label}
                    {ch.href.startsWith("http") ? <span className="sr-only"> (abre em nova aba)</span> : null}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-faint">Use o formulário de orçamento para falar com o estúdio.</p>
          )}
          {hasAddress(studio.address) ? (
            <address className="mt-6 text-sm not-italic text-bone-dim">
              {formatAddress(studio.address).map((l) => (
                <span key={l} className="block">
                  {l}
                </span>
              ))}
            </address>
          ) : null}
        </div>

        <div className="md:col-span-2">
          <h2 className="eyebrow mb-4">Atendimento</h2>
          {days.length ? (
            <dl className="space-y-1 text-sm">
              {days.map((d) => (
                <div key={d.weekday} className="flex justify-between gap-3">
                  <dt className="text-mute">{d.label.slice(0, 3)}</dt>
                  <dd className="text-bone-dim tabular-nums">{d.intervals.join(", ")}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-faint">Horários sob agendamento.</p>
          )}
          {studio.hoursNote ? <p className="mt-3 text-xs text-faint">{studio.hoursNote}</p> : null}
        </div>
      </div>
      <div className="border-t border-ink-700/60">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-4 py-6 text-xs text-faint sm:flex-row sm:justify-between sm:px-6 lg:px-10">
          <p>© {studio.name}</p>
          <Link href="/privacidade" className="hover:text-bone">
            Aviso de privacidade
          </Link>
        </div>
      </div>
    </footer>
  );
}
