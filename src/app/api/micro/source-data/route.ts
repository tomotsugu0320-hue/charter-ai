import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SOURCE_DATA_COLUMNS = `
  id,
  tenant_slug,
  source_type,
  title,
  raw_content,
  normalized_content,
  status,
  pinned,
  usage_count,
  last_used_at,
  author_key,
  created_at,
  updated_at,
  archived_at
`;

const SOURCE_TYPES = new Set([
  "free_log",
  "smart_note",
  "chat_log",
  "imported_text",
  "manual",
  "voice",
  "chatgpt_share",
  "line",
  "web_clip",
]);

const SOURCE_STATUSES = new Set(["draft", "active", "archived"]);

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey);
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(req: NextRequest) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Supabase env is missing" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const tenantSlug =
    searchParams.get("tenant_slug")?.trim() ||
    searchParams.get("tenantSlug")?.trim() ||
    "";
  const status = searchParams.get("status")?.trim() || "";

  if (!tenantSlug) {
    return NextResponse.json(
      { success: false, error: "tenant_slug is required" },
      { status: 400 }
    );
  }

  let query = supabase
    .from("micro_source_data")
    .select(SOURCE_DATA_COLUMNS)
    .eq("tenant_slug", tenantSlug)
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });

  if (status === "archived") {
    query = query.eq("status", "archived");
  } else {
    query = query.neq("status", "archived");
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    sourceData: data ?? [],
  });
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Supabase env is missing" },
      { status: 500 }
    );
  }

  let body: Record<string, unknown>;

  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const tenantSlug = readString(body.tenant_slug || body.tenantSlug);
  const rawContent = readString(body.raw_content || body.rawContent);
  const title = readString(body.title) || null;
  const sourceType = readString(body.source_type || body.sourceType) || "free_log";
  const status = readString(body.status) || "draft";

  if (!tenantSlug) {
    return NextResponse.json(
      { success: false, error: "tenant_slug is required" },
      { status: 400 }
    );
  }

  if (!rawContent) {
    return NextResponse.json(
      { success: false, error: "raw_content is required" },
      { status: 400 }
    );
  }

  if (!SOURCE_TYPES.has(sourceType)) {
    return NextResponse.json(
      { success: false, error: "source_type is invalid" },
      { status: 400 }
    );
  }

  if (!SOURCE_STATUSES.has(status)) {
    return NextResponse.json(
      { success: false, error: "status is invalid" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("micro_source_data")
    .insert({
      tenant_slug: tenantSlug,
      raw_content: rawContent,
      title,
      source_type: sourceType,
      status,
    })
    .select(SOURCE_DATA_COLUMNS)
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      sourceData: data,
    },
    { status: 201 }
  );
}

export async function PATCH(req: NextRequest) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Supabase env is missing" },
      { status: 500 }
    );
  }

  let body: Record<string, unknown>;

  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const id = readString(body.id);
  const action = readString(body.action);

  if (!id) {
    return NextResponse.json(
      { success: false, error: "id is required" },
      { status: 400 }
    );
  }

  if (
    action !== "archive" &&
    action !== "restore" &&
    action !== "pin" &&
    action !== "unpin"
  ) {
    return NextResponse.json(
      { success: false, error: "action is invalid" },
      { status: 400 }
    );
  }

  const values: Record<string, boolean | string | null> = {};

  if (action === "archive") {
    values.status = "archived";
    values.archived_at = new Date().toISOString();
  } else if (action === "restore") {
    values.status = "active";
    values.archived_at = null;
  } else {
    values.pinned = action === "pin";
  }

  const { error } = await supabase
    .from("micro_source_data")
    .update(values)
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
  });
}
