import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getForumBetaSessionUser,
  isForumBetaUserActive,
  isForumBetaLoggedIn,
  normalizeForumBetaDisplayName,
  validateForumBetaDisplayName,
} from "@/lib/forum-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ForumBetaAccountRow = {
  login_id: string;
  display_name: string | null;
  created_at: string | null;
  last_login_at: string | null;
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

async function findAccount(supabase: ForumSupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("forum_beta_users")
    .select("login_id, display_name, created_at, last_login_at, status")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return { account: null, error };
  }

  return { account: (data as ForumBetaAccountRow | null) ?? null, error: null };
}

function toAccountPayload(account: ForumBetaAccountRow) {
  const displayName = account.display_name?.trim() || account.login_id;

  return {
    login_id: account.login_id,
    display_name: displayName,
    created_at: account.created_at,
    last_login_at: account.last_login_at,
  };
}

export async function GET(request: NextRequest) {
  const userId = getLoggedInUserId(request);

  if (!userId) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const supabase = getSupabase();

  if (!supabase) {
    return NextResponse.json(
      { error: "Forum beta account is not configured." },
      { status: 500 }
    );
  }

  const { account, error } = await findAccount(supabase, userId);

  if (error) {
    console.error("[forum beta account] account lookup failed", {
      userId,
      message: error.message,
    });
    return NextResponse.json(
      { error: "Forum beta account is not configured." },
      { status: 500 }
    );
  }

  if (!account || !isForumBetaUserActive(account.status)) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  return NextResponse.json({ ok: true, account: toAccountPayload(account) });
}

export async function PATCH(request: NextRequest) {
  const userId = getLoggedInUserId(request);

  if (!userId) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const supabase = getSupabase();

  if (!supabase) {
    return NextResponse.json(
      { error: "Forum beta account is not configured." },
      { status: 500 }
    );
  }

  const { account, error: findError } = await findAccount(supabase, userId);

  if (findError) {
    console.error("[forum beta account] account lookup failed", {
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

  const body = (await request.json().catch(() => null)) as {
    displayName?: unknown;
  } | null;
  const displayName = normalizeForumBetaDisplayName(
    toStringValue(body?.displayName)
  );
  const displayNameError = validateForumBetaDisplayName(displayName);

  if (displayNameError) {
    return NextResponse.json({ error: displayNameError }, { status: 400 });
  }

  const savedDisplayName = displayName || account.login_id;
  const { error } = await supabase
    .from("forum_beta_users")
    .update({ display_name: savedDisplayName })
    .eq("id", userId);

  if (error) {
    console.error("[forum beta account] display_name update failed", {
      userId,
      message: error.message,
    });
    return NextResponse.json(
      { error: "Forum beta account is not configured." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    account: toAccountPayload({
      ...account,
      display_name: savedDisplayName,
    }),
  });
}
