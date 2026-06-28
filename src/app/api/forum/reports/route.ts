import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActiveForumBetaSessionUser } from "@/lib/forum-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ALLOWED_REASON_TYPES = [
  "personal_info",
  "harassment",
  "spam",
  "illegal_or_dangerous",
  "wrong_publication",
  "other",
] as const;

type ReasonType = (typeof ALLOWED_REASON_TYPES)[number];

function isReasonType(value: string): value is ReasonType {
  return ALLOWED_REASON_TYPES.includes(value as ReasonType);
}

function getAuthorKey(req: NextRequest) {
  const value = req.cookies.get("author_key")?.value;
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDetail(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 500);
}

export async function POST(req: NextRequest) {
  const activeUser = await getActiveForumBetaSessionUser(req);
  if (!activeUser.ok) {
    return NextResponse.json(
      { success: false, error: activeUser.error },
      { status: activeUser.status }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const postId = String(body?.post_id ?? body?.postId ?? "").trim();
    const threadIdFromBody = String(
      body?.thread_id ?? body?.threadId ?? ""
    ).trim();
    const reasonType = String(body?.reason_type ?? body?.reasonType ?? "").trim();
    const reasonDetail = normalizeDetail(
      body?.reason_detail ?? body?.reasonDetail
    );

    if (!postId) {
      return NextResponse.json(
        { success: false, error: "post_id is required" },
        { status: 400 }
      );
    }

    if (!isReasonType(reasonType)) {
      return NextResponse.json(
        { success: false, error: "invalid reason_type" },
        { status: 400 }
      );
    }

    const { data: post, error: postError } = await supabase
      .from("forum_posts")
      .select("id, thread_id")
      .eq("id", postId)
      .maybeSingle();

    if (postError) {
      return NextResponse.json(
        { success: false, error: postError.message },
        { status: 500 }
      );
    }

    if (!post) {
      return NextResponse.json(
        { success: false, error: "post not found" },
        { status: 404 }
      );
    }

    const postThreadId = String(post.thread_id ?? "");
    if (threadIdFromBody && threadIdFromBody !== postThreadId) {
      return NextResponse.json(
        { success: false, error: "thread_id does not match post" },
        { status: 400 }
      );
    }

    const { error: insertError } = await supabase.from("forum_reports").insert({
      target_type: "post",
      thread_id: postThreadId || null,
      post_id: postId,
      reason_type: reasonType,
      reason_detail: reasonDetail || null,
      reporter_user_id: activeUser.user.id,
      reporter_author_key: getAuthorKey(req) || null,
      status: "pending",
    });

    if (insertError) {
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "failed to create report",
      },
      { status: 500 }
    );
  }
}
