import { NextResponse } from "next/server";
import {
  FORUM_BETA_SESSION_COOKIE,
  getForumBetaSessionClearCookieOptions,
} from "@/lib/forum-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    FORUM_BETA_SESSION_COOKIE,
    "",
    getForumBetaSessionClearCookieOptions()
  );

  return response;
}
