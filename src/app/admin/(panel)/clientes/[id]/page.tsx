import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { requireAdmin } from "@/server/auth/session";
import { getClientDetail } from "@/server/clients";
import { getSettings } from "@/server/settings";
import { formatDateShort, formatDateTime } from "@/lib/time";
import { whatsappUrl } from "@/lib/contact";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { AppointmentBadge, QuoteBadge } from "@/components/admin/status-badge";
import { ActionForm } from "@/components/admin/action-form";
import { TextArea, TextField } from "@/components/ui/field";
import { anonymizeClientAction, clientNotesAction } from "../../../_actions/catalog";

/** Dados administrativos sempre atualizados por requisição (ver layout do painel). */
export const instant = false;

export const metadata: Metadata = { title: "Cliente" };

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = getDb();
  const [detail, { timezone: tz }] = await Promise.all([getClientDetail(db, id), getSettings(db, "booking")]);
  if (!detail) notFound();
  const { client } = detail;

  return (
    <>
      <Link href="/admin/clientes" className="mb-4 inline-block text-sm text-mute hover:text-bone">← Clientes</Link>
      <PageHeader title={client.name} description={`Cliente desde ${formatDateShort(client.createdAt, tz)}`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title="Agendamentos">
            {detail.appointments.length ? (
              <ul className="divide-y divide-ink-700 text-sm">
                {detail.appointments.map(({ appt, serviceName }) => (
                  <li key={appt.id}>
                    <Link href={`/admin/agenda/${appt.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-bone">
                      <span><span className="tabular-nums">{formatDateTime(appt.startsAt, tz)}</span> <span className="text-faint">· {serviceName}</span></span>
                      <AppointmentBadge status={appt.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-mute">Nenhum agendamento.</p>}
          </Panel>
          <Panel title="Orçamentos">
            {detail.quotes.length ? (
              <ul className="divide-y divide-ink-700 text-sm">
                {detail.quotes.map((q) => (
                  <li key={q.id}>
                    <Link href={`/admin/orcamentos/${q.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-bone">
                      <span>{q.style} <span className="text-faint">· {q.protocol}</span></span>
                      <QuoteBadge status={q.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-mute">Nenhum orçamento.</p>}
          </Panel>
          <Panel title="Observações internas">
            <ActionForm action={clientNotesAction} submitLabel="Salvar" variant="secondary" size="sm">
              <input type="hidden" name="id" value={client.id} />
              <TextArea label="Observações" name="internalNotes" rows={4} defaultValue={client.internalNotes ?? ""} hint="Evite registrar dados sensíveis (saúde, por exemplo) sem necessidade." />
            </ActionForm>
          </Panel>
        </div>
        <div className="space-y-6">
          <Panel title="Contato">
            <div className="space-y-2 text-sm">
              {client.email ? <a href={`mailto:${client.email}`} className="block text-bone-dim hover:underline">{client.email}</a> : null}
              {client.phone ? <a href={whatsappUrl(client.phone.length <= 11 ? `55${client.phone}` : client.phone)} target="_blank" rel="noopener noreferrer" className="block text-bone-dim hover:underline">WhatsApp {client.phone}</a> : null}
              {client.privacyConsentAt ? <p className="pt-2 text-xs text-faint">Consentimento registrado em {formatDateTime(client.privacyConsentAt, tz)}</p> : null}
            </div>
          </Panel>
          <Panel title="Excluir dados (LGPD)">
            <p className="mb-4 text-sm text-mute">
              Remove nome, contatos, observações, descrições e referências enviadas. Mantém apenas registros de agenda sem identificação. Ação irreversível.
            </p>
            <ActionForm action={anonymizeClientAction} submitLabel="Excluir dados do cliente" variant="danger" size="sm" confirm="Excluir definitivamente os dados pessoais deste cliente?">
              <>
                                    <input type="hidden" name="id" value={client.id} />
                  <TextField label='Digite "EXCLUIR" para confirmar' name="confirmText" autoComplete="off" />
                </>
            </ActionForm>
          </Panel>
        </div>
      </div>
    </>
  );
}
