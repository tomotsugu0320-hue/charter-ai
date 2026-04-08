// src/app/api/forum/create-thread-from-draft/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      tenantSlug,
      title,
      claim,
      premises,
      reasons,

      // 👇 追加（AI構造）
      summaryText,
      issues,
      conflicts,
      fullStructure,
    } = body;

    if (!tenantSlug || !title || !claim) {
      return NextResponse.json(
        { error: "tenantSlug, title and claim are required" },
        { status: 400 }
      );
    }

    // tenant確認
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

    // スレ作成
    const { data: thread, error: threadError } = await supabase
      .from("forum_threads")
      .insert({
        title,
        slug: `${title}-${Date.now()}`,
        original_post: claim,
        visibility: "public",
      })
      .select("id")
      .single();

    if (threadError || !thread) {
      console.error("thread create error:", threadError);
      return NextResponse.json(
        {
          error:
            threadError?.message ||
            threadError?.details ||
            JSON.stringify(threadError) ||
            "failed to create thread",
        },
        { status: 500 }
      );
    }

    // 👇 投稿内容生成
    const content =
      Array.isArray(premises) && Array.isArray(reasons)
        ? [
            `主張: ${claim}`,
            ...premises.map((p: string) => `前提: ${p}`),
            ...reasons.map((r: string) => `根拠: ${r}`),
          ].join("\n")
        : claim;

    // 👇 初期投稿（論点）
    const { error: postError } = await supabase
      .from("forum_posts")
      .insert({
        thread_id: thread.id,
        source_type: "human",
        post_role: "issue_raise",
        content,
      });

    if (postError) {
      console.error("post create error:", postError);
      return NextResponse.json(
        {
          error:
            postError?.message ||
            postError?.details ||
            JSON.stringify(postError) ||
            "failed to create post",
        },
        { status: 500 }
      );
    }

    // ===============================
    // 🔥 ここが今回の追加（超重要）
    // ===============================

    const { error: structureError } = await supabase
      .from("thread_ai_structures")
      .upsert({
        thread_id: thread.id,
        summary_text: summaryText ?? null,

        issues: Array.isArray(issues) ? issues : [],
        conflicts: Array.isArray(conflicts) ? conflicts : [],

        // 使わないが将来用に空で入れておく
        opinions: [],
        rebuttals: [],
        supplements: [],
        explanations: [],

        full_structure_json: fullStructure ?? null,
      });

    if (structureError) {
      console.error("structure save error:", structureError);
      return NextResponse.json(
        {
          error:
            structureError?.message ||
            structureError?.details ||
            JSON.stringify(structureError) ||
            "failed to save structure",
        },
        { status: 500 }
      );
    }

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