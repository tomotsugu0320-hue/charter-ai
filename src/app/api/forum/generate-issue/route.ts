// src/app/api/forum/generate-issue/route.ts


import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { isForumBetaLoggedIn } from "@/lib/forum-auth";

type DbStructure = {
  premises: string[];
  reasons: string[];
  conflicts: { a: string; b: string }[];
};

// =========================
// Supabase
// =========================

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  return createClient(url, key);
}


// =========================
// OpenAI
// =========================
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

type GenerateIssueCacheValue = {
  response: Record<string, unknown>;
  createdAt: number;
};

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_SIZE = 100;
const generateIssueCache = new Map<string, GenerateIssueCacheValue>();

function normalizeCacheText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function getCacheKey(tenantSlug: string, text: string) {
  return `${tenantSlug}:${normalizeCacheText(text)}`;
}

function pruneCache(now: number) {
  for (const [key, value] of generateIssueCache.entries()) {
    if (now - value.createdAt > CACHE_TTL_MS) {
      generateIssueCache.delete(key);
    }
  }

  while (generateIssueCache.size > MAX_CACHE_SIZE) {
    const oldestKey = generateIssueCache.keys().next().value;
    if (!oldestKey) break;
    generateIssueCache.delete(oldestKey);
  }
}

function cacheResponse(cacheKey: string, response: Record<string, unknown>) {
  generateIssueCache.set(cacheKey, {
    response,
    createdAt: Date.now(),
  });
  pruneCache(Date.now());
}

