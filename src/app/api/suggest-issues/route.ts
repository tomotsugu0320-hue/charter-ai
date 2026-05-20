import { NextResponse } from "next/server";

type SuggestIssuesResponse = {
  matches: unknown[];
  newIssues: unknown[];
};

type CacheEntry = {
  value: SuggestIssuesResponse;
  expiresAt: number;
};

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_SIZE = 100;
const suggestIssuesCache = new Map<string, CacheEntry>();

function normalizeCacheText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function getCacheKey(tenantSlug: string, text: string) {
  return `${tenantSlug}:${normalizeCacheText(text)}`;
}

function getCachedResponse(cacheKey: string) {
  const cached = suggestIssuesCache.get(cacheKey);
  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    suggestIssuesCache.delete(cacheKey);
    return null;
  }

  return cached.value;
}

function setCachedResponse(cacheKey: string, value: SuggestIssuesResponse) {
  const now = Date.now();

  for (const [key, entry] of suggestIssuesCache.entries()) {
    if (entry.expiresAt <= now) {
      suggestIssuesCache.delete(key);
    }
  }

  while (suggestIssuesCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = suggestIssuesCache.keys().next().value;
    if (!oldestKey) break;
    suggestIssuesCache.delete(oldestKey);
  }

  suggestIssuesCache.set(cacheKey, {
    value,
    expiresAt: now + CACHE_TTL_MS,
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  const text =
    typeof body.text === "string"
      ? body.text
      : typeof body.content === "string"
        ? body.content
        : typeof body.message === "string"
          ? body.message
          : "";
  const issues = Array.isArray(body.issues) ? body.issues : [];
  const tenantSlug =
    typeof body.tenantSlug === "string"
      ? body.tenantSlug
      : typeof body.tenant_slug === "string"
        ? body.tenant_slug
        : "default";
  const cacheKey = getCacheKey(tenantSlug, text);
  const cached = getCachedResponse(cacheKey);

  if (cached) {
    return NextResponse.json({
      ...cached,
      cached: true,
      reused: true,
      source: "memory",
    });
  }

  const prompt = `
以下の投稿を読んで、既存の論点に関連するものがあれば最大3つ選んでください。
また、既存論点に十分合わない場合は、新しい論点候補を最大2つ提案してください。

投稿:
${text}

既存の論点:
${issues.map((i: { title: string }) => i.title).join("\n")}

JSONのみで返してください。
形式:
{
  "matches": [
    {
      "title": "円安が輸出企業に与える影響",
      "reason": "円安と輸出企業の利益に直接言及しているため"
    },
    {
      "title": "円安による消費者物価への影響",
      "reason": "円安が物価に影響する可能性があるため"
    }
  ],
  "newIssues": []
}

`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    }),
  });

  const data = await res.json();

  try {
    const json = JSON.parse(data.choices[0].message.content);
    const response = {
      matches: Array.isArray(json.matches) ? json.matches : [],
      newIssues: Array.isArray(json.newIssues) ? json.newIssues : [],
    };
    setCachedResponse(cacheKey, response);
    return NextResponse.json(response);
  } catch {
    const response = { matches: [], newIssues: [] };
    setCachedResponse(cacheKey, response);
    return NextResponse.json(response);
  }
}
