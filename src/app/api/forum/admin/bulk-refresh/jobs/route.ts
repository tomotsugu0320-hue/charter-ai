import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isForumAdminAuthenticated } from "@/lib/forum-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const JOB_LIMIT = 20;
const ITEM_LIMIT = 120;

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

export async function GET(request: NextRequest) {
  if (!isForumAdminAuthenticated(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase service role is not configured." },
      { status: 500 }
    );
  }

  const { data: jobs, error: jobsError } = await supabase
    .from("forum_bulk_refresh_jobs")
    .select(
      [
        "id",
        "status",
        "target_type",
        "max_items",
        "estimated_api_calls",
        "estimated_total_tokens",
        "estimated_cost_usd",
        "actual_api_calls",
        "actual_total_tokens",
        "actual_cost_usd",
        "success_count",
        "failed_count",
        "skipped_count",
        "error_message",
        "created_at",
        "started_at",
        "completed_at",
      ].join(", ")
    )
    .order("created_at", { ascending: false })
    .limit(JOB_LIMIT);

  if (jobsError) {
    return NextResponse.json({ ok: false, error: jobsError.message }, { status: 500 });
  }

  const jobRows = (jobs ?? []) as any[];
  const jobIds = jobRows.map((job) => job.id).filter(Boolean);
  let itemsByJobId: Record<string, unknown[]> = {};

  if (jobIds.length > 0) {
    const { data: items, error: itemsError } = await supabase
      .from("forum_bulk_refresh_job_items")
      .select(
        [
          "id",
          "job_id",
          "target_type",
          "target_id",
          "status",
          "previous_version_id",
          "new_version_id",
          "actual_total_tokens",
          "actual_cost_usd",
          "error_message",
          "created_at",
          "started_at",
          "completed_at",
        ].join(", ")
      )
      .in("job_id", jobIds)
      .order("created_at", { ascending: false })
      .limit(ITEM_LIMIT);

    if (itemsError) {
      return NextResponse.json({ ok: false, error: itemsError.message }, { status: 500 });
    }

    itemsByJobId = ((items ?? []) as any[]).reduce<Record<string, unknown[]>>((acc, item) => {
      const jobId = String(item.job_id ?? "");
      if (!jobId) return acc;
      acc[jobId] = [...(acc[jobId] ?? []), item];
      return acc;
    }, {});
  }

  return NextResponse.json({
    ok: true,
    jobs: jobRows.map((job) => ({
      ...job,
      items: itemsByJobId[String(job.id)] ?? [],
    })),
  });
}
