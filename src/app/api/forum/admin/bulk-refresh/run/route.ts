import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isForumAdminAuthenticated } from "@/lib/forum-auth";
import { getErrorMessage, recordForumApiUsageLog } from "@/lib/forum-api-usage";
import { calculateOpenAiEstimatedCostUsd } from "@/lib/openai-pricing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_THREAD_SCAN = 5000;
const MAX_RUN_ITEMS = 10;
const DEFAULT_RUN_ITEMS = 3;
const PROMPT_VERSION = "bulk-refresh-thread-summary-v2";
const LOGIC_SCORE_PROMPT_VERSION = "bulk-refresh-logic-score-v1";
const MODEL = "gpt-5.4-mini";
const LOGIC_SCORE_MODEL = "gpt-4.1-mini";
const INPUT_TOKENS_PER_CALL = 8000;
const OUTPUT_TOKENS_PER_CALL = 1800;
const LOGIC_SCORE_INPUT_TOKENS_PER_CALL = 2500;
const LOGIC_SCORE_OUTPUT_TOKENS_PER_CALL = 600;
const CATEGORY_OPTIONS = [
  "経済・政策",
  "AI・技術",
  "特許・発明",
  "生活・健康",
] as const;
const LOGIC_BREAK_TYPES = [
  "none",
  "emotional",
  "authority_based",
  "weak_causality",
  "unclear_premise",
  "off_topic",
  "other",
] as const;

type PeriodFilter = "six_months" | "one_year" | "all";
type LogicBreakType = (typeof LOGIC_BREAK_TYPES)[number];

type RunRequest = {
  period?: PeriodFilter;
  category?: string;
  target_type?: string;
  targetKind?: string;
  max_items?: number | string | null;
  minLogicScore?: number | string | null;
  includeNoLogicScore?: boolean;
  excludeHiddenDeleted?: boolean;
  confirmNoOverwrite?: boolean;
  confirmCost?: boolean;
  confirmMaxTen?: boolean;
};

type ThreadRow = {
  id: string;
  title: string | null;
  category: string | null;
  original_post: string | null;
  ai_summary: string | null;
  created_at: string | null;
};

type ForumPostRow = {
  id: string;
  post_role: string | null;
  content: string | null;
  created_at: string | null;
};

type LogicScorePostRow = ForumPostRow & {
  thread_id: string | null;
  logic_score: number | null;
  logic_score_reason: string | null;
  logic_break_type: string | null;
  logic_break_note: string | null;
  thread_title?: string | null;
  thread_category?: string | null;
};

type GeneratedSummary = {
  summary_text: string | null;
  provisional_answer: string | null;
  evidence_text: string | null;
  counterargument_text: string | null;
  related_topics: string[];
  structure_json: Record<string, unknown>;
  raw_result: Record<string, unknown>;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  actual_cost_usd: number | null;
};

