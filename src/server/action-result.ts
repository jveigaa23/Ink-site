import { z } from "zod";
import { isAppError } from "@/lib/errors";
import { fieldErrors } from "@/lib/validation";

export type ActionState<T = undefined> =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> }
  | { status: "success"; message?: string; data?: T };

export const idle = { status: "idle" } as const;

/** Converte qualquer erro em resposta segura para o usuário (sem detalhes internos). */
export function toErrorState(e: unknown): Extract<ActionState, { status: "error" }> {
  if (e instanceof z.ZodError) {
    return { status: "error", message: "Revise os campos destacados.", fieldErrors: fieldErrors(e) };
  }
  if (isAppError(e)) return { status: "error", message: e.message, fieldErrors: e.fieldErrors };
  console.error("[action] erro inesperado:", e instanceof Error ? `${e.name}: ${e.message}` : e);
  return { status: "error", message: "Não foi possível concluir agora. Tente novamente em instantes." };
}

/** redirect()/notFound() lançam erros especiais que precisam ser repassados. */
export function isNextControlFlow(e: unknown) {
  const digest = (e as { digest?: unknown })?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK"));
}
