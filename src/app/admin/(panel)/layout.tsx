import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/server/auth/session";
import { AdminMobileMenu, AdminNavLinks } from "@/components/admin/admin-nav";
import { Spinner } from "@/components/ui/feedback";
import { logoutAction } from "../_actions/auth";

/**
 * Dados do painel são sempre lidos por requisição (nunca em cache): a navegação pode aguardar
 * o servidor, com o esqueleto de loading.tsx exibido enquanto isso.
 */
export const instant = false;

export const metadata: Metadata = { title: { default: "Painel", template: "%s · Painel" }, robots: { index: false, follow: false } };

/**
 * Layout do painel. A autenticação é exigida aqui E em cada página/ação (requireAdmin),
 * pois layouts não são barreira de segurança suficiente para Server Actions.
 */
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-ink-950 lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-ink-700 bg-ink-900 px-3 py-5 lg:flex">
        <Link href="/admin" className="display mb-8 px-3 text-2xl">
          Painel
        </Link>
        <nav aria-label="Painel" className="flex-1">
          <Suspense fallback={null}>
            <AdminNavLinks />
          </Suspense>
        </nav>
        <Suspense fallback={null}>
          <Account />
        </Suspense>
      </aside>
      <div className="min-w-0">
        <header className="relative flex h-14 items-center justify-between border-b border-ink-700 bg-ink-900 px-4 lg:hidden">
          <Link href="/admin" className="display text-xl">
            Painel
          </Link>
          <Suspense fallback={null}>
            <AdminMobileMenu />
          </Suspense>
        </header>
        <main id="conteudo" className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          <Suspense
            fallback={
              <div className="py-20">
                <Spinner />
              </div>
            }
          >
            <Guard>{children}</Guard>
          </Suspense>
        </main>
      </div>
    </div>
  );
}

async function Guard({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}

async function Account() {
  const admin = await requireAdmin();
  return (
    <div className="border-t border-ink-700 px-3 pt-4 text-sm">
      <p className="truncate text-bone-dim">{admin.name}</p>
      <p className="truncate text-xs text-faint">{admin.email}</p>
      <div className="mt-3 flex gap-4 text-xs">
        <Link href="/" className="text-mute hover:text-bone" target="_blank">
          Ver site
        </Link>
        <form action={logoutAction}>
          <button type="submit" className="text-mute hover:text-bone">
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}