type GeneratedLogicScore = {
  logic_score: number;
  logic_score_reason: string;
  logic_break_type: LogicBreakType;
  logic_break_note: string;
  raw_result: Record<string, unknown>;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  actual_cost_usd: number | null;
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

function normalizePeriod(value: unknown): PeriodFilter {
  return value === "six_months" || value === "one_year" || value === "all"
    ? value
    : "six_months";
}

function normalizeCategory(value: unknown) {
  const category = typeof value === "string" ? value.trim() : "all";
  return category || "all";
}

function normalizeMaxItems(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_RUN_ITEMS;
  return Math.max(1, Math.min(MAX_RUN_ITEMS, Math.floor(numeric)));
}

function toOptionalScore(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function clampScore(value: unknown) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 50;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeBreakType(value: unknown): LogicBreakType {
  const type = String(value ?? "").trim();
  return LOGIC_BREAK_TYPES.includes(type as LogicBreakType)
    ? (type as LogicBreakType)
    : "other";
}

function getPeriodStart(period: PeriodFilter) {
  if (period === "all") return null;

  const date = new Date();
  if (period === "one_year") {
    date.setFullYear(date.getFullYear() - 1);
  } else {
    date.setMonth(date.getMonth() - 6);
  }

  return date.toISOString();
}

function matchesCategory(threadCategory: string | null | undefined, category: string) {
  const normalized = String(threadCategory ?? "").trim();
  if (category === "all") return true;
  if (category === "その他") {
    return !normalized || !CATEGORY_OPTIONS.includes(normalized as (typeof CATEGORY_OPTIONS)[number]);
  }
  return normalized === category;
}

function compactText(value: string | null | undefined, maxLength = 1200) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function toInteger(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.ceil(numeric);
}

function extractUsage(usage: unknown) {
  const value = (usage || {}) as {
    input_tokens?: unknown;
    output_tokens?: unknown;
    total_tokens?: unknown;
    prompt_tokens?: unknown;
    completion_tokens?: unknown;
  };
  const input_tokens = toInteger(value.input_tokens ?? value.prompt_tokens);
  const output_tokens = toInteger(value.output_tokens ?? value.completion_tokens);
  const total_tokens =
    toInteger(value.total_tokens) || input_tokens + output_tokens;

  return {
    input_tokens,
    output_tokens,
    total_tokens,
  };
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

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
        .slice(0, 12)
    : [];
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
  if (!data || typeof data !== "object") return "";

  const record = data as Record<string, unknown>;
  const direct = asString(record.output_text);
  if (direct) return direct;

  return Array.from(new Set(collectTextFromUnknown(record.output))).join("\n").trim();
}

function buildPrompt(thread: ThreadRow, posts: ForumPostRow[]) {
  const postText = posts
    .map((post, index) => {
      const role = post.post_role || "post";
      return `[${index + 1}] role=${role}\n${compactText(post.content, 1800)}`;
    })
    .join("\n\n");
  const sourceText =
    postText ||
    `[thread]\n${compactText(thread.original_post || thread.ai_summary || thread.title, 2400)}`;

  return `
あなたはAI知恵袋Forumの議論整理AIです。
次のスレッドを、既存データへ反映しないテスト用の新versionとして整理します。

必ずJSONだけを返してください。Markdownや説明文は不要です。

JSON形式:
{
  "summary_text": "スレッド全体の現時点の答え。結論は3層見出しを含める。",
  "provisional_answer": "現時点の暫定回答。",
  "evidence_text": "主な理由・根拠。一般論だけでなく因果関係や確認条件を含める。",
  "counterargument_text": "反論・リスク。反論A/B/Cに近い形で、本当の反論を書く。",
  "related_topics": ["関連論点1", "関連論点2"],
  "structure_json": {
    "issues": [],
    "premises": [],
    "reasons": [],
    "counterarguments": []
  }
}

summary_text の中では次の3層を維持してください。
【誰でも分かる説明】
【もう少し詳しい説明】
【深層・専門的な補足】

注意:
- 既存投稿本文を変えない前提で整理する。
- 断定しすぎず、必要な確認条件を明確にする。
- 経済・政策テーマでは、景気局面、需要不足/需要超過、物価、雇用、賃金、消費を分けて説明する。
- 専門用語を使う場合は短い説明を添える。
- 返答は日本語。

スレッドタイトル:
${thread.title || "無題"}

カテゴリー:
${thread.category || "未分類"}

元投稿:
${compactText(thread.original_post || thread.ai_summary, 2400)}

投稿一覧:
${sourceText}
`.trim();
}

async function generateThreadSummaryVersion(
  thread: ThreadRow,
  posts: ForumPostRow[],
  jobId: string,
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const prompt = buildPrompt(thread, posts);
  let data: any = null;

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
      }),
    });

    data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.error?.message || "OpenAI summary generation failed");
    }

    const outputText = extractOutputTextFromResponse(data);
    const usage = extractUsage(data?.usage);
    const actualCostUsd = calculateOpenAiEstimatedCostUsd({
      model: MODEL,
      inputTokenEstimate: usage.input_tokens,
      outputTokenEstimate: usage.output_tokens,
    });

    await recordForumApiUsageLog({
      featureKey: "bulk_refresh_thread_summary",
      routePath: "/api/forum/admin/bulk-refresh/run",
      model: MODEL,
      promptVersion: PROMPT_VERSION,
      targetType: "thread",
      targetId: thread.id,
      inputText: prompt,
      outputText,
      usage: data?.usage,
      status: "success",
      estimatedCost: actualCostUsd,
    });

    const parsed = parseJsonObject(outputText);
    const structureJson =
      parsed && typeof parsed.structure_json === "object" && parsed.structure_json !== null
        ? (parsed.structure_json as Record<string, unknown>)
        : {};
    const summaryText =
      asString(parsed?.summary_text) || outputText || null;

    return {
      summary_text: summaryText,
      provisional_answer: asString(parsed?.provisional_answer) || null,
      evidence_text: asString(parsed?.evidence_text) || null,
      counterargument_text: asString(parsed?.counterargument_text) || null,
      related_topics: asStringArray(parsed?.related_topics),
      structure_json: structureJson,
      raw_result: {
        job_id: jobId,
        output_text: outputText,
        parsed,
        response: data,
      },
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      total_tokens: usage.total_tokens,
      actual_cost_usd: actualCostUsd,
    } satisfies GeneratedSummary;
  } catch (error) {
    await recordForumApiUsageLog({
      featureKey: "bulk_refresh_thread_summary",
      routePath: "/api/forum/admin/bulk-refresh/run",
      model: MODEL,
      promptVersion: PROMPT_VERSION,
      targetType: "thread",
      targetId: thread.id,
      inputText: prompt,
      outputText: extractOutputTextFromResponse(data),
      usage: data?.usage,
      status: "error",
      errorMessage: getErrorMessage(error),
    });
    throw error;
  }
}

