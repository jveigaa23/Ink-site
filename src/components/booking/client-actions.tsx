"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { clientCancelAction, clientRescheduleAction } from "@/app/actions/public";
import { idle, type ActionState } from "@/server/action-result";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { TextArea } from "@/components/ui/field";
import { SlotPicker, type PickerConfig, type SlotOption } from "./slot-picker";

export function ClientAppointmentActions({
  token,
  appointmentId,
  serviceId,
  canCancel,
  canReschedule,
  blockedReason,
  pickerConfig,
  requiresApproval,
}: {
  token: string;
  appointmentId: string;
  serviceId: string;
  canCancel: boolean;
  canReschedule: boolean;
  blockedReason?: string;
  pickerConfig: PickerConfig;
  requiresApproval: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"none" | "cancel" | "reschedule">("none");
  const [cancelState, cancelAction, cancelling] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const r = await clientCancelAction(prev, fd);
    if (r.status === "success") router.refresh();
    return r;
  }, idle);
  const [reschedule, setReschedule] = useState<ActionState>(idle);
  const [selected, setSelected] = useState<SlotOption | null>(null);
  const [pending, startTransition] = useTransition();

  if (!canCancel && !canReschedule) {
    return blockedReason ? <p className="text-sm text-mute">{blockedReason}</p> : null;
  }

  function confirmReschedule() {
    if (!selected) return;
    startTransition(async () => {
      const r = await clientRescheduleAction({ token, appointmentId, startsAt: selected.startsAt });
      setReschedule(r);
      if (r.status === "success") {
        setMode("none");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {reschedule.status === "success" ? <Notice tone="success" role="status">{reschedule.message}</Notice> : null}
      {cancelState.status === "success" ? <Notice tone="success" role="status">{cancelState.message}</Notice> : null}

      {mode === "none" ? (
        <div className="flex flex-wrap gap-3">
          {canReschedule ? (
            <Button variant="secondary" onClick={() => setMode("reschedule")}>
              Remarcar
            </Button>
          ) : null}
          {canCancel ? (
            <Button variant="danger" onClick={() => setMode("cancel")}>
              Cancelar agendamento
            </Button>
          ) : null}
        </div>
      ) : null}

      {mode === "cancel" ? (
        <form action={cancelAction} className="space-y-4 border border-ink-600 p-5">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="appointmentId" value={appointmentId} />
          <TextArea label="Motivo (opcional)" name="reason" rows={2} maxLength={500} />
          {cancelState.status === "error" ? <Notice tone="danger" role="alert">{cancelState.message}</Notice> : null}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="danger" disabled={cancelling}>
              {cancelling ? "Cancelando…" : "Confirmar cancelamento"}
            </Button>
            <Button variant="ghost" onClick={() => setMode("none")}>
              Voltar
            </Button>
          </div>
        </form>
      ) : null}

      {mode === "reschedule" ? (
        <div className="space-y-6 border border-ink-600 p-5">
          {requiresApproval ? (
            <Notice tone="info">O novo horário precisa ser aprovado pelo estúdio. Até lá, o horário atual continua valendo.</Notice>
          ) : null}
          <SlotPicker serviceId={serviceId} config={pickerConfig} onSelect={(s) => setSelected(s)} selected={selected?.startsAt} disabled={pending} />
          {reschedule.status === "error" ? <Notice tone="danger" role="alert">{reschedule.message}</Notice> : null}
          <div className="flex flex-wrap gap-3">
            <Button onClick={confirmReschedule} disabled={!selected || pending}>
              {pending ? "Enviando…" : selected ? `Remarcar para ${selected.label}` : "Escolha um horário"}
            </Button>
            <Button variant="ghost" onClick={() => setMode("none")}>
              Voltar
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
