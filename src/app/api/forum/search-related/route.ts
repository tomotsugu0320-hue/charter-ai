// api/forum/search-related


import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

    if (searchTexts.length === 0) {
      return NextResponse.json({ posts: [], summary: null });
    }

    let query = supabase
      .from("forum_posts")
      .select("id, content, post_role, created_at, thread_id")
      .order("created_at", { ascending: false })
      .limit(12);

    const orConditions = searchTexts
      .map((q) => `content.ilike.%${q.slice(0, 20)}%`)
      .join(",");

    query = query.or(orConditions);

    if (threadId) {
      query = query.neq("thread_id", threadId);
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