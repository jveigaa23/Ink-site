"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { changePassword, login, revokeSession } from "@/server/auth/core";
import { clearSessionCookie, readSessionToken, requireAdmin, setSessionCookie } from "@/server/auth/session";
import { isNextControlFlow, toErrorState, type ActionState } from "@/server/action-result";
import { clientIp, userAgent } from "@/server/request";

const loginSchema = z.object({
  email: z.string().trim().email("E-mail inválido.").max(200),
  password: z.string().min(1, "Informe a senha.").max(200),
});

export async function loginAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const input = loginSchema.parse({ email: fd.get("email"), password: fd.get("password") });
    const { token } = await login(getDb(), { ...input, ip: await clientIp(), userAgent: await userAgent() });
    await setSessionCookie(token);
  } catch (e) {
    if (isNextControlFlow(e)) throw e;
    return toErrorState(e);
  }
  const next = String(fd.get("next") ?? "");
  // apenas caminhos internos do painel (evita redirecionamento aberto)
  redirect(/^\/admin(\/[\w\-/]*)?$/.test(next) ? next : "/admin");
}

export async function logoutAction() {
  const token = await readSessionToken();
  if (token) await revokeSession(getDb(), token);
  await clearSessionCookie();
  redirect("/admin/login");
}

const passwordSchema = z
  .object({ currentPassword: z.string().min(1, "Informe a senha atual."), newPassword: z.string(), confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { message: "As senhas não conferem.", path: ["confirm"] });

export async function changePasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    const input = passwordSchema.parse(Object.fromEntries(fd));
    await changePassword(getDb(), {
      userId: admin.id,
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
      keepSessionId: admin.sessionId,
    });
    return { status: "success", message: "Senha alterada. As outras sessões foram encerradas." };
  } catch (e) {
    if (isNextControlFlow(e)) throw e;
    return toErrorState(e);
  }
}
