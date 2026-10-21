import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { env } from "@/server/env";
import { SESSION_TTL_MS, validateSession, type AdminIdentity } from "./core";

/** Prefixo __Host- exige Secure, Path=/ e ausência de Domain (proteção contra sobrescrita por subdomínios). */
export const SESSION_COOKIE = env.isProd ? "__Host-studio_admin" : "studio_admin";

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function readSessionToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

/** Identidade do administrador da requisição atual (deduplicada por renderização). */
export const getAdmin = cache(async (): Promise<AdminIdentity | null> => {
  return validateSession(getDb(), await readSessionToken());
});

/**
 * Exige sessão administrativa válida. Use em TODA página, Server Action e Route Handler do painel.
 * A verificação acontece no servidor; o layout do painel não é uma barreira de segurança.
 */
export async function requireAdmin(): Promise<AdminIdentity> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
