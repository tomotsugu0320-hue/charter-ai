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

type ApplyRequest = {
  confirmApply?: boolean;
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

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      const record = asRecord(item);
      return asString(record?.text ?? record?.label ?? record?.title);
    })
    .filter(Boolean)
    .slice(0, 12);
}

function shortText(value: string | null | undefined, maxLength = 160) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
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
  const structureJson = isNonEmptyRecord(version.structure_json)
    ? (version.structure_json as Record<string, unknown>)
    : isNonEmptyRecord(parsed?.structure_json)
      ? (parsed?.structure_json as Record<string, unknown>)
      : {};

  const relatedTopics = asStringArray(version.related_topics);
  const parsedRelatedTopics = asStringArray(parsed?.related_topics);

  return {
    summary_text: isPlaceholderSummary(version.summary_text)
      ? asString(parsed?.summary_text) || rawOutputText || null
      : asString(version.summary_text),
    provisional_answer:
      asString(version.provisional_answer) || asString(parsed?.provisional_answer) || null,
    evidence_text: asString(version.evidence_text) || asString(parsed?.evidence_text) || null,
    counterargument_text:
      asString(version.counterargument_text) ||
      asString(parsed?.counterargument_text) ||
      null,
    related_topics: relatedTopics.length > 0 ? relatedTopics : parsedRelatedTopics,
    structure_json: structureJson,
  };
}

function buildKeyPoints(version: {
  provisional_answer: string | null;
  evidence_text: string | null;
  counterargument_text: string | null;
  related_topics: string[];
  structure_json: Record<string, unknown>;
}) {
  const issues =
    asStringArray(version.structure_json.issues).length > 0
      ? asStringArray(version.structure_json.issues)
      : version.related_topics.slice(0, 5);
  const opinions =
    asStringArray(version.structure_json.opinions).length > 0
      ? asStringArray(version.structure_json.opinions)
      : version.provisional_answer
        ? [version.provisional_answer]
        : [];
  const rebuttals =
    asStringArray(version.structure_json.rebuttals).length > 0
      ? asStringArray(version.structure_json.rebuttals)
      : asStringArray(version.structure_json.counterarguments).length > 0
        ? asStringArray(version.structure_json.counterarguments)
        : version.counterargument_text
          ? [version.counterargument_text]
          : [];
  const supplements =
    asStringArray(version.structure_json.supplements).length > 0
      ? asStringArray(version.structure_json.supplements)
      : asStringArray(version.structure_json.premises).length > 0
        ? asStringArray(version.structure_json.premises)
        : version.related_topics.slice(0, 5);
  const explanations =
    asStringArray(version.structure_json.explanations).length > 0
      ? asStringArray(version.structure_json.explanations)
      : asStringArray(version.structure_json.reasons).length > 0
        ? asStringArray(version.structure_json.reasons)
        : version.evidence_text
          ? [version.evidence_text]
          : [];

  return {
    issues,
    opinions,
    rebuttals,
    supplements,
    explanations,
  };
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isForumAdminAuthenticated(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const versionId = String(id ?? "").trim();

  if (!versionId) {
    return NextResponse.json({ ok: false, error: "version id is required" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as ApplyRequest;
  if (body.confirmApply !== true) {
    return NextResponse.json(
      { ok: false, error: "Apply confirmation is required." },
      { status: 400 }
    );
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
        "prompt_version",
        "model",
        "summary_text",
        "provisional_answer",
        "evidence_text",
        "counterargument_text",
        "related_topics",
        "structure_json",
        "raw_result",
        "is_applied",
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

  const versionRow = version as unknown as Record<string, unknown>;
  if (versionRow.is_applied === true) {
    return NextResponse.json(
      { ok: false, error: "This version has already been applied." },
      { status: 409 }
    );
  }

  const threadId = asString(versionRow.thread_id);
  if (!threadId) {
    return NextResponse.json({ ok: false, error: "version thread_id is missing" }, { status: 400 });
  }

  const normalized = normalizeVersionFields(versionRow);
  if (!normalized.summary_text) {
    return NextResponse.json(
      { ok: false, error: "version summary_text is empty" },
      { status: 400 }
    );
  }

  const { data: thread, error: threadError } = await supabase
    .from("forum_threads")
    .select("id, title, original_post")
    .eq("id", threadId)
    .maybeSingle();

  if (threadError) {
    return NextResponse.json({ ok: false, error: threadError.message }, { status: 500 });
  }

  if (!thread) {
    return NextResponse.json({ ok: false, error: "thread not found" }, { status: 404 });
  }

  const keyPoints = buildKeyPoints({
    provisional_answer: normalized.provisional_answer,
    evidence_text: normalized.evidence_text,
    counterargument_text: normalized.counterargument_text,
    related_topics: normalized.related_topics,
    structure_json: normalized.structure_json,
  });
  const now = new Date().toISOString();
  const summaryPayload = {
    thread_id: threadId,
    original_post: asString((thread as Record<string, unknown>).original_post) || normalized.summary_text,
    normalized_theme: asString((thread as Record<string, unknown>).title) || shortText(normalized.summary_text, 80),
    summary_text: normalized.summary_text,
    easy_summary_text: shortText(normalized.summary_text, 160),
    key_points: keyPoints,
    issues: keyPoints.issues,
    opinions: keyPoints.opinions,
    rebuttals: keyPoints.rebuttals,
    supplements: keyPoints.supplements,
    explanations: keyPoints.explanations,
    trust_status: "trusted",
    status: "active",
    summary_type: "bulk_refresh_thread_summary",
    updated_at: now,
  };

  const { error: summaryError } = await supabase
    .from("thread_ai_structures")
    .upsert(summaryPayload, { onConflict: "thread_id" })
    .select("thread_id")
    .maybeSingle();

  if (summaryError) {
    return NextResponse.json({ ok: false, error: summaryError.message }, { status: 500 });
  }

  const { data: appliedVersion, error: applyError } = await supabase
    .from("forum_thread_ai_structure_versions")
    .update({
      is_applied: true,
      applied_at: now,
    })
    .eq("id", versionId)
    .eq("thread_id", threadId)
    .eq("is_applied", false)
    .select("id, thread_id, is_applied, applied_at")
    .maybeSingle();

  if (applyError) {
    return NextResponse.json({ ok: false, error: applyError.message }, { status: 500 });
  }

  if (!appliedVersion) {
    return NextResponse.json(
      { ok: false, error: "This version has already been applied." },
      { status: 409 }
    );
  }

  return NextResponse.json({
    ok: true,
    version: appliedVersion,
  });
}
