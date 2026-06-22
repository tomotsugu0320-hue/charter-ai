import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUMMARY_TYPE = "thread_summary_from_classifications";

type RouteContext = {
  params: Promise<{ threadId: string }>;
};

type PostRow = {
  id: string;
  post_role: string | null;
};

type ClassificationRow = {
  classification: string | null;
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) return null;

  return createClient(url, serviceRole, {
    auth: { persistSession: false },
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { threadId } = await context.params;
  const normalizedThreadId = threadId.trim();

  if (!normalizedThreadId) {
    return NextResponse.json({ ok: false, error: "threadId is required." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase environment is not configured." },
      { status: 500 }
    );
  }

  const { data: thread, error: threadError } = await supabase
    .from("forum_threads")
    .select("id, title, category, original_post, created_at")
    .eq("id", normalizedThreadId)
    .eq("is_deleted", false)
    .maybeSingle();

  if (threadError) {
    return NextResponse.json({ ok: false, error: "スレッドを取得できませんでした。" }, { status: 500 });
  }

  if (!thread) {
    return NextResponse.json({ ok: false, error: "政策提言候補が見つかりません。" }, { status: 404 });
  }

  const { data: structure, error: structureError } = await supabase
    .from("thread_ai_structures")
    .select("summary_type, summary_text, easy_summary_text, key_points, updated_at")
    .eq("thread_id", normalizedThreadId)
    .eq("summary_type", SUMMARY_TYPE)
    .eq("status", "active")
    .maybeSingle();

  if (structureError) {
    return NextResponse.json({ ok: false, error: "AI再総括を取得できませんでした。" }, { status: 500 });
  }

  if (!structure) {
    return NextResponse.json({ ok: false, error: "このスレッドは政策提言候補ではありません。" }, { status: 404 });
  }

  const { data: posts, error: postsError } = await supabase
    .from("forum_posts")
    .select("id, post_role")
    .eq("thread_id", normalizedThreadId)
    .eq("is_deleted", false)
    .limit(500);

  if (postsError) {
    return NextResponse.json({ ok: false, error: "投稿情報を取得できませんでした。" }, { status: 500 });
  }

  const postRows = (posts ?? []) as PostRow[];
  const postIds = postRows.map((post) => post.id).filter(Boolean);
  let classificationRows: ClassificationRow[] = [];

  if (postIds.length > 0) {
    const { data: classifications, error: classificationsError } = await supabase
      .from("forum_post_ai_classifications")
      .select("classification")
      .eq("thread_id", normalizedThreadId)
      .eq("is_active", true)
      .in("post_id", postIds);

    if (classificationsError) {
      console.warn("[policy-proposal classifications skipped]", classificationsError.message);
    } else {
      classificationRows = (classifications ?? []) as ClassificationRow[];
    }
  }

  const classificationCounts = classificationRows.reduce<Record<string, number>>(
    (counts, row) => {
      const key = row.classification?.trim();
      if (key) counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    },
    {}
  );
  const keyPoints = asRecord(structure.key_points);

  return NextResponse.json({
    ok: true,
    proposal: {
      thread_id: thread.id,
      title: thread.title?.trim() || "無題の議論",
      category: thread.category?.trim() || "未設定",
      original_post: thread.original_post?.trim() || "",
      created_at: thread.created_at,
      summary_updated_at: structure.updated_at,
      summary_type: structure.summary_type,
      summary_text: structure.summary_text?.trim() || "",
      easy_summary_text: structure.easy_summary_text?.trim() || "",
      key_points: {
        discussion_position: asStringArray(keyPoints.discussion_position),
        added_premises: asStringArray(keyPoints.added_premises),
        added_evidence: asStringArray(keyPoints.added_evidence),
        main_agreements: asStringArray(keyPoints.main_agreements),
        main_rebuttals: asStringArray(keyPoints.main_rebuttals),
        verification_metrics: asStringArray(keyPoints.verification_metrics),
        needs_review: asStringArray(keyPoints.needs_review),
        changes_from_initial_answer: asStringArray(keyPoints.changes_from_initial_answer),
        current_tentative_conclusion: asStringArray(
          keyPoints.current_tentative_conclusion
        ),
      },
      post_count: postRows.length,
      classified_comment_count: classificationRows.length,
      classification_counts: classificationCounts,
    },
  });
}
