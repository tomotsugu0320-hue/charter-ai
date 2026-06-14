import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isForumAdminAuthenticated } from "@/lib/forum-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type CurrentSummaryRow = {
  thread_id: string;
  summary_text: string | null;
  issues: unknown;
  rebuttals: unknown;
  supplements: unknown;
  explanations: unknown;
};

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

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function buildCurrentSummary(row: CurrentSummaryRow | null | undefined) {
  if (!row) return null;

  const explanations = asStringArray(row.explanations);
  const rebuttals = asStringArray(row.rebuttals);
  const supplements = asStringArray(row.supplements);
  const issues = asStringArray(row.issues);

  return {
    summary_text: row.summary_text ?? null,
    provisional_answer: row.summary_text ?? null,
    evidence_text: explanations.join("\n") || null,
    counterargument_text: rebuttals.join("\n") || null,
    related_topics: [...issues, ...supplements].slice(0, 12),
  };
}

function truncateText(value: unknown, maxLength = 5000) {
  if (typeof value !== "string") return value ?? null;
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function sanitizeRawResult(value: unknown) {
  if (!value || typeof value !== "object") return value ?? null;

  const raw = value as Record<string, unknown>;
  return {
    job_id: raw.job_id ?? null,
    parsed: raw.parsed ?? null,
    output_text: truncateText(raw.output_text),
  };
}

export async function GET(request: NextRequest, context: RouteContext) {
  if (!isForumAdminAuthenticated(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const versionId = String(id ?? "").trim();

  if (!versionId) {
    return NextResponse.json({ ok: false, error: "version id is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase service role is not configured." },
      { status: 500 }
    );
  }

  const { data: version, error: versionError } = await supabase
    .from("forum_thread_ai_structure_versions")
    .select(
      [
        "id",
        "thread_id",
        "source_structure_id",
        "job_id",
        "job_item_id",
        "prompt_version",
        "model",
        "summary_text",
        "provisional_answer",
        "evidence_text",
        "counterargument_text",
        "related_topics",
        "structure_json",
        "raw_result",
        "input_tokens",
        "output_tokens",
        "total_tokens",
        "estimated_cost_usd",
        "actual_cost_usd",
        "is_applied",
        "applied_at",
        "created_at",
      ].join(", ")
    )
    .eq("id", versionId)
    .maybeSingle();

  if (versionError) {
    return NextResponse.json({ ok: false, error: versionError.message }, { status: 500 });
  }

  if (!version) {
    return NextResponse.json({ ok: false, error: "version not found" }, { status: 404 });
  }

  const versionRow = version as any;
  const threadId = String(versionRow.thread_id ?? "");
  const { data: thread, error: threadError } = await supabase
    .from("forum_threads")
    .select("id, title, category, created_at")
    .eq("id", threadId)
    .maybeSingle();

  if (threadError) {
    return NextResponse.json({ ok: false, error: threadError.message }, { status: 500 });
  }

  const { data: currentSummary, error: currentSummaryError } = await supabase
    .from("thread_ai_structures")
    .select("thread_id, summary_text, issues, rebuttals, supplements, explanations")
    .eq("thread_id", threadId)
    .maybeSingle();

  if (currentSummaryError) {
    return NextResponse.json({ ok: false, error: currentSummaryError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    version: {
      ...versionRow,
      raw_result: sanitizeRawResult(versionRow.raw_result),
      thread: thread ?? null,
      current_summary: buildCurrentSummary((currentSummary ?? null) as CurrentSummaryRow | null),
    },
  });
}
