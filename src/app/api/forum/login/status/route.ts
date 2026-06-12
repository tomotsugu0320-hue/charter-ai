import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getForumBetaSessionUser,
  isForumBetaUserActive,
  isForumBetaLoggedIn,
} from "@/lib/forum-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ForumBetaUserProfileRow = {
  login_id: string;
  display_name: string | null;
  status?: string | null;
};

type ForumSupabaseClient = ReturnType<typeof createClient<any, "public", any>>;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  return createClient(url, key);
}

async function getForumBetaUserProfile(
  supabase: ForumSupabaseClient,
  userId: string
) {
  const { data, error } = await supabase
    .from("forum_beta_users")
    .select("login_id, display_name, status")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[forum beta status] user profile lookup failed", {
      userId,
      message: error.message,
    });
    return null;
  }

  return (data as ForumBetaUserProfileRow | null) ?? null;
}

export async function GET(request: NextRequest) {
  const loggedIn = isForumBetaLoggedIn(request);
  const userId = loggedIn ? getForumBetaSessionUser(request) : null;
  const supabase = userId ? getSupabase() : null;
  const profile =
    userId && supabase ? await getForumBetaUserProfile(supabase, userId) : null;
  const active = Boolean(loggedIn && profile && isForumBetaUserActive(profile.status));
  const loginId = profile?.login_id || null;
  const displayName =
    active && profile ? profile.display_name?.trim() || profile.login_id : null;

  return NextResponse.json({
    ok: true,
    loggedIn: active,
    userId: active ? userId : null,
    loginId: active ? loginId : null,
    login_id: active ? loginId : null,
    displayName,
    display_name: displayName,
  });
}
