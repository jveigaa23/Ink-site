import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db/client";
import { quoteStatus, type QuoteStatus } from "@/db/schema";
import { requireAdmin } from "@/server/auth/session";
import { listQuotes } from "@/server/quotes/service";
import { getSettings } from "@/server/settings";
import { QUOTE_STATUS_LABEL } from "@/domain/status";
import { formatDateShort, isValidLocalDate, startOfLocalDay, addDaysLocal } from "@/lib/time";
import { PageHeader } from "@/components/admin/page-header";
import { QuoteBadge } from "@/components/admin/status-badge";
import { Pager } from "@/components/admin/pager";
import { EmptyState } from "@/components/ui/feedback";

/** Dados administrativos sempre atualizados por requisição (ver layout do painel). */
export const instant = false;

export const metadata: Metadata = { title: "Orçamentos" };

type SP = { status?: string; q?: string; de?: string; ate?: string; pagina?: string };

export default async function QuotesPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin();
  const sp = await searchParams;
  const db = getDb();
  const { timezone: tz } = await getSettings(db, "booking");
  const status = sp.status === "open" ? "open" : (quoteStatus.enumValues as readonly string[]).includes(sp.status ?? "") ? (sp.status as QuoteStatus) : undefined;
  const page = Math.max(1, Number(sp.pagina) || 1);
  const from = sp.de && isValidLocalDate(sp.de) ? startOfLocalDay(sp.de, tz) : undefined;
  const to = sp.ate && isValidLocalDate(sp.ate) ? startOfLocalDay(addDaysLocal(sp.ate, 1), tz) : undefined;
  const { rows, hasMore } = await listQuotes(db, { status, q: sp.q?.slice(0, 80), from, to, page });
  const qs = (p: number) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, pagina: String(p) })) if (v) u.set(k, v);
    return `/admin/orcamentos?${u}`;
  };

  return (
    <>
      <PageHeader title="Orçamentos" description="Pedidos enviados pelo site." />
      <form action="/admin/orcamentos" className="mb-6 flex flex-wrap items-end gap-2 text-sm">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs text-mute">Buscar</span>
          <input name="q" defaultValue={sp.q} placeholder="Protocolo, nome, estilo…" className="min-h-10 min-w-48 rounded-sm border border-ink-600 bg-ink-900 px-3" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-mute">Status</span>
          <select name="status" defaultValue={sp.status ?? ""} className="min-h-10 rounded-sm border border-ink-600 bg-ink-900 px-2">
            <option value="">Todos</option>
            <option value="open">Em aberto</option>
            {quoteStatus.enumValues.map((s) => (
              <option key={s} value={s}>
                {QUOTE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-mute">De</span>
          <input type="date" name="de" defaultValue={sp.de} className="min-h-10 rounded-sm border border-ink-600 bg-ink-900 px-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-mute">Até</span>
          <input type="date" name="ate" defaultValue={sp.ate} className="min-h-10 rounded-sm border border-ink-600 bg-ink-900 px-2" />
        </label>
        <button type="submit" className="min-h-10 rounded-sm border border-ink-600 px-3 hover:border-bone">
          Filtrar
        </button>
      </form>

      {rows.length ? (
        <ul className="divide-y divide-ink-700 rounded-sm border border-ink-700">
          {rows.map((q) => (
            <li key={q.id}>
              <Link href={`/admin/orcamentos/${q.id}`} className="flex flex-col gap-2 px-4 py-4 hover:bg-ink-900 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-bone">
                    {q.clientName ?? "—"} <span className="text-faint">· {q.protocol}</span>
                  </p>
                  <p className="text-sm text-mute">
                    {q.style} · {q.bodyPart} {q.refs ? `· ${q.refs} ref.` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs tabular-nums text-faint">{formatDateShort(q.createdAt, tz)}</span>
                  <QuoteBadge status={q.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Nenhum pedido">Nenhum orçamento corresponde aos filtros.</EmptyState>
      )}
      <Pager page={page} hasMore={hasMore} href={qs} />
    </>
  );
}
