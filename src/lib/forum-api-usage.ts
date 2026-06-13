import { createClient } from "@supabase/supabase-js";
import { calculateOpenAiEstimatedCostUsd } from "@/lib/openai-pricing";

type ForumApiUsageStatus = "success" | "error";

type OpenAiUsageLike = {
  input_tokens?: unknown;
  output_tokens?: unknown;
  total_tokens?: unknown;
  prompt_tokens?: unknown;
  completion_tokens?: unknown;
};

export type ForumApiUsageLogInput = {
  featureKey: string;
  routePath?: string | null;
  model?: string | null;
  promptVersion?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  userId?: string | null;
  inputText?: string | null;
  outputText?: string | null;
  usage?: unknown;
  status: ForumApiUsageStatus;
  errorMessage?: string | null;
  estimatedCost?: number | null;
};

const ESTIMATED_CHARS_PER_TOKEN = 4;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    return null;
  }

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
    },
  });
}

function toInteger(value: unknown): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }
  return Math.ceil(numeric);
}

function estimateTokens(text?: string | null): number | null {
  if (!text) {
    return null;
  }
  return Math.max(1, Math.ceil(text.length / ESTIMATED_CHARS_PER_TOKEN));
}

function truncateText(text: string | null | undefined, maxLength: number): string | null {
  if (!text) {
    return null;
  }
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function extractUsage(usage: unknown): {
  inputTokenEstimate: number | null;
  outputTokenEstimate: number | null;
  totalTokenEstimate: number | null;
} {
  const value = (usage || {}) as OpenAiUsageLike;
  const inputTokenEstimate =
    toInteger(value.input_tokens) ?? toInteger(value.prompt_tokens);
  const outputTokenEstimate =
    toInteger(value.output_tokens) ?? toInteger(value.completion_tokens);
  const totalTokenEstimate =
    toInteger(value.total_tokens) ??
    (inputTokenEstimate !== null || outputTokenEstimate !== null
      ? (inputTokenEstimate ?? 0) + (outputTokenEstimate ?? 0)
      : null);

  return {
    inputTokenEstimate,
    outputTokenEstimate,
    totalTokenEstimate,
  };
}

export async function recordForumApiUsageLog(input: ForumApiUsageLogInput) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error("[forum-api-usage] Supabase environment is not configured");
    return;
  }

  const usage = extractUsage(input.usage);
  const inputTokenEstimate =
    usage.inputTokenEstimate ?? estimateTokens(input.inputText);
  const outputTokenEstimate =
    usage.outputTokenEstimate ?? estimateTokens(input.outputText) ?? (input.status === "error" ? 0 : null);
  const totalTokenEstimate =
    usage.totalTokenEstimate ??
    (inputTokenEstimate !== null || outputTokenEstimate !== null
      ? (inputTokenEstimate ?? 0) + (outputTokenEstimate ?? 0)
      : null);
  const estimatedCost =
    input.estimatedCost ??
    calculateOpenAiEstimatedCostUsd({
      model: input.model,
      inputTokenEstimate,
      outputTokenEstimate,
    });

  try {
    const { error } = await supabase.from("forum_api_usage_logs").insert({
      feature_key: input.featureKey || "unknown",
      route_path: input.routePath ?? null,
      model: input.model ?? null,
      prompt_version: input.promptVersion ?? null,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      user_id: input.userId ?? null,
      input_token_estimate: inputTokenEstimate,
      output_token_estimate: outputTokenEstimate,
      total_token_estimate: totalTokenEstimate,
      estimated_cost: estimatedCost,
      status: input.status,
      error_message: truncateText(input.errorMessage, 500),
    });

    if (error) {
      console.error("[forum-api-usage] Failed to record API usage", error.message);
    }
  } catch (error) {
    console.error("[forum-api-usage] Failed to record API usage", getErrorMessage(error));
  }
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
