import { createClient } from "@supabase/supabase-js";

export type ApiUsageLogInput = {
  route: string;
  model?: string | null;
  threadId?: string | null;
  postId?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  responseTimeMs?: number | null;
  success: boolean;
  errorMessage?: string | null;
};

type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

const MODEL_PRICING_USD_PER_1M_TOKENS: Record<
  string,
  { input: number; output: number }
> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-5.4": { input: 1.25, output: 10 },
  "gpt-5.4-mini": { input: 0.25, output: 2 },
  "gpt-5.3-codex": { input: 1.25, output: 10 },
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function toSafeInteger(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

export function estimateCostUsd(params: {
  model?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
}): number {
  const pricing = params.model
    ? MODEL_PRICING_USD_PER_1M_TOKENS[params.model]
    : null;

  if (!pricing) return 0;

  const inputTokens = toSafeInteger(params.inputTokens);
  const outputTokens = toSafeInteger(params.outputTokens);

  return Number(
    (
      (inputTokens / 1_000_000) * pricing.input +
      (outputTokens / 1_000_000) * pricing.output
    ).toFixed(6)
  );
}

export function extractTokenUsage(usage: unknown): TokenUsage {
  const value = usage && typeof usage === "object" ? (usage as any) : {};

  const inputTokens = toSafeInteger(
    value.input_tokens ?? value.prompt_tokens
  );
  const outputTokens = toSafeInteger(
    value.output_tokens ?? value.completion_tokens
  );
  const totalTokens = toSafeInteger(
    value.total_tokens || inputTokens + outputTokens
  );

  return {
    inputTokens,
    outputTokens,
    totalTokens,
  };
}

export async function logApiUsage(input: ApiUsageLogInput): Promise<void> {
  try {
    const inputTokens = toSafeInteger(input.inputTokens);
    const outputTokens = toSafeInteger(input.outputTokens);
    const totalTokens = toSafeInteger(
      input.totalTokens || inputTokens + outputTokens
    );

    const { error } = await supabase.from("api_usage_logs").insert({
      route: input.route,
      model: input.model ?? null,
      thread_id: input.threadId ?? null,
      post_id: input.postId ?? null,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: totalTokens,
      estimated_cost_usd: estimateCostUsd({
        model: input.model,
        inputTokens,
        outputTokens,
      }),
      response_time_ms:
        typeof input.responseTimeMs === "number"
          ? Math.max(0, Math.round(input.responseTimeMs))
          : null,
      success: input.success,
      error_message: input.errorMessage ?? null,
    });

    if (error) {
      console.error("[api-usage-log insert error]", error);
    }
  } catch (error) {
    console.error("[api-usage-log unexpected error]", error);
  }
}
