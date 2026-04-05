    // src/app/api/forum/create-thread/route.ts

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


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const suggestionId = body?.suggestionId;

    if (!suggestionId) {
      return NextResponse.json(
        { success: false, error: "suggestionId is required" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // ① suggestion 取得
    const { data: suggestion, error: suggestionError } = await supabase
      .from("thread_suggestions")
      .select("*")
      .eq("id", suggestionId)
      .single();

    if (suggestionError || !suggestion) {
      return NextResponse.json(
        { success: false, error: "suggestion not found" },
        { status: 404 }
      );
    }

const rawText = suggestion.proposed_text;

// ② 仮タイトル（今はそのまま）
const title = rawText;
const slug = makeSlug(title);


// ③ forum_threads 作成
const { data: thread, error: threadError } = await supabase
  .from("forum_threads")
  .insert({
    title: title,
    slug: slug,
    original_post: rawText,
  })
  .select("id")
  .single();

    if (threadError || !thread) {
      return NextResponse.json(
        { success: false, error: threadError?.message },
        { status: 500 }
      );
    }

    const threadId = thread.id;

    // ④ 最初の投稿作成
const { error: postError } = await supabase
  .from("forum_posts")
  .insert({
    thread_id: threadId,
source_type: "human",
post_role: "issue_raise",
    content: rawText,
    trust_status: "trusted",
  });

    if (postError) {
      return NextResponse.json(
        { success: false, error: postError.message },
        { status: 500 }
      );
    }

    // ⑤ suggestionを完了にする
    await supabase
      .from("thread_suggestions")
      .update({ status: "done" })
      .eq("id", suggestionId);

    return NextResponse.json({
      success: true,
      threadId,
    });
  } catch (e: any) {
    console.error("[create-thread error]", e);

    return NextResponse.json(
      { success: false, error: e?.message },
      { status: 500 }
    );
  }
}