function buildLogicScorePrompt(post: LogicScorePostRow) {
  return `
あなたはAI知恵袋Forumの投稿を再評価する採点者です。
これは一括再整理の安全テスト実行です。既存の forum_posts は更新せず、新しいversionとして保存するための評価だけを行います。

必ずJSONだけを返してください。Markdownや説明文は不要です。

JSON形式:
{
  "logic_score": 82,
  "logic_score_reason": "評価理由を日本語で2〜4文。",
  "logic_break_type": "none",
  "logic_break_note": "主な弱点、改善点、反論余地。"
}

評価観点:
- 問いに答えているか。
- 前提が明示されているか。
- 根拠や因果関係が飛んでいないか。
- 反論・例外・条件分岐があるか。
- 両論併記だけで終わらず、どの条件なら成立するかを説明しているか。
- 経済・政策テーマでは、デフレ/インフレ、需要不足/需要超過、供給制約、物価、雇用、賃金、消費など景気局面の確認が必要な場合に触れているか。

logic_score は0〜100点です。
logic_score_reason には、強みと弱点が読める評価理由を書いてください。
logic_break_type は次のいずれかだけを使ってください:
${LOGIC_BREAK_TYPES.join(", ")}
logic_break_note には、足りない前提・因果・反論余地・確認すべき指標を簡潔に書いてください。

スレッドタイトル:
${post.thread_title || "不明"}

カテゴリー:
${post.thread_category || "未分類"}

投稿分類:
${post.post_role || "opinion"}

現在のAI論理スコア:
- score: ${post.logic_score ?? "未評価"}
- reason: ${post.logic_score_reason || "なし"}
- break_type: ${post.logic_break_type || "なし"}
- break_note: ${post.logic_break_note || "なし"}

投稿本文:
${compactText(post.content, 3200)}
`.trim();
}

