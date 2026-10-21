import { readLocalPublic } from "@/server/storage";

/** Serve imagens públicas gravadas em disco SOMENTE em desenvolvimento/testes (sem Vercel Blob). */
export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_STORAGE !== "1") return new Response("Not found", { status: 404 });
  const { key } = await ctx.params;
  const buf = await readLocalPublic(key.join("/"));
  if (!buf) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "image/webp", "Cache-Control": "no-store" } });
}
