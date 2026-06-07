import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isForumBetaLoggedIn } from "@/lib/forum-auth";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

async function readRequestBody(req: NextRequest) {
  try {
    const body: unknown = await req.json();
    return typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    if (!isForumBetaLoggedIn(req)) {
      return NextResponse.json(
        { success: false, error: "Login required." },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const logId = readText(id);
    const body = await readRequestBody(req);
    const tenantSlug = readText(body.tenantSlug ?? body.tenant_slug);

    if (!logId) {
      return NextResponse.json(
        { success: false, error: "log id is required" },
        { status: 400 }
      );
    }

    if (!tenantSlug) {
      return NextResponse.json(
        { success: false, error: "tenantSlug is required" },
        { status: 400 }
      );
    }

    const authorKey = getAuthorKey(req);

    if (!authorKey) {
      return NextResponse.json(
        { success: false, error: "forbidden" },
        { status: 403 }
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

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const baseQuery = () =>
      supabase
        .from("private_import_logs")
        .update({
          status: "archived",
          updated_at: new Date().toISOString(),
        })
        .eq("id", logId)
        .eq("tenant_slug", tenantSlug)
        .eq("author_key", authorKey)
        .eq("status", "saved")
        .select("id, status")
        .maybeSingle();

    let { data, error } = await baseQuery();

    if (error && error.message.toLowerCase().includes("updated_at")) {
      const fallback = await supabase
        .from("private_import_logs")
        .update({ status: "archived" })
        .eq("id", logId)
        .eq("tenant_slug", tenantSlug)
        .eq("author_key", authorKey)
        .eq("status", "saved")
        .select("id, status")
        .maybeSingle();

      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: "Log not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      log: data,
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
