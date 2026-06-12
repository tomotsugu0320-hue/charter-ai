import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  createForumBetaSessionToken,
  FORUM_BETA_SESSION_COOKIE,
  getForumBetaSessionCookieOptions,
  getForumBetaAuthConfigError,
  isForumBetaUserActive,
  normalizeForumBetaLoginId,
  validateForumBetaLoginInput,
  verifyForumBetaPassword,
} from "@/lib/forum-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function toStringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

type ForumBetaUserRow = {
  id: string;
  login_id: string;
  password_hash: string;
  status?: string | null;
};

type ForumSupabaseClient = ReturnType<typeof createClient<any, "public", any>>;

const INVALID_LOGIN_MESSAGE = "IDまたはパスワードが違います。";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  return createClient(url, key);
}

async function updateLastLoginAt(supabase: ForumSupabaseClient, id: string) {
  const { error } = await supabase
    .from("forum_beta_users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.warn("[forum beta login] last_login_at update failed", {
      userId: id,
      message: error.message,
    });
  }
}

async function findForumBetaUser(
  supabase: ForumSupabaseClient,
  normalizedLoginId: string
) {
  const { data, error } = await supabase
    .from("forum_beta_users")
    .select("id, login_id, password_hash, status")
    .eq("login_id_normalized", normalizedLoginId)
    .maybeSingle();

  if (error) {
    return { user: null, error };
  }

  return { user: (data as ForumBetaUserRow | null) ?? null, error: null };
}

function createLoginResponse(userId: string) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    FORUM_BETA_SESSION_COOKIE,
    createForumBetaSessionToken(userId),
    getForumBetaSessionCookieOptions()
  );

  return response;
}

export async function POST(request: NextRequest) {
  const configError = getForumBetaAuthConfigError();

  if (configError) {
    return NextResponse.json(
      { error: "Forum beta login is not configured." },
      { status: 500 }
    );
  }

  const body = (await request.json().catch(() => null)) as {
    user?: unknown;
    password?: unknown;
  } | null;
  const user = toStringValue(body?.user).trim();
  const password = toStringValue(body?.password);

  const inputError = validateForumBetaLoginInput(user, password);

  if (inputError) {
    return NextResponse.json({ error: inputError }, { status: 400 });
  }

  const normalizedLoginId = normalizeForumBetaLoginId(user);
  const supabase = getSupabase();

  if (!supabase) {
    return NextResponse.json(
      { error: "Forum beta login is not configured." },
      { status: 500 }
    );
  }

  const existing = await findForumBetaUser(supabase, normalizedLoginId);

  if (existing.error) {
    console.error("[forum beta login] user lookup failed", existing.error);
    return NextResponse.json(
      { error: "Forum beta login is not configured." },
      { status: 500 }
    );
  }

  if (!existing.user) {
    return NextResponse.json({ error: INVALID_LOGIN_MESSAGE }, { status: 401 });
  }

  if (!isForumBetaUserActive(existing.user.status)) {
    return NextResponse.json({ error: INVALID_LOGIN_MESSAGE }, { status: 401 });
  }

  const passwordMatches = await verifyForumBetaPassword(
    password,
    existing.user.password_hash
  );

  if (!passwordMatches) {
    return NextResponse.json({ error: INVALID_LOGIN_MESSAGE }, { status: 401 });
  }

  const userId = existing.user.id;
  await updateLastLoginAt(supabase, userId);

  return createLoginResponse(userId);
}
