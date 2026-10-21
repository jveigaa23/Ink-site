import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { auditLog } from "@/db/schema";
import { requireAdmin } from "@/server/auth/session";
import { getQuoteDetail } from "@/server/quotes/service";
import { listServices } from "@/server/catalog";
import { getSettings } from "@/server/settings";
import { nextQuoteStatuses } from "@/domain/status";
import { addDaysLocal, formatDateTime, toLocalDate, toLocalDateTimeInput } from "@/lib/time";
import { SIZE_OPTIONS } from "@/lib/validation";
import { whatsappUrl } from "@/lib/contact";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { QuoteBadge } from "@/components/admin/status-badge";
import { HistoryList } from "@/components/admin/history-list";
import { ConvertQuoteForm, QuoteUpdateForm } from "@/components/admin/quote-forms";
import { Paragraphs } from "@/components/ui/feedback";

/** Dados administrativos sempre atualizados por requisição (ver layout do painel). */
export const instant = false;

export const metadata: Metadata = { title: "Orçamento" };

const centsToInput = (c: number | null) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = getDb();
  const [detail, booking, services, history] = await Promise.all([
    getQuoteDetail(db, id),
    getSettings(db, "booking"),
    listServices(db, { onlyActive: true }),
    db.select().from(auditLog).where(and(eq(auditLog.entityType, "quote"), eq(auditLog.entityId, id))).orderBy(desc(auditLog.createdAt)).limit(50),
  ]);
  if (!detail) notFound();
  const { quote: q, client, refs } = detail;
  const tz = booking.timezone;
  const hasContact = Boolean(client?.email || client?.phone);

  return (
    <>
      <Link href="/admin/orcamentos" className="mb-4 inline-block text-sm text-mute hover:text-bone">
        ← Orçamentos
      </Link>
      <PageHeader title={`${q.style} · ${q.protocol}`} description={`Recebido em ${formatDateTime(q.createdAt, tz)}`} actions={<QuoteBadge status={q.status} />} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title="Pedido">
            <dl className="mb-6 grid gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wider text-mute">Local</dt>
                <dd className="mt-1 text-bone">{q.bodyPart}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-mute">Tamanho</dt>
                <dd className="mt-1 text-bone">{SIZE_OPTIONS.find((o) => o.value === q.size)?.label ?? q.size}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-mute">Preferência de datas</dt>
                <dd className="mt-1 text-bone">{q.preferredDates || "—"}</dd>
              </div>
            </dl>
            <Paragraphs text={q.description} className="leading-relaxed text-bone-dim" />
            {q.extraInfo ? (
              <div className="mt-4 border-t border-ink-700 pt-4">
                <p className="text-xs uppercase tracking-wider text-mute">Informações adicionais</p>
                <Paragraphs text={q.extraInfo} className="mt-1 text-sm text-bone-dim" />
              </div>
            ) : null}
          </Panel>

          <Panel title={`Referências (${refs.length})`}>
            {refs.length ? (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {refs.map((r, i) => (
                  <li key={r.id}>
                    <a href={`/api/admin/references/${r.id}`} target="_blank" rel="noopener" className="block overflow-hidden rounded-sm border border-ink-700 hover:border-bone/50">
                      {/* imagem privada servida por rota autenticada; next/image não é usado para não armazená-la em cache público */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/admin/references/${r.id}`} alt={`Referência ${i + 1} enviada pelo cliente`} width={r.width} height={r.height} loading="lazy" className="aspect-square w-full object-cover" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-mute">O cliente não enviou imagens.</p>
            )}
            <p className="mt-3 text-xs text-faint">Referências são privadas e nunca publicadas automaticamente no portfólio.</p>
          </Panel>

          <Panel title="Resposta e status">
            <QuoteUpdateForm
              id={q.id}
              status={q.status}
              options={nextQuoteStatuses(q.status)}
              estimateMin={centsToInput(q.estimateMinCents)}
              estimateMax={centsToInput(q.estimateMaxCents)}
              messageToClient={q.messageToClient ?? ""}
              internalNotes={q.internalNotes ?? ""}
              proposed={q.proposedSlots.map((s) => toLocalDateTimeInput(new Date(s.startsAt), tz))}
              hasContact={hasContact}
            />
          </Panel>

          <Panel title="Histórico">
            <HistoryList entries={history} tz={tz} />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Cliente">
            {client ? (
              <div className="space-y-2 text-sm">
                <p className="text-bone">{client.name}</p>
                {client.email ? <a href={`mailto:${client.email}`} className="block text-bone-dim hover:underline">{client.email}</a> : null}
                {client.phone ? (
                  <a href={whatsappUrl(client.phone.length <= 11 ? `55${client.phone}` : client.phone)} target="_blank" rel="noopener noreferrer" className="block text-bone-dim hover:underline">
                    WhatsApp {client.phone}
                  </a>
                ) : null}
                <Link href={`/admin/clientes/${client.id}`} className="block pt-2 text-xs text-mute hover:text-bone">
                  Ver ficha do cliente
                </Link>
              </div>
            ) : (
              <p className="text-sm text-mute">Cliente removido.</p>
            )}
          </Panel>
          <Panel title="Converter em agendamento">
            {q.appointmentId ? (
              <p className="mb-4 text-sm">
                <Link href={`/admin/agenda/${q.appointmentId}`} className="text-bone underline underline-offset-4">
                  Ver agendamento vinculado
                </Link>
              </p>
            ) : null}
            {services.length && client ? (
              <ConvertQuoteForm
                quoteId={q.id}
                services={services.map((s) => ({ id: s.id, name: s.name, durationMinutes: s.durationMinutes }))}
                defaultStart={`${addDaysLocal(toLocalDate(new Date(), tz), 7)}T10:00`}
                hasContact={hasContact}
              />
            ) : (
              <p className="text-sm text-mute">Cadastre um serviço ativo para converter.</p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
