// src/app/api/forum/top-summary/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  try {
    // スレッド取得
    const { data: threads, error: threadError } = await supabase
      .from("forum_threads")
      .select("id, title, category, created_at")

    if (threadError) {
      throw threadError;
    }

    // 投稿取得
    const { data: posts, error: postError } = await supabase
      .from("forum_posts")
      .select("thread_id, logic_score");

    if (postError) {
      throw postError;
    }

    // 集計
    const map = new Map<string, { count: number; totalScore: number }>();

    for (const post of posts ?? []) {
      const entry = map.get(post.thread_id) || { count: 0, totalScore: 0 };

      entry.count += 1;
      entry.totalScore += post.logic_score ?? 0;

      map.set(post.thread_id, entry);
    }

    const threadStats =
      threads?.map((t) => {
        const stat = map.get(t.id) || { count: 0, totalScore: 0 };

        const avg =
          stat.count > 0 ? Math.round(stat.totalScore / stat.count) : 0;

return {
  id: t.id,
  title: t.title,
  category: t.category,
  created_at: t.created_at,
  post_count: stat.count,
  avg_logic_score: avg,
};
      }) ?? [];

    // 人気スレ
    const popularThreads = [...threadStats]
      .sort((a, b) => {
        if (b.avg_logic_score !== a.avg_logic_score) {
          return b.avg_logic_score - a.avg_logic_score;
        }
        return b.post_count - a.post_count;
      })
      .slice(0, 5);

    // 活発スレ
    const activeThreads = [...threadStats]
      .sort((a, b) => {
        if (b.post_count !== a.post_count) {
          return b.post_count - a.post_count;
        }
        return b.avg_logic_score - a.avg_logic_score;
      })
      .slice(0, 5);

    return NextResponse.json({
      success: true,
      popularThreads,
      activeThreads,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { success: false, error: e?.message || "エラー" },
      { status: 500 }
    );
  }
}