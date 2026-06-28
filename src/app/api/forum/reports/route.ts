import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActiveForumBetaSessionUser } from "@/lib/forum-auth";
import { assertRecentRateLimit, DAY_MS, MINUTE_MS } from "@/lib/forum/rate-limit";

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

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error("Supabase environment is not configured");
  }

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
    },
  });
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
    const supabase = getSupabaseAdmin();
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

    const { data: duplicateReport, error: duplicateError } = await supabase
      .from("forum_reports")
      .select("id")
      .eq("post_id", postId)
      .eq("reporter_user_id", activeUser.user.id)
      .in("status", ["pending", "reviewing"])
      .limit(1)
      .maybeSingle();

    if (duplicateError) {
      return NextResponse.json(
        { success: false, error: duplicateError.message },
        { status: 500 }
      );
    }

    if (duplicateReport) {
      return NextResponse.json(
        {
          success: false,
          error:
            "この投稿への通報はすでに受け付けています。管理者の確認をお待ちください。",
        },
        { status: 409 }
      );
    }

    const shortLimitResponse = await assertRecentRateLimit({
      table: "forum_reports",
      filters: [{ column: "reporter_user_id", value: activeUser.user.id }],
      limit: 5,
      windowMs: 10 * MINUTE_MS,
      retryAfterSeconds: 10 * 60,
      message:
        "通報が短時間に集中しています。少し時間をおいてから再試行してください。",
    });
    if (shortLimitResponse) return shortLimitResponse;

    const dailyLimitResponse = await assertRecentRateLimit({
      table: "forum_reports",
      filters: [{ column: "reporter_user_id", value: activeUser.user.id }],
      limit: 30,
      windowMs: DAY_MS,
      retryAfterSeconds: 60 * 60,
      message:
        "通報の1日の送信数が上限へ達しました。時間をおいてから再試行してください。",
    });
    if (dailyLimitResponse) return dailyLimitResponse;

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
