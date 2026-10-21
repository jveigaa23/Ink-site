import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, put } from "@vercel/blob";
import { env } from "@/server/env";
import { AppError } from "@/lib/errors";

/**
 * Armazenamento de mídia.
 * - "public": imagens do portfólio e do site (Vercel Blob, store público, servido por CDN).
 * - "private": referências enviadas por clientes (Vercel Blob, store privado). Só são
 *   lidas pelo servidor através de rota autenticada do painel.
 * Em desenvolvimento, sem tokens configurados, usa o disco local (.data/uploads) — nunca em produção.
 */
export type Visibility = "public" | "private";

const LOCAL_ROOT = path.join(process.cwd(), ".data", "uploads");

function tokenFor(v: Visibility) {
  return v === "public" ? env.blobPublicToken() : env.blobPrivateToken();
}

function isLocalDriver(v: Visibility) {
  if (tokenFor(v)) return false;
  if (env.isProd && process.env.ALLOW_LOCAL_STORAGE !== "1") {
    throw new AppError(
      "STORAGE_NOT_CONFIGURED",
      v === "public"
        ? "Armazenamento de imagens não configurado (BLOB_READ_WRITE_TOKEN)."
        : "Armazenamento privado não configurado (BLOB_PRIVATE_READ_WRITE_TOKEN).",
      503,
    );
  }
  return true;
}

function safeLocalPath(v: Visibility, key: string) {
  const full = path.join(LOCAL_ROOT, v, key);
  if (!full.startsWith(path.join(LOCAL_ROOT, v) + path.sep)) throw new Error("Caminho inválido.");
  return full;
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
  visibility: Visibility,
): Promise<{ key: string; url: string }> {
  if (isLocalDriver(visibility)) {
    const file = safeLocalPath(visibility, key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
    return { key, url: visibility === "public" ? `/api/dev-media/${key}` : `local:${key}` };
  }
  const res = await put(key, body, {
    access: visibility,
    contentType,
    addRandomSuffix: false,
    token: tokenFor(visibility),
    cacheControlMaxAge: visibility === "public" ? 31_536_000 : 0,
  });
  // A chave persistida é o pathname; para blobs públicos, a URL é a do CDN.
  return { key: res.pathname, url: res.url };
}

export async function getPrivateObject(key: string): Promise<{ body: ReadableStream | Buffer; contentType: string } | null> {
  if (isLocalDriver("private")) {
    try {
      return { body: await readFile(safeLocalPath("private", key)), contentType: "image/webp" };
    } catch {
      return null;
    }
  }
  const res = await get(key, { access: "private", token: tokenFor("private") });
  if (!res || res.statusCode !== 200 || !res.stream) return null;
  return { body: res.stream, contentType: res.blob.contentType };
}

export async function readLocalPublic(key: string): Promise<Buffer | null> {
  if (env.isProd && process.env.ALLOW_LOCAL_STORAGE !== "1") return null;
  try {
    return await readFile(safeLocalPath("public", key));
  } catch {
    return null;
  }
}

export async function deleteObject(keyOrUrl: string, visibility: Visibility) {
  if (isLocalDriver(visibility)) {
    await rm(safeLocalPath(visibility, keyOrUrl), { force: true });
    return;
  }
  await del(keyOrUrl, { token: tokenFor(visibility) });
}
