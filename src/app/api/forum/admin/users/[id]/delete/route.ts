import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isForumAdminKeyValid } from "@/lib/forum-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function toStringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  return createClient(url, key);
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isForumAdminKeyValid(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const userId = String(id ?? "").trim();

  if (!userId) {
    return NextResponse.json({ error: "user id is required" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as {
    postHandling?: unknown;
    confirmText?: unknown;
  } | null;
  const postHandling = toStringValue(body?.postHandling).trim();
  const confirmText = toStringValue(body?.confirmText).trim();

  if (confirmText !== "削除する") {
    return NextResponse.json(
      { error: "確認文言を入力してください。" },
      { status: 400 }
    );
  }

  if (postHandling !== "keep_visible") {
    return NextResponse.json(
      {
        error:
          "投稿とユーザーIDの正式な紐づきがないため、この投稿扱いは未対応です。",
      },
      { status: 400 }
    );
  }

  const supabase = getSupabase();

  if (!supabase) {
    return NextResponse.json(
      { error: "Forum beta admin users is not configured." },
      { status: 500 }
    );
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("forum_beta_users")
    .update({
      status: "deleted",
      display_name: "退会ユーザー",
      disabled_at: now,
      deleted_at: now,
    })
    .eq("id", userId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[forum beta admin users] account delete failed", {
      userId,
      message: error.message,
    });
    return NextResponse.json(
      { error: "Forum beta admin users is not configured." },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
