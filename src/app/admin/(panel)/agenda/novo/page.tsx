import type { Metadata } from "next";
import { getDb } from "@/db/client";
import { requireAdmin } from "@/server/auth/session";
import { listServices } from "@/server/catalog";
import { getSettings } from "@/server/settings";
import { addDaysLocal, toLocalDate } from "@/lib/time";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { NewAppointmentForm } from "@/components/admin/appointment-forms";
import { EmptyState } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";

/** Dados administrativos sempre atualizados por requisição (ver layout do painel). */
export const instant = false;

export const metadata: Metadata = { title: "Novo agendamento" };

export default async function NewAppointmentPage() {
  await requireAdmin();
  const db = getDb();
  const [services, booking] = await Promise.all([listServices(db, { onlyActive: true }), getSettings(db, "booking")]);
  const tomorrow = addDaysLocal(toLocalDate(new Date(), booking.timezone), 1);
  return (
    <>
      <PageHeader title="Novo agendamento" description="Criação manual (ex.: atendimento combinado por mensagem)." />
      {services.length ? (
        <Panel>
          <NewAppointmentForm services={services.map((s) => ({ id: s.id, name: s.name, durationMinutes: s.durationMinutes }))} defaultStart={`${tomorrow}T10:00`} />
        </Panel>
      ) : (
        <EmptyState title="Cadastre um serviço primeiro" action={<ButtonLink href="/admin/servicos">Ir para serviços</ButtonLink>} />
      )}
    </>
  );
}
