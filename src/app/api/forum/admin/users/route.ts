import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isForumAdminAuthenticated } from "@/lib/forum-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ForumBetaAdminUserRow = {
  id: string;
  login_id: string;
  display_name: string | null;
  created_at: string | null;
  last_login_at: string | null;
  status?: string | null;
  disabled_at?: string | null;
  deleted_at?: string | null;
};

function normalizeStatus(status: string | null | undefined) {
  if (status === "disabled" || status === "deleted") return status;
  return "active";
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  if (!isForumAdminAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();

  if (!supabase) {
    return NextResponse.json(
      { error: "Forum beta admin users is not configured." },
      { status: 500 }
    );
  }

  const { data, error } = await supabase
    .from("forum_beta_users")
    .select(
      "id, login_id, display_name, created_at, last_login_at, status, disabled_at, deleted_at"
    )
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    console.error("[forum beta admin users] list failed", {
      message: error.message,
    });
    return NextResponse.json(
      { error: "Forum beta admin users is not configured." },
      { status: 500 }
    );
  }

  const users = ((data ?? []) as ForumBetaAdminUserRow[]).map((user) => ({
    id: user.id,
    login_id: user.login_id,
    display_name: user.display_name?.trim() || user.login_id,
    created_at: user.created_at,
    last_login_at: user.last_login_at,
    status: normalizeStatus(user.status),
    disabled_at: user.disabled_at,
    deleted_at: user.deleted_at,
  }));

  return NextResponse.json({ ok: true, users });
}
