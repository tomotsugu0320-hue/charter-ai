import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isForumAdminAuthenticated } from "@/lib/forum-auth";
import { getErrorMessage, recordForumApiUsageLog } from "@/lib/forum-api-usage";
import { ECONOMIC_POLICY_ANALYSIS_FRAME_PROMPT } from "@/lib/forum/economic-policy-analysis-frame";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MODEL = "gpt-5.4-mini";
const PROMPT_VERSION = "thread_summary_from_classifications_v1";
const MAX_CLASSIFICATION_ITEMS = 30;

const CLASSIFICATION_LABELS: Record<string, string> = {
  agreement: "主な同意",
  rebuttal: "主な反論",
  premise_addition: "追加された前提",
  evidence_addition: "追加された根拠",
  case_addition: "追加された事例",
  metric_suggestion: "検証指標の提案",
  topic_shift: "論点ずれ",
  emotional_reaction: "感情的反応",
  needs_review_or_misinformation_risk: "要確認・誤情報疑い",
};

type ForumThreadRow = {
  id: string;
  title: string | null;
  category: string | null;
  original_post: string | null;
  ai_summary: string | null;
};

type ForumPostRow = {
  id: string;
  thread_id: string;
  post_role: string | null;
  parent_opinion_id: string | null;
  content: string | null;
  created_at: string | null;
  logic_score: number | null;
  logic_score_reason: string | null;
};

type PostAiClassificationRow = {
  post_id: string | null;
  classification: string | null;
  confidence: number | string | null;
  reason: string | null;
  extracted_premise: string | null;
  extracted_evidence: string | null;
  suggested_metrics: unknown;
  created_at: string | null;
};

type ExistingSummaryRow = {
  summary_text: string | null;
  easy_summary_text?: string | null;
  issues?: unknown;
  opinions?: unknown;
  rebuttals?: unknown;
  supplements?: unknown;
  explanations?: unknown;
  key_points?: unknown;
};

type ClassifiedPost = {
  post: ForumPostRow;
  classification: {
    classification: string;
    label: string;
    confidence: number | null;
    reason: string;
    extracted_premise: string;
    extracted_evidence: string;
    suggested_metrics: string[];
    created_at: string | null;
  };
};

type GeneratedKeyPoints = {
  discussion_position: string[];
  added_premises: string[];
  added_evidence: string[];
  main_agreements: string[];
  main_rebuttals: string[];
  verification_metrics: string[];
  needs_review: string[];
  changes_from_initial_answer: string[];
  current_tentative_conclusion: string[];
};

type GeneratedSummary = {
  summary_text: string;
  easy_summary_text: string;
  provisional_answer: string;
  key_points: GeneratedKeyPoints;
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

function errorResponse(error: string, status = 500) {
  return NextResponse.json({ ok: false, error }, { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown, maxLength = 4000) {
  const text = String(value ?? "").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function asStringArray(value: unknown, maxItems = 12) {
  const source = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return source
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (typeof item === "number" || typeof item === "boolean") return String(item);
      const record = isRecord(item) ? item : null;
      return asString(record?.text ?? record?.label ?? record?.title, 500);
    })
    .filter(Boolean)
    .slice(0, maxItems);
}

function compactText(value: string | null | undefined, maxLength = 900) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function toNullableNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
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
  if (!isRecord(value)) return [];

  const directText = [value.text, value.output_text]
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());

  return [
    ...directText,
    ...collectTextFromUnknown(value.content),
    ...collectTextFromUnknown(value.output),
    ...collectTextFromUnknown(value.message),
  ];
}

function extractOutputTextFromResponse(data: unknown) {
  if (!isRecord(data)) return "";

  const direct = asString(data.output_text);
  if (direct) return direct;

  return Array.from(new Set(collectTextFromUnknown(data.output))).join("\n").trim();
}

