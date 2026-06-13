import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) return null;

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
    },
  });
}

export async function GET() {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        error: "Supabase environment is not configured.",
      },
      { status: 500 }
    );
  }

  const { data, error } = await supabase
    .from("forum_discussion_map_versions")
    .select("id, map_json, source_preview_id, created_at, applied_at")
    .eq("is_active", true)
    .order("applied_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to load active discussion map.",
        details: error.message,
      },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json({
      ok: true,
      map: null,
      fallbackRequired: true,
      version: null,
    });
  }

  return NextResponse.json({
    ok: true,
    map: data.map_json,
    fallbackRequired: false,
    version: {
      id: data.id,
      source_preview_id: data.source_preview_id,
      created_at: data.created_at,
      applied_at: data.applied_at,
    },
  });
}
