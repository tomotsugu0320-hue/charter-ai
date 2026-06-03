import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type UserPostSummary = {
  author_key: string;
  post_count: number;
  hidden_post_count: number;
  latest_post_at: string | null;
};

type RawPostSummaryRow = {
  author_key: string | null;
  is_deleted: boolean | null;
  created_at: string | null;
};

export async function GET(req: Request) {
  if (req.headers.get("x-admin-key") !== process.env.ADMIN_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const authorKey = searchParams.get("authorKey")?.trim();

  if (authorKey) {
    const { data, error } = await supabase
      .from("forum_posts")
      .select(
        `
        id,
        thread_id,
        content,
        post_role,
        logic_score,
        is_deleted,
        created_at,
        forum_threads (title, is_deleted)
      `
      )
      .eq("author_key", authorKey)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ posts: data ?? [] });
  }

  const { data, error } = await supabase
    .from("forum_posts")
    .select("author_key, is_deleted, created_at")
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const users = new Map<string, UserPostSummary>();

  for (const row of (data ?? []) as RawPostSummaryRow[]) {
    const key = row.author_key?.trim();
    if (!key) continue;

    const current =
      users.get(key) ??
      ({
        author_key: key,
        post_count: 0,
        hidden_post_count: 0,
        latest_post_at: null,
      } satisfies UserPostSummary);

    current.post_count += 1;

    if (row.is_deleted === true) {
      current.hidden_post_count += 1;
    }

    if (
      row.created_at &&
      (!current.latest_post_at ||
        new Date(row.created_at).getTime() >
          new Date(current.latest_post_at).getTime())
    ) {
      current.latest_post_at = row.created_at;
    }

    users.set(key, current);
  }

  return NextResponse.json({
    users: Array.from(users.values()).sort((a, b) => {
      const aTime = a.latest_post_at ? new Date(a.latest_post_at).getTime() : 0;
      const bTime = b.latest_post_at ? new Date(b.latest_post_at).getTime() : 0;
      return bTime - aTime;
    }),
  });
}