function normalizeKeyPoints(value: unknown): GeneratedKeyPoints {
  const record = isRecord(value) ? value : {};

  return {
    discussion_position: asStringArray(record.discussion_position, 8),
    added_premises: asStringArray(record.added_premises, 8),
    added_evidence: asStringArray(record.added_evidence, 8),
    main_agreements: asStringArray(record.main_agreements, 8),
    main_rebuttals: asStringArray(record.main_rebuttals, 8),
    verification_metrics: asStringArray(record.verification_metrics, 8),
    needs_review: asStringArray(record.needs_review, 8),
    changes_from_initial_answer: asStringArray(record.changes_from_initial_answer, 8),
    current_tentative_conclusion: asStringArray(record.current_tentative_conclusion, 8),
  };
}

function normalizeGeneratedSummary(outputText: string) {
  const parsed = parseJsonObject(outputText);
  if (!parsed) {
    throw new Error("Failed to parse OpenAI summary JSON.");
  }

  const keyPoints = normalizeKeyPoints(parsed.key_points);
  const summaryText = asString(parsed.summary_text, 12000);
  const easySummaryText = asString(parsed.easy_summary_text, 3000);
  const provisionalAnswer = asString(parsed.provisional_answer, 8000);

  if (!summaryText) {
    throw new Error("OpenAI summary_text is empty.");
  }

  return {
    summary_text: summaryText,
    easy_summary_text: easySummaryText || compactText(summaryText, 180),
    provisional_answer: provisionalAnswer || summaryText,
    key_points: keyPoints,
  } satisfies GeneratedSummary;
}

function buildClassificationGroups(items: ClassifiedPost[]) {
  const grouped = new Map<string, ClassifiedPost[]>();

  for (const item of items) {
    const key = item.classification.classification || "unknown";
    const current = grouped.get(key) ?? [];
    current.push(item);
    grouped.set(key, current);
  }

  return Array.from(grouped.entries())
    .map(([classification, groupItems]) => {
      const label = CLASSIFICATION_LABELS[classification] ?? classification;
      const lines = groupItems.slice(0, 8).map((item, index) => {
        const metrics =
          item.classification.suggested_metrics.length > 0
            ? `\n  検証指標: ${item.classification.suggested_metrics.join(" / ")}`
            : "";
        return [
          `${index + 1}. role=${item.post.post_role ?? "post"} confidence=${item.classification.confidence ?? "unknown"}`,
          `  投稿: ${compactText(item.post.content, 520)}`,
          `  理由: ${compactText(item.classification.reason, 260)}`,
          item.classification.extracted_premise
            ? `  抽出前提: ${compactText(item.classification.extracted_premise, 260)}`
            : "",
          item.classification.extracted_evidence
            ? `  抽出根拠: ${compactText(item.classification.extracted_evidence, 260)}`
            : "",
          metrics,
        ]
          .filter(Boolean)
          .join("\n");
      });

      return `## ${label} (${classification}) ${groupItems.length}件\n${lines.join("\n\n")}`;
    })
    .join("\n\n");
}

