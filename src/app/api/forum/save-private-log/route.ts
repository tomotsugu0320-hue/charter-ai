import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getOrCreateAuthorKey(req: NextRequest) {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(/author_key=([^;]+)/);

  if (match?.[1]) {
    return {
      authorKey: match[1],
      shouldSetCookie: false,
    };
  }

  return {
    authorKey: "u_" + Math.random().toString(36).slice(2, 10),
    shouldSetCookie: true,
  };
}

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { success: false, error: "Supabase service role env is missing" },
        { status: 500 }
      );
    }

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    if (!isRecord(body)) {
      return NextResponse.json(
        { success: false, error: "Invalid request body" },
        { status: 400 }
      );
    }

    const tenantSlug = toText(body.tenantSlug ?? body.tenant_slug);
    const candidate = body.candidate;
    const relatedThread = body.relatedThread ?? body.related_thread ?? null;
    const relatedThreadUrl = toText(
      body.relatedThreadUrl ?? body.related_thread_url
    );
    const memo = toText(body.memo);

    if (!tenantSlug) {
      return NextResponse.json(
        { success: false, error: "tenantSlug is required" },
        { status: 400 }
      );
    }

    if (!isRecord(candidate)) {
      return NextResponse.json(
        { success: false, error: "candidate is required" },
        { status: 400 }
      );
    }

    if (relatedThread !== null && !isRecord(relatedThread)) {
      return NextResponse.json(
        { success: false, error: "relatedThread must be an object" },
        { status: 400 }
      );
    }

    const relatedThreadId = isRecord(relatedThread)
      ? toText(relatedThread.id) || null
      : null;
    const { authorKey, shouldSetCookie } = getOrCreateAuthorKey(req);
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data, error } = await supabase
      .from("private_import_logs")
      .insert({
        tenant_slug: tenantSlug,
        author_key: authorKey,
        source_type: "external_ai_import",
        candidate,
        related_thread: relatedThread,
        related_thread_id: relatedThreadId,
        related_thread_url: relatedThreadUrl || null,
        memo: memo || null,
        status: "saved",
      })
      .select("id, status, related_thread_id, created_at")
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const response = NextResponse.json({
      success: true,
      log: data,
    });

    if (shouldSetCookie) {
      response.headers.set(
        "Set-Cookie",
        `author_key=${authorKey}; Path=/; Max-Age=31536000; SameSite=Lax`
      );
    }

    return response;
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
