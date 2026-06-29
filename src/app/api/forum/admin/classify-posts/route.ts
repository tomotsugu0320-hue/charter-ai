import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isForumAdminAuthenticated } from "@/lib/forum-auth";
import { getErrorMessage, recordForumApiUsageLog } from "@/lib/forum-api-usage";
import { ECONOMIC_POLICY_ANALYSIS_FRAME_PROMPT } from "@/lib/forum/economic-policy-analysis-frame";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MODEL = "gpt-4.1-mini";
const PROMPT_VERSION = "post_ai_classification_v1_ja";
const MAX_ITEMS = 10;
const DEFAULT_MAX_ITEMS = 5;
const TARGET_POST_ROLES = [
  "opinion",
  "rebuttal",
  "supplement",
  "explanation",
] as const;
const CLASSIFICATIONS = [
  "agreement",
  "rebuttal",
  "premise_addition",
  "evidence_addition",
  "case_addition",
  "metric_suggestion",
  "topic_shift",
  "emotional_reaction",
  "needs_review_or_misinformation_risk",
] as const;

type Classification = (typeof CLASSIFICATIONS)[number];

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

type ActiveClassificationRow = {
  id: string;
  post_id: string;
};

type ClassificationResult = {
  classification: Classification;
  confidence: number;
  reason: string;
  extracted_premise: string;
  extracted_evidence: string;
  suggested_metrics: string[];
  raw_result: Record<string, unknown>;
};

