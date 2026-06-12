import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  FORUM_BETA_SESSION_COOKIE,
  getForumBetaSessionClearCookieOptions,
  getForumBetaSessionUser,
  isForumBetaUserActive,
  isForumBetaLoggedIn,
  verifyForumBetaPassword,
} from "@/lib/forum-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ForumBetaDeleteAccountRow = {
  password_hash: string;
  status?: string | null;
};

type ForumSupabaseClient = ReturnType<typeof createClient<any, "public", any>>;

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

function getLoggedInUserId(request: NextRequest) {
  if (!isForumBetaLoggedIn(request)) return null;

  return getForumBetaSessionUser(request);
}

async function findAccountForDelete(
  supabase: ForumSupabaseClient,
  userId: string
) {
  const { data, error } = await supabase
    .from("forum_beta_users")
    .select("password_hash, status")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return { account: null, error };
  }

  return {
    account: (data as ForumBetaDeleteAccountRow | null) ?? null,
    error: null,
  };
}

function createLogoutResponse() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    FORUM_BETA_SESSION_COOKIE,
    "",
    getForumBetaSessionClearCookieOptions()
  );

  return response;
}

export async function POST(request: NextRequest) {
  const userId = getLoggedInUserId(request);

  if (!userId) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    currentPassword?: unknown;
    confirmText?: unknown;
  } | null;
  const currentPassword = toStringValue(body?.currentPassword);
  const confirmText = toStringValue(body?.confirmText).trim();

  if (confirmText !== "退会する") {
    return NextResponse.json(
      { error: "確認文言を入力してください。" },
      { status: 400 }
    );
  }

  const supabase = getSupabase();

  if (!supabase) {
    return NextResponse.json(
      { error: "Forum beta account is not configured." },
      { status: 500 }
    );
  }

  const { account, error: findError } = await findAccountForDelete(
    supabase,
    userId
  );

  if (findError) {
    console.error("[forum beta account delete] account lookup failed", {
      userId,
      message: findError.message,
    });
    return NextResponse.json(
      { error: "Forum beta account is not configured." },
      { status: 500 }
    );
  }

  if (!account || !isForumBetaUserActive(account.status)) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const passwordMatches = await verifyForumBetaPassword(
    currentPassword,
    account.password_hash
  );

  if (!passwordMatches) {
    return NextResponse.json(
      { error: "現在のパスワードが違います。" },
      { status: 401 }
    );
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("forum_beta_users")
    .update({
      status: "deleted",
      display_name: "退会ユーザー",
      disabled_at: now,
      deleted_at: now,
    })
    .eq("id", userId);

  if (error) {
    console.error("[forum beta account delete] account update failed", {
      userId,
      message: error.message,
    });
    return NextResponse.json(
      { error: "Forum beta account is not configured." },
      { status: 500 }
    );
  }

  return createLogoutResponse();
}
