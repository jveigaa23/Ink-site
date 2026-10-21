"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export const ADMIN_NAV = [
  { href: "/admin", label: "Visão geral" },
  { href: "/admin/agenda", label: "Agenda" },
  { href: "/admin/orcamentos", label: "Orçamentos" },
  { href: "/admin/clientes", label: "Clientes" },
  { href: "/admin/portfolio", label: "Portfólio" },
  { href: "/admin/servicos", label: "Serviços" },
  { href: "/admin/bloqueios", label: "Bloqueios" },
  { href: "/admin/notificacoes", label: "Notificações" },
  { href: "/admin/configuracoes", label: "Configurações" },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

export function AdminNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-0.5">
      {ADMIN_NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-10 items-center rounded-sm px-3 text-sm transition-colors ${
                active ? "bg-ink-800 text-bone" : "text-mute hover:bg-ink-850 hover:text-bone"
              }`}
            >
              {active ? <span aria-hidden="true" className="mr-2.5 h-4 w-0.5 bg-accent" /> : null}
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function AdminMobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fecha o menu ao navegar
  useEffect(() => setOpen(false), [pathname]);
  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="admin-mobile-nav"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-10 items-center gap-2 rounded-sm border border-ink-600 px-3 text-sm"
      >
        {open ? "Fechar" : "Menu"}
      </button>
      {open ? (
        <nav id="admin-mobile-nav" aria-label="Painel" className="absolute inset-x-0 top-14 z-30 border-b border-ink-700 bg-ink-900 p-3 shadow-2xl">
          <AdminNavLinks onNavigate={() => setOpen(false)} />
        </nav>
      ) : null}
    </div>
  );
}
