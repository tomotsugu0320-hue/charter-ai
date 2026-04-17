import type { MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/seo";

const defaultTenant = process.env.NEXT_PUBLIC_DEFAULT_TENANT || "dev";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getBaseUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          `/${defaultTenant}/forum`,
          `/${defaultTenant}/forum/thread/*`,
        ],
        disallow: [
          `/${defaultTenant}/forum/admin/*`,
          "/api/*",
          "/_next/*",
          "/private/*",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