async function generateLogicScoreVersion(post: LogicScorePostRow, jobId: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const prompt = buildLogicScorePrompt(post);
  let data: any = null;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: LOGIC_SCORE_MODEL,
        input: prompt,
        temperature: 0,
        text: {
          format: {
            type: "json_schema",
            name: "bulk_refresh_logic_score_result",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                logic_score: {
                  type: "number",
                  minimum: 0,
                  maximum: 100,
                },
                logic_score_reason: {
                  type: "string",
                },
                logic_break_type: {
                  type: "string",
                  enum: LOGIC_BREAK_TYPES,
                },
                logic_break_note: {
                  type: "string",
                },
              },
              required: [
                "logic_score",
                "logic_score_reason",
                "logic_break_type",
                "logic_break_note",
              ],
            },
            strict: true,
          },
        },
      }),
    });

    data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.error?.message || "OpenAI logic score generation failed");
    }

    const outputText = extractOutputTextFromResponse(data);
    const usage = extractUsage(data?.usage);
    const actualCostUsd = calculateOpenAiEstimatedCostUsd({
      model: LOGIC_SCORE_MODEL,
      inputTokenEstimate: usage.input_tokens,
      outputTokenEstimate: usage.output_tokens,
    });

    const parsed = parseJsonObject(outputText);
    if (!parsed) {
      throw new Error("Failed to parse OpenAI logic score JSON");
    }

    await recordForumApiUsageLog({
      featureKey: "bulk_refresh_logic_score",
      routePath: "/api/forum/admin/bulk-refresh/run",
      model: LOGIC_SCORE_MODEL,
      promptVersion: LOGIC_SCORE_PROMPT_VERSION,
      targetType: "post",
      targetId: post.id,
      inputText: prompt,
      outputText,
      usage: data?.usage,
      status: "success",
      estimatedCost: actualCostUsd,
    });

    return {
      logic_score: clampScore(parsed.logic_score),
      logic_score_reason: asString(parsed.logic_score_reason) || "評価理由が取得できませんでした。",
      logic_break_type: normalizeBreakType(parsed.logic_break_type),
      logic_break_note: asString(parsed.logic_break_note) || "主な補足はありません。",
      raw_result: {
        job_id: jobId,
        output_text: outputText,
        parsed,
        response: data,
      },
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      total_tokens: usage.total_tokens,
      actual_cost_usd: actualCostUsd,
    } satisfies GeneratedLogicScore;
  } catch (error) {
    await recordForumApiUsageLog({
      featureKey: "bulk_refresh_logic_score",
      routePath: "/api/forum/admin/bulk-refresh/run",
      model: LOGIC_SCORE_MODEL,
      promptVersion: LOGIC_SCORE_PROMPT_VERSION,
      targetType: "post",
      targetId: post.id,
      inputText: prompt,
      outputText: extractOutputTextFromResponse(data),
      usage: data?.usage,
      status: "error",
      errorMessage: getErrorMessage(error),
    });
    throw error;
  }
}

async function loadCandidateThreads(
  supabase: any,
  body: RunRequest,
) {
  const period = normalizePeriod(body.period);
  const category = normalizeCategory(body.category);
  const periodStart = getPeriodStart(period);

  let threadQuery = supabase
    .from("forum_threads")
    .select("id, title, category, original_post, ai_summary, created_at")
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(MAX_THREAD_SCAN);

  if (periodStart) {
    threadQuery = threadQuery.gte("created_at", periodStart);
  }

  const { data, error } = await threadQuery;

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as ThreadRow[]).filter((thread) =>
    matchesCategory(thread.category, category)
  );
}

async function loadCandidateLogicScorePosts(
  supabase: any,
  body: RunRequest,
) {
  const period = normalizePeriod(body.period);
  const periodStart = getPeriodStart(period);
  const minLogicScore = toOptionalScore(body.minLogicScore);
  const includeNoLogicScore = body.includeNoLogicScore !== false;
  const candidateThreads = await loadCandidateThreads(supabase, body);
  const threadById = new Map(candidateThreads.map((thread) => [thread.id, thread]));
  const threadIds = Array.from(threadById.keys());

  if (threadIds.length === 0) return [];

  let postQuery = supabase
    .from("forum_posts")
    .select(
      [
        "id",
        "thread_id",
        "content",
        "post_role",
        "created_at",
        "logic_score",
        "logic_score_reason",
        "logic_break_type",
        "logic_break_note",
      ].join(", ")
    )
    .in("thread_id", threadIds)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(10000);

  if (periodStart) {
    postQuery = postQuery.gte("created_at", periodStart);
  }

  const { data, error } = await postQuery;

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as LogicScorePostRow[])
    .filter((post) => {
      if (!String(post.content ?? "").trim()) return false;

      const score =
        typeof post.logic_score === "number" && Number.isFinite(post.logic_score)
          ? post.logic_score
          : null;

      if (score === null) return includeNoLogicScore;
      if (minLogicScore === null) return true;
      return score >= minLogicScore;
    })
    .map((post) => {
      const thread = threadById.get(String(post.thread_id ?? ""));
      return {
        ...post,
        thread_title: thread?.title ?? null,
        thread_category: thread?.category ?? null,
      };
    });
}

