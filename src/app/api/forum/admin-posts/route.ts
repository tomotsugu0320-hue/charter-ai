import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isForumAdminAuthenticated } from "@/lib/forum-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: Request) {
  if (!isForumAdminAuthenticated(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data, error } = await supabase
    .from("forum_posts")
    .select(`
      id, thread_id, post_role, parent_opinion_id, content, created_at,
      logic_score, logic_score_reason, logic_break_type, logic_break_note,
      forum_threads (title)
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ posts: data ?? [] });
}
