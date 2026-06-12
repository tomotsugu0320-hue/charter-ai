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
    confirmText?: unknown;
  } | null;
  const confirmText = toStringValue(body?.confirmText).trim();

  if (confirmText !== "完全削除") {
    return NextResponse.json(
      { error: "確認文言を入力してください。" },
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

  const { data: user, error: selectError } = await supabase
    .from("forum_beta_users")
    .select("id, status")
    .eq("id", userId)
    .maybeSingle();

  if (selectError) {
    console.error("[forum beta admin users] account purge lookup failed", {
      userId,
      message: selectError.message,
    });
    return NextResponse.json(
      { error: "Forum beta admin users is not configured." },
      { status: 500 }
    );
  }

  if (!user) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }

  if (user.status !== "deleted") {
    return NextResponse.json(
      { error: "先に削除状態にしてください。" },
      { status: 400 }
    );
  }

  const { error: deleteError } = await supabase
    .from("forum_beta_users")
    .delete()
    .eq("id", userId)
    .eq("status", "deleted");

  if (deleteError) {
    console.error("[forum beta admin users] account purge failed", {
      userId,
      message: deleteError.message,
    });
    return NextResponse.json(
      { error: "Forum beta admin users is not configured." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
