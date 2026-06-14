import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isForumAdminAuthenticated } from "@/lib/forum-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VERSION_LIMIT = 30;

type VersionRow = {
  id: string;
  thread_id: string;
  job_id: string | null;
  job_item_id: string | null;
  prompt_version: string;
  model: string | null;
  summary_text: string | null;
  provisional_answer: string | null;
  evidence_text: string | null;
  counterargument_text: string | null;
  related_topics: unknown;
  structure_json: unknown;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  actual_cost_usd: number | null;
  is_applied: boolean;
  created_at: string | null;
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

function compactText(value: string | null | undefined, maxLength = 260) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
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

  const { data: versions, error: versionsError } = await supabase
    .from("forum_thread_ai_structure_versions")
    .select(
      [
        "id",
        "thread_id",
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
        "input_tokens",
        "output_tokens",
        "total_tokens",
        "actual_cost_usd",
        "is_applied",
        "created_at",
      ].join(", ")
    )
    .order("created_at", { ascending: false })
    .limit(VERSION_LIMIT);

  if (versionsError) {
    return NextResponse.json({ ok: false, error: versionsError.message }, { status: 500 });
  }

  const versionRows = (versions ?? []) as unknown as VersionRow[];
  const threadIds = Array.from(new Set(versionRows.map((row) => row.thread_id).filter(Boolean)));
  const threadTitles = new Map<string, string | null>();
  const currentSummaries = new Map<string, CurrentSummaryRow>();

  if (threadIds.length > 0) {
    const { data: threads, error: threadsError } = await supabase
      .from("forum_threads")
      .select("id, title")
      .in("id", threadIds);

    if (threadsError) {
      return NextResponse.json({ ok: false, error: threadsError.message }, { status: 500 });
    }

    ((threads ?? []) as Array<{ id: string; title: string | null }>).forEach((thread) => {
      threadTitles.set(thread.id, thread.title);
    });

    const { data: summaries, error: summariesError } = await supabase
      .from("thread_ai_structures")
      .select("thread_id, summary_text, issues, rebuttals, supplements, explanations")
      .in("thread_id", threadIds);

    if (summariesError) {
      return NextResponse.json({ ok: false, error: summariesError.message }, { status: 500 });
    }

    ((summaries ?? []) as CurrentSummaryRow[]).forEach((summary) => {
      currentSummaries.set(summary.thread_id, summary);
    });
  }

  return NextResponse.json({
    ok: true,
    versions: versionRows.map((version) => ({
      id: version.id,
      thread_id: version.thread_id,
      thread_title: threadTitles.get(version.thread_id) ?? null,
      job_id: version.job_id,
      job_item_id: version.job_item_id,
      prompt_version: version.prompt_version,
      model: version.model,
      is_applied: version.is_applied,
      input_tokens: version.input_tokens,
      output_tokens: version.output_tokens,
      total_tokens: version.total_tokens,
      actual_cost_usd: version.actual_cost_usd,
      created_at: version.created_at,
      summary_text: version.summary_text,
      summary_excerpt: compactText(version.summary_text),
      provisional_answer: version.provisional_answer,
      evidence_text: version.evidence_text,
      counterargument_text: version.counterargument_text,
      related_topics: version.related_topics,
      structure_json: version.structure_json,
      current_summary: buildCurrentSummary(currentSummaries.get(version.thread_id)),
    })),
  });
}
