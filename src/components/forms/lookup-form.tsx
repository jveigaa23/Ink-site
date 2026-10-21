"use client";

import { useActionState } from "react";
import { lookupAction, type LookupState } from "@/app/actions/public";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/field";

export function LookupForm() {
  const [state, action, pending] = useActionState<LookupState, FormData>(lookupAction, { status: "idle" });
  const errors = state.status === "error" ? state.fieldErrors : undefined;
  return (
    <div className="space-y-8">
      <form action={action} className="grid gap-5 sm:grid-cols-2">
        <TextField label="Protocolo" name="protocol" required placeholder="AG-XXXX-XXXX" autoCapitalize="characters" error={errors?.protocol} />
        <TextField label="E-mail ou telefone informado" name="contact" required autoComplete="email" error={errors?.contact} />
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Consultando…" : "Consultar"}
          </Button>
        </div>
      </form>
      <div aria-live="polite">
        {state.status === "error" && !errors ? <Notice tone="danger" role="alert">{state.message}</Notice> : null}
        {state.status === "success" && state.data ? (
          <div className="border border-ink-700 bg-ink-900 p-6">
            <p className="eyebrow">{state.data.kind === "quote" ? "Orçamento" : "Agendamento"} · {state.data.protocol}</p>
            <p className="display mt-3 text-3xl">{state.data.statusLabel}</p>
            {state.data.detail ? <p className="mt-2 text-bone-dim">{state.data.detail}</p> : null}
            <p className="mt-4 text-xs text-faint">Para remarcar ou cancelar, use o link recebido no momento da solicitação ou fale com o estúdio.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
