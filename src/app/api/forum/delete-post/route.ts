// src/app/api/forum/delete-post/route.ts

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const { postId } = await req.json();

  const { error } = await supabase
    .from("forum_posts")
    .delete()
    .eq("id", postId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}