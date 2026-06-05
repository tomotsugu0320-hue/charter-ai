import { NextRequest, NextResponse } from "next/server";
import { isForumBetaLoggedIn } from "@/lib/forum-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  return NextResponse.json({
    ok: true,
    loggedIn: isForumBetaLoggedIn(request),
  });
}
