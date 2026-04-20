// src/app/api/forum/create-thread-from-draft/route.ts




import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function makeSlug(input: string) {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const fallback = "thread";
  const random = Math.random().toString(36).slice(2, 8);

  return `${base || fallback}-${random}`;
}

type Conflict = {
  opinion?: string;
  rebuttal?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const title = String(body?.title || "").trim();
    const claim = String(body?.claim || "").trim();
    const premises = Array.isArray(body?.premises) ? body.premises : [];
    const reasons = Array.isArray(body?.reasons) ? body.reasons : [];
    const conflicts: Conflict[] = Array.isArray(body?.conflicts) ? body.conflicts : [];
    const postType = body?.postType === "auto" ? "auto" : "human";

    if (!title || !claim) {
      return NextResponse.json(
        { success: false, error: "title and claim are required" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { success: false, error: "Supabase env is missing" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const slug = makeSlug(title);

    const { data: existing } = await supabase
      .from("forum_threads")
      .select("id")
      .eq("title", title)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        success: true,
        threadId: existing.id,
      });
    }

    const { data: thread, error: threadError } = await supabase
      .from("forum_threads")
      .insert({
        title,
        slug,
        original_post: claim,
        category: null,
        ai_summary: null,
        is_deleted: false,
      })
      .select("id")
      .single();

    if (threadError || !thread) {
      return NextResponse.json(
        { success: false, error: threadError?.message || "thread insert failed" },
        { status: 500 }
      );
    }

    const threadId = thread.id;

    const seedPosts: {
      thread_id: string;
      content: string;
      source_type: string;
      post_role: string;
      trust_status: string;
      logic_score: number;
      author_key: string;
    }[] = [
    {
      thread_id: threadId,
      content: claim,
      source_type: postType === "auto" ? "ai" : "human",
      post_role: "issue_raise",
      trust_status: "trusted",
      logic_score: 70,
      author_key: "system",
    },
    ];

    for (const premise of premises) {
      const text = String(premise || "").trim();
      if (!text) continue;

      seedPosts.push({
        thread_id: threadId,
        content: text,
        source_type: "ai",
        post_role: "supplement",
        trust_status: "trusted",
        logic_score: 85,
        author_key: "system",
      });
    }

    for (const reason of reasons) {
      const text = String(reason || "").trim();
      if (!text) continue;
      seedPosts.push({
        thread_id: threadId,
        content: `根拠: ${reason}`,
        source_type: "ai",
        post_role: "explanation",
        trust_status: "trusted",
        logic_score: 90,
        author_key: "system",
      });
    }


    for (const conflict of conflicts) {
      const opinion = String(conflict?.opinion || "").trim();
      const rebuttal = String(conflict?.rebuttal || "").trim();

      if (opinion) {
        seedPosts.push({
          thread_id: threadId,
          content: opinion,
          source_type: "ai",
          post_role: "opinion",
          trust_status: "trusted",
          logic_score: 75,
          author_key: "system",
        });
      }

      if (rebuttal) {
        seedPosts.push({
          thread_id: threadId,
          content: rebuttal,
          source_type: "ai",
          post_role: "rebuttal",
          trust_status: "trusted",
          logic_score: 95,
          author_key: "system",
        });
      }
    }

    const { error: postError } = await supabase
      .from("forum_posts")
      .insert(seedPosts);

    if (postError) {
      return NextResponse.json(
        { success: false, error: postError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      threadId,
    });
  } catch (e: any) {
    console.error("[create-thread-from-draft error]", e);

    return NextResponse.json(
      {
        success: false,
        error: e?.message || "unexpected error",
      },
      { status: 500 }
    );
  }
}