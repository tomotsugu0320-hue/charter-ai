// api/forum/search-related



import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type ForumPostRow = {
  id: string;
  content: string;
  post_role: string | null;
  created_at: string | null;
  thread_id: string;
  forum_threads: { title?: string | null; category?: string | null } | { title?: string | null; category?: string | null }[] | null;
};

export async function POST(req: Request) {
  try {
    const { text, claim, premises, reasons, threadId } = await req.json();

    const searchTexts = [
      String(text ?? "").trim(),
      String(claim ?? "").trim(),
      ...(Array.isArray(premises) ? premises : []),
      ...(Array.isArray(reasons) ? reasons : []),
    ]
      .map((v) => String(v || "").replace(/[。？?！!]/g, "").trim())
      .filter(Boolean)
      .slice(0, 5);

    // 検索語がないなら空で返す
    if (searchTexts.length === 0) {
      return NextResponse.json({ threads: [] });
    }

    let query = supabase
      .from("forum_posts")
      .select(`
        id,
        content,
        post_role,
        created_at,
        thread_id,
        forum_threads (
          title,
          category
        )
      `)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(20);

    const orConditions = searchTexts
      .map((q) => `content.ilike.%${q.slice(0, 20)}%`)
      .join(",");

    query = query.or(orConditions);

    if (threadId) {
      query = query.neq("thread_id", threadId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("search-related forum_posts error:", error);
      return NextResponse.json({ threads: [] });
    }

    const rows = (data ?? []) as ForumPostRow[];

    // post単位 → thread単位にまとめる
    const threadMap = new Map<
      string,
      {
        id: string;
        title: string;
        category: string;
        summary: string;
      }
    >();

    for (const row of rows) {
      const threadInfo = Array.isArray(row.forum_threads)
        ? row.forum_threads[0]
        : row.forum_threads;

      if (!row.thread_id) continue;
      if (threadMap.has(row.thread_id)) continue;

      threadMap.set(row.thread_id, {
        id: row.thread_id,
        title: threadInfo?.title ?? "無題スレ",
        category: threadInfo?.category ?? "未分類",
        summary: String(row.content ?? "").slice(0, 100),
      });
    }

    let threads = Array.from(threadMap.values());

    // 0件なら保険で新しいスレを返す
    if (threads.length === 0) {
      let fallbackQuery = supabase
        .from("forum_threads")
        .select("id, title, category, summary")
        .order("created_at", { ascending: false })
        .limit(3);

      if (threadId) {
        fallbackQuery = fallbackQuery.neq("id", threadId);
      }

      const { data: fallbackData, error: fallbackError } = await fallbackQuery;

      if (fallbackError) {
        console.error("search-related fallback error:", fallbackError);
        return NextResponse.json({ threads: [] });
      }

      threads = (fallbackData ?? []).map((row: any) => ({
        id: row.id,
        title: row.title ?? "無題スレ",
        category: row.category ?? "未分類",
        summary: row.summary ?? "",
      }));
    }

    return NextResponse.json({ threads });
  } catch (e) {
    console.error("search-related route error:", e);
    return NextResponse.json({ threads: [] });
  }
}
