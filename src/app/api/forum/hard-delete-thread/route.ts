import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    if (req.headers.get("x-admin-key") !== process.env.ADMIN_KEY) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { threadId } = await req.json();

    if (!threadId) {
      return NextResponse.json(
        { success: false, error: "threadId is required" },
        { status: 400 }
      );
    }

    const { data: existingThread, error: existingThreadError } = await supabase
      .from("forum_threads")
      .select("id")
      .eq("id", threadId)
      .maybeSingle();

    if (existingThreadError) {
      return NextResponse.json(
        { success: false, error: existingThreadError.message },
        { status: 500 }
      );
    }

    if (!existingThread) {
      return NextResponse.json(
        { success: false, error: "Thread not found" },
        { status: 404 }
      );
    }

    const { error: feedbackError } = await supabase
      .from("forum_post_feedback")
      .delete()
      .eq("thread_id", threadId);

    if (feedbackError) {
      return NextResponse.json(
        { success: false, error: feedbackError.message },
        { status: 500 }
      );
    }

    const { error: summaryError } = await supabase
      .from("thread_ai_structures")
      .delete()
      .eq("thread_id", threadId);

    if (summaryError) {
      return NextResponse.json(
        { success: false, error: summaryError.message },
        { status: 500 }
      );
    }

    const { error: postsError } = await supabase
      .from("forum_posts")
      .delete()
      .eq("thread_id", threadId);

    if (postsError) {
      return NextResponse.json(
        { success: false, error: postsError.message },
        { status: 500 }
      );
    }

    const { data: deletedThread, error: threadError } = await supabase
      .from("forum_threads")
      .delete()
      .eq("id", threadId)
      .select("id")
      .maybeSingle();

    if (threadError) {
      return NextResponse.json(
        { success: false, error: threadError.message },
        { status: 500 }
      );
    }

    if (!deletedThread) {
      return NextResponse.json(
        { success: false, error: "Thread delete did not remove a row" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, deletedThreadId: threadId });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "failed to hard delete thread",
      },
      { status: 500 }
    );
  }
}
