import "server-only";
import { headers } from "next/headers";
import { keyedHash } from "@/lib/crypto";

/** IP do cliente informado pela plataforma (Vercel define x-forwarded-for / x-real-ip). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/** IP convertido em hash com segredo do servidor: serve para antiabuso sem guardar o IP. */
export async function clientIpHash(): Promise<string> {
  return keyedHash(await clientIp());
}

export async function userAgent(): Promise<string | null> {
  return (await headers()).get("user-agent");
}
