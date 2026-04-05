// src/app/api/forum/feedback/route.ts


import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_FEEDBACK_TYPES = [
  "term_unknown",
  "premise_unknown",
  "conclusion_unknown",
  "evidence_unknown",
  "counterargument_unknown",
] as const;

type AllowedFeedbackType = (typeof ALLOWED_FEEDBACK_TYPES)[number];

function isAllowedFeedbackType(value: string): value is AllowedFeedbackType {
  return ALLOWED_FEEDBACK_TYPES.includes(value as AllowedFeedbackType);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const threadId = String(body?.threadId ?? "").trim();
    const postId = String(body?.postId ?? "").trim();
    const feedbackType = String(body?.feedbackType ?? "").trim();

    if (!threadId) {
      return NextResponse.json(
        { success: false, error: "threadId is required" },
        { status: 400 }
      );
    }

    if (!postId) {
      return NextResponse.json(
        { success: false, error: "postId is required" },
        { status: 400 }
      );
    }

    if (!isAllowedFeedbackType(feedbackType)) {
      return NextResponse.json(
        { success: false, error: "invalid feedbackType" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase
      .from("forum_post_feedback")
      .insert({
        thread_id: threadId,
        post_id: postId,
        feedback_type: feedbackType,
      })
      .select("id, thread_id, post_id, feedback_type, created_at");

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      feedback: data ?? [],
    });
  } catch (e: any) {
    console.error("[forum feedback error]", e);

    return NextResponse.json(
      { success: false, error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}