function buildPrompt(input: {
  thread: ForumThreadRow;
  posts: ForumPostRow[];
  classifiedItems: ClassifiedPost[];
  existingSummary: ExistingSummaryRow | null;
}) {
  const { thread, posts, classifiedItems, existingSummary } = input;
  const usedItems = classifiedItems.slice(0, MAX_CLASSIFICATION_ITEMS);
  const groupedText = buildClassificationGroups(usedItems);
  const existingIssues = asStringArray(existingSummary?.issues, 5).join(" / ");
  const existingOpinions = asStringArray(existingSummary?.opinions, 5).join(" / ");
  const existingRebuttals = asStringArray(existingSummary?.rebuttals, 5).join(" / ");

  return `
${ECONOMIC_POLICY_ANALYSIS_FRAME_PROMPT}

あなたはAI知恵袋Forumの議論再総括AIです。
管理者がAI分類済みコメントを確認した後、スレッド全体のAI総括を更新するための材料を整理します。

重要:
- 分類結果はAIによる補助判断であり、確定事実ではありません。
- 分類結果を根拠にしつつ、投稿本文・理由・抽出前提・抽出根拠を見比べてください。
- 「どちらも一理あります」「バランスが重要」だけで終わらないでください。
- 断定しすぎず、追加前提、追加根拠、反論、検証指標を分けてください。
- reason等の表示用テキストは日本語で書いてください。
- JSONのみ返してください。Markdownや説明文は不要です。

JSON形式:
{
  "summary_text": "議論後の現在地と現時点の再総括。読みやすい日本語で書く。",
  "easy_summary_text": "短い要約。100〜180字程度。",
  "provisional_answer": "現時点の暫定結論。断定しすぎず、条件分岐を含める。",
  "key_points": {
    "discussion_position": [],
    "added_premises": [],
    "added_evidence": [],
    "main_agreements": [],
    "main_rebuttals": [],
    "verification_metrics": [],
    "needs_review": [],
    "changes_from_initial_answer": [],
    "current_tentative_conclusion": []
  }
}

スレッド:
- title: ${compactText(thread.title, 240)}
- category: ${compactText(thread.category, 120)}
- original_post: ${compactText(thread.original_post || thread.ai_summary, 1600)}

既存AI総括:
- summary_text: ${compactText(existingSummary?.summary_text, 1200)}
- easy_summary_text: ${compactText(existingSummary?.easy_summary_text, 400)}
- issues: ${existingIssues || "なし"}
- opinions: ${existingOpinions || "なし"}
- rebuttals: ${existingRebuttals || "なし"}

投稿数: ${posts.length}
分類済みコメント数: ${classifiedItems.length}
今回AIに渡す分類済みコメント数: ${usedItems.length}

分類済みコメント:
${groupedText}
`.trim();
}

async function generateSummaryFromClassifications(input: {
  thread: ForumThreadRow;
  posts: ForumPostRow[];
  classifiedItems: ClassifiedPost[];
  existingSummary: ExistingSummaryRow | null;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }

  const prompt = buildPrompt(input);
  let data: unknown = null;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        input: prompt,
        text: {
          format: {
            type: "json_schema",
            name: "thread_summary_from_classifications",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                summary_text: { type: "string" },
                easy_summary_text: { type: "string" },
                provisional_answer: { type: "string" },
                key_points: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    discussion_position: {
                      type: "array",
                      items: { type: "string" },
                    },
                    added_premises: {
                      type: "array",
                      items: { type: "string" },
                    },
                    added_evidence: {
                      type: "array",
                      items: { type: "string" },
                    },
                    main_agreements: {
                      type: "array",
                      items: { type: "string" },
                    },
                    main_rebuttals: {
                      type: "array",
                      items: { type: "string" },
                    },
                    verification_metrics: {
                      type: "array",
                      items: { type: "string" },
                    },
                    needs_review: {
                      type: "array",
                      items: { type: "string" },
                    },
                    changes_from_initial_answer: {
                      type: "array",
                      items: { type: "string" },
                    },
                    current_tentative_conclusion: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                  required: [
                    "discussion_position",
                    "added_premises",
                    "added_evidence",
                    "main_agreements",
                    "main_rebuttals",
                    "verification_metrics",
                    "needs_review",
                    "changes_from_initial_answer",
                    "current_tentative_conclusion",
                  ],
                },
              },
              required: [
                "summary_text",
                "easy_summary_text",
                "provisional_answer",
                "key_points",
              ],
            },
            strict: true,
          },
        },
      }),
    });

    data = await response.json().catch(() => ({}));
    const outputText = extractOutputTextFromResponse(data);

    if (!response.ok) {
      throw new Error(
        isRecord(data) && isRecord(data.error) && typeof data.error.message === "string"
          ? data.error.message
          : "OpenAI thread summary regeneration failed."
      );
    }

    const generated = normalizeGeneratedSummary(outputText);

    await recordForumApiUsageLog({
      featureKey: "thread_summary_from_classifications",
      routePath: "/api/forum/admin/thread-summary/rebuild-from-classifications",
      model: MODEL,
      promptVersion: PROMPT_VERSION,
      targetType: "thread",
      targetId: input.thread.id,
      inputText: prompt,
      outputText,
      usage: isRecord(data) ? data.usage : null,
      status: "success",
    });

    return generated;
  } catch (error) {
    await recordForumApiUsageLog({
      featureKey: "thread_summary_from_classifications",
      routePath: "/api/forum/admin/thread-summary/rebuild-from-classifications",
      model: MODEL,
      promptVersion: PROMPT_VERSION,
      targetType: "thread",
      targetId: input.thread.id,
      inputText: prompt,
      outputText: extractOutputTextFromResponse(data),
      usage: isRecord(data) ? data.usage : null,
      status: "error",
      errorMessage: getErrorMessage(error),
    });
    throw error;
  }
}