async function updateJobTotals(
  supabase: any,
  jobId: string,
  totals: {
    status: "completed" | "failed";
    actual_api_calls: number;
    actual_input_tokens: number;
    actual_output_tokens: number;
    actual_total_tokens: number;
    actual_cost_usd: number;
    success_count: number;
    failed_count: number;
    skipped_count: number;
    error_message?: string | null;
  },
) {
  await supabase
    .from("forum_bulk_refresh_jobs")
    .update({
      ...totals,
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

async function runLogicScoreTest(supabase: any, body: RunRequest) {
  const maxItems = normalizeMaxItems(body.max_items);
  let jobId: string | null = null;

  try {
    const candidates = await loadCandidateLogicScorePosts(supabase, body);
    const selectedPosts = candidates.slice(0, maxItems);
    const estimatedInputTokens = selectedPosts.length * LOGIC_SCORE_INPUT_TOKENS_PER_CALL;
    const estimatedOutputTokens = selectedPosts.length * LOGIC_SCORE_OUTPUT_TOKENS_PER_CALL;
    const estimatedCostUsd = calculateOpenAiEstimatedCostUsd({
      model: LOGIC_SCORE_MODEL,
      inputTokenEstimate: estimatedInputTokens,
      outputTokenEstimate: estimatedOutputTokens,
    });

    const { data: jobRow, error: jobError } = await supabase
      .from("forum_bulk_refresh_jobs")
      .insert({
        status: "running",
        target_type: "logic_score",
        filter_json: {
          period: normalizePeriod(body.period),
          category: normalizeCategory(body.category),
          minLogicScore: toOptionalScore(body.minLogicScore),
          includeNoLogicScore: body.includeNoLogicScore !== false,
          excludeHiddenDeleted: true,
          prompt_version: LOGIC_SCORE_PROMPT_VERSION,
        },
        max_items: maxItems,
        estimated_api_calls: selectedPosts.length,
        estimated_input_tokens: estimatedInputTokens,
        estimated_output_tokens: estimatedOutputTokens,
        estimated_total_tokens: estimatedInputTokens + estimatedOutputTokens,
        estimated_cost_usd: estimatedCostUsd,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (jobError || !jobRow?.id) {
      throw new Error(jobError?.message || "Failed to create bulk refresh job.");
    }

    jobId = jobRow.id as string;

    const totals = {
      actual_api_calls: 0,
      actual_input_tokens: 0,
      actual_output_tokens: 0,
      actual_total_tokens: 0,
      actual_cost_usd: 0,
      success_count: 0,
      failed_count: 0,
      skipped_count: 0,
    };
    const items: Array<{
      id: string;
      target_id: string;
      status: string;
      new_version_id?: string | null;
      previous_version_id?: string | null;
      error_message?: string | null;
    }> = [];

    for (const post of selectedPosts) {
      const { data: itemRow, error: itemError } = await supabase
        .from("forum_bulk_refresh_job_items")
        .insert({
          job_id: jobId,
          target_type: "logic_score",
          target_id: post.id,
          status: "pending",
        })
        .select("id")
        .single();

      if (itemError || !itemRow?.id) {
        totals.failed_count += 1;
        items.push({
          id: "",
          target_id: post.id,
          status: "failed",
          error_message: itemError?.message || "Failed to create job item.",
        });
        continue;
      }

      const itemId = itemRow.id as string;

      const { data: existingVersion, error: existingVersionError } = await supabase
        .from("forum_post_logic_score_versions")
        .select("id")
        .eq("post_id", post.id)
        .eq("prompt_version", LOGIC_SCORE_PROMPT_VERSION)
        .limit(1)
        .maybeSingle();

      if (existingVersionError) {
        await supabase
          .from("forum_bulk_refresh_job_items")
          .update({
            status: "failed",
            error_message: existingVersionError.message,
            completed_at: new Date().toISOString(),
          })
          .eq("id", itemId);
        totals.failed_count += 1;
        items.push({
          id: itemId,
          target_id: post.id,
          status: "failed",
          error_message: existingVersionError.message,
        });
        continue;
      }

      if (existingVersion?.id) {
        await supabase
          .from("forum_bulk_refresh_job_items")
          .update({
            status: "skipped",
            previous_version_id: existingVersion.id,
            completed_at: new Date().toISOString(),
          })
          .eq("id", itemId);
        totals.skipped_count += 1;
        items.push({
          id: itemId,
          target_id: post.id,
          status: "skipped",
          previous_version_id: existingVersion.id as string,
        });
        continue;
      }

      await supabase
        .from("forum_bulk_refresh_job_items")
        .update({
          status: "running",
          started_at: new Date().toISOString(),
        })
        .eq("id", itemId);

      try {
        totals.actual_api_calls += 1;
        const generated = await generateLogicScoreVersion(post, jobId);

        const { data: versionRow, error: versionError } = await supabase
          .from("forum_post_logic_score_versions")
          .insert({
            post_id: post.id,
            job_id: jobId,
            job_item_id: itemId,
            prompt_version: LOGIC_SCORE_PROMPT_VERSION,
            model: LOGIC_SCORE_MODEL,
            logic_score: generated.logic_score,
            logic_score_reason: generated.logic_score_reason,
            logic_break_type: generated.logic_break_type,
            logic_break_note: generated.logic_break_note,
            raw_result: generated.raw_result,
            input_tokens: generated.input_tokens,
            output_tokens: generated.output_tokens,
            total_tokens: generated.total_tokens,
            actual_cost_usd: generated.actual_cost_usd,
            is_applied: false,
          })
          .select("id")
          .single();

        if (versionError || !versionRow?.id) {
          throw new Error(versionError?.message || "Failed to save logic score version.");
        }

        const actualCost = generated.actual_cost_usd ?? 0;
        totals.actual_input_tokens += generated.input_tokens;
        totals.actual_output_tokens += generated.output_tokens;
        totals.actual_total_tokens += generated.total_tokens;
        totals.actual_cost_usd += actualCost;
        totals.success_count += 1;

        await supabase
          .from("forum_bulk_refresh_job_items")
          .update({
            status: "completed",
            new_version_id: versionRow.id,
            actual_input_tokens: generated.input_tokens,
            actual_output_tokens: generated.output_tokens,
            actual_total_tokens: generated.total_tokens,
            actual_cost_usd: actualCost,
            completed_at: new Date().toISOString(),
          })
          .eq("id", itemId);

        items.push({
          id: itemId,
          target_id: post.id,
          status: "completed",
          new_version_id: versionRow.id as string,
        });
      } catch (error) {
        const message = getErrorMessage(error);
        totals.failed_count += 1;
        await supabase
          .from("forum_bulk_refresh_job_items")
          .update({
            status: "failed",
            error_message: message,
            completed_at: new Date().toISOString(),
          })
          .eq("id", itemId);
        items.push({
          id: itemId,
          target_id: post.id,
          status: "failed",
          error_message: message,
        });
      }
    }

    await updateJobTotals(supabase, jobId, {
      status: "completed",
      ...totals,
      actual_cost_usd: Number(totals.actual_cost_usd.toFixed(8)),
    });

    return NextResponse.json({
      ok: true,
      job: {
        id: jobId,
        status: "completed",
        target_type: "logic_score",
        max_items: maxItems,
        ...totals,
        actual_cost_usd: Number(totals.actual_cost_usd.toFixed(8)),
      },
      items,
      prompt_version: LOGIC_SCORE_PROMPT_VERSION,
      model: LOGIC_SCORE_MODEL,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    if (jobId) {
      await updateJobTotals(supabase, jobId, {
        status: "failed",
        actual_api_calls: 0,
        actual_input_tokens: 0,
        actual_output_tokens: 0,
        actual_total_tokens: 0,
        actual_cost_usd: 0,
        success_count: 0,
        failed_count: 0,
        skipped_count: 0,
        error_message: message,
      });
    }

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isForumAdminAuthenticated(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as RunRequest;
  const targetType = body.target_type || body.targetKind;

  if (targetType !== "thread_summary" && targetType !== "logic_score") {
    return NextResponse.json(
      { ok: false, error: "Only thread_summary or logic_score test runs are supported." },
      { status: 400 }
    );
  }

  if (
    body.confirmNoOverwrite !== true ||
    body.confirmCost !== true ||
    body.confirmMaxTen !== true
  ) {
    return NextResponse.json(
      { ok: false, error: "Required confirmations are missing." },
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

  if (targetType === "logic_score") {
    return runLogicScoreTest(supabase, body);
  }

  const maxItems = normalizeMaxItems(body.max_items);
  let jobId: string | null = null;

  try {
    const candidates = await loadCandidateThreads(supabase, body);
    const selectedThreads = candidates.slice(0, maxItems);
    const estimatedInputTokens = selectedThreads.length * INPUT_TOKENS_PER_CALL;
    const estimatedOutputTokens = selectedThreads.length * OUTPUT_TOKENS_PER_CALL;
    const estimatedCostUsd = calculateOpenAiEstimatedCostUsd({
      model: MODEL,
      inputTokenEstimate: estimatedInputTokens,
      outputTokenEstimate: estimatedOutputTokens,
    });

    const { data: jobRow, error: jobError } = await supabase
      .from("forum_bulk_refresh_jobs")
      .insert({
        status: "running",
        target_type: "thread_summary",
        filter_json: {
          period: normalizePeriod(body.period),
          category: normalizeCategory(body.category),
          excludeHiddenDeleted: true,
          prompt_version: PROMPT_VERSION,
        },
        max_items: maxItems,
        estimated_api_calls: selectedThreads.length,
        estimated_input_tokens: estimatedInputTokens,
        estimated_output_tokens: estimatedOutputTokens,
        estimated_total_tokens: estimatedInputTokens + estimatedOutputTokens,
        estimated_cost_usd: estimatedCostUsd,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (jobError || !jobRow?.id) {
      throw new Error(jobError?.message || "Failed to create bulk refresh job.");
    }

    jobId = jobRow.id as string;

    const totals = {
      actual_api_calls: 0,
      actual_input_tokens: 0,
      actual_output_tokens: 0,
      actual_total_tokens: 0,
      actual_cost_usd: 0,
      success_count: 0,
      failed_count: 0,
      skipped_count: 0,
    };
    const items: Array<{
      id: string;
      target_id: string;
      status: string;
      new_version_id?: string | null;
      previous_version_id?: string | null;
      error_message?: string | null;
    }> = [];

    for (const thread of selectedThreads) {
      const { data: itemRow, error: itemError } = await supabase
        .from("forum_bulk_refresh_job_items")
        .insert({
          job_id: jobId,
          target_type: "thread_summary",
          target_id: thread.id,
          status: "pending",
        })
        .select("id")
        .single();

      if (itemError || !itemRow?.id) {
        totals.failed_count += 1;
        items.push({
          id: "",
          target_id: thread.id,
          status: "failed",
          error_message: itemError?.message || "Failed to create job item.",
        });
        continue;
      }

      const itemId = itemRow.id as string;

      const { data: existingVersion, error: existingVersionError } = await supabase
        .from("forum_thread_ai_structure_versions")
        .select("id")
        .eq("thread_id", thread.id)
        .eq("prompt_version", PROMPT_VERSION)
        .limit(1)
        .maybeSingle();

      if (existingVersionError) {
        await supabase
          .from("forum_bulk_refresh_job_items")
          .update({
            status: "failed",
            error_message: existingVersionError.message,
            completed_at: new Date().toISOString(),
          })
          .eq("id", itemId);
        totals.failed_count += 1;
        items.push({
          id: itemId,
          target_id: thread.id,
          status: "failed",
          error_message: existingVersionError.message,
        });
        continue;
      }

      if (existingVersion?.id) {
        await supabase
          .from("forum_bulk_refresh_job_items")
          .update({
            status: "skipped",
            previous_version_id: existingVersion.id,
            completed_at: new Date().toISOString(),
          })
          .eq("id", itemId);
        totals.skipped_count += 1;
        items.push({
          id: itemId,
          target_id: thread.id,
          status: "skipped",
          previous_version_id: existingVersion.id as string,
        });
        continue;
      }

      await supabase
        .from("forum_bulk_refresh_job_items")
        .update({
          status: "running",
          started_at: new Date().toISOString(),
        })
        .eq("id", itemId);

      try {
        const { data: posts, error: postsError } = await supabase
          .from("forum_posts")
          .select("id, post_role, content, created_at")
          .eq("thread_id", thread.id)
          .eq("is_deleted", false)
          .order("created_at", { ascending: true });

        if (postsError) {
          throw new Error(postsError.message);
        }

        totals.actual_api_calls += 1;
        const generated = await generateThreadSummaryVersion(
          thread,
          (posts ?? []) as ForumPostRow[],
          jobId
        );

        const { data: versionRow, error: versionError } = await supabase
          .from("forum_thread_ai_structure_versions")
          .insert({
            thread_id: thread.id,
            job_id: jobId,
            job_item_id: itemId,
            prompt_version: PROMPT_VERSION,
            model: MODEL,
            summary_text: generated.summary_text,
            provisional_answer: generated.provisional_answer,
            evidence_text: generated.evidence_text,
            counterargument_text: generated.counterargument_text,
            related_topics: generated.related_topics,
            structure_json: generated.structure_json,
            raw_result: generated.raw_result,
            input_tokens: generated.input_tokens,
            output_tokens: generated.output_tokens,
            total_tokens: generated.total_tokens,
            actual_cost_usd: generated.actual_cost_usd,
            is_applied: false,
          })
          .select("id")
          .single();

        if (versionError || !versionRow?.id) {
          throw new Error(versionError?.message || "Failed to save version.");
        }

        const actualCost = generated.actual_cost_usd ?? 0;
        totals.actual_input_tokens += generated.input_tokens;
        totals.actual_output_tokens += generated.output_tokens;
        totals.actual_total_tokens += generated.total_tokens;
        totals.actual_cost_usd += actualCost;
        totals.success_count += 1;

        await supabase
          .from("forum_bulk_refresh_job_items")
          .update({
            status: "completed",
            new_version_id: versionRow.id,
            actual_input_tokens: generated.input_tokens,
            actual_output_tokens: generated.output_tokens,
            actual_total_tokens: generated.total_tokens,
            actual_cost_usd: actualCost,
            completed_at: new Date().toISOString(),
          })
          .eq("id", itemId);

        items.push({
          id: itemId,
          target_id: thread.id,
          status: "completed",
          new_version_id: versionRow.id as string,
        });
      } catch (error) {
        const message = getErrorMessage(error);
        totals.failed_count += 1;
        await supabase
          .from("forum_bulk_refresh_job_items")
          .update({
            status: "failed",
            error_message: message,
            completed_at: new Date().toISOString(),
          })
          .eq("id", itemId);
        items.push({
          id: itemId,
          target_id: thread.id,
          status: "failed",
          error_message: message,
        });
      }
    }

    await updateJobTotals(supabase, jobId, {
      status: "completed",
      ...totals,
      actual_cost_usd: Number(totals.actual_cost_usd.toFixed(8)),
    });

    return NextResponse.json({
      ok: true,
      job: {
        id: jobId,
        status: "completed",
        target_type: "thread_summary",
        max_items: maxItems,
        ...totals,
        actual_cost_usd: Number(totals.actual_cost_usd.toFixed(8)),
      },
      items,
      prompt_version: PROMPT_VERSION,
      model: MODEL,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    if (jobId) {
      await updateJobTotals(supabase, jobId, {
        status: "failed",
        actual_api_calls: 0,
        actual_input_tokens: 0,
        actual_output_tokens: 0,
        actual_total_tokens: 0,
        actual_cost_usd: 0,
        success_count: 0,
        failed_count: 0,
        skipped_count: 0,
        error_message: message,
      });
    }

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
