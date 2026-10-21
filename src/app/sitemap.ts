import type { MetadataRoute } from "next";
import { getPublicPortfolio } from "@/server/public-data";
import { env } from "@/server/env";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.appUrl;
  const { items } = await getPublicPortfolio();
  const pages = ["", "/portfolio", "/estudio", "/servicos", "/cuidados", "/contato", "/orcamento", "/agendar", "/privacidade"];
  return [
    ...pages.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 })),
    ...items
      .filter((i) => !i.isDemo)
      .map((i) => ({ url: `${base}/portfolio/${i.slug}`, changeFrequency: "monthly" as const, priority: 0.5, images: [i.imageUrl] })),
  ];
}
