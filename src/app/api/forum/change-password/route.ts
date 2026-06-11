import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getForumBetaSessionUser,
  hashForumBetaPassword,
  isForumBetaLoggedIn,
  validateForumBetaPasswordConfirmation,
  validateForumBetaPasswordInput,
  verifyForumBetaPassword,
} from "@/lib/forum-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ForumBetaPasswordRow = {
  password_hash: string;
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

async function findPasswordHash(supabase: ForumSupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("forum_beta_users")
    .select("password_hash")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return { user: null, error };
  }

  return { user: (data as ForumBetaPasswordRow | null) ?? null, error: null };
}

export async function POST(request: NextRequest) {
  const userId = getLoggedInUserId(request);

  if (!userId) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    currentPassword?: unknown;
    newPassword?: unknown;
    newPasswordConfirm?: unknown;
  } | null;
  const currentPassword = toStringValue(body?.currentPassword);
  const newPassword = toStringValue(body?.newPassword);
  const newPasswordConfirm = toStringValue(body?.newPasswordConfirm);
  const newPasswordError = validateForumBetaPasswordInput(newPassword);

  if (newPasswordError) {
    return NextResponse.json({ error: newPasswordError }, { status: 400 });
  }

  const passwordConfirmError = validateForumBetaPasswordConfirmation(
    newPassword,
    newPasswordConfirm
  );

  if (passwordConfirmError) {
    return NextResponse.json({ error: passwordConfirmError }, { status: 400 });
  }

  const supabase = getSupabase();

  if (!supabase) {
    return NextResponse.json(
      { error: "Forum beta account is not configured." },
      { status: 500 }
    );
  }

  const { user, error: findError } = await findPasswordHash(supabase, userId);

  if (findError) {
    console.error("[forum beta change password] user lookup failed", {
      userId,
      message: findError.message,
    });
    return NextResponse.json(
      { error: "Forum beta account is not configured." },
      { status: 500 }
    );
  }

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const currentPasswordMatches = await verifyForumBetaPassword(
    currentPassword,
    user.password_hash
  );

  if (!currentPasswordMatches) {
    return NextResponse.json(
      { error: "現在のパスワードが違います。" },
      { status: 401 }
    );
  }

  const passwordHash = await hashForumBetaPassword(newPassword);
  const { error } = await supabase
    .from("forum_beta_users")
    .update({ password_hash: passwordHash })
    .eq("id", userId);

  if (error) {
    console.error("[forum beta change password] password update failed", {
      userId,
      message: error.message,
    });
    return NextResponse.json(
      { error: "Forum beta account is not configured." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
