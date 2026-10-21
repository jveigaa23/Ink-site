import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db/client";
import { requireAdmin } from "@/server/auth/session";
import { listClients } from "@/server/clients";
import { PageHeader } from "@/components/admin/page-header";
import { Pager } from "@/components/admin/pager";
import { EmptyState } from "@/components/ui/feedback";

/** Dados administrativos sempre atualizados por requisição (ver layout do painel). */
export const instant = false;

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; pagina?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.pagina) || 1);
  const { rows, hasMore } = await listClients(getDb(), { q: sp.q?.slice(0, 80), page });
  return (
    <>
      <PageHeader title="Clientes" description="Dados de contato restritos ao atendimento. Não há exportação em massa." />
      <form action="/admin/clientes" className="mb-6 flex gap-2 text-sm">
        <label className="sr-only" htmlFor="q">Buscar cliente</label>
        <input id="q" name="q" defaultValue={sp.q} placeholder="Nome, e-mail ou telefone" className="min-h-10 flex-1 rounded-sm border border-ink-600 bg-ink-900 px-3" />
        <button type="submit" className="min-h-10 rounded-sm border border-ink-600 px-3 hover:border-bone">Buscar</button>
      </form>
      {rows.length ? (
        <ul className="divide-y divide-ink-700 rounded-sm border border-ink-700">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/clientes/${c.id}`} className="flex flex-col gap-1 px-4 py-3 hover:bg-ink-900 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-bone">{c.name}</span>
                <span className="text-xs text-faint">
                  {c.appointments} agendamento(s) · {c.quotes} orçamento(s)
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Nenhum cliente">{sp.q ? "Nenhum resultado para a busca." : "Os clientes aparecem aqui após o primeiro pedido."}</EmptyState>
      )}
      <Pager page={page} hasMore={hasMore} href={(p) => `/admin/clientes?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), pagina: String(p) })}`} />
    </>
  );
}
