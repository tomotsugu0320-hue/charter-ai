// src/app/api/forum/create-post/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const { thread_id, content, type } = await req.json();

    if (!thread_id || !content) {
      return NextResponse.json({ error: "missing" }, { status: 400 });
    }

    const { error } = await supabase.from("forum_posts").insert({
      thread_id,
      content,
      post_role: type,
      source_type: "human",
    });

    if (error) {
      console.error(error);
      return NextResponse.json({ error: "db error" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
