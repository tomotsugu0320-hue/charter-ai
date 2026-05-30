import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function readText(value: string | null) {
  return (value ?? "").trim();
}

function getAuthorKey(req: NextRequest) {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(/author_key=([^;]+)/);

  if (!match?.[1]) return null;

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantSlug = readText(
      searchParams.get("tenantSlug") || searchParams.get("tenant_slug")
    );

    if (!tenantSlug) {
      return NextResponse.json(
        { success: false, error: "tenantSlug is required" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { success: false, error: "Supabase service role env is missing" },
        { status: 500 }
      );
    }

    const authorKey = getAuthorKey(req);

    if (!authorKey) {
      return NextResponse.json({ success: true, logs: [] });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data, error } = await supabase
      .from("private_import_logs")
      .select(
        "id, tenant_slug, author_key, source_type, candidate, related_thread, related_thread_id, related_thread_url, memo, status, created_at"
      )
      .eq("tenant_slug", tenantSlug)
      .eq("author_key", authorKey)
      .eq("status", "saved")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      logs: data ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "unexpected error",
      },
      { status: 500 }
    );
  }
}