type ResponseItem = {
  post_id: string;
  status: "completed" | "skipped" | "failed";
  classification_id?: string;
  classification?: Classification;
  confidence?: number;
  error?: string;
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

function normalizeMaxItems(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_MAX_ITEMS;
  return Math.max(1, Math.min(MAX_ITEMS, Math.floor(numeric)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function compactText(value: string | null | undefined, maxLength = 1600) {
  const text = String(value ?? "").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function stripMarkdownJsonFence(value: string) {
  const trimmed = value.trim();
  const fencedBlock = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fencedBlock?.[1]) return fencedBlock[1].trim();

  const embeddedFence = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (embeddedFence?.[1]) return embeddedFence[1].trim();

  return trimmed;
}

function parseJsonObject(value: string) {
  const normalized = stripMarkdownJsonFence(value);
  const parsed = JSON.parse(normalized);
  return isRecord(parsed) ? parsed : null;
}

function extractOutputTextFromResponse(data: unknown) {
  if (isRecord(data) && typeof data.output_text === "string") {
    return data.output_text.trim();
  }

  const output = isRecord(data) ? data.output : null;
  if (!Array.isArray(output)) return "";

  for (const item of output) {
    if (!isRecord(item) || !Array.isArray(item.content)) continue;

    for (const content of item.content) {
      if (!isRecord(content)) continue;
      if (
        (content.type === "output_text" || content.type === "text") &&
        typeof content.text === "string"
      ) {
        return content.text.trim();
      }
    }
  }

  return "";
}

function normalizeClassification(value: unknown): Classification {
  const text = String(value ?? "").trim();
  if (CLASSIFICATIONS.includes(text as Classification)) {
    return text as Classification;
  }

  throw new Error(`Invalid classification: ${text || "(empty)"}`);
}

function clampConfidence(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0.5;
  return Math.max(0, Math.min(1, numeric));
}

function asString(value: unknown, maxLength = 1000) {
  const text = String(value ?? "").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function asStringArray(value: unknown, maxItems = 8) {
  const source = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return source
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function buildPrompt(
  thread: ForumThreadRow,
  post: ForumPostRow,
  parentPost?: ForumPostRow | null
) {
  return `
${ECONOMIC_POLICY_ANALYSIS_FRAME_PROMPT}

あなたはAI知恵袋Forumのコメント分類AIです。
次の投稿を、スレッド文脈に照らして1つの分類にしてください。

分類は次のいずれか:
- agreement
- rebuttal
- premise_addition
- evidence_addition
- case_addition
- metric_suggestion
- topic_shift
- emotional_reaction
- needs_review_or_misinformation_risk

判断方針:
- 投稿者の意図を決めつけすぎない
- 反論と根拠追加を混同しない
- 数値、統計、制度名、検証方法がある場合は evidence_addition または metric_suggestion を優先
- 論点から外れている場合は topic_shift
- 感情表現が中心で論拠が弱い場合は emotional_reaction
- 明確な誤情報の疑い、断定的な不確実情報、確認が必要な主張は needs_review_or_misinformation_risk
- JSONのみ返す

Output language rules:
- Keep classification exactly as one of the English keys listed above.
- Write reason only in Japanese.
- Write extracted_premise only in Japanese. If no premise is available, use an empty string.
- Write extracted_evidence only in Japanese. If no evidence is available, use an empty string.
- Write each suggested_metrics item in Japanese. If no metric is available, use an empty array.
- Even if the input text contains English, translate and summarize display fields in Japanese.
- Do not output English sentences in reason, extracted_premise, extracted_evidence, or suggested_metrics.

スレッド:
- title: ${compactText(thread.title, 240)}
- category: ${compactText(thread.category, 120)}
- original_post: ${compactText(thread.original_post, 1200)}
- ai_summary: ${compactText(thread.ai_summary, 800)}

親投稿:
${parentPost ? compactText(parentPost.content, 1000) : "なし"}

対象投稿:
- post_role: ${compactText(post.post_role, 80)}
- logic_score: ${post.logic_score ?? "未評価"}
- logic_score_reason: ${compactText(post.logic_score_reason, 240)}
- content:
${compactText(post.content, 2200)}
`.trim();
}

async function generateClassification(
  thread: ForumThreadRow,
  post: ForumPostRow,
  parentPost?: ForumPostRow | null
): Promise<ClassificationResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }

  const prompt = buildPrompt(thread, post, parentPost);
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
        temperature: 0,
        text: {
          format: {
            type: "json_schema",
            name: "post_ai_classification_result",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                classification: {
                  type: "string",
                  enum: CLASSIFICATIONS,
                },
                confidence: {
                  type: "number",
                  minimum: 0,
                  maximum: 1,
                },
                reason: {
                  type: "string",
                },
                extracted_premise: {
                  type: "string",
                },
                extracted_evidence: {
                  type: "string",
                },
                suggested_metrics: {
                  type: "array",
                  items: { type: "string" },
                },
              },
              required: [
                "classification",
                "confidence",
                "reason",
                "extracted_premise",
                "extracted_evidence",
                "suggested_metrics",
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
          : "OpenAI post classification failed."
      );
    }

    const parsed = parseJsonObject(outputText);
    if (!parsed) {
      throw new Error("Failed to parse OpenAI classification JSON.");
    }

    await recordForumApiUsageLog({
      featureKey: "post_ai_classification",
      routePath: "/api/forum/admin/classify-posts",
      model: MODEL,
      promptVersion: PROMPT_VERSION,
      targetType: "post",
      targetId: post.id,
      inputText: prompt,
      outputText,
      usage: isRecord(data) ? data.usage : null,
      status: "success",
    });

    return {
      classification: normalizeClassification(parsed.classification),
      confidence: clampConfidence(parsed.confidence),
      reason: asString(parsed.reason),
      extracted_premise: asString(parsed.extracted_premise),
      extracted_evidence: asString(parsed.extracted_evidence),
      suggested_metrics: asStringArray(parsed.suggested_metrics),
      raw_result: {
        output_text: outputText,
        parsed,
        response: data,
      },
    };
  } catch (error) {
    await recordForumApiUsageLog({
      featureKey: "post_ai_classification",
      routePath: "/api/forum/admin/classify-posts",
      model: MODEL,
      promptVersion: PROMPT_VERSION,
      targetType: "post",
      targetId: post.id,
      inputText: prompt,
      outputText: extractOutputTextFromResponse(data),
      usage: isRecord(data) ? data.usage : null,
      status: "error",
      errorMessage: getErrorMessage(error),
    });
    throw error;
  }
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

  const threadId = String(body.thread_id ?? body.threadId ?? "").trim();
  const maxItems = normalizeMaxItems(body.max_items ?? body.maxItems);
  const forceReclassify =
    body.force_reclassify === true || body.forceReclassify === true;

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

  const { data: postRows, error: postsError } = await supabase
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
    .in("post_role", Array.from(TARGET_POST_ROLES))
    .order("created_at", { ascending: true })
    .limit(200);

  if (postsError) {
    return errorResponse(postsError.message, 500);
  }

  const allCandidates = ((postRows ?? []) as unknown as ForumPostRow[]).filter((post) =>
    String(post.content ?? "").trim()
  );
  const selectedPosts = allCandidates.slice(0, maxItems);
  const postIds = selectedPosts.map((post) => post.id);
  const postById = new Map(allCandidates.map((post) => [post.id, post]));
  const activeByPostId = new Map<string, string>();

  if (postIds.length > 0) {
    const { data: activeRows, error: activeError } = await supabase
      .from("forum_post_ai_classifications")
      .select("id, post_id")
      .eq("is_active", true)
      .in("post_id", postIds);

    if (activeError) {
      return errorResponse(activeError.message, 500);
    }

    ((activeRows ?? []) as unknown as ActiveClassificationRow[]).forEach((row) => {
      activeByPostId.set(row.post_id, row.id);
    });
  }

  const items: ResponseItem[] = [];
  let successCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const post of selectedPosts) {
    const activeClassificationId = activeByPostId.get(post.id);

    if (activeClassificationId && !forceReclassify) {
      skippedCount += 1;
      items.push({
        post_id: post.id,
        status: "skipped",
        classification_id: activeClassificationId,
      });
      continue;
    }

    try {
      const parentPost = post.parent_opinion_id
        ? postById.get(post.parent_opinion_id) ?? null
        : null;
      const generated = await generateClassification(
        thread as ForumThreadRow,
        post,
        parentPost
      );

      if (forceReclassify) {
        const { error: supersedeError } = await supabase
          .from("forum_post_ai_classifications")
          .update({
            is_active: false,
            superseded_at: new Date().toISOString(),
          })
          .eq("post_id", post.id)
          .eq("is_active", true);

        if (supersedeError) {
          throw new Error(supersedeError.message);
        }
      }

      const { data: classificationRow, error: saveError } = await supabase
        .from("forum_post_ai_classifications")
        .insert({
          post_id: post.id,
          thread_id: threadId,
          classification: generated.classification,
          confidence: generated.confidence,
          reason: generated.reason,
          extracted_premise: generated.extracted_premise,
          extracted_evidence: generated.extracted_evidence,
          suggested_metrics: generated.suggested_metrics,
          raw_result: generated.raw_result,
          prompt_version: PROMPT_VERSION,
          model: MODEL,
          api_usage_log_id: null,
          created_by_admin: null,
          is_active: true,
        })
        .select("id")
        .single();

      if (saveError || !classificationRow?.id) {
        throw new Error(saveError?.message || "classification save failed.");
      }

      successCount += 1;
      items.push({
        post_id: post.id,
        status: "completed",
        classification_id: classificationRow.id as string,
        classification: generated.classification,
        confidence: generated.confidence,
      });
    } catch (error) {
      failedCount += 1;
      items.push({
        post_id: post.id,
        status: "failed",
        error: getErrorMessage(error),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    thread_id: threadId,
    processed_count: items.length,
    success_count: successCount,
    skipped_count: skippedCount,
    failed_count: failedCount,
    items,
  });
}
