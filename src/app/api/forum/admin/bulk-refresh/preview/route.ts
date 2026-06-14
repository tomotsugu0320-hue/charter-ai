import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isForumAdminAuthenticated } from "@/lib/forum-auth";
import { calculateOpenAiEstimatedCostUsd } from "@/lib/openai-pricing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_THREAD_SCAN = 5000;
const MAX_POST_SCAN = 10000;
const SAMPLE_LIMIT = 50;
const THREAD_SUMMARY_MODEL = "gpt-5.4-mini";
const LOGIC_SCORE_MODEL = "gpt-4.1-mini";
const THREAD_SUMMARY_INPUT_TOKENS = 8000;
const THREAD_SUMMARY_OUTPUT_TOKENS = 1800;
const LOGIC_SCORE_INPUT_TOKENS = 2500;
const LOGIC_SCORE_OUTPUT_TOKENS = 600;

const CATEGORY_OPTIONS = [
  "経済・政策",
  "AI・技術",
  "特許・発明",
  "生活・健康",
  "その他",
] as const;

type PeriodFilter = "six_months" | "one_year" | "all";
type TargetKind = "thread_summary" | "logic_score" | "both";

type PreviewRequest = {
  period?: PeriodFilter;
  category?: string;
  targetKind?: TargetKind;
  minLogicScore?: number | string | null;
  includeNoLogicScore?: boolean;
  excludeHiddenDeleted?: boolean;
  excludeUpToDatePromptVersion?: boolean;
};

type ThreadRow = {
  id: string;
  title: string | null;
  category: string | null;
  original_post: string | null;
  ai_summary: string | null;
  created_at: string | null;
};

