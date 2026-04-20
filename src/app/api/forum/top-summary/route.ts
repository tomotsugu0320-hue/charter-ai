// src/app/api/forum/top-summary/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ThreadRow = {
  id: string;
  title: string;
  category: string | null;
  created_at: string | null;
};

type PostRow = {
  thread_id: string;
  content: string | null;
  logic_score: number | null;
};

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  try {
    const { data: threads, error: threadsError } = await supabase
      .from("forum_threads")
      .select("id, title, category, created_at")
      .eq("is_deleted", false);

    if (threadsError) {
      throw new Error(threadsError.message);
    }

    const { data: posts, error: postsError } = await supabase
      .from("forum_posts")
      .select("thread_id, content, logic_score")
      .eq("is_deleted", false);

    if (postsError) {
      throw new Error(postsError.message);
    }

    const countMap = new Map<string, number>();
    const logicMap = new Map<string, { total: number; count: number }>();

    for (const post of (posts ?? []) as PostRow[]) {
      countMap.set(post.thread_id, (countMap.get(post.thread_id) ?? 0) + 1);

      if (typeof post.logic_score === "number") {
        const current = logicMap.get(post.thread_id) ?? { total: 0, count: 0 };
        logicMap.set(post.thread_id, {
          total: current.total + post.logic_score,
          count: current.count + 1,
        });
      }
    }

    const threadStats =
      ((threads ?? []) as ThreadRow[]).map((t) => {
        const count = countMap.get(t.id) ?? 0;
        const logic = logicMap.get(t.id);
        const avgLogicScore =
          logic && logic.count > 0 ? logic.total / logic.count : 0;

        return {
          id: t.id,
          title: t.title,
          category: t.category,
          created_at: t.created_at,
          post_count: count,
          avg_logic_score: avgLogicScore,
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
        return (
          new Date(b.created_at ?? 0).getTime() -
          new Date(a.created_at ?? 0).getTime()
        );
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
        return (
          new Date(b.created_at ?? 0).getTime() -
          new Date(a.created_at ?? 0).getTime()
        );
      })
      .slice(0, 5);

    return NextResponse.json({
      success: true,
      popularThreads,
      activeThreads,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "error";

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}