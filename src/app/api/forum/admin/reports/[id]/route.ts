import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isForumAdminAuthenticated } from "@/lib/forum-auth";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ALLOWED_UPDATE_STATUSES = ["reviewing", "resolved", "dismissed"] as const;

function isAllowedUpdateStatus(value: string) {
  return ALLOWED_UPDATE_STATUSES.includes(
    value as (typeof ALLOWED_UPDATE_STATUSES)[number]
  );
}

function normalizeAdminNote(value: unknown) {
  if (typeof value !== "string") return null;
  const note = value.trim().slice(0, 1000);
  return note || null;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!isForumAdminAuthenticated(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await context.params;
  const reportId = String(id ?? "").trim();

  if (!reportId) {
    return NextResponse.json(
      { success: false, error: "report id is required" },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const status = String(body?.status ?? "").trim();

  if (!isAllowedUpdateStatus(status)) {
    return NextResponse.json(
      { success: false, error: "invalid status" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("forum_reports")
    .update({
      status,
      admin_note: normalizeAdminNote(body?.admin_note ?? body?.adminNote),
      resolved_at:
        status === "resolved" || status === "dismissed"
          ? new Date().toISOString()
          : null,
    })
    .eq("id", reportId)
    .select("id,status,admin_note,resolved_at,updated_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { success: false, error: "report not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, report: data });
}
