import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "post id is required" },
        { status: 400 }
      );
    }

    const adminKey = req.headers.get("x-admin-key") || "";
    const isAdmin = Boolean(process.env.ADMIN_KEY) && adminKey === process.env.ADMIN_KEY;

    const { data: post, error: postError } = await supabase
      .from("forum_posts")
      .select("id, author_key")
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

    return NextResponse.json({ success: true });
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
