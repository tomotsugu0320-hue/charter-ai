// src/app/[tenant]/forum/thread/[id]/layout.tsx


import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import {
  absoluteUrl,
  siteDescription,
  siteName,
  truncateDescription,
} from "@/lib/seo";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{
    tenant: string;
    id: string;
  }>;
};

type ThreadSeoRow = {
  id: string;
  title: string | null;
  ai_summary: string | null;
  original_post: string | null;
};

export async function generateMetadata({
  params,
}: LayoutProps): Promise<Metadata> {
  const { tenant, id } = await params;
  const url = absoluteUrl(`/${tenant}/forum/thread/${id}`);

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: thread } = await supabase
      .from("forum_threads")
      .select("id, title, ai_summary, original_post")
      .eq("id", id)
      .maybeSingle<ThreadSeoRow>();

    const pageTitle = thread?.title
      ? `${thread.title} | ${siteName}`
      : `スレッド詳細 | ${siteName}`;
    const description = truncateDescription(
      thread?.ai_summary || thread?.original_post || siteDescription
    );

    return {
      title: pageTitle,
      description,
      alternates: {
        canonical: url,
      },
      openGraph: {
        title: pageTitle,
        description,
        url,
        siteName,
        type: "article",
      },
      twitter: {
        card: "summary",
        title: pageTitle,
        description,
      },
    };
  } catch {
    const pageTitle = `スレッド詳細 | ${siteName}`;
    const description = truncateDescription(siteDescription);

    return {
      title: pageTitle,
      description,
      alternates: {
        canonical: url,
      },
      openGraph: {
        title: pageTitle,
        description,
        url,
        siteName,
        type: "article",
      },
      twitter: {
        card: "summary",
        title: pageTitle,
        description,
      },
    };
  }
}

async function legacyGenerateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const resolved = await params;

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: thread } = await supabase
      .from("forum_threads")
      .select("title, original_post")
      .eq("id", resolved.id)
      .maybeSingle();

    const title = thread?.title
      ? `${thread.title} | AI掲示板`
      : "議論詳細 | AI掲示板";

    const description = thread?.original_post
      ? thread.original_post.slice(0, 120)
      : "論点・前提・根拠・反対意見を構造的に理解できる議論ページです。";

    const fullUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/${resolved.tenant}/forum/thread/${resolved.id}`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: fullUrl,
        siteName: "AI掲示板",
        type: "article",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
      },
    };
  } catch {
    return {
      title: "議論詳細 | AI掲示板",
      description:
        "論点・前提・根拠・反対意見を構造的に理解できる議論ページです。",
    };
  }
}

export default function ThreadLayout({ children }: LayoutProps) {
  return <>{children}</>;
}
