"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, type ReactNode } from "react";
import { compressImage } from "@/lib/client-image";
import type { ActionState } from "@/server/action-result";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { FormErrorsContext } from "@/components/ui/field";

type Props = {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  /** Em componentes de servidor use children comuns: os campos leem seus erros pelo `name`. */
  children?: ReactNode | ((errors: Record<string, string> | undefined) => ReactNode);
  submitLabel: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  /** Pede confirmação antes de enviar (ações destrutivas). */
  confirm?: string;
  className?: string;
  resetOnSuccess?: boolean;
  inline?: boolean;
  /** Reduz imagens no navegador antes do envio (limite de 4 MB por requisição). */
  compressImages?: number;
};

/** Formulário do painel: envia uma Server Action e mostra sucesso/erro de forma acessível. */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Salvando…",
  variant = "primary",
  size = "md",
  confirm,
  className = "",
  resetOnSuccess,
  inline,
  compressImages,
}: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as ActionState);
  const ref = useRef<HTMLFormElement>(null);
  const errors = state.status === "error" ? state.fieldErrors : undefined;

  useEffect(() => {
    if (state.status === "success") {
      if (resetOnSuccess) ref.current?.reset();
      router.refresh();
    }
  }, [state, resetOnSuccess, router]);

  return (
    <form
      ref={ref}
      action={formAction}
      onSubmit={async (e) => {
        if (confirm && !window.confirm(confirm)) {
          e.preventDefault();
          return;
        }
        if (!compressImages) return;
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        for (const [key, value] of Array.from(fd.entries())) {
          if (value instanceof File && value.size > 0) fd.set(key, await compressImage(value, compressImages, 0.9));
        }
        startTransition(() => formAction(fd));
      }}
      className={inline ? `inline-flex flex-col gap-2 ${className}` : `space-y-4 ${className}`}
    >
      <FormErrorsContext value={errors}>{typeof children === "function" ? children(errors) : children}</FormErrorsContext>
      <div aria-live="polite">
        {state.status === "error" ? (
          <Notice tone="danger" role="alert">
            {state.message}
          </Notice>
        ) : state.status === "success" && state.message ? (
          <Notice tone="success" role="status">
            {state.message}
          </Notice>
        ) : null}
      </div>
      <div>
        <Button type="submit" variant={variant} size={size} disabled={pending} aria-busy={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
