import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isForumAdminAuthenticated } from "@/lib/forum-auth";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const ALLOWED_UPDATE_STATUSES = [
  "new",
  "reviewing",
  "resolved",
  "ignored",
] as const;

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

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error("Supabase environment is not configured");
  }

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
    },
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!isForumAdminAuthenticated(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await context.params;
  const feedbackId = String(id ?? "").trim();

  if (!feedbackId) {
    return NextResponse.json(
      { success: false, error: "feedback id is required" },
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

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("forum_feedback_reports")
    .update({
      status,
      admin_note: normalizeAdminNote(body?.admin_note ?? body?.adminNote),
      updated_at: new Date().toISOString(),
    })
    .eq("id", feedbackId)
    .select("id,status,admin_note,updated_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { success: false, error: "feedback not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, feedback: data });
}
