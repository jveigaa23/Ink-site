import sharp from "sharp";
import { generateToken } from "@/lib/crypto";
import { AppError } from "@/lib/errors";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // abaixo do limite de corpo das funções da Vercel (4,5 MB)
const ALLOWED_INPUT = new Set(["jpeg", "png", "webp", "avif", "gif"]);

export type ProcessedImage = {
  buffer: Buffer;
  contentType: "image/webp";
  width: number;
  height: number;
  blurDataUrl: string;
  sizeBytes: number;
};

/**
 * Valida e normaliza uma imagem enviada:
 * - confere o conteúdo real (não confia em extensão ou Content-Type);
 * - limita dimensões, corrige orientação e REMOVE metadados (EXIF/GPS);
 * - reencoda em WebP, o que também neutraliza conteúdo malicioso embutido.
 */
export async function processImage(file: File, opts: { maxDimension?: number } = {}): Promise<ProcessedImage> {
  if (!(file instanceof File) || file.size === 0) throw new AppError("INVALID_FILE", "Arquivo de imagem inválido.");
  if (file.size > MAX_UPLOAD_BYTES) throw new AppError("FILE_TOO_LARGE", "Imagem acima de 4 MB.");

  const input = Buffer.from(await file.arrayBuffer());
  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    meta = await sharp(input, { limitInputPixels: 40_000_000 }).metadata();
  } catch {
    throw new AppError("INVALID_FILE", "O arquivo enviado não é uma imagem válida.");
  }
  if (!meta.format || !ALLOWED_INPUT.has(meta.format)) {
    throw new AppError("INVALID_FILE", "Formato não suportado. Use JPG, PNG ou WebP.");
  }

  const max = opts.maxDimension ?? 2400;
  const pipeline = sharp(input, { limitInputPixels: 40_000_000, animated: false })
    .rotate()
    .resize({ width: max, height: max, fit: "inside", withoutEnlargement: true });
  const { data, info } = await pipeline.webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  const blur = await sharp(data).resize(16, 16, { fit: "inside" }).webp({ quality: 40 }).toBuffer();

  return {
    buffer: data,
    contentType: "image/webp",
    width: info.width,
    height: info.height,
    blurDataUrl: `data:image/webp;base64,${blur.toString("base64")}`,
    sizeBytes: data.length,
  };
}

/** Nome de arquivo seguro e imprevisível; nunca usa o nome enviado pelo usuário. */
export const safeObjectKey = (prefix: "portfolio" | "site" | "references") =>
  `${prefix}/${new Date().toISOString().slice(0, 7)}/${generateToken(18)}.webp`;
