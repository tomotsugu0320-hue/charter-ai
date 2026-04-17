// src/app/api/forum/top-summary/route.ts


import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  try {
    const { data: threads } = await supabase
      .from("forum_threads")
      .select("id, title, category, created_at")
      .eq("is_deleted", false);

    const { data: posts } = await supabase
      .from("forum_posts")
      .select("thread_id, content")
      .eq("is_deleted", false);

    const map = new Map<string, number>();

    for (const post of posts ?? []) {
      map.set(post.thread_id, (map.get(post.thread_id) ?? 0) + 1);
    }

    const threadStats =
      threads?.map((t) => {
        const count = map.get(t.id) ?? 0;

        return {
          id: t.id,
          title: t.title,
          category: t.category,
          created_at: t.created_at,
          post_count: count,
          avg_logic_score: 0,
        };
      }) ?? [];

    const popularThreads = [...threadStats]
      .sort((a, b) => {
        if (b.avg_logic_score !== a.avg_logic_score) {
          return b.avg_logic_score - a.avg_logic_score;
        }
        if (b.post_count !== a.post_count) {
          return b.post_count - a.post_count;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      })
      .slice(0, 100);

    const activeThreads = [...threadStats]
      .sort((a, b) => {
        if (b.post_count !== a.post_count) {
          return b.post_count - a.post_count;
        }
        if (b.avg_logic_score !== a.avg_logic_score) {
          return b.avg_logic_score - a.avg_logic_score;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      })
      .slice(0, 5);

    return NextResponse.json({
      success: true,
      popularThreads,
      activeThreads,
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "error" },
      { status: 500 }
    );
  }
}