function buildDisplayColumns(keyPoints: GeneratedKeyPoints) {
  const issues =
    keyPoints.discussion_position.length > 0
      ? keyPoints.discussion_position
      : keyPoints.current_tentative_conclusion;

  return {
    issues: issues.slice(0, 8),
    opinions: [
      ...keyPoints.main_agreements,
      ...keyPoints.current_tentative_conclusion,
    ].slice(0, 8),
    rebuttals: [
      ...keyPoints.main_rebuttals,
      ...keyPoints.needs_review,
    ].slice(0, 8),
    supplements: keyPoints.added_premises.slice(0, 8),
    explanations: [
      ...keyPoints.added_evidence,
      ...keyPoints.verification_metrics,
      ...keyPoints.changes_from_initial_answer,
    ].slice(0, 8),
  };
}

export async function POST(request: NextRequest) {
  if (!isForumAdminAuthenticated(request)) {
    return errorResponse("Unauthorized", 401);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return errorResponse("Supabase service role env is missing.", 500);
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    body = isRecord(parsed) ? parsed : {};
  } catch {
    body = {};
  }

  const threadId = asString(body.thread_id ?? body.threadId, 120);

  if (!threadId) {
    return errorResponse("thread_id is required.", 400);
  }

  const { data: thread, error: threadError } = await supabase
    .from("forum_threads")
    .select("id, title, category, original_post, ai_summary")
    .eq("id", threadId)
    .eq("is_deleted", false)
    .maybeSingle();

  if (threadError) {
    return errorResponse(threadError.message, 500);
  }

  if (!thread) {
    return errorResponse("thread not found.", 404);
  }

  const { data: posts, error: postsError } = await supabase
    .from("forum_posts")
    .select(
      [
        "id",
        "thread_id",
        "post_role",
        "parent_opinion_id",
        "content",
        "created_at",
        "logic_score",
        "logic_score_reason",
      ].join(", ")
    )
    .eq("thread_id", threadId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: true })
    .limit(300);

  if (postsError) {
    return errorResponse(postsError.message, 500);
  }

  const safePosts = ((posts ?? []) as unknown as ForumPostRow[]).filter((post) =>
    String(post.content ?? "").trim()
  );
  const postById = new Map(safePosts.map((post) => [post.id, post]));

  const { data: classificationRows, error: classificationError } = await supabase
    .from("forum_post_ai_classifications")
    .select(
      [
        "post_id",
        "classification",
        "confidence",
        "reason",
        "extracted_premise",
        "extracted_evidence",
        "suggested_metrics",
        "created_at",
      ].join(", ")
    )
    .eq("thread_id", threadId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(200);

  if (classificationError) {
    return errorResponse(classificationError.message, 500);
  }

  const classifiedByPostId = new Map<string, ClassifiedPost>();

  for (const row of (classificationRows ?? []) as unknown as PostAiClassificationRow[]) {
    const postId = row.post_id ?? "";
    const post = postById.get(postId);

    if (!post || classifiedByPostId.has(postId)) continue;

    const classification = asString(row.classification, 120);
    if (!classification) continue;

    classifiedByPostId.set(postId, {
      post,
      classification: {
        classification,
        label: CLASSIFICATION_LABELS[classification] ?? classification,
        confidence: toNullableNumber(row.confidence),
        reason: asString(row.reason, 800),
        extracted_premise: asString(row.extracted_premise, 800),
        extracted_evidence: asString(row.extracted_evidence, 800),
        suggested_metrics: asStringArray(row.suggested_metrics, 8),
        created_at: row.created_at ?? null,
      },
    });
  }

  const classifiedItems = Array.from(classifiedByPostId.values()).sort((a, b) => {
    const aTime = new Date(a.post.created_at ?? a.classification.created_at ?? "").getTime();
    const bTime = new Date(b.post.created_at ?? b.classification.created_at ?? "").getTime();
    return (Number.isFinite(aTime) ? aTime : 0) - (Number.isFinite(bTime) ? bTime : 0);
  });

  if (classifiedItems.length === 0) {
    return errorResponse("active classified comments were not found.", 400);
  }

  const { data: existingSummary, error: existingSummaryError } = await supabase
    .from("thread_ai_structures")
    .select(
      "summary_text, easy_summary_text, issues, opinions, rebuttals, supplements, explanations, key_points"
    )
    .eq("thread_id", threadId)
    .maybeSingle();

  if (existingSummaryError) {
    return errorResponse(existingSummaryError.message, 500);
  }

  const generated = await generateSummaryFromClassifications({
    thread: thread as ForumThreadRow,
    posts: safePosts,
    classifiedItems,
    existingSummary: (existingSummary ?? null) as ExistingSummaryRow | null,
  });
  const displayColumns = buildDisplayColumns(generated.key_points);
  const now = new Date().toISOString();
  const payload = {
    thread_id: threadId,
    original_post:
      asString((thread as ForumThreadRow).original_post) ||
      asString((thread as ForumThreadRow).title) ||
      generated.summary_text,
    normalized_theme:
      asString((thread as ForumThreadRow).title) ||
      compactText(generated.summary_text, 80) ||
      "classified-thread-summary",
    summary_text: generated.summary_text,
    easy_summary_text: generated.easy_summary_text,
    key_points: generated.key_points,
    issues: displayColumns.issues,
    opinions: displayColumns.opinions,
    rebuttals: displayColumns.rebuttals,
    supplements: displayColumns.supplements,
    explanations: displayColumns.explanations,
    trust_status: "trusted",
    status: "active",
    summary_type: "thread_summary_from_classifications",
    source_post_count: safePosts.length,
    updated_at: now,
  };

  const { error: saveError } = await supabase
    .from("thread_ai_structures")
    .upsert(payload, { onConflict: "thread_id" })
    .select("thread_id")
    .maybeSingle();

  if (saveError) {
    return errorResponse(saveError.message, 500);
  }

  return NextResponse.json({
    ok: true,
    thread_id: threadId,
    classified_count: classifiedItems.length,
    used_count: Math.min(classifiedItems.length, MAX_CLASSIFICATION_ITEMS),
    summary: {
      counts: {
        total: safePosts.length,
        issue_raise: safePosts.filter((post) => post.post_role === "issue_raise").length,
        opinion: safePosts.filter((post) => post.post_role === "opinion").length,
        rebuttal: safePosts.filter((post) => post.post_role === "rebuttal").length,
        supplement: safePosts.filter((post) => post.post_role === "supplement").length,
        explanation: safePosts.filter((post) => post.post_role === "explanation").length,
      },
      summary_text: generated.summary_text,
      easy_summary_text: generated.easy_summary_text,
      provisional_answer: generated.provisional_answer,
      key_points: {
        ...displayColumns,
        ...generated.key_points,
      },
    },
  });
}
