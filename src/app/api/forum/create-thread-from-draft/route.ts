// src/app/api/forum/create-thread-from-draft/route.ts



import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const { draftId, tenantSlug } = await req.json();

    if (!draftId || !tenantSlug) {
      return NextResponse.json(
        { error: "draftId and tenantSlug are required" },
        { status: 400 }
      );
    }

    // tenant取得
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id")
      .eq("slug", tenantSlug)
      .single();

    if (tenantError || !tenant) {
      console.error("tenant error:", tenantError);
      return NextResponse.json(
        { error: "tenant not found" },
        { status: 404 }
      );
    }

    // draft取得
    const { data: draft, error: draftError } = await supabase
      .from("forum_issue_drafts")
      .select("*")
      .eq("id", draftId)
      .single();

    if (draftError || !draft) {
      console.error("draft error:", draftError);
      return NextResponse.json(
        { error: "draft not found" },
        { status: 404 }
      );
    }

    // すでにスレ化されてる場合
    if (draft.thread_id) {
      return NextResponse.json({
        success: true,
        threadId: draft.thread_id,
        alreadyCreated: true,
      });
    }


    // スレ作成
const { data: thread, error: threadError } = await supabase
  .from("forum_threads")
  .insert({
    tenant_id: tenant.id,
    title: draft.claim,
  })
  .select("id")
  .single();


    if (threadError || !thread) {
      console.error("thread create error:", threadError);
      return NextResponse.json(
        { error: "failed to create thread" },
        { status: 500 }
      );
    }

    // 初期投稿
    const { error: postError } = await supabase
      .from("forum_posts")
      .insert({
        thread_id: thread.id,
        source_type: "human",
        post_role: "issue_raise",
        content: draft.raw_content,
      });

    if (postError) {
      console.error("post create error:", postError);
      return NextResponse.json(
        { error: "failed to create post" },
        { status: 500 }
      );
    }

    // draft更新
    await supabase
      .from("forum_issue_drafts")
      .update({
        thread_id: thread.id,
        published_at: new Date().toISOString(),
      })
      .eq("id", draft.id);

    return NextResponse.json({
      success: true,
      threadId: thread.id,
    });
  } catch (error) {
    console.error("create-thread-from-draft error:", error);
    return NextResponse.json(
      { error: "unexpected error" },
      { status: 500 }
    );
  }
}