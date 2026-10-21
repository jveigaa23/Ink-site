import type { Metadata } from "next";
import { asc, gt } from "drizzle-orm";
import { getDb } from "@/db/client";
import { availabilityBlocks } from "@/db/schema";
import { requireAdmin } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { formatDateTime, toLocalDate } from "@/lib/time";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { ActionForm } from "@/components/admin/action-form";
import { CheckboxField, TextField } from "@/components/ui/field";
import { createBlockAction, deleteBlockAction } from "../../_actions/agenda";

/** Dados administrativos sempre atualizados por requisição (ver layout do painel). */
export const instant = false;

export const metadata: Metadata = { title: "Bloqueios" };

export default async function BlocksPage() {
  await requireAdmin();
  const db = getDb();
  const { timezone: tz } = await getSettings(db, "booking");
  const blocks = await db.select().from(availabilityBlocks).where(gt(availabilityBlocks.endsAt, new Date())).orderBy(asc(availabilityBlocks.startsAt));
  const today = toLocalDate(new Date(), tz);
  return (
    <>
      <PageHeader title="Bloqueios de agenda" description="Folgas, férias, compromissos e intervalos sem atendimento. Horários bloqueados não aparecem para agendamento." />
      <div className="grid gap-6 lg:grid-cols-5">
        <Panel title="Novo bloqueio" className="lg:col-span-2">
          <ActionForm action={createBlockAction} submitLabel="Bloquear" resetOnSuccess>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Data inicial" name="startDate" type="date" required defaultValue={today} />
              <TextField label="Data final" name="endDate" type="date" defaultValue={today} hint="Para férias, informe o último dia." />
              <TextField label="Hora inicial" name="startTime" type="time" defaultValue="09:00" />
              <TextField label="Hora final" name="endTime" type="time" defaultValue="18:00" />
            </div>
            <CheckboxField name="allDay" label="Dia(s) inteiro(s)" />
            <TextField label="Motivo (interno)" name="reason" maxLength={200} placeholder="Ex.: férias, evento, consulta" />
          </ActionForm>
        </Panel>
        <Panel title="Bloqueios ativos e futuros" className="lg:col-span-3">
          {blocks.length ? (
            <ul className="divide-y divide-ink-700">
              {blocks.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <div>
                    <p className="tabular-nums text-bone">
                      {formatDateTime(b.startsAt, tz)} → {formatDateTime(b.endsAt, tz)}
                    </p>
                    {b.reason ? <p className="text-xs text-faint">{b.reason}</p> : null}
                  </div>
                  <form action={deleteBlockAction}>
                    <input type="hidden" name="id" value={b.id} />
                    <button type="submit" className="text-xs text-danger hover:underline">
                      Remover<span className="sr-only"> bloqueio</span>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-mute">Nenhum bloqueio futuro.</p>
          )}
        </Panel>
      </div>
    </>
  );
}
