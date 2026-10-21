"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createAppointmentAction, rescheduleAppointmentAction, setAppointmentStatusAction, updateAppointmentNotesAction, type CreateAppointmentState } from "@/app/admin/_actions/agenda";
import type { AppointmentStatus } from "@/db/schema";
import { APPOINTMENT_STATUS_SHORT } from "@/domain/status";
import { ActionForm } from "./action-form";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { CheckboxField, SelectField, TextArea, TextField } from "@/components/ui/field";

const ACTION_LABEL: Partial<Record<AppointmentStatus, { label: string; variant: "primary" | "secondary" | "danger" }>> = {
  confirmed: { label: "Confirmar agendamento", variant: "primary" },
  completed: { label: "Marcar como concluído", variant: "secondary" },
  no_show: { label: "Não compareceu", variant: "secondary" },
  cancelled: { label: "Cancelar", variant: "danger" },
};

export function StatusActions({ id, next, hasContact }: { id: string; next: AppointmentStatus[]; hasContact: boolean }) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const simple = next.filter((s) => s !== "cancelled" && ACTION_LABEL[s]);
  if (!next.length) return <p className="text-sm text-mute">Nenhuma ação disponível para este status.</p>;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {simple.map((to) => (
          <ActionForm key={to} action={setAppointmentStatusAction} submitLabel={ACTION_LABEL[to]!.label} variant={ACTION_LABEL[to]!.variant} size="sm" inline>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="to" value={to} />
            {to === "confirmed" && hasContact ? <input type="hidden" name="notify" value="on" /> : null}
          </ActionForm>
        ))}
        {next.includes("cancelled") && !cancelOpen ? (
          <Button variant="danger" size="sm" onClick={() => setCancelOpen(true)}>
            Cancelar…
          </Button>
        ) : null}
      </div>
      {cancelOpen ? (
        <ActionForm action={setAppointmentStatusAction} submitLabel="Confirmar cancelamento" variant="danger" size="sm" confirm="Cancelar este agendamento e liberar o horário?">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="to" value="cancelled" />
          <TextField label="Motivo (visível ao cliente)" name="reason" maxLength={500} />
          {hasContact ? <CheckboxField name="notify" defaultChecked label="Avisar o cliente" /> : null}
        </ActionForm>
      ) : null}
      {next.includes("confirmed") && hasContact ? <p className="text-xs text-faint">Ao confirmar, o cliente é avisado (e-mail ou pendência de WhatsApp no painel).</p> : null}
    </div>
  );
}

export function RescheduleForm({ id, defaultStart, defaultDuration }: { id: string; defaultStart: string; defaultDuration: number }) {
  return (
    <ActionForm action={rescheduleAppointmentAction} submitLabel="Remarcar" variant="secondary">
      {(errors) => (
        <>
          <input type="hidden" name="id" value={id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Novo início" name="startsAt" type="datetime-local" required defaultValue={defaultStart} error={errors?.startsAt} />
            <TextField label="Duração (min)" name="durationMinutes" type="number" min={15} max={720} step={15} required defaultValue={defaultDuration} error={errors?.durationMinutes} />
          </div>
          <CheckboxField name="overrideRules" label="Ignorar expediente e bloqueios (conflitos com outros agendamentos continuam proibidos)" />
          <CheckboxField name="notify" defaultChecked label="Avisar o cliente sobre o novo horário" />
        </>
      )}
    </ActionForm>
  );
}

export function NotesForm({ id, notes, depositReceived }: { id: string; notes: string; depositReceived: boolean }) {
  return (
    <ActionForm action={updateAppointmentNotesAction} submitLabel="Salvar anotações" variant="secondary" size="sm">
      <input type="hidden" name="id" value={id} />
      <TextArea label="Observações internas (não visíveis ao cliente)" name="internalNotes" rows={4} defaultValue={notes} maxLength={4000} />
      <CheckboxField
        name="depositReceived"
        defaultChecked={depositReceived}
        label="Sinal recebido"
        hint="Registro manual do estúdio. Não há cobrança automática integrada."
      />
    </ActionForm>
  );
}

export function NewAppointmentForm({ services, defaultStart }: { services: { id: string; name: string; durationMinutes: number }[]; defaultStart: string }) {
  const [state, action, pending] = useActionState<CreateAppointmentState, FormData>(createAppointmentAction, { status: "idle" });
  const [duration, setDuration] = useState(services[0]?.durationMinutes ?? 60);
  const errors = state.status === "error" ? state.fieldErrors : undefined;

  if (state.status === "success" && state.data) {
    return (
      <div className="space-y-4">
        <Notice tone="success" title="Agendamento criado">
          Copie o link de acompanhamento abaixo se quiser enviá-lo ao cliente. Ele é exibido somente agora (não é armazenado).
        </Notice>
        <input readOnly value={state.data.link} onFocus={(e) => e.currentTarget.select()} aria-label="Link de acompanhamento" className="w-full rounded-sm border border-ink-600 bg-ink-900 px-3 py-2 text-sm" />
        <div className="flex gap-3">
          <Link href={`/admin/agenda/${state.data.id}`} className="text-sm text-bone underline underline-offset-4">
            Abrir agendamento
          </Link>
          <button type="button" onClick={() => window.location.reload()} className="text-sm text-mute underline underline-offset-4">
            Criar outro
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-6">
      {state.status === "error" ? <Notice tone="danger" role="alert">{state.message}</Notice> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Serviço"
          name="serviceId"
          required
          error={errors?.serviceId}
          onChange={(e) => setDuration(services.find((s) => s.id === e.target.value)?.durationMinutes ?? duration)}
        >
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Status" name="status" defaultValue="confirmed">
          <option value="confirmed">{APPOINTMENT_STATUS_SHORT.confirmed}</option>
          <option value="pending">{APPOINTMENT_STATUS_SHORT.pending}</option>
        </SelectField>
        <TextField label="Início" name="startsAt" type="datetime-local" required defaultValue={defaultStart} error={errors?.startsAt} />
        <TextField
          label="Duração (min)"
          name="durationMinutes"
          type="number"
          min={15}
          max={720}
          step={15}
          required
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          error={errors?.durationMinutes}
        />
        <TextField label="Nome do cliente" name="name" required error={errors?.name} className="sm:col-span-2" />
        <TextField label="E-mail" name="email" type="email" error={errors?.email} />
        <TextField label="Telefone/WhatsApp" name="phone" type="tel" error={errors?.phone} />
        <TextArea label="Observações internas" name="internalNotes" rows={3} className="sm:col-span-2" />
      </div>
      <CheckboxField name="overrideRules" label="Ignorar expediente e bloqueios (conflitos com outros agendamentos continuam proibidos)" />
      <CheckboxField name="notify" label="Avisar o cliente" />
      <Button type="submit" disabled={pending}>
        {pending ? "Criando…" : "Criar agendamento"}
      </Button>
    </form>
  );
}
