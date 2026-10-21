import Link from "next/link";
import { getPublicBooking, getPublicStudio } from "@/server/public-data";
import { buttonClass } from "@/components/ui/button";
import { Brand } from "./brand";
import { MobileNav } from "./mobile-nav";
import { NAV } from "./nav-config";

export async function SiteHeader() {
  const [studio, booking] = await Promise.all([getPublicStudio(), getPublicBooking()]);
  return (
    <header className="sticky top-0 z-40 border-b border-ink-700/60 bg-ink-950/85 backdrop-blur-md">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:bg-bone focus:px-4 focus:py-2 focus:text-ink-950"
      >
        Pular para o conteúdo
      </a>
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-6 px-4 sm:px-6 md:h-20 lg:px-10">
        <Brand name={studio.name} logo={studio.logo} />
        <nav aria-label="Principal" className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm text-bone-dim transition-colors hover:text-bone">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href={booking.onlineBookingEnabled ? "/agendar" : "/orcamento"}
            className={buttonClass("primary", "sm", "px-4 uppercase tracking-[0.14em] sm:min-h-10")}
          >
            {booking.onlineBookingEnabled ? "Agendar" : "Orçamento"}
          </Link>
          <MobileNav bookingEnabled={booking.onlineBookingEnabled} />
        </div>
      </div>
    </header>
  );
}
