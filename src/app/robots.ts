import type { MetadataRoute } from "next";
import { env } from "@/server/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/acompanhar/"] }],
    sitemap: `${env.appUrl}/sitemap.xml`,
  };
}
