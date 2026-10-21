"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { confirmBookingAction, holdSlotAction, releaseHoldAction } from "@/app/actions/public";
import { idle, type ActionState } from "@/server/action-result";
import { contactSchema, fieldErrors } from "@/lib/validation";
import { formatLocalDate } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { TextArea } from "@/components/ui/field";
import { ContactFields } from "@/components/forms/contact-fields";
import { SlotPicker, type PickerConfig, type SlotOption } from "./slot-picker";

export type WizardService = { id: string; slug: string; name: string; description: string; durationMinutes: number };

type Hold = { holdToken: string; expiresAt: string; startsAt: string; endsAt: string; label: string; date: string };

function durationLabel(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h} h` : "", m ? `${m} min` : ""].filter(Boolean).join(" ");
}

export function BookingWizard({
  services,
  config,
  holdMinutes,
  autoConfirm,
  depositRequired,
}: {
  services: WizardService[];
  config: PickerConfig;
  holdMinutes: number;
  autoConfirm: boolean;
  depositRequired: boolean;
}) {
  const [serviceId, setServiceId] = useState<string>(services.length === 1 ? services[0].id : "");
  const [hold, setHold] = useState<Hold | null>(null);
  const [holdError, setHoldError] = useState("");
  const [holding, setHolding] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(confirmBookingAction, idle);
  const [clientErrors, setClientErrors] = useState<Record<string, string> | null>(null);
  const errors = clientErrors ?? (state.status === "error" ? state.fieldErrors : undefined);
  const service = services.find((s) => s.id === serviceId);

  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("servico");
    const match = services.find((s) => s.slug === slug);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pré-seleção vinda da URL
    if (match) setServiceId(match.id);
  }, [services]);

  async function pick(slot: SlotOption, date: string) {
    setHoldError("");
    setHolding(true);
    if (hold) await releaseHoldAction(hold.holdToken);
    const res = await holdSlotAction({ serviceId, startsAt: slot.startsAt });
    setHolding(false);
    if (res.status === "success" && res.data) {
      setHold({ ...res.data, label: slot.label, date });
      requestAnimationFrame(() => document.getElementById("step-3")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } else if (res.status === "error") {
      setHold(null);
      setHoldError(res.message);
    }
  }

  async function changeSlot() {
    if (hold) await releaseHoldAction(hold.holdToken);
    setHold(null);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const check = contactSchema.safeParse({
      name: fd.get("name"),
      email: fd.get("email"),
      phone: fd.get("phone"),
      privacyConsent: fd.get("privacyConsent") === "on",
    });
    if (!check.success) {
      setClientErrors(fieldErrors(check.error));
      requestAnimationFrame(() => form.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
      return;
    }
    setClientErrors(null);
    startTransition(() => action(fd));
  }

  return (
    <div className="space-y-16">
      {/* Passo 1 */}
      <section aria-labelledby="step-1-title">
        <StepTitle n={1} id="step-1-title" done={Boolean(service)}>
          Tipo de atendimento
        </StepTitle>
        <div role="radiogroup" aria-labelledby="step-1-title" className="grid gap-3 sm:grid-cols-2">
          {services.map((s) => {
            const active = s.id === serviceId;
            return (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={Boolean(hold) || holding}
                onClick={() => setServiceId(s.id)}
                className={`flex flex-col items-start gap-1 rounded-sm border p-5 text-left transition-colors disabled:opacity-60 ${
                  active ? "border-bone bg-ink-850" : "border-ink-600 hover:border-bone/50"
                }`}
              >
                <span className="flex w-full items-baseline justify-between gap-4">
                  <span className="display text-2xl text-bone">{s.name}</span>
                  <span className="text-xs tabular-nums text-faint">{durationLabel(s.durationMinutes)}</span>
                </span>
                {s.description ? <span className="line-clamp-2 text-sm text-mute">{s.description}</span> : null}
              </button>
            );
          })}
        </div>
      </section>

      {/* Passo 2 */}
      <section aria-labelledby="step-2-title" className={service ? "" : "pointer-events-none opacity-40"} inert={!service}>
        <StepTitle n={2} id="step-2-title" done={Boolean(hold)}>
          Data e horário
        </StepTitle>
        {service ? (
          hold ? (
            <div className="flex flex-wrap items-center justify-between gap-4 border border-ink-600 p-5">
              <p className="text-bone">
                <span className="inline-block first-letter:uppercase">{formatLocalDate(hold.date)}</span>, às <strong>{hold.label}</strong>
              </p>
              <button type="button" onClick={changeSlot} className="text-sm text-bone-dim underline underline-offset-4 hover:text-bone">
                Trocar horário
              </button>
            </div>
          ) : (
            <>
              {holdError ? (
                <Notice tone="danger" role="alert" className="mb-6">
                  {holdError}
                </Notice>
              ) : null}
              <SlotPicker key={service.id} serviceId={service.id} config={config} onSelect={pick} disabled={holding} />
              {holding ? <p className="mt-4 text-sm text-mute" role="status">Reservando horário…</p> : null}
            </>
          )
        ) : (
          <p className="text-sm text-faint">Selecione o tipo de atendimento primeiro.</p>
        )}
      </section>

      {/* Passo 3 */}
      <section id="step-3" aria-labelledby="step-3-title" className={hold ? "scroll-mt-28" : "pointer-events-none opacity-40"} inert={!hold}>
        <StepTitle n={3} id="step-3-title">
          Seus dados
        </StepTitle>
        {hold ? (
          <form onSubmit={onSubmit} noValidate className="space-y-10">
            <HoldTimer expiresAt={hold.expiresAt} holdMinutes={holdMinutes} />
            {state.status === "error" ? (
              <Notice tone="danger" role="alert" title="Não foi possível concluir">
                {state.message}
                {/indispon/i.test(state.message) ? (
                  <button type="button" onClick={changeSlot} className="ml-2 text-bone underline underline-offset-4">
                    Escolher outro horário
                  </button>
                ) : null}
              </Notice>
            ) : null}
            <input type="hidden" name="holdToken" value={hold.holdToken} />
            <ContactFields errors={errors} />
            <TextArea label="Observações (opcional)" name="notes" rows={3} maxLength={1500} hint="Ex.: referência do orçamento já aprovado, dúvidas." />
            <div className="space-y-4 border-t border-ink-700 pt-8">
              <p className="text-sm text-mute">
                {autoConfirm
                  ? "Ao enviar, seu agendamento será confirmado automaticamente."
                  : "Ao enviar, sua solicitação será registrada e o estúdio confirmará o horário. Até lá, ela não é uma confirmação definitiva."}
                {depositRequired ? " Este estúdio pode solicitar sinal para garantir a reserva; as instruções serão enviadas pelo estúdio." : ""}
              </p>
              <Button type="submit" size="lg" disabled={pending} aria-busy={pending} className="w-full sm:w-auto">
                {pending ? "Enviando…" : autoConfirm ? "Confirmar agendamento" : "Enviar solicitação"}
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-faint">Escolha um horário para continuar.</p>
        )}
      </section>
    </div>
  );
}

function StepTitle({ n, id, done, children }: { n: number; id: string; done?: boolean; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-6 flex items-center gap-4">
      <span
        aria-hidden="true"
        className={`flex size-9 items-center justify-center rounded-full border text-sm tabular-nums ${done ? "border-accent bg-accent text-accent-contrast" : "border-ink-600 text-mute"}`}
      >
        {done ? "✓" : n}
      </span>
      <span className="display text-3xl text-bone sm:text-4xl">{children}</span>
      <span className="sr-only">{done ? " (concluído)" : ""}</span>
    </h2>
  );
}

/** Contagem regressiva informativa: a expiração real é controlada pelo servidor. */
function HoldTimer({ expiresAt, holdMinutes }: { expiresAt: string; holdMinutes: number }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  if (left == null) return null;
  const mm = String(Math.floor(left / 60000)).padStart(2, "0");
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, "0");
  return left > 0 ? (
    <Notice tone="info">
      Horário reservado temporariamente por <span className="tabular-nums text-bone">{mm}:{ss}</span> (até {holdMinutes} minutos) enquanto você preenche
      seus dados.
    </Notice>
  ) : (
    <Notice tone="warning">
      A reserva temporária expirou. Você ainda pode enviar: se o horário continuar livre, ele será registrado.
    </Notice>
  );
}
