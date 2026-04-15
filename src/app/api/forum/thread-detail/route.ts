    // src/app/api/forum/thread-detail/route.ts


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
.select(`
  id,
  title,
  slug,
  original_post,
  category,
  created_at,
  ai_premises,
  ai_reasons,
  ai_conflicts
`)
  .eq("id", threadId)
  .maybeSingle();

console.log("[thread-detail] thread =", thread);
console.log("[thread-detail] threadError =", threadError);

if (threadError) {
  return NextResponse.json(
    { success: false, error: threadError.message },
    { status: 500 }
  );
}

if (!thread) {
  return NextResponse.json(
    { success: false, error: "thread not found", threadId },
    { status: 404 }
  );
}


    const { data: posts, error: postsError } = await supabase
      .from("forum_posts")
.select(`
  id,
  thread_id,
  source_type,
  post_role,
  content,
  author_key,
  trust_status,
  created_at,
  logic_score,
  logic_score_reason,
  logic_break_type,
  logic_break_note,
  prediction_flag,
  prediction_target,
  prediction_deadline,
  prediction_result
`)
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    if (postsError) {
      return NextResponse.json(
        { success: false, error: postsError.message },
        { status: 500 }
      );
    }


    const { data: feedbackRows, error: feedbackError } = await supabase
      .from("forum_post_feedback")
      .select("post_id, feedback_type")
      .eq("thread_id", threadId);

    if (feedbackError) {
      return NextResponse.json(
        { success: false, error: feedbackError.message },
        { status: 500 }
      );
    }

    const feedbackMap: Record<
      string,
      {
        term_unknown: number;
        premise_unknown: number;
        conclusion_unknown: number;
        evidence_unknown: number;
        counterargument_unknown: number;
      }
    > = {};

    (feedbackRows ?? []).forEach((row: any) => {
      if (!feedbackMap[row.post_id]) {
        feedbackMap[row.post_id] = {
          term_unknown: 0,
          premise_unknown: 0,
          conclusion_unknown: 0,
          evidence_unknown: 0,
          counterargument_unknown: 0,
        };
      }

      if (row.feedback_type in feedbackMap[row.post_id]) {
        feedbackMap[row.post_id][
          row.feedback_type as keyof (typeof feedbackMap)[string]
        ] += 1;
      }
    });

    const postsWithFeedback = (posts ?? []).map((post: any) => ({
      ...post,
      feedback_counts: feedbackMap[post.id] ?? {
        term_unknown: 0,
        premise_unknown: 0,
        conclusion_unknown: 0,
        evidence_unknown: 0,
        counterargument_unknown: 0,
      },
    }));

    const feedbackSummary = {
      term_unknown: 0,
      premise_unknown: 0,
      conclusion_unknown: 0,
      evidence_unknown: 0,
      counterargument_unknown: 0,
    };

    (feedbackRows ?? []).forEach((row: any) => {
      if (row.feedback_type in feedbackSummary) {
        feedbackSummary[
          row.feedback_type as keyof typeof feedbackSummary
        ] += 1;
      }
    });

    return NextResponse.json({
      success: true,
      thread,
      posts: postsWithFeedback,
      feedback_summary: feedbackSummary,
    });
  } catch (e: any) {
    console.error("[thread-detail error]", e);

    return NextResponse.json(
      { success: false, error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

