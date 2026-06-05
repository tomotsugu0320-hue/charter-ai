import { NextRequest, NextResponse } from "next/server";
import {
  createForumBetaSessionToken,
  FORUM_BETA_SESSION_COOKIE,
  getForumBetaSessionCookieOptions,
  isForumBetaAuthConfigured,
  verifyForumBetaCredentials,
} from "@/lib/forum-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function toStringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

export async function POST(request: NextRequest) {
  if (!isForumBetaAuthConfigured()) {
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

  if (!verifyForumBetaCredentials(user, password)) {
    return NextResponse.json(
      { error: "IDまたはパスワードが違います。" },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    FORUM_BETA_SESSION_COOKIE,
    createForumBetaSessionToken(),
    getForumBetaSessionCookieOptions()
  );

  return response;
}
