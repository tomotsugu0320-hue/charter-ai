type OpenAiTokenPrice = {
  inputUsdPer1M: number;
  outputUsdPer1M: number;
};

// Estimated standard text token pricing in USD per 1M tokens.
// OpenAI model prices can change; update this table as needed.
// This does not include cached-input, batch, tool, web search, or image costs.
const OPENAI_TOKEN_PRICES: Record<string, OpenAiTokenPrice> = {
  "gpt-5.5": { inputUsdPer1M: 5, outputUsdPer1M: 30 },
  "gpt-5.4": { inputUsdPer1M: 2.5, outputUsdPer1M: 15 },
  "gpt-5.4-mini": { inputUsdPer1M: 0.75, outputUsdPer1M: 4.5 },
  "gpt-4.1": { inputUsdPer1M: 2, outputUsdPer1M: 8 },
  "gpt-4.1-mini": { inputUsdPer1M: 0.4, outputUsdPer1M: 1.6 },
  "gpt-4.1-nano": { inputUsdPer1M: 0.1, outputUsdPer1M: 0.4 },
  "gpt-4o": { inputUsdPer1M: 2.5, outputUsdPer1M: 10 },
  "gpt-4o-mini": { inputUsdPer1M: 0.15, outputUsdPer1M: 0.6 },
};

const MODEL_PREFIXES = Object.keys(OPENAI_TOKEN_PRICES).sort(
  (a, b) => b.length - a.length
);

function normalizeModelName(model?: string | null) {
  return model?.trim().toLowerCase() || null;
}

export function getOpenAiTokenPrice(model?: string | null) {
  const normalized = normalizeModelName(model);
  if (!normalized) {
    return null;
  }

  if (OPENAI_TOKEN_PRICES[normalized]) {
    return OPENAI_TOKEN_PRICES[normalized];
  }

  const matchedPrefix = MODEL_PREFIXES.find((prefix) =>
    normalized === prefix || normalized.startsWith(`${prefix}-`)
  );

  return matchedPrefix ? OPENAI_TOKEN_PRICES[matchedPrefix] : null;
}

function normalizeTokenEstimate(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, value);
}

export function calculateOpenAiEstimatedCostUsd(input: {
  model?: string | null;
  inputTokenEstimate?: number | null;
  outputTokenEstimate?: number | null;
}) {
  const price = getOpenAiTokenPrice(input.model);
  if (!price) {
    return null;
  }

  const inputTokens = normalizeTokenEstimate(input.inputTokenEstimate);
  const outputTokens = normalizeTokenEstimate(input.outputTokenEstimate);

  if (inputTokens === null && outputTokens === null) {
    return null;
  }

  const inputCost =
    inputTokens !== null && inputTokens > 0
      ? (inputTokens / 1_000_000) * price.inputUsdPer1M
      : 0;
  const outputCost =
    outputTokens !== null && outputTokens > 0
      ? (outputTokens / 1_000_000) * price.outputUsdPer1M
      : 0;

  return Number((inputCost + outputCost).toFixed(8));
}
