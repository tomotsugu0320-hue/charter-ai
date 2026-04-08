// api/forum/search-related

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const { text, threadId } = await req.json();

const keyword = String(text ?? "")
  .replace(/[。？?！!]/g, "")
  .slice(0, 15)
  .trim();

    if (!keyword) {
      return NextResponse.json({ posts: [], summary: null });
    }

    let query = supabase
      .from("forum_posts")
      .select("id, content, post_role, created_at, thread_id")
      .ilike("content", `%${keyword}%`)
      .order("created_at", { ascending: false })
      .limit(8);

    if (threadId) {
      query = query.eq("thread_id", threadId);
    }

    const { data, error } = await query;

    if (error) {
      console.error(error);
      return NextResponse.json({ posts: [], summary: null });
    }

    return NextResponse.json({
      posts: data ?? [],
      summary: null,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ posts: [], summary: null });
  }
}