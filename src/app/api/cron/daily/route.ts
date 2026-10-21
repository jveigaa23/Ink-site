import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/db/client";
import { env } from "@/server/env";
import { runDailyMaintenance } from "@/server/maintenance";

/** Chamado pelo Vercel Cron (ver vercel.json) com Authorization: Bearer CRON_SECRET. */
export async function GET(req: Request) {
  const secret = env.cronSecret();
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const ok = secret.length >= 16 && auth.length === expected.length && timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
  if (!ok) return new Response("Não autorizado", { status: 401 });
  try {
    const result = await runDailyMaintenance(getDb());
    return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[cron] falhou:", e instanceof Error ? e.message : e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