// =========================
// キーワード抽出（強化版）
// =========================
function extractKeywords(inputText: string): string[] {
  const normalized = inputText
    .replace(/[,%_、。.,!?！？()（）「」『』[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const rawWords = normalized
    .split(" ")
    .map((w) => w.trim())
    .filter((w) => w.length >= 2);

  const jaMatches =
    normalized.match(/[一-龠ぁ-んァ-ヶA-Za-z0-9ー]{2,12}/g) ?? [];

  const stopWords = new Set([
    "こと","これ","それ","ため","よう","もの","ここ","そこ",
    "議論","主張","前提","根拠","意見","反論","補足","解説",
    "する","した","して","ある","ない","いる","なる",
    "です","ます","日本"
  ]);

  const merged = [...rawWords, ...jaMatches]
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !stopWords.has(w));

  const unique = Array.from(new Set(merged));

  return unique.length > 0
    ? unique.slice(0, 5)
    : [inputText.replace(/[,%_\s]/g, "").slice(0, 16)];
}

// =========================
// テキスト整形
// =========================
function uniqueShortTexts(texts: string[], limit: number): string[] {
  const set = new Set<string>();

  for (const t of texts) {
    const v = t.trim();
    if (v.length >= 5 && v.length <= 120) {
      set.add(v);
    }
  }

  return Array.from(set).slice(0, limit);
}

// =========================
// DB検索（強化版）
// =========================

async function loadDbStructure(inputText: string): Promise<DbStructure> {
  const supabase = getSupabase();
  if (!supabase) {
    return { premises: [], reasons: [], conflicts: [] };
  }

  const keywords = extractKeywords(inputText);

  if (keywords.length === 0) {
    return { premises: [], reasons: [], conflicts: [] };
  }


const mainKeywords = keywords
  .slice(0, 3)
  .filter((k) => k && k.length >= 2);

const safeKeywords = mainKeywords.map((k) =>
  k.replace(/[%_,]/g, "")
);


if (safeKeywords.length === 0) {
  return { premises: [], reasons: [], conflicts: [] };
}
const { data: threads } = await supabase
  .from("forum_threads")
  .select("id, title, original_post")
  .eq("is_deleted", false);


const matchedThreadIds = (threads || [])
  .filter((t) => {
    const text = `${t.title || ""} ${t.original_post || ""}`.toLowerCase();

    const matchCount = safeKeywords.filter((k) =>
      text.includes(k.toLowerCase())
    ).length;

    return matchCount >= Math.ceil(safeKeywords.length / 2);
  })
  .map((t) => t.id);
let query = supabase
  .from("forum_posts")
  .select("post_role, content, created_at")
  .in("post_role", [
    "rebuttal",
    "issue_raise",
    "opinion",
    "supplement",
    "explanation",
  ])
  .eq("is_deleted", false);

if (safeKeywords.length > 0) {
  const k = safeKeywords.slice(0, 2); // 上位2つだけ使う
  query = query
    .ilike("content", `%${k[0]}%`);

  if (k[1]) {
    query = query.or(`content.ilike.%${k[1]}%`);
  }
}


if (matchedThreadIds.length > 0) {
  query = query.in("thread_id", matchedThreadIds);
}


const { data, error } = await query
  .order("created_at", { ascending: false })
  .limit(80);


  if (error || !data) {
    console.error("[DB検索エラー]", error);
    return { premises: [], reasons: [], conflicts: [] };
  }

  const rows = data;

const premises = uniqueShortTexts(
  rows
    .filter((r) => r.post_role === "supplement")
    .map((r) => r.content),
  3
);

const reasons = uniqueShortTexts(
  rows
    .filter(
      (r) =>
        r.post_role === "explanation" ||
        r.post_role === "opinion"
    )
    .map((r) => r.content),
  3
);

  const conflictsRaw = rows
    .filter((r) => r.post_role === "rebuttal")
    .map((r) => r.content);

  const conflicts: { a: string; b: string }[] = [];

  for (let i = 0; i < conflictsRaw.length; i += 2) {
    if (conflictsRaw[i + 1]) {
      conflicts.push({
        a: conflictsRaw[i],
        b: conflictsRaw[i + 1],
      });
    }
  }

  // premiseが足りない場合、issueで補完
const finalPremises = premises;
  return {
    premises: finalPremises,
    reasons,
    conflicts,
  };
}

// =========================
// fallback
// =========================

function fallbackStructure(): DbStructure {
  return {
    premises: [
      "前提がまだ十分に整理されていません",
    ],
    reasons: [
      "根拠がまだ十分に整理されていません",
    ],
    conflicts: [
      {
        a: "この主張には別の見方があり得ます",
        b: "前提や条件によって結論が変わる可能性があります",
      },
    ],
  };
}


// =========================
// API本体
// =========================

export async function POST(req: Request) {
  let text = "";
  let cacheKey = "";

  try {
    if (!isForumBetaLoggedIn(req)) {
      return NextResponse.json(
        { ok: false, error: "Login required." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const inputText = body?.text ?? body?.content ?? body?.input;
    text = typeof inputText === "string" ? inputText : "";
    const tenantSlug =
      String(body?.tenantSlug ?? body?.tenant_slug ?? "default").trim() ||
      "default";
    cacheKey = getCacheKey(tenantSlug, text);

    const now = Date.now();
    pruneCache(now);

    const cached = generateIssueCache.get(cacheKey);

    if (cached && now - cached.createdAt <= CACHE_TTL_MS) {
      return NextResponse.json({
        ...cached.response,
        cached: true,
        reused: true,
        source: "memory",
      });
    }

    // ① DB検索
    const dbResult = await loadDbStructure(text);


    // ② DBである程度拾えたらそれ優先

if (
  dbResult.premises.length >= 1 ||
  dbResult.reasons.length >= 1 ||
  dbResult.conflicts.length >= 1
) {
  const response = {
    mode: "expand",
claim: typeof text === "string" ? text : "",
    premises: dbResult.premises.slice(0, 3),
    reasons: dbResult.reasons.slice(0, 3),
    conflicts: dbResult.conflicts.slice(0, 3).map((c) => ({
      opinion: c.a ?? "",
      rebuttal: c.b ?? "",
    })),
    source: "db",
  };
  cacheResponse(cacheKey, response);
  return NextResponse.json(response);
}


    // ③ AI fallback
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",

content: `
主張を分析し、前提・根拠・対立をJSONで出力してください。

条件:
・前提: 最低1個、最大3個
・根拠: 最低1個、最大3個
・対立: 最低1組、最大3組
・既に与えられている候補がある場合は、それを尊重し、不足分だけ補う
・抽象禁止
・具体必須
・JSON以外は出力しない

出力形式:
{
  "premises": ["...", "..."],
  "reasons": ["...", "..."],
  "conflicts": [
    { "opinion": "...", "rebuttal": "..." }
  ]
}
`,
        },
        {
          role: "user",
          content: text,
        },
      ],
    });


const raw = completion.choices[0].message.content || "{}";

// JSON部分だけ抜き出す
const jsonMatch = raw.match(/\{[\s\S]*\}/);

let parsed: any;
try {
  parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
} catch {
  parsed = fallbackStructure();
}


const fallback = fallbackStructure();

const safePremises =
  Array.isArray(parsed?.premises) && parsed.premises.length > 0
    ? parsed.premises.slice(0, 3)
    : fallback.premises.slice(0, 3);

const safeReasons =
  Array.isArray(parsed?.reasons) && parsed.reasons.length > 0
    ? parsed.reasons.slice(0, 3)
    : fallback.reasons.slice(0, 3);

const safeConflictsRaw =
  Array.isArray(parsed?.conflicts) && parsed.conflicts.length > 0
    ? parsed.conflicts.slice(0, 3)
    : fallback.conflicts.slice(0, 3);

const response = {
  mode: "expand",
claim: text,
  premises: safePremises,
  reasons: safeReasons,
  conflicts: safeConflictsRaw.map((c: any) => ({
    opinion: c?.opinion ?? c?.a ?? "",
    rebuttal: c?.rebuttal ?? c?.b ?? "",
  })),
  source: "ai",
};
cacheResponse(cacheKey, response);
return NextResponse.json(response);
  } catch (e) {
    console.error(e);

    const fallback = fallbackStructure();

    const response = {
      mode: "expand",
      claim: typeof text === "string" ? text : "",
      premises: fallback.premises,
      reasons: fallback.reasons,
      conflicts: fallback.conflicts.map((c) => ({
        opinion: c.a ?? "",
        rebuttal: c.b ?? "",
      })),
      source: "fallback",
    };
    if (cacheKey) {
      cacheResponse(cacheKey, response);
    }
    return NextResponse.json(response);
  }
}
