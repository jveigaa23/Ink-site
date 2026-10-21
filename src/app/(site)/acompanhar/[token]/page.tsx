import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { getAppointmentChainByToken } from "@/server/booking/service";
import { getSettings } from "@/server/settings";
import { getBusinessHours } from "@/server/catalog";
import { APPOINTMENT_STATUS_LABEL, clientChangeDecision } from "@/domain/status";
import { formatDateLong, formatTime } from "@/lib/time";
import { Container } from "@/components/site/section";
import { Badge, Notice, Spinner } from "@/components/ui/feedback";
import { ClientAppointmentActions } from "@/components/booking/client-actions";
import type { AppointmentStatus } from "@/db/schema";

export const metadata: Metadata = { title: "Acompanhar agendamento", robots: { index: false, follow: false } };

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ novo?: string }> };

const TONE: Record<AppointmentStatus, "info" | "success" | "warning" | "danger" | "neutral"> = {
  held: "neutral",
  pending: "warning",
  confirmed: "success",
  completed: "neutral",
  cancelled: "danger",
  no_show: "danger",
  expired: "neutral",
};

const EXPLAIN: Partial<Record<AppointmentStatus, string>> = {
  pending: "Recebemos sua solicitação. O horário está reservado para você, mas ainda NÃO é uma confirmação definitiva — o estúdio vai confirmar em breve.",
  confirmed: "Seu horário está confirmado. Chegue com alguns minutos de antecedência.",
  cancelled: "Este agendamento foi cancelado e o horário foi liberado.",
  completed: "Sessão concluída. Confira as orientações de cuidados no site.",
};

export default function Page(props: Props) {
  return (
    <Container className="py-16 md:py-24">
      <Suspense fallback={<Spinner label="Carregando agendamento" />}>
        <Content {...props} />
      </Suspense>
    </Container>
  );
}

async function Content({ params, searchParams }: Props) {
  await connection();
  const [{ token }, { novo }] = await Promise.all([params, searchParams]);
  const db = getDb();
  const view = await getAppointmentChainByToken(db, token);
  if (!view) notFound();
  const [booking, hours] = await Promise.all([getSettings(db, "booking"), getBusinessHours(db)]);
  const tz = booking.timezone;
  const now = new Date();
  const items = [...view.chain].reverse(); // mais recente primeiro
  const pickerConfig = { timezone: tz, maxAdvanceDays: booking.maxAdvanceDays, openWeekdays: Array.from(new Set(hours.map((h) => h.weekday))) };

  return (
    <div className="mx-auto max-w-3xl">
      {novo ? (
        <Notice tone="success" role="status" title="Solicitação registrada" className="mb-10">
          Guarde este link: é por ele que você acompanha, remarca ou cancela. Não compartilhe — ele dá acesso ao seu agendamento.
        </Notice>
      ) : null}
      <p className="eyebrow">Agendamento</p>
      <h1 className="display mt-3 text-5xl sm:text-6xl">
        Olá{view.client ? `, ${view.client.name.split(" ")[0]}` : ""}.
      </h1>
      <p className="mt-4 text-mute">
        Protocolo <span className="font-semibold tracking-wider text-bone">{view.root.protocol}</span>
      </p>

      <ol className="mt-12 space-y-8">
        {items.map(({ appt, service }) => {
          const decisionCancel = clientChangeDecision("cancel", appt, booking, now);
          const decisionResched = clientChangeDecision("reschedule", appt, booking, now);
          const hasPendingChild = view.chain.some((c) => c.appt.rescheduledFromId === appt.id && c.appt.status === "pending");
          const isRequest = Boolean(appt.rescheduledFromId) && appt.status === "pending";
          return (
            <li key={appt.id} className="border border-ink-700 bg-ink-900 p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Badge tone={TONE[appt.status]}>{isRequest ? "Pedido de reagendamento — aguardando aprovação" : APPOINTMENT_STATUS_LABEL[appt.status]}</Badge>
                {appt.protocol !== view.root.protocol ? <span className="text-xs text-faint">{appt.protocol}</span> : null}
              </div>
              <p className="display mt-6 text-3xl capitalize sm:text-4xl">{formatDateLong(appt.startsAt, tz)}</p>
              <p className="mt-1 text-lg text-bone-dim">
                {formatTime(appt.startsAt, tz)} – {formatTime(appt.endsAt, tz)} · {service.name}
              </p>
              {EXPLAIN[appt.status] && !isRequest ? <p className="mt-6 text-sm leading-relaxed text-mute">{EXPLAIN[appt.status]}</p> : null}
              {appt.status === "cancelled" && appt.cancelReason ? <p className="mt-2 text-sm text-faint">Motivo: {appt.cancelReason}</p> : null}
              {(appt.status === "pending" || appt.status === "confirmed") && !isRequest ? (
                <div className="mt-8 border-t border-ink-700 pt-6">
                  <ClientAppointmentActions
                    token={token}
                    appointmentId={appt.id}
                    serviceId={appt.serviceId}
                    canCancel={decisionCancel.allowed}
                    canReschedule={decisionResched.allowed && !hasPendingChild}
                    blockedReason={!decisionCancel.allowed ? decisionCancel.reason : hasPendingChild ? "Há um pedido de reagendamento aguardando aprovação." : undefined}
                    pickerConfig={pickerConfig}
                    requiresApproval={booking.rescheduleRequiresApproval}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
