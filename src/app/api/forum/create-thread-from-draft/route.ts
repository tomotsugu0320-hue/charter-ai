// src/app/api/forum/create-thread-from-draft/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPrivacyRisk } from "@/lib/privacy";

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
  conflicts,
} = body;
    if (!tenantSlug || !title || !claim) {
      return NextResponse.json(
        { error: "tenantSlug, title and claim are required" },
        { status: 400 }
      );
    }

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


let category = "政治・経済";

if (title.includes("売上") || title.includes("経営") || title.includes("集客")) {
  category = "ビジネス";
} else if (title.includes("恋愛") || title.includes("彼女") || title.includes("彼氏")) {
  category = "恋愛";
} else if (title.includes("健康") || title.includes("筋トレ") || title.includes("ダイエット")) {
  category = "健康";
} else if (title.includes("雑談")) {
  category = "雑談";
}

    const content =
     Array.isArray(premises) && Array.isArray(reasons)
        ? [
            `主張: ${claim}`,
            ...premises.map((p: string) => `前提: ${p}`),
            ...reasons.map((r: string) => `根拠: ${r}`),
          ].join("\n")
        : claim;


const privacy = checkPrivacyRisk(content);

    const { data: thread, error: threadError } = await supabase
      .from("forum_threads")
.insert({
  title,
  slug: `${title}-${Date.now()}`,
  original_post: privacy.maskedText,
  visibility: "public",
  category: category,
  ai_premises: Array.isArray(premises) ? premises : [],
  ai_reasons: Array.isArray(reasons) ? reasons : [],
  ai_conflicts: Array.isArray(conflicts) ? conflicts : [],
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

const { error: postError } = await supabase
  .from("forum_posts")
  .insert({
    thread_id: thread.id,
    source_type: "human",
    post_role: "issue_raise",
    content,
    raw_text: content,
    sanitized_text: privacy.maskedText,
    is_sensitive: privacy.isSensitive,
    privacy_flags: privacy.flags,
    privacy_score: privacy.score,
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