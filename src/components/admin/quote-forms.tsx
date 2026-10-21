"use client";

import { useState } from "react";
import { convertQuoteAction, updateQuoteAction } from "@/app/admin/_actions/quotes";
import type { QuoteStatus } from "@/db/schema";
import { QUOTE_STATUS_LABEL } from "@/domain/status";
import { ActionForm } from "./action-form";
import { CheckboxField, SelectField, TextArea, TextField } from "@/components/ui/field";

export function QuoteUpdateForm({
  id,
  status,
  options,
  estimateMin,
  estimateMax,
  messageToClient,
  internalNotes,
  proposed,
  hasContact,
}: {
  id: string;
  status: QuoteStatus;
  options: QuoteStatus[];
  estimateMin: string;
  estimateMax: string;
  messageToClient: string;
  internalNotes: string;
  proposed: string[];
  hasContact: boolean;
}) {
  const [slots, setSlots] = useState<string[]>(proposed.length ? proposed : [""]);
  return (
    <ActionForm action={updateQuoteAction} submitLabel="Salvar alterações">
      {(errors) => (
        <>
          <input type="hidden" name="id" value={id} />
          <SelectField label="Status" name="status" defaultValue={status}>
            {[status, ...options].map((s) => (
              <option key={s} value={s}>
                {QUOTE_STATUS_LABEL[s]}
              </option>
            ))}
          </SelectField>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Estimativa mínima (R$)" name="estimateMin" inputMode="decimal" defaultValue={estimateMin} error={errors?.estimateMin} placeholder="Opcional" />
            <TextField label="Estimativa máxima (R$)" name="estimateMax" inputMode="decimal" defaultValue={estimateMax} error={errors?.estimateMax} placeholder="Opcional" />
          </div>
          <TextArea label="Mensagem ao cliente" name="messageToClient" rows={4} defaultValue={messageToClient} hint="Visível na página de acompanhamento do cliente." />
          <fieldset>
            <legend className="text-sm font-medium text-bone-dim">Datas sugeridas ao cliente</legend>
            <div className="mt-2 space-y-2">
              {slots.map((v, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="datetime-local"
                    name="proposedSlot"
                    aria-label={`Data sugerida ${i + 1}`}
                    defaultValue={v}
                    className="min-h-11 flex-1 rounded-sm border border-ink-600 bg-ink-900 px-3 text-sm"
                  />
                  <button type="button" onClick={() => setSlots((s) => s.filter((_, j) => j !== i))} className="px-2 text-xs text-mute hover:text-danger">
                    Remover<span className="sr-only"> data {i + 1}</span>
                  </button>
                </div>
              ))}
              {slots.length < 5 ? (
                <button type="button" onClick={() => setSlots((s) => [...s, ""])} className="text-xs text-bone-dim underline underline-offset-4">
                  Adicionar data
                </button>
              ) : null}
            </div>
          </fieldset>
          <TextArea label="Observações internas" name="internalNotes" rows={3} defaultValue={internalNotes} hint="Nunca exibidas ao cliente." />
          {hasContact ? <CheckboxField name="notify" label="Avisar o cliente sobre a atualização" /> : null}
        </>
      )}
    </ActionForm>
  );
}

export function ConvertQuoteForm({
  quoteId,
  services,
  defaultStart,
  hasContact,
}: {
  quoteId: string;
  services: { id: string; name: string; durationMinutes: number }[];
  defaultStart: string;
  hasContact: boolean;
}) {
  const [duration, setDuration] = useState(services[0]?.durationMinutes ?? 60);
  return (
    <ActionForm action={convertQuoteAction} submitLabel="Criar agendamento" variant="secondary">
      {(errors) => (
        <>
          <input type="hidden" name="quoteId" value={quoteId} />
          <SelectField label="Serviço" name="serviceId" error={errors?.serviceId} onChange={(e) => setDuration(services.find((s) => s.id === e.target.value)?.durationMinutes ?? duration)}>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectField>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Início" name="startsAt" type="datetime-local" required defaultValue={defaultStart} error={errors?.startsAt} />
            <TextField label="Duração (min)" name="durationMinutes" type="number" min={15} max={720} step={15} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </div>
          <SelectField label="Status" name="status" defaultValue="confirmed">
            <option value="confirmed">Confirmado</option>
            <option value="pending">Aguardando confirmação</option>
          </SelectField>
          <CheckboxField name="overrideRules" label="Ignorar expediente e bloqueios" />
          {hasContact ? <CheckboxField name="notify" defaultChecked label="Avisar o cliente" /> : null}
        </>
      )}
    </ActionForm>
  );
}
