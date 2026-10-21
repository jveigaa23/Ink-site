"use client";

import { useActionState } from "react";
import { loginAction } from "../_actions/auth";
import type { ActionState } from "@/server/action-result";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/field";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(loginAction, { status: "idle" });
  const errors = state.status === "error" ? state.fieldErrors : undefined;
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={next} />
      {state.status === "error" && !errors ? (
        <Notice tone="danger" role="alert">
          {state.message}
        </Notice>
      ) : null}
      <TextField label="E-mail" name="email" type="email" autoComplete="username" required error={errors?.email} />
      <TextField label="Senha" name="password" type="password" autoComplete="current-password" required error={errors?.password} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
