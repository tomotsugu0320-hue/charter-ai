// src/app/api/forum/delete-post/route.ts

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

    const { postId } = await req.json();

    if (!postId) {
      return NextResponse.json(
        { error: "postIdが必要" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("forum_posts")
      .delete()
      .eq("id", postId); // ←ここが絶対これ

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "削除失敗" },
      { status: 500 }
    );
  }
}
