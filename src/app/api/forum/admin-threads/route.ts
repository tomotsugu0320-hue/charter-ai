import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: Request) {
  if (req.headers.get("x-admin-key") !== process.env.ADMIN_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") ?? "visible";

  let query = supabase
    .from("forum_threads")
    .select("id, title, original_post, created_at, is_deleted, deleted_at")
    .order("created_at", { ascending: false });

  if (mode === "hidden") {
    query = query.eq("is_deleted", true);
  } else if (mode !== "all") {
    query = query.eq("is_deleted", false);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ threads: data ?? [] });
}
