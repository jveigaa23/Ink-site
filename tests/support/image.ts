import sharp from "sharp";

export async function makeImageFile(name = "ref.jpg", w = 800, h = 600, withExif = false) {
  let img = sharp({ create: { width: w, height: h, channels: 3, background: { r: 30, g: 30, b: 30 } } }).jpeg();
  if (withExif) img = img.withExif({ IFD0: { Copyright: "secret-gps-like-metadata" } });
  const buf = await img.toBuffer();
  return new File([new Uint8Array(buf)], name, { type: "image/jpeg" });
}
