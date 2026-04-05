    // src/app/[tenant]/thread-detail/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const threadId = searchParams.get("threadId");

    if (!threadId) {
      return NextResponse.json(
        { success: false, error: "threadId is required" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: thread, error: threadError } = await supabase
      .from("forum_threads")
      .select("id, title, slug, original_post, created_at")
      .eq("id", threadId)
      .single();

    if (threadError) {
      return NextResponse.json(
        { success: false, error: threadError.message },
        { status: 500 }
      );
    }

    const { data: posts, error: postsError } = await supabase
      .from("forum_posts")
      .select(
        "id, thread_id, source_type, post_role, content, trust_status, created_at"
      )
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    if (postsError) {
      return NextResponse.json(
        { success: false, error: postsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      thread,
      posts: posts ?? [],
    });
  } catch (e: any) {
    console.error("[thread-detail error]", e);

    return NextResponse.json(
      { success: false, error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}