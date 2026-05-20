import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type StanceResponse = {
  stance_label?: string | null;
  note?: string;
};

type CachedStance = {
  value: StanceResponse;
  expiresAt: number;
};

const ALLOWED_STANCE_LABELS = new Set(["side_a", "side_b", "neutral", "unknown"]);
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_SIZE = 100;
const stanceCache = new Map<string, CachedStance>();

function normalizeCacheText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeStanceLabel(value: unknown) {
  return typeof value === "string" && ALLOWED_STANCE_LABELS.has(value)
    ? value
    : "unknown";
}

function getCacheKey(input: {
  postId?: string;
  issueId?: string;
  issueTitle: string;
  sideA: string;
  sideB: string;
  postContent: string;
}) {
  if (input.postId && input.issueId) {
    return `ids:${input.postId}:${input.issueId}`;
  }

  return [
    "content",
    normalizeCacheText(input.issueTitle),
    normalizeCacheText(input.sideA),
    normalizeCacheText(input.sideB),
    normalizeCacheText(input.postContent),
  ].join(":");
}

function getCachedStance(cacheKey: string) {
  const cached = stanceCache.get(cacheKey);
  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    stanceCache.delete(cacheKey);
    return null;
  }

  return cached.value;
}

function setCachedStance(cacheKey: string, value: StanceResponse) {
  const now = Date.now();

  for (const [key, entry] of stanceCache.entries()) {
    if (entry.expiresAt <= now) {
      stanceCache.delete(key);
    }
  }

  while (stanceCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = stanceCache.keys().next().value;
    if (!oldestKey) break;
    stanceCache.delete(oldestKey);
  }

  stanceCache.set(cacheKey, {
    value,
    expiresAt: now + CACHE_TTL_MS,
  });
}

async function findExistingStance(postId: string, issueId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) return null;

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: linkedRow, error: linkedError } = await supabase
    .from("post_issues")
    .select("post_id")
    .eq("post_id", postId)
    .eq("issue_id", issueId)
    .maybeSingle();

  if (linkedError) {
    console.warn("classify-stance existing link skipped:", linkedError.message);
    return null;
  }

  if (!linkedRow) return null;

  const { data: entryRow, error: entryError } = await supabase
    .from("entries")
    .select("stance_label")
    .eq("id", postId)
    .maybeSingle();

  if (entryError) {
    console.warn("classify-stance existing stance skipped:", entryError.message);
    return null;
  }

  if (!entryRow?.stance_label) return null;

  return normalizeStanceLabel(entryRow.stance_label);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const issueTitle = typeof body.issueTitle === "string" ? body.issueTitle : "";
    const sideA = typeof body.sideA === "string" ? body.sideA : "";
    const sideB = typeof body.sideB === "string" ? body.sideB : "";
    const postContent = typeof body.postContent === "string" ? body.postContent : "";
    const postId = typeof body.postId === "string" ? body.postId : "";
    const issueId = typeof body.issueId === "string" ? body.issueId : "";
    const force = body.force === true;
    const cacheKey = getCacheKey({ postId, issueId, issueTitle, sideA, sideB, postContent });

    if (!force && postId && issueId) {
      const existingStance = await findExistingStance(postId, issueId);

      if (existingStance) {
        return NextResponse.json({
          stance_label: existingStance,
          note: "",
          reused: true,
          source: "existing",
        });
      }
    }

    if (!force) {
      const cached = getCachedStance(cacheKey);

      if (cached) {
        return NextResponse.json({
          ...cached,
          reused: true,
          source: "memory",
        });
      }
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          stance_label: "unknown",
          note: "OPENAI_API_KEY is not set",
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
あなたは投稿の立場を分類するAIです。

以下の論点と投稿内容をもとに、
必ず以下のいずれか1つを選んでください：

- side_a
- side_b
- neutral
- unknown

【最重要ルール】
・必ずどれか1つを選ぶこと
・side_a または side_b を最優先で選択すること
・迷った場合でも必ず side_a か side_b のどちらかに寄せること
・unknown は「完全に意味不明・情報ゼロ」の場合のみ許可

【判断基準】
・投稿がポジティブに近いなら side_a
・ネガティブまたは否定的なら side_b
・両方の要素がある場合はより強い方に寄せる
・少しでもどちらかに傾いていれば必ずその側に分類する

出力はJSONのみ：

{
  "stance_label": "side_a" または "side_b" または "neutral" または "unknown"
}
`,
          },
{
  role: "user",
  content: `
論点: ${issueTitle}

立場A: ${sideA}
立場B: ${sideB}

投稿:
${postContent}

この投稿はどの立場か？
`,
},
        ],
      }),
    });

    const data = await res.json();
    const message = data.choices?.[0]?.message?.content ?? "{}";

    let parsed: StanceResponse;

    try {
      parsed = JSON.parse(message);
    } catch {
      parsed = {
        stance_label: "unknown",
        note: "Failed to parse AI response",
      };
    }

    const stanceLabel = normalizeStanceLabel(parsed.stance_label);
    const response = {
      stance_label: stanceLabel,
      note: parsed.note ?? "",
    };
    setCachedStance(cacheKey, response);

    return NextResponse.json(response);
  } catch (error) {
    console.error("classify-stance route error:", error);

    return NextResponse.json(
      {
        stance_label: "unknown",
        note: "stance api error",
      },
      { status: 500 }
    );
  }
}
