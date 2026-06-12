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
    status?: unknown;
  } | null;
  const nextStatus = toStringValue(body?.status).trim();

  if (nextStatus !== "active" && nextStatus !== "disabled") {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
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
      status: nextStatus,
      disabled_at: nextStatus === "disabled" ? now : null,
      deleted_at: null,
    })
    .eq("id", userId)
    .neq("status", "deleted")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[forum beta admin users] status update failed", {
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
