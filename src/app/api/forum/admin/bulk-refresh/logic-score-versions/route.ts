import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isForumAdminAuthenticated } from "@/lib/forum-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VERSION_LIMIT = 30;

type LogicScoreVersionRow = {
  id: string;
  post_id: string;
  job_id: string | null;
  job_item_id: string | null;
  prompt_version: string;
  model: string | null;
  logic_score: number | null;
  logic_score_reason: string | null;
  logic_break_type: string | null;
  logic_break_note: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  actual_cost_usd: number | null;
  is_applied: boolean;
  applied_at: string | null;
  created_at: string | null;
};

type ForumPostRow = {
  id: string;
  thread_id: string | null;
  content: string | null;
  logic_score: number | null;
  logic_score_reason: string | null;
  forum_threads:
    | {
        id?: string | null;
        title?: string | null;
        category?: string | null;
      }
    | Array<{
        id?: string | null;
        title?: string | null;
        category?: string | null;
      }>
    | null;
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) return null;

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
    },
  });
}

function compactText(value: string | null | undefined, maxLength = 180) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function getPostThread(post: ForumPostRow) {
  if (Array.isArray(post.forum_threads)) return post.forum_threads[0] ?? null;
  return post.forum_threads ?? null;
}

function getLogicScoreVersionStatus(version: LogicScoreVersionRow) {
  if (typeof version.logic_score !== "number" || !String(version.logic_score_reason ?? "").trim()) {
    return "empty";
  }
  if (version.is_applied === true && Boolean(version.applied_at)) {
    return "applied";
  }
  return "unapplied";
}

export async function GET(request: NextRequest) {
  if (!isForumAdminAuthenticated(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase service role is not configured." },
      { status: 500 }
    );
  }

  const { data: versions, error: versionsError } = await supabase
    .from("forum_post_logic_score_versions")
    .select(
      [
        "id",
        "post_id",
        "job_id",
        "job_item_id",
        "prompt_version",
        "model",
        "logic_score",
        "logic_score_reason",
        "logic_break_type",
        "logic_break_note",
        "input_tokens",
        "output_tokens",
        "total_tokens",
        "actual_cost_usd",
        "is_applied",
        "applied_at",
        "created_at",
      ].join(", ")
    )
    .order("created_at", { ascending: false })
    .limit(VERSION_LIMIT);

  if (versionsError) {
    return NextResponse.json({ ok: false, error: versionsError.message }, { status: 500 });
  }

  const versionRows = (versions ?? []) as unknown as LogicScoreVersionRow[];
  const postIds = Array.from(new Set(versionRows.map((version) => version.post_id).filter(Boolean)));
  const postsById = new Map<string, ForumPostRow>();

  if (postIds.length > 0) {
    const { data: posts, error: postsError } = await supabase
      .from("forum_posts")
      .select(
        [
          "id",
          "thread_id",
          "content",
          "logic_score",
          "logic_score_reason",
          "forum_threads(id, title, category)",
        ].join(", ")
      )
      .in("id", postIds);

    if (postsError) {
      return NextResponse.json({ ok: false, error: postsError.message }, { status: 500 });
    }

    ((posts ?? []) as unknown as ForumPostRow[]).forEach((post) => {
      postsById.set(post.id, post);
    });
  }

  return NextResponse.json({
    ok: true,
    versions: versionRows.map((version) => {
      const post = postsById.get(version.post_id) ?? null;
      const thread = post ? getPostThread(post) : null;

      return {
        id: version.id,
        post_id: version.post_id,
        thread_id: post?.thread_id ?? thread?.id ?? null,
        thread_title: thread?.title ?? null,
        thread_category: thread?.category ?? null,
        post_excerpt: compactText(post?.content),
        current_logic_score: post?.logic_score ?? null,
        current_logic_score_reason: post?.logic_score_reason ?? null,
        job_id: version.job_id,
        job_item_id: version.job_item_id,
        prompt_version: version.prompt_version,
        model: version.model,
        logic_score: version.logic_score,
        logic_score_reason: version.logic_score_reason,
        logic_break_type: version.logic_break_type,
        logic_break_note: version.logic_break_note,
        version_status: getLogicScoreVersionStatus(version),
        input_tokens: version.input_tokens,
        output_tokens: version.output_tokens,
        total_tokens: version.total_tokens,
        actual_cost_usd: version.actual_cost_usd,
        is_applied: version.is_applied,
        applied_at: version.applied_at,
        created_at: version.created_at,
      };
    }),
  });
}
