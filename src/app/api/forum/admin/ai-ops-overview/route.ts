import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isForumAdminAuthenticated } from "@/lib/forum-auth";
import { calculateOpenAiEstimatedCostUsd } from "@/lib/openai-pricing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TARGET_POST_ROLES = [
  "opinion",
  "rebuttal",
  "supplement",
  "explanation",
] as const;
const FEATURE_KEYS = [
  "post_ai_classification",
  "thread_summary_from_classifications",
] as const;
const CLASSIFICATION_SUMMARY_TYPE = "thread_summary_from_classifications";
const PAGE_SIZE = 1000;

type FeatureKey = (typeof FEATURE_KEYS)[number];

type ThreadRow = {
  id: string;
};

type PostRow = {
  id: string;
  thread_id: string | null;
  content: string | null;
};

type ClassificationRow = {
  post_id: string | null;
  thread_id: string | null;
};

type SummaryRow = {
  thread_id: string | null;
};

type UsageLogRow = {
  feature_key: string | null;
  model: string | null;
  status: string | null;
  input_token_estimate: number | null;
  output_token_estimate: number | null;
  total_token_estimate: number | null;
  estimated_cost: string | number | null;
};

type UsageSummary = {
  calls: number;
  success_calls: number;
  failed_calls: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost: number;
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error("Supabase environment is not configured");
  }

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
    },
  });
}

function toNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function isFeatureKey(value: string | null): value is FeatureKey {
  return FEATURE_KEYS.includes(value as FeatureKey);
}

async function fetchAll<T>(
  loadPage: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
) {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await loadPage(from, to);

    if (error) {
      throw new Error(error.message);
    }

    const pageRows = data ?? [];
    rows.push(...pageRows);

    if (pageRows.length < PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

function emptyUsageSummary(): UsageSummary {
  return {
    calls: 0,
    success_calls: 0,
    failed_calls: 0,
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    estimated_cost: 0,
  };
}

function getDisplayCost(row: UsageLogRow) {
  if (row.estimated_cost !== null && row.estimated_cost !== undefined) {
    const storedCost = Number(row.estimated_cost);
    if (Number.isFinite(storedCost)) {
      return storedCost;
    }
  }

  // Older logs may have null estimated_cost; calculate from stored token estimates
  // when pricing is available, otherwise count them as 0 for this overview.
  return (
    calculateOpenAiEstimatedCostUsd({
      model: row.model,
      inputTokenEstimate: toNumber(row.input_token_estimate),
      outputTokenEstimate: toNumber(row.output_token_estimate),
    }) ?? 0
  );
}

function addUsage(summary: UsageSummary, row: UsageLogRow) {
  summary.calls += 1;
  if (row.status === "success") {
    summary.success_calls += 1;
  } else if (row.status === "error") {
    summary.failed_calls += 1;
  }

  summary.input_tokens += toNumber(row.input_token_estimate);
  summary.output_tokens += toNumber(row.output_token_estimate);
  summary.total_tokens += toNumber(row.total_token_estimate);
  summary.estimated_cost += getDisplayCost(row);
}

export async function GET(request: NextRequest) {
  if (!isForumAdminAuthenticated(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const [threads, posts, classifications, rebuiltSummaries, usageLogs] =
      await Promise.all([
        fetchAll<ThreadRow>((from, to) =>
          supabase
            .from("forum_threads")
            .select("id")
            .eq("is_deleted", false)
            .range(from, to)
        ),
        fetchAll<PostRow>((from, to) =>
          supabase
            .from("forum_posts")
            .select("id, thread_id, content")
            .eq("is_deleted", false)
            .in("post_role", Array.from(TARGET_POST_ROLES))
            .range(from, to)
        ),
        fetchAll<ClassificationRow>((from, to) =>
          supabase
            .from("forum_post_ai_classifications")
            .select("post_id, thread_id")
            .eq("is_active", true)
            .range(from, to)
        ),
        fetchAll<SummaryRow>((from, to) =>
          supabase
            .from("thread_ai_structures")
            .select("thread_id")
            .eq("summary_type", CLASSIFICATION_SUMMARY_TYPE)
            .range(from, to)
        ),
        fetchAll<UsageLogRow>((from, to) =>
          supabase
            .from("forum_api_usage_logs")
            .select(
              "feature_key, model, status, input_token_estimate, output_token_estimate, total_token_estimate, estimated_cost"
            )
            .in("feature_key", Array.from(FEATURE_KEYS))
            .range(from, to)
        ),
      ]);

    const activeThreadIds = new Set(threads.map((thread) => thread.id));
    const targetPosts = posts.filter(
      (post) =>
        post.thread_id &&
        activeThreadIds.has(post.thread_id) &&
        String(post.content ?? "").trim()
    );
    const targetPostIds = new Set(targetPosts.map((post) => post.id));
    const materialThreadIds = new Set(
      targetPosts
        .map((post) => post.thread_id)
        .filter((threadId): threadId is string => Boolean(threadId))
    );
    const activeClassifications = classifications.filter(
      (row) =>
        row.post_id &&
        row.thread_id &&
        targetPostIds.has(row.post_id) &&
        activeThreadIds.has(row.thread_id)
    );
    const classifiedPostIds = new Set(
      activeClassifications
        .map((row) => row.post_id)
        .filter((postId): postId is string => Boolean(postId))
    );
    const classifiedThreadIds = new Set(
      activeClassifications
        .map((row) => row.thread_id)
        .filter((threadId): threadId is string => Boolean(threadId))
    );
    const rebuiltThreadIds = new Set(
      rebuiltSummaries
        .map((row) => row.thread_id)
        .filter(
          (threadId): threadId is string =>
            typeof threadId === "string" && activeThreadIds.has(threadId)
        )
    );
    const classificationWaitingPosts = targetPosts.filter(
      (post) => !classifiedPostIds.has(post.id)
    );
    const classificationWaitingThreadIds = new Set(
      classificationWaitingPosts
        .map((post) => post.thread_id)
        .filter((threadId): threadId is string => Boolean(threadId))
    );
    const rebuildWaitingThreadIds = new Set(
      Array.from(classifiedThreadIds).filter(
        (threadId) => !rebuiltThreadIds.has(threadId)
      )
    );
    const usageByFeature = {
      post_ai_classification: emptyUsageSummary(),
      thread_summary_from_classifications: emptyUsageSummary(),
      total: emptyUsageSummary(),
    };

    for (const row of usageLogs) {
      if (!isFeatureKey(row.feature_key)) {
        continue;
      }

      addUsage(usageByFeature[row.feature_key], row);
      addUsage(usageByFeature.total, row);
    }

    return NextResponse.json({
      ok: true,
      overview: {
        total_threads: activeThreadIds.size,
        classification_waiting_threads: classificationWaitingThreadIds.size,
        classification_waiting_posts: classificationWaitingPosts.length,
        classified_threads: classifiedThreadIds.size,
        rebuild_waiting_threads: rebuildWaitingThreadIds.size,
        rebuilt_threads: rebuiltThreadIds.size,
        no_material_threads: Math.max(
          0,
          activeThreadIds.size - materialThreadIds.size
        ),
      },
      usage: usageByFeature,
    });
  } catch (error) {
    console.error("[forum-admin-ai-ops-overview] Failed to load overview", error);
    return NextResponse.json(
      { ok: false, error: "AI管理操作の全体状況を取得できませんでした。" },
      { status: 500 }
    );
  }
}