type PostRow = {
  id: string;
  thread_id: string | null;
  content: string | null;
  created_at: string | null;
  logic_score: number | null;
  forum_threads:
    | {
        title?: string | null;
        category?: string | null;
      }
    | Array<{
        title?: string | null;
        category?: string | null;
      }>
    | null;
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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

function normalizeTargetKind(value: unknown): TargetKind {
  return value === "thread_summary" || value === "logic_score" || value === "both"
    ? value
    : "both";
}

function normalizeCategory(value: unknown) {
  const category = typeof value === "string" ? value.trim() : "all";
  return category || "all";
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

function toOptionalScore(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function compactText(value: string | null | undefined, maxLength = 140) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function matchesCategory(threadCategory: string | null | undefined, category: string) {
  const normalized = String(threadCategory ?? "").trim();
  if (category === "all") return true;
  if (category === "その他") {
    return !normalized || !CATEGORY_OPTIONS.includes(normalized as (typeof CATEGORY_OPTIONS)[number]);
  }
  return normalized === category;
}

function getPostThread(post: PostRow) {
  if (Array.isArray(post.forum_threads)) return post.forum_threads[0] ?? null;
  return post.forum_threads ?? null;
}

function estimateCost(inputTokens: number, outputTokens: number, model: string) {
  return calculateOpenAiEstimatedCostUsd({
    model,
    inputTokenEstimate: inputTokens,
    outputTokenEstimate: outputTokens,
  });
}

function addCost(left: number | null, right: number | null) {
  if (left === null && right === null) return null;
  return (left ?? 0) + (right ?? 0);
}

export async function POST(request: NextRequest) {
  if (!isForumAdminAuthenticated(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as PreviewRequest;
  const period = normalizePeriod(body.period);
  const category = normalizeCategory(body.category);
  const targetKind = normalizeTargetKind(body.targetKind);
  const minLogicScore = toOptionalScore(body.minLogicScore);
  const includeNoLogicScore = body.includeNoLogicScore !== false;
  const excludeHiddenDeleted = body.excludeHiddenDeleted !== false;
  const periodStart = getPeriodStart(period);
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase environment is not configured." },
      { status: 500 }
    );
  }

  let threadQuery = supabase
    .from("forum_threads")
    .select("id, title, category, original_post, ai_summary, created_at")
    .order("created_at", { ascending: false })
    .limit(MAX_THREAD_SCAN);

  if (excludeHiddenDeleted) {
    threadQuery = threadQuery.eq("is_deleted", false);
  }
  if (periodStart) {
    threadQuery = threadQuery.gte("created_at", periodStart);
  }

  const { data: threadRows, error: threadError } = await threadQuery;

  if (threadError) {
    return NextResponse.json({ ok: false, error: threadError.message }, { status: 500 });
  }

  const candidateThreads = ((threadRows ?? []) as ThreadRow[]).filter((thread) =>
    matchesCategory(thread.category, category)
  );
  const candidateThreadIds = new Set(candidateThreads.map((thread) => thread.id));
  const shouldEstimateThreadSummary =
    targetKind === "thread_summary" || targetKind === "both";
  const shouldEstimateLogicScore = targetKind === "logic_score" || targetKind === "both";
  const threadSummaryCount = shouldEstimateThreadSummary ? candidateThreads.length : 0;
  let logicScorePosts: PostRow[] = [];

  if (shouldEstimateLogicScore && candidateThreadIds.size > 0) {
    let postQuery = supabase
      .from("forum_posts")
      .select("id, thread_id, content, created_at, logic_score, forum_threads(title, category)")
      .in("thread_id", Array.from(candidateThreadIds))
      .order("created_at", { ascending: false })
      .limit(MAX_POST_SCAN);

    if (excludeHiddenDeleted) {
      postQuery = postQuery.eq("is_deleted", false);
    }
    if (periodStart) {
      postQuery = postQuery.gte("created_at", periodStart);
    }

    const { data: postRows, error: postError } = await postQuery;

    if (postError) {
      return NextResponse.json({ ok: false, error: postError.message }, { status: 500 });
    }

    logicScorePosts = ((postRows ?? []) as PostRow[]).filter((post) => {
      const score =
        typeof post.logic_score === "number" && Number.isFinite(post.logic_score)
          ? post.logic_score
          : null;

      if (score === null) return includeNoLogicScore;
      if (minLogicScore === null) return true;
      return score >= minLogicScore;
    });
  }

  const logicScoreCount = shouldEstimateLogicScore ? logicScorePosts.length : 0;
  const estimatedThreadInputTokens = threadSummaryCount * THREAD_SUMMARY_INPUT_TOKENS;
  const estimatedThreadOutputTokens = threadSummaryCount * THREAD_SUMMARY_OUTPUT_TOKENS;
  const estimatedLogicInputTokens = logicScoreCount * LOGIC_SCORE_INPUT_TOKENS;
  const estimatedLogicOutputTokens = logicScoreCount * LOGIC_SCORE_OUTPUT_TOKENS;
  const estimatedInputTokens = estimatedThreadInputTokens + estimatedLogicInputTokens;
  const estimatedOutputTokens = estimatedThreadOutputTokens + estimatedLogicOutputTokens;
  const threadCost = estimateCost(
    estimatedThreadInputTokens,
    estimatedThreadOutputTokens,
    THREAD_SUMMARY_MODEL
  );
  const logicCost = estimateCost(
    estimatedLogicInputTokens,
    estimatedLogicOutputTokens,
    LOGIC_SCORE_MODEL
  );
  const estimatedCost = addCost(threadCost, logicCost);
  const threadSamples = candidateThreads.slice(0, SAMPLE_LIMIT).map((thread) => ({
    target_type: "thread_summary",
    id: thread.id,
    title: thread.title || "無題のスレッド",
    excerpt: compactText(thread.original_post || thread.ai_summary),
    category: thread.category || "未分類",
    logic_score: null,
    updated_at: thread.created_at,
    current_prompt_version: null,
  }));
  const postSamples = logicScorePosts.slice(0, SAMPLE_LIMIT).map((post) => {
    const thread = getPostThread(post);
    return {
      target_type: "logic_score",
      id: post.id,
      title: thread?.title || "投稿",
      excerpt: compactText(post.content),
      category: thread?.category || "未分類",
      logic_score: post.logic_score,
      updated_at: post.created_at,
      current_prompt_version: null,
    };
  });

  return NextResponse.json({
    ok: true,
    filters: {
      period,
      category,
      targetKind,
      minLogicScore,
      includeNoLogicScore,
      excludeHiddenDeleted,
      excludeUpToDatePromptVersion: body.excludeUpToDatePromptVersion === true,
    },
    unsupported_filters:
      body.excludeUpToDatePromptVersion === true ? ["prompt_version_exclusion"] : [],
    notes: [
      "This is a read-only preview. It does not call OpenAI and does not update forum data.",
      "prompt_version is not currently stored on thread_ai_structures, so prompt-version exclusion is not applied.",
    ],
    target_thread_count: threadSummaryCount,
    target_post_count: logicScoreCount,
    estimated_api_calls: threadSummaryCount + logicScoreCount,
    estimated_input_tokens: estimatedInputTokens,
    estimated_output_tokens: estimatedOutputTokens,
    estimated_total_tokens: estimatedInputTokens + estimatedOutputTokens,
    estimated_cost_usd: estimatedCost === null ? null : Number(estimatedCost.toFixed(8)),
    estimate_assumptions: {
      thread_summary: {
        model: THREAD_SUMMARY_MODEL,
        input_tokens_per_call: THREAD_SUMMARY_INPUT_TOKENS,
        output_tokens_per_call: THREAD_SUMMARY_OUTPUT_TOKENS,
      },
      logic_score: {
        model: LOGIC_SCORE_MODEL,
        input_tokens_per_call: LOGIC_SCORE_INPUT_TOKENS,
        output_tokens_per_call: LOGIC_SCORE_OUTPUT_TOKENS,
      },
    },
    sample_targets: [...threadSamples, ...postSamples].slice(0, SAMPLE_LIMIT),
    truncated: {
      threads: (threadRows ?? []).length >= MAX_THREAD_SCAN,
      posts: logicScorePosts.length >= MAX_POST_SCAN,
    },
  });
}
