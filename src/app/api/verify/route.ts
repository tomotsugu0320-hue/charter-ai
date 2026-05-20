import { NextResponse } from "next/server";

type VerifyResponse = {
  status?: string;
  reason_type?: string | string[] | null;
  note?: string;
};

type CachedVerify = {
  value: VerifyResponse;
  expiresAt: number;
};

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_SIZE = 100;
const verifyCache = new Map<string, CachedVerify>();

function normalizeCacheText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function getCacheKey(input: {
  tenantSlug: string;
  targetId: string;
  issueId: string;
  postId: string;
  title: string;
  text: string;
}) {
  return [
    input.tenantSlug || "default",
    input.targetId || input.issueId || input.postId || "no-target",
    normalizeCacheText(input.title),
    normalizeCacheText(input.text),
  ].join(":");
}

function getCachedVerify(cacheKey: string) {
  const cached = verifyCache.get(cacheKey);
  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    verifyCache.delete(cacheKey);
    return null;
  }

  return cached.value;
}

function setCachedVerify(cacheKey: string, value: VerifyResponse) {
  const now = Date.now();

  for (const [key, entry] of verifyCache.entries()) {
    if (entry.expiresAt <= now) {
      verifyCache.delete(key);
    }
  }

  while (verifyCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = verifyCache.keys().next().value;
    if (!oldestKey) break;
    verifyCache.delete(oldestKey);
  }

  verifyCache.set(cacheKey, {
    value,
    expiresAt: now + CACHE_TTL_MS,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const tenantSlug =
      typeof body.tenantSlug === "string"
        ? body.tenantSlug
        : typeof body.tenant_slug === "string"
          ? body.tenant_slug
          : "";
    const targetId = typeof body.targetId === "string" ? body.targetId : "";
    const issueId = typeof body.issueId === "string" ? body.issueId : "";
    const postId = typeof body.postId === "string" ? body.postId : "";
    const title =
      typeof body.title === "string"
        ? body.title
        : typeof body.issueTitle === "string"
          ? body.issueTitle
          : "";
    const text =
      typeof body.text === "string"
        ? body.text
        : typeof body.content === "string"
          ? body.content
          : typeof body.claim === "string"
            ? body.claim
            : "";
    const cacheKey = getCacheKey({
      tenantSlug,
      targetId,
      issueId,
      postId,
      title,
      text,
    });
    const cached = getCachedVerify(cacheKey);

    if (cached) {
      return NextResponse.json({
        ...cached,
        cached: true,
        reused: true,
        source: "memory",
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          status: "weak",
          reason_type: "data_insufficient",
          note: "OPENAI_API_KEY が設定されていません",
        },
        { status: 500 }
      );
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `
You are an issue verification AI.

IMPORTANT:
- Always respond in Japanese.
- note must be written in natural Japanese.
- Do NOT use English in note.

Return JSON in this format:

{
  "status": "verified" | "disputed" | "weak",
  "reason_type": ["premise_difference"] | ["definition_difference"] | ["data_insufficient"] | ["value_judgment"] | ["timeframe_mismatch"] | ["causal_uncertain"] | null,
  "note": "日本語で1文"
}

Rules:
- verified: the claim is reasonably supported
- disputed: interpretation depends on perspective
- weak: insufficient evidence

Return JSON only.
`,
          },
          {
            role: "user",
            content: text,
          },
        ],
      }),
    });

    const data = await res.json();
    const message = data.choices?.[0]?.message?.content ?? "{}";

    let parsed: VerifyResponse;

    try {
      parsed = JSON.parse(message);
    } catch {
      parsed = {
        status: "disputed",
        reason_type: "data_insufficient",
        note: "AIの応答解析に失敗",
      };
    }

    const newStatus =
      parsed.status === "verified"
        ? "verified"
        : parsed.status === "disputed"
        ? "disputed"
        : "weak";

    const allowedReasonTypes = new Set([
      "premise_difference",
      "definition_difference",
      "data_insufficient",
      "value_judgment",
      "timeframe_mismatch",
      "causal_uncertain",
    ]);

    let normalizedReasonType: string[] | null = null;

    if (Array.isArray(parsed.reason_type)) {
      normalizedReasonType = parsed.reason_type.filter((r) =>
        allowedReasonTypes.has(r)
      );
    } else if (typeof parsed.reason_type === "string") {
      if (allowedReasonTypes.has(parsed.reason_type)) {
        normalizedReasonType = [parsed.reason_type];
      }
    }

    const response = {
      status: newStatus,
      reason_type: normalizedReasonType,
      note: parsed.note ?? "",
    };
    setCachedVerify(cacheKey, response);

    return NextResponse.json({
      status: newStatus,
      reason_type: normalizedReasonType,
      note: parsed.note ?? "判定理由なし",
    });
  } catch (error) {
    console.error("verify route error:", error);

    return NextResponse.json(
      {
        status: "weak",
        reason_type: "data_insufficient",
        note: "検証APIエラー",
      },
      { status: 500 }
    );
  }
}
