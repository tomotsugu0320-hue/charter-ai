import { NextRequest, NextResponse } from "next/server";
import {
  createForumAdminSessionToken,
  FORUM_ADMIN_SESSION_COOKIE,
  getForumAdminSessionClearCookieOptions,
  getForumAdminSessionCookieOptions,
  isForumAdminKeyValueValid,
} from "@/lib/forum-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function toStringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

async function readRequestAdminKey(request: NextRequest) {
  const headerKey = request.headers.get("x-admin-key");

  if (headerKey?.trim()) return headerKey;

  const body = (await request.json().catch(() => null)) as {
    adminKey?: unknown;
    admin_key?: unknown;
    key?: unknown;
  } | null;

  return (
    toStringValue(body?.adminKey) ||
    toStringValue(body?.admin_key) ||
    toStringValue(body?.key)
  );
}

export async function POST(request: NextRequest) {
  const adminKey = await readRequestAdminKey(request);

  if (!isForumAdminKeyValueValid(adminKey)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    FORUM_ADMIN_SESSION_COOKIE,
    createForumAdminSessionToken(),
    getForumAdminSessionCookieOptions()
  );

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    FORUM_ADMIN_SESSION_COOKIE,
    "",
    getForumAdminSessionClearCookieOptions()
  );

  return response;
}
