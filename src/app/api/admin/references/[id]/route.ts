import { getDb } from "@/db/client";
import { getAdmin } from "@/server/auth/session";
import { getReference } from "@/server/quotes/service";
import { getPrivateObject } from "@/server/storage";

/** Entrega imagens de referência PRIVADAS apenas para administradores autenticados. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) return new Response("Não autorizado", { status: 401 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Não encontrado", { status: 404 });
  const ref = await getReference(getDb(), id);
  if (!ref) return new Response("Não encontrado", { status: 404 });
  const obj = await getPrivateObject(ref.storageKey);
  if (!obj) return new Response("Não encontrado", { status: 404 });
  const body: BodyInit = obj.body instanceof ReadableStream ? obj.body : new Uint8Array(obj.body);
  return new Response(body, {
    headers: {
      "Content-Type": ref.contentType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
