import { NextRequest, NextResponse } from "next/server";
import {
  getForumBetaSessionUser,
  isForumBetaLoggedIn,
} from "@/lib/forum-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const loggedIn = isForumBetaLoggedIn(request);

  return NextResponse.json({
    ok: true,
    loggedIn,
    userId: loggedIn ? getForumBetaSessionUser(request) : null,
  });
}
