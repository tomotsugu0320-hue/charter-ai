import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const adminKey = process.env.ADMIN_KEY;
    const requestAdminKey = req.headers.get("x-admin-key");

    if (!adminKey || requestAdminKey !== adminKey) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { threadId } = await req.json();

    if (!threadId) {
      return NextResponse.json(
        { error: "threadId is required" },
        { status: 400 }
      );
    }

    const { error: feedbackError } = await supabase
      .from("forum_post_feedback")
      .delete()
      .eq("thread_id", threadId);

    if (feedbackError) {
      return NextResponse.json(
        { error: feedbackError.message },
        { status: 500 }
      );
    }

    const { error: postsError } = await supabase
      .from("forum_posts")
      .delete()
      .eq("thread_id", threadId);

    if (postsError) {
      return NextResponse.json({ error: postsError.message }, { status: 500 });
    }

    const { error: threadError } = await supabase
      .from("forum_threads")
      .delete()
      .eq("id", threadId);

    if (threadError) {
      return NextResponse.json({ error: threadError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "failed to hard delete thread",
      },
      { status: 500 }
    );
  }
}
