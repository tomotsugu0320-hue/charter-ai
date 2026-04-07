// api/forum/search-related


import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const { claim } = await req.json();

    if (!claim) {
      return NextResponse.json([], { status: 200 });
    }

    const { data, error } = await supabase
      .from("forum_threads")
      .select("id, title")
      .ilike("title", `%${claim}%`)
      .limit(5);

    if (error) {
      console.error(error);
      return NextResponse.json([], { status: 200 });
    }

    return NextResponse.json(data ?? []);
  } catch (e) {
    console.error(e);
    return NextResponse.json([], { status: 200 });
  }
}