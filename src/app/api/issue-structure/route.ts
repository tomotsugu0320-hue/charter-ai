import { NextResponse } from "next/server";

type StructureResponse = {
  side_a?: string;
  side_b?: string;
  core_conflict?: string;
};

type CachedStructure = {
  value: StructureResponse;
  expiresAt: number;
};

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_SIZE = 100;
const structureCache = new Map<string, CachedStructure>();

function normalizeCacheText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function getCacheKey(input: {
  issueId: string;
  tenantSlug: string;
  title: string;
  text: string;
}) {
  return [
    input.tenantSlug || "default",
    input.issueId || "no-issue",
    normalizeCacheText(input.title),
    normalizeCacheText(input.text),
  ].join(":");
}

function getCachedStructure(cacheKey: string) {
  const cached = structureCache.get(cacheKey);
  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    structureCache.delete(cacheKey);
    return null;
  }

  return cached.value;
}

function setCachedStructure(cacheKey: string, value: StructureResponse) {
  const now = Date.now();

  for (const [key, entry] of structureCache.entries()) {
    if (entry.expiresAt <= now) {
      structureCache.delete(key);
    }
  }

  while (structureCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = structureCache.keys().next().value;
    if (!oldestKey) break;
    structureCache.delete(oldestKey);
  }

  structureCache.set(cacheKey, {
    value,
    expiresAt: now + CACHE_TTL_MS,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const issueId = typeof body.issueId === "string" ? body.issueId : "";
    const tenantSlug =
      typeof body.tenantSlug === "string"
        ? body.tenantSlug
        : typeof body.tenant_slug === "string"
          ? body.tenant_slug
          : "";
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
          : typeof body.postContent === "string"
            ? body.postContent
            : "";
    const cacheKey = getCacheKey({ issueId, tenantSlug, title, text });
    const cached = getCachedStructure(cacheKey);

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
          side_a: "API key missing",
          side_b: "API key missing",
          core_conflict: "OPENAI_API_KEY is not set",
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
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `
You are a debate structure AI.

Read the issue title and related posts, then extract:
- side_a: one short summary of one major position
- side_b: one short summary of the opposing or contrasting position
- core_conflict: one short sentence describing the core disagreement

Return JSON only:

{
  "side_a": "...",
  "side_b": "...",
  "core_conflict": "..."
}
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

    let parsed: StructureResponse;

    try {
      parsed = JSON.parse(message);
    } catch {
      parsed = {
        side_a: "立場Aの抽出に失敗",
        side_b: "立場Bの抽出に失敗",
        core_conflict: "争点の抽出に失敗",
      };
    }

    const response = {
      side_a: parsed.side_a ?? "",
      side_b: parsed.side_b ?? "",
      core_conflict: parsed.core_conflict ?? "",
    };
    setCachedStructure(cacheKey, response);

    return NextResponse.json(response);
  } catch (error) {
    console.error("issue-structure route error:", error);

    return NextResponse.json(
      {
        side_a: "",
        side_b: "",
        core_conflict: "構造抽出APIエラー",
      },
      { status: 500 }
    );
  }
}
