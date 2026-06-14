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

function normalizeVersionFields(version: Record<string, unknown>) {
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
      asString(version.provisional_answer) || asString(parsed?.provisional_answer) || null,
    evidence_text: asString(version.evidence_text) || asString(parsed?.evidence_text) || null,
    counterargument_text:
      asString(version.counterargument_text) ||
      asString(parsed?.counterargument_text) ||
      null,
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

function truncateText(value: unknown, maxLength = 5000) {
  if (typeof value !== "string") return value ?? null;
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function sanitizeRawResult(value: unknown) {
  if (!value || typeof value !== "object") return value ?? null;

  const raw = value as Record<string, unknown>;
  const response = asRecord(raw.response);
  return {
    job_id: raw.job_id ?? null,
    parsed: raw.parsed ?? null,
    output_text: truncateText(raw.output_text),
    response_output_text: truncateText(extractOutputTextFromResponse(raw.response)),
    response_id: response?.id ?? null,
    response_model: response?.model ?? null,
    usage: response?.usage ?? null,
    raw_keys: Object.keys(raw),
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
      ...normalizeVersionFields(versionRow),
      raw_result: sanitizeRawResult(versionRow.raw_result),
      thread: thread ?? null,
      current_summary: buildCurrentSummary((currentSummary ?? null) as CurrentSummaryRow | null),
    },
  });
}
