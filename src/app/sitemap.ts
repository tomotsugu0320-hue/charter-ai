import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { getBaseUrl } from "@/lib/seo";

type ThreadRow = {
  id: string;
  created_at: string | null;
};

const defaultTenant = process.env.NEXT_PUBLIC_DEFAULT_TENANT || "dev";

function fixedPages(baseUrl: string): MetadataRoute.Sitemap {
  return [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/${defaultTenant}/forum`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.8,
    },
  ];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();
  const pages = fixedPages(baseUrl);

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase
      .from("forum_threads")
      .select("id, created_at")
      .eq("is_deleted", false)
      .order("created_at", { ascending: false });

    if (error) {
      return pages;
    }

    const threadPages: MetadataRoute.Sitemap = ((data ?? []) as ThreadRow[]).map(
      (thread) => ({
        url: `${baseUrl}/${defaultTenant}/forum/thread/${thread.id}`,
        lastModified: thread.created_at
          ? new Date(thread.created_at)
          : new Date(),
        changeFrequency: "weekly",
        priority: 0.6,
      })
    );

    return [...pages, ...threadPages];
  } catch {
    return pages;
  }
}
