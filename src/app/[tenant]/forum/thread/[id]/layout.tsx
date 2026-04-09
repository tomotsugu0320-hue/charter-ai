// src/app/[tenant]/forum/thread/[id]/layout.tsx


import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{
    tenant: string;
    id: string;
  }>;
};

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
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