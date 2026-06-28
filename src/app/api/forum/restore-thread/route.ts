import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getActiveForumBetaSessionUser,
  isForumAdminAuthenticated,
} from "@/lib/forum-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const activeUser = await getActiveForumBetaSessionUser(req);
    if (!activeUser.ok) {
      return NextResponse.json(
        { ok: false, error: activeUser.error },
        { status: activeUser.status }
      );
    }

    if (!isForumAdminAuthenticated(req)) {
      return NextResponse.json(
        { success: false, error: "Admin permission required." },
        { status: 403 }
      );
    }

    const { threadId } = await req.json();

    if (!threadId) {
      return NextResponse.json(
        { error: "threadId is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("forum_threads")
      .update({
        is_deleted: false,
        deleted_at: null,
      })
      .eq("id", threadId)
      .select("id,is_deleted,deleted_at")
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: "Thread not found or not updated" },
        { status: 404 }
      );
    }

    if (data.is_deleted !== false) {
      return NextResponse.json(
        { success: false, error: "Restore update did not apply" },
        { status: 500 }
      );
    }

    const { error: postRestoreError } = await supabase
      .from("forum_posts")
      .update({
        is_deleted: false,
        deleted_at: null,
        delete_reason: null,
      })
      .eq("thread_id", threadId)
      .eq("post_role", "issue_raise")
      .eq("is_deleted", true);

    if (postRestoreError) {
      return NextResponse.json(
        { success: false, error: postRestoreError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, thread: data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "failed to restore thread",
      },
      { status: 500 }
    );
  }
}
