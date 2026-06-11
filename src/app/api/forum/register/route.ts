import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  createForumBetaSessionToken,
  FORUM_BETA_SESSION_COOKIE,
  getForumBetaAuthConfigError,
  getForumBetaSessionCookieOptions,
  hashForumBetaPassword,
  normalizeForumBetaDisplayName,
  normalizeForumBetaLoginId,
  validateForumBetaDisplayName,
  validateForumBetaLoginInput,
} from "@/lib/forum-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ForumBetaUserRow = {
  id: string;
  login_id: string;
  display_name: string | null;
  password_hash: string;
};

type ForumSupabaseClient = ReturnType<typeof createClient<any, "public", any>>;

const ID_ALREADY_USED_MESSAGE = "このIDはすでに使われています。";

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

async function findForumBetaUser(
  supabase: ForumSupabaseClient,
  normalizedLoginId: string
) {
  const { data, error } = await supabase
    .from("forum_beta_users")
    .select("id, login_id, display_name, password_hash")
    .eq("login_id_normalized", normalizedLoginId)
    .maybeSingle();

  if (error) {
    return { user: null, error };
  }

  return { user: (data as ForumBetaUserRow | null) ?? null, error: null };
}

async function createForumBetaUser(
  supabase: ForumSupabaseClient,
  loginId: string,
  normalizedLoginId: string,
  displayName: string,
  password: string
) {
  const passwordHash = await hashForumBetaPassword(password);
  const savedDisplayName = displayName || loginId;
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("forum_beta_users")
    .insert({
      login_id: loginId,
      login_id_normalized: normalizedLoginId,
      password_hash: passwordHash,
      display_name: savedDisplayName,
      last_login_at: now,
    })
    .select("id, login_id, display_name, password_hash")
    .single();

  if (error) {
    return { user: null, error };
  }

  return { user: data as ForumBetaUserRow, error: null };
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
    displayName?: unknown;
  } | null;
  const user = toStringValue(body?.user).trim();
  const password = toStringValue(body?.password);
  const displayName = normalizeForumBetaDisplayName(
    toStringValue(body?.displayName)
  );
  const inputError = validateForumBetaLoginInput(user, password);

  if (inputError) {
    return NextResponse.json({ error: inputError }, { status: 400 });
  }

  const displayNameError = validateForumBetaDisplayName(displayName);

  if (displayNameError) {
    return NextResponse.json({ error: displayNameError }, { status: 400 });
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
    console.error("[forum beta register] user lookup failed", existing.error);
    return NextResponse.json(
      { error: "Forum beta login is not configured." },
      { status: 500 }
    );
  }

  if (existing.user) {
    return NextResponse.json(
      { error: ID_ALREADY_USED_MESSAGE },
      { status: 409 }
    );
  }

  const created = await createForumBetaUser(
    supabase,
    user,
    normalizedLoginId,
    displayName,
    password
  );

  if (created.error || !created.user) {
    const retry = await findForumBetaUser(supabase, normalizedLoginId);

    if (retry.user) {
      return NextResponse.json(
        { error: ID_ALREADY_USED_MESSAGE },
        { status: 409 }
      );
    }

    console.error("[forum beta register] user creation failed", created.error);
    return NextResponse.json(
      { error: "Forum beta login is not configured." },
      { status: 500 }
    );
  }

  return createLoginResponse(created.user.id);
}
