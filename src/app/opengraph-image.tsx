import { ImageResponse } from "next/og";
import { getPublicStudio } from "@/server/public-data";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Estúdio de tatuagem";

/** Imagem de compartilhamento gerada a partir do nome e chamada configurados. */
export default async function OgImage() {
  const s = await getPublicStudio();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "#0a0a0a",
          color: "#ece8e1",
          fontFamily: "serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 24, letterSpacing: 6, textTransform: "uppercase", color: "#a29d95" }}>
          <div style={{ width: 60, height: 2, background: s.accentColor }} />
          {s.tagline}
        </div>
        <div style={{ fontSize: 120, lineHeight: 1 }}>{s.name}</div>
        <div style={{ fontSize: 36, color: "#a29d95" }}>{s.heroTitle}</div>
      </div>
    ),
    size,
  );
}
