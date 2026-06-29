import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isForumAdminAuthenticated } from "@/lib/forum-auth";

const ALLOWED_STATUSES = ["new", "reviewing", "resolved", "ignored"] as const;

function isAllowedStatus(value: string) {
  return ALLOWED_STATUSES.includes(value as (typeof ALLOWED_STATUSES)[number]);
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

export async function GET(request: NextRequest) {
  if (!isForumAdminAuthenticated(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const statusParam = request.nextUrl.searchParams.get("status") ?? "new";
  const status = statusParam.trim() || "new";

  if (status !== "all" && !isAllowedStatus(status)) {
    return NextResponse.json(
      { success: false, error: "invalid status" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("forum_feedback_reports")
    .select(
      "id,tenant_id,page_url,report_type,device_type,message,contact,user_agent,status,admin_note,created_at,updated_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, feedback: data ?? [] });
}
