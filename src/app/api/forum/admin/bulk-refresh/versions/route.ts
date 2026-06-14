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
  raw_result: unknown;
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

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stripCodeFence(value: string) {
  return value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseJsonObject(outputText: string) {
  const stripped = stripCodeFence(outputText);

  try {
    return JSON.parse(stripped) as Record<string, unknown>;
  } catch {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(stripped.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
  }

  return null;
}

function collectTextFromUnknown(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") {
    const text = value.trim();
    return text ? [text] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectTextFromUnknown(item));
  }
  if (typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  const directText = [record.text, record.output_text]
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());

  return [
    ...directText,
    ...collectTextFromUnknown(record.content),
    ...collectTextFromUnknown(record.output),
    ...collectTextFromUnknown(record.message),
  ];
}

function extractOutputTextFromResponse(data: unknown) {
  const record = asRecord(data);
  if (!record) return "";

  const direct = asString(record.output_text);
  if (direct) return direct;

  return Array.from(new Set(collectTextFromUnknown(record.output))).join("\n").trim();
}

function extractRawOutputText(rawResult: unknown) {
  const raw = asRecord(rawResult);
  if (!raw) return "";

  return asString(raw.output_text) || extractOutputTextFromResponse(raw.response);
}

function getRawParsed(rawResult: unknown) {
  const raw = asRecord(rawResult);
  const parsed = asRecord(raw?.parsed);
  if (parsed) return parsed;

  const outputText = extractRawOutputText(rawResult);
  return outputText ? parseJsonObject(outputText) : null;
}

function isPlaceholderSummary(value: unknown) {
  const text = asString(value);
  return (
    !text ||
    text.includes("AI整理結果を取得しました") ||
    text.includes("AI謨ｴ逅")
  );
}

function isNonEmptyRecord(value: unknown) {
  const record = asRecord(value);
  return record ? Object.keys(record).length > 0 : false;
}

function normalizeVersionFields(version: VersionRow) {
  const parsed = getRawParsed(version.raw_result);
  const rawOutputText = extractRawOutputText(version.raw_result);
  const relatedTopics = asStringArray(version.related_topics);
  const parsedRelatedTopics = asStringArray(parsed?.related_topics);
  const structureJson = isNonEmptyRecord(version.structure_json)
    ? version.structure_json
    : isNonEmptyRecord(parsed?.structure_json)
      ? parsed?.structure_json
      : {};

  return {
    summary_text: isPlaceholderSummary(version.summary_text)
      ? asString(parsed?.summary_text) || rawOutputText || null
      : version.summary_text,
    provisional_answer:
      version.provisional_answer || asString(parsed?.provisional_answer) || null,
    evidence_text: version.evidence_text || asString(parsed?.evidence_text) || null,
    counterargument_text:
      version.counterargument_text || asString(parsed?.counterargument_text) || null,
    related_topics: relatedTopics.length > 0 ? version.related_topics : parsedRelatedTopics,
    structure_json: structureJson,
  };
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
        "raw_result",
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
    versions: versionRows.map((version) => {
      const normalized = normalizeVersionFields(version);
      return {
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
        summary_text: normalized.summary_text,
        summary_excerpt: compactText(normalized.summary_text),
        provisional_answer: normalized.provisional_answer,
        evidence_text: normalized.evidence_text,
        counterargument_text: normalized.counterargument_text,
        related_topics: normalized.related_topics,
        structure_json: normalized.structure_json,
        current_summary: buildCurrentSummary(currentSummaries.get(version.thread_id)),
      };
    }),
  });
}
