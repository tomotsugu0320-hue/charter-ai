import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isForumAdminAuthenticated } from "@/lib/forum-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ALLOWED_STATUSES = [
  "pending",
  "reviewing",
  "resolved",
  "dismissed",
] as const;

function isAllowedStatus(value: string) {
  return ALLOWED_STATUSES.includes(value as (typeof ALLOWED_STATUSES)[number]);
}

function safePostContent(post: any) {
  if (!post) return "";
  if (post.is_sensitive === true) {
    return "個人情報保護のため、この投稿は表示を制限しています。";
  }

  const sanitizedText =
    typeof post.sanitized_text === "string" ? post.sanitized_text.trim() : "";

  return sanitizedText || String(post.content ?? "");
}

export async function GET(request: NextRequest) {
  if (!isForumAdminAuthenticated(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const statusParam = request.nextUrl.searchParams.get("status") ?? "pending";
  const status = statusParam.trim() || "pending";

  if (status !== "all" && !isAllowedStatus(status)) {
    return NextResponse.json(
      { success: false, error: "invalid status" },
      { status: 400 }
    );
  }

  let query = supabase
    .from("forum_reports")
    .select(
      "id,target_type,thread_id,post_id,reason_type,reason_detail,reporter_user_id,status,admin_note,resolved_at,created_at,updated_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data: reports, error } = await query;

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  const postIds = Array.from(
    new Set((reports ?? []).map((report: any) => report.post_id).filter(Boolean))
  );
  const threadIds = Array.from(
    new Set(
      (reports ?? []).map((report: any) => report.thread_id).filter(Boolean)
    )
  );

  const { data: posts, error: postsError } =
    postIds.length > 0
      ? await supabase
          .from("forum_posts")
          .select(
            "id,thread_id,post_role,content,sanitized_text,is_sensitive,created_at,is_deleted"
          )
          .in("id", postIds)
      : { data: [], error: null };

  if (postsError) {
    return NextResponse.json(
      { success: false, error: postsError.message },
      { status: 500 }
    );
  }

  const { data: threads, error: threadsError } =
    threadIds.length > 0
      ? await supabase
          .from("forum_threads")
          .select("id,title,is_deleted")
          .in("id", threadIds)
      : { data: [], error: null };

  if (threadsError) {
    return NextResponse.json(
      { success: false, error: threadsError.message },
      { status: 500 }
    );
  }

  const postMap = new Map((posts ?? []).map((post: any) => [post.id, post]));
  const threadMap = new Map(
    (threads ?? []).map((thread: any) => [thread.id, thread])
  );

  const enrichedReports = (reports ?? []).map((report: any) => {
    const post = postMap.get(report.post_id);
    const thread = threadMap.get(report.thread_id);

    return {
      ...report,
      post: post
        ? {
            id: post.id,
            thread_id: post.thread_id,
            post_role: post.post_role,
            content: safePostContent(post),
            is_sensitive: post.is_sensitive === true,
            is_deleted: post.is_deleted === true,
            created_at: post.created_at,
          }
        : null,
      thread: thread
        ? {
            id: thread.id,
            title: thread.title,
            is_deleted: thread.is_deleted === true,
          }
        : null,
    };
  });

  return NextResponse.json({ success: true, reports: enrichedReports });
}
