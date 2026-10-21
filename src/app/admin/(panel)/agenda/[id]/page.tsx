import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { requireAdmin } from "@/server/auth/session";
import { getAppointmentDetail } from "@/server/agenda";
import { getSettings } from "@/server/settings";
import { canTransitionAppointment } from "@/domain/status";
import { appointmentStatus } from "@/db/schema";
import { formatDateLong, formatDateTime, formatTime, toLocalDateTimeInput } from "@/lib/time";
import { whatsappUrl } from "@/lib/contact";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { AppointmentBadge } from "@/components/admin/status-badge";
import { NotesForm, RescheduleForm, StatusActions } from "@/components/admin/appointment-forms";
import { HistoryList } from "@/components/admin/history-list";
import { Notice } from "@/components/ui/feedback";

/** Dados administrativos sempre atualizados por requisição (ver layout do painel). */
export const instant = false;

export const metadata: Metadata = { title: "Agendamento" };

export default async function AppointmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = getDb();
  const [detail, booking] = await Promise.all([getAppointmentDetail(db, id), getSettings(db, "booking")]);
  if (!detail) notFound();
  const { appt, service, client } = detail;
  const tz = booking.timezone;
  const next = appointmentStatus.enumValues.filter(
    (s) => appt.status !== "held" && appt.status !== "expired" && s !== appt.status && canTransitionAppointment(appt.status, s),
  );
  const active = appt.status === "pending" || appt.status === "confirmed";
  const durationMin = Math.round((appt.endsAt.getTime() - appt.startsAt.getTime()) / 60000);

  return (
    <>
      <Link href="/admin/agenda" className="mb-4 inline-block text-sm text-mute hover:text-bone">
        ← Agenda
      </Link>
      <PageHeader
        title={`${service.name} · ${appt.protocol}`}
        description={
          <span className="inline-block first-letter:uppercase">
            {formatDateLong(appt.startsAt, tz)}, {formatTime(appt.startsAt, tz)}–{formatTime(appt.endsAt, tz)}
          </span>
        }
        actions={<AppointmentBadge status={appt.status} reschedule={Boolean(appt.rescheduledFromId)} />}
      />

      {appt.rescheduledFromId && appt.status === "pending" ? (
        <Notice tone="warning" className="mb-6" title="Pedido de reagendamento">
          O cliente pediu para mudar para este horário. Ao confirmar, o agendamento anterior é cancelado automaticamente.
        </Notice>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title="Ações">
            <StatusActions id={appt.id} next={next} hasContact={Boolean(client?.email || client?.phone)} />
          </Panel>
          {active ? (
            <Panel title="Remarcar">
              <RescheduleForm id={appt.id} defaultStart={toLocalDateTimeInput(appt.startsAt, tz)} defaultDuration={durationMin} />
            </Panel>
          ) : null}
          <Panel title="Anotações">
            {appt.clientNotes ? (
              <div className="mb-4">
                <p className="text-xs uppercase tracking-wider text-mute">Observações do cliente</p>
                <p className="mt-1 whitespace-pre-line text-sm text-bone-dim">{appt.clientNotes}</p>
              </div>
            ) : null}
            <NotesForm id={appt.id} notes={appt.internalNotes ?? ""} depositReceived={Boolean(appt.depositReceivedAt)} />
          </Panel>
          <Panel title="Histórico">
            <HistoryList entries={detail.history} tz={tz} />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Cliente">
            {client ? (
              <div className="space-y-2 text-sm">
                <p className="text-bone">{client.name}</p>
                {client.email ? (
                  <a href={`mailto:${client.email}`} className="block text-bone-dim underline-offset-4 hover:underline">
                    {client.email}
                  </a>
                ) : null}
                {client.phone ? (
                  <a href={whatsappUrl(client.phone.length <= 11 ? `55${client.phone}` : client.phone)} target="_blank" rel="noopener noreferrer" className="block text-bone-dim underline-offset-4 hover:underline">
                    WhatsApp {client.phone}
                  </a>
                ) : null}
                <Link href={`/admin/clientes/${client.id}`} className="block pt-2 text-xs text-mute hover:text-bone">
                  Ver ficha do cliente
                </Link>
              </div>
            ) : (
              <p className="text-sm text-mute">Sem cliente vinculado.</p>
            )}
          </Panel>
          <Panel title="Detalhes">
            <dl className="space-y-2 text-sm">
              <Row k="Origem" v={appt.source === "online" ? "Site" : appt.source === "quote" ? "Orçamento" : "Painel"} />
              <Row k="Criado em" v={formatDateTime(appt.createdAt, tz)} />
              {appt.confirmedAt ? <Row k="Confirmado em" v={formatDateTime(appt.confirmedAt, tz)} /> : null}
              {appt.cancelledAt ? <Row k="Cancelado em" v={`${formatDateTime(appt.cancelledAt, tz)} (${appt.cancelledBy === "client" ? "cliente" : "estúdio"})`} /> : null}
              {appt.cancelReason ? <Row k="Motivo" v={appt.cancelReason} /> : null}
              {detail.quote ? <Row k="Orçamento" v={<Link className="underline" href={`/admin/orcamentos/${detail.quote.id}`}>{detail.quote.protocol}</Link>} /> : null}
            </dl>
            {detail.related.length ? (
              <div className="mt-4 border-t border-ink-700 pt-3 text-sm">
                <p className="mb-1 text-xs uppercase tracking-wider text-mute">{appt.rescheduledFromId ? "Agendamento anterior" : "Reagendamentos"}</p>
                {detail.related.map((r) => (
                  <Link key={r.id} href={`/admin/agenda/${r.id}`} className="flex items-center justify-between gap-2 py-1 hover:text-bone">
                    <span className="tabular-nums">{formatDateTime(r.startsAt, tz)}</span>
                    <AppointmentBadge status={r.status} />
                  </Link>
                ))}
              </div>
            ) : null}
          </Panel>
          <Panel title="Notificações">
            {detail.notifs.length ? (
              <ul className="space-y-2 text-xs">
                {detail.notifs.map((n) => (
                  <li key={n.id} className="flex justify-between gap-2">
                    <span className="text-bone-dim">{n.subject}</span>
                    <span className="shrink-0 text-faint">{n.status === "sent" ? "enviado" : n.status === "manual_pending" ? "envio manual pendente" : n.status === "failed" ? "falhou" : n.status}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-mute">Nenhuma notificação.</p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-mute">{k}</dt>
      <dd className="text-right text-bone-dim">{v}</dd>
    </div>
  );
}
