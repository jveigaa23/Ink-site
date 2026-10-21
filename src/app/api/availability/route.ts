import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/db/client";
import { isAppError } from "@/lib/errors";
import { formatTime } from "@/lib/time";
import { localDateSchema } from "@/lib/validation";
import { getAvailability } from "@/server/booking/service";
import { hitRateLimit } from "@/server/rate-limit";
import { clientIpHash } from "@/server/request";

const query = z.object({ serviceId: z.string().uuid(), date: localDateSchema });
const noStore = { "Cache-Control": "no-store, max-age=0" };

/**
 * Horários disponíveis para um serviço em uma data (fuso do estúdio).
 * Informativo: a validação definitiva acontece ao reservar, dentro da transação.
 */
export async function GET(req: NextRequest) {
  const parsed = query.safeParse({
    serviceId: req.nextUrl.searchParams.get("serviceId"),
    date: req.nextUrl.searchParams.get("date"),
  });
  if (!parsed.success) return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400, headers: noStore });

  const db = getDb();
  const rl = await hitRateLimit(db, `avail:${await clientIpHash()}`, 120, 60);
  if (!rl.allowed) return NextResponse.json({ error: "Muitas consultas. Aguarde um instante." }, { status: 429, headers: noStore });

  try {
    const res = await getAvailability(db, parsed.data);
    return NextResponse.json(
      {
        date: parsed.data.date,
        reason: res.reason,
        slots: res.slots.map((s) => ({
          startsAt: s.startsAt.toISOString(),
          endsAt: s.endsAt.toISOString(),
          label: formatTime(s.startsAt, res.timezone),
        })),
      },
      { headers: noStore },
    );
  } catch (e) {
    if (isAppError(e)) return NextResponse.json({ error: e.message }, { status: e.status, headers: noStore });
    console.error("[availability]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível consultar a agenda agora." }, { status: 500, headers: noStore });
  }
}
