import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getActiveForumBetaSessionUser,
  isForumAdminAuthenticated,
} from "@/lib/forum-auth";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function getAuthorKey(req: Request) {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(/author_key=([^;]+)/);

  if (!match?.[1]) return "";

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const activeUser = await getActiveForumBetaSessionUser(req);
    if (!activeUser.ok) {
      return NextResponse.json(
        { success: false, error: activeUser.error },
        { status: activeUser.status }
      );
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "post id is required" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const hideThread = body?.hideThread === true;

    const isAdmin = isForumAdminAuthenticated(req);

    const { data: post, error: postError } = await supabase
      .from("forum_posts")
      .select("id, author_key, thread_id, post_role")
      .eq("id", id)
      .maybeSingle();

    if (postError) {
      return NextResponse.json(
        { success: false, error: postError.message },
        { status: 500 }
      );
    }

    if (!post) {
      return NextResponse.json(
        { success: false, error: "post not found" },
        { status: 404 }
      );
    }

    if (!isAdmin) {
      const authorKey = getAuthorKey(req);

      if (!authorKey || post.author_key !== authorKey) {
        return NextResponse.json(
          { success: false, error: "forbidden" },
          { status: 403 }
        );
      }
    }

    if (hideThread && post.post_role !== "issue_raise") {
      return NextResponse.json(
        { success: false, error: "hideThread is allowed only for main posts" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("forum_posts")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        delete_reason: "self_deleted",
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (hideThread) {
      const { error: threadError } = await supabase
        .from("forum_threads")
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
        })
        .eq("id", post.thread_id);

      if (threadError) {
        return NextResponse.json(
          { success: false, error: threadError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true, threadHidden: hideThread });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "failed to hide post",
      },
      { status: 500 }
    );
  }
}
