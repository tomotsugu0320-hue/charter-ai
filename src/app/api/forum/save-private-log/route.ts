import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActiveForumBetaSessionUser } from "@/lib/forum-auth";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

const ALLOWED_SOURCE_TYPES = new Set([
  "external_ai_import",
  "external_ai_related",
  "thread_bookmark",
  "post_bookmark",
]);

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

function buildAuthorKeyCookie(authorKey: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `author_key=${encodeURIComponent(
    authorKey
  )}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly${secure}`;
}

export async function POST(req: NextRequest) {
  try {
    const activeUser = await getActiveForumBetaSessionUser(req);
    if (!activeUser.ok) {
      return NextResponse.json(
        { ok: false, error: activeUser.error },
        { status: activeUser.status }
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
    const sourceType =
      toText(body.sourceType ?? body.source_type) || "external_ai_import";

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

    if (!ALLOWED_SOURCE_TYPES.has(sourceType)) {
      return NextResponse.json(
        { success: false, error: "Invalid source_type" },
        { status: 400 }
      );
    }

    const relatedThreadId = isRecord(relatedThread)
      ? toText(relatedThread.id) || null
      : null;
    const { authorKey, shouldSetCookie } = getOrCreateAuthorKey(req);
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    if (sourceType === "thread_bookmark" && relatedThreadId) {
      const { data: existingLog, error: duplicateCheckError } = await supabase
        .from("private_import_logs")
        .select(
          "id, status, source_type, related_thread_id, related_thread_url, created_at"
        )
        .eq("tenant_slug", tenantSlug)
        .eq("author_key", authorKey)
        .eq("source_type", "thread_bookmark")
        .eq("related_thread_id", relatedThreadId)
        .eq("status", "saved")
        .maybeSingle();

      if (duplicateCheckError) {
        return NextResponse.json(
          { success: false, error: duplicateCheckError.message },
          { status: 500 }
        );
      }

      if (existingLog) {
        const response = NextResponse.json({
          success: true,
          duplicated: true,
          log: existingLog,
        });

        if (shouldSetCookie) {
          response.headers.set(
            "Set-Cookie",
            buildAuthorKeyCookie(authorKey)
          );
        }

        return response;
      }
    }

    const { data, error } = await supabase
      .from("private_import_logs")
      .insert({
        tenant_slug: tenantSlug,
        author_key: authorKey,
        source_type: sourceType,
        candidate,
        related_thread: relatedThread,
        related_thread_id: relatedThreadId,
        related_thread_url: relatedThreadUrl || null,
        memo: memo || null,
        status: "saved",
      })
      .select("id, status, source_type, related_thread_id, created_at")
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
        buildAuthorKeyCookie(authorKey)
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
