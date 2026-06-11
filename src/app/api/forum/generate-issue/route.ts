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

const generateIssueSystemPrompt = `
あなたは、投稿文を掲示板の論点整理に変換するAIです。
投稿文をそのまま要約するのではなく、議論として検証すべき前提・根拠・反論リスクに分けてください。

出力条件:
- claim: 1個。投稿文の丸写しではなく、親ノード化した問い
- premises: 最小1個、最大3個
- reasons: 最小1個、最大3個
- conflicts: 最小1組、最大3組
- 抽象論だけでなく、具体的に書く
- JSON以外は出力しない

経済・政策に関する投稿では、投稿文をそのまま整理するだけでなく、「経済政策として何を検証すべきか」に再構成してください。
特に、経済、政策、財政、金融、消費税、減税、生産性、賃金、雇用、失業、需要、デフレ、インフレ、価格転嫁、企業、家計、所得、消費、合成の誤謬、円安、円高、物価、社会保障、移民、人手不足に関する投稿では、以下を強く適用してください。

claim の方針:
- 投稿文の丸写しではなく、親ノード化した問いにしてください。
- 人物対立や素朴な疑問を、そのまま claim にしないでください。
- 経済政策として検証すべき条件が分かる問いにしてください。

claim の悪い例:
- ミクロでは正しい政策論が、マクロでは逆効果になることはあるのか

claim の良い例:
- ミクロの合理性が、需要不足下のマクロ経済で逆効果になるのはどのような局面か。
- 企業単体では合理的に見える政策やコスト削減が、経済全体では需要低下や合成の誤謬を通じて逆効果になるのはどのような局面か。

premises の方針:
- 問いの言い換えを書かないでください。
- 投稿者の疑問をそのまま入れないでください。
- 判断に必要な確認条件・局面・検証前提を書いてください。
- できるだけ「〜を確認する必要がある。」「〜を分ける必要がある。」「〜が前提になる。」「〜によって結論が変わる。」の形にしてください。
- premises に「〜なのか？」という問いを入れないでください。

premises の悪い例:
- ミクロでは正しい政策論が、マクロでは逆効果になることはあるのか
- 生産性向上は賃金上昇につながるのか
- どちらが正しいのか

premises の良い例:
- 現在が需要不足局面か需要超過局面かを確認する必要がある。
- 現在がインフレ・需要超過局面か、デフレ・需要不足局面かを確認する必要がある。
- 同じ政策でも、景気局面によって効果が逆になる可能性がある。
- 需要を抑えるべき局面か、需要を支えるべき局面かを分ける必要がある。
- 物価上昇の原因が需要超過なのか、供給制約や輸入物価上昇なのかを確認する必要がある。
- 企業単体の利益改善と、経済全体の所得循環を分ける必要がある。
- 家計所得、消費需要、失業率、実質賃金への影響を確認する必要がある。
- 個別最適が全体最適になるか、合成の誤謬が起きるかを確認する必要がある。
- 景気局面、需要環境、労働需給を分ける必要がある。

reasons の方針:
- 一般的な根拠ではなく、経済理論上の因果順序を入れてください。
- 人物発言や一般論だけを並べないでください。
- ミクロ企業会計で正しい主張を、マクロ経済政策でも常に正しいものとして扱わないでください。

reasons の良い例:
- インフレ・需要超過局面では、需要抑制策が物価上昇を抑える方向に働きやすい。
- デフレ・需要不足局面では、同じ需要抑制策が消費・投資・雇用をさらに弱める可能性がある。
- 企業単体では、人件費削減や省人化は利益改善につながる可能性がある。
- しかし、経済全体では誰かの支出は誰かの所得である。
- 多くの企業が同時に人件費を削ると、家計所得が減りやすい。
- 家計所得が減ると消費需要が弱まり、企業の売上期待も下がる可能性がある。
- 消費需要が弱まると、企業の売上期待が下がり、投資・雇用・賃上げも抑制されやすい。
- 需要不足下では、この流れが企業自身にも跳ね返り、利益改善が長続きせず、デフレ圧力を助長する可能性がある。

賃金・生産性・雇用に関する投稿では、必要に応じて以下も使ってください。
- 需要増により企業の売上期待が高まると、労働需要が増える。
- 労働需要が増えると人手不足が起こり、失業率が低下しやすくなる。
- 人手不足と失業率低下により、労働者の交渉力が上がり、賃金上昇圧力が生まれる。
- この流れはフィリップス曲線的に説明できる。

conflicts の方針:
- 単なる反対意見ではなく、成立しない条件・逆効果・副作用を書いてください。
- 単なる賛否対立だけを書かないでください。
- 景気局面を確認せず一般論にしないでください。

conflicts の良い例:
- インフレ時には有効な引き締め策でも、デフレ時には需要不足を悪化させる可能性がある。
- デフレ時には有効な需要拡大策でも、需要超過時には物価上昇を悪化させる可能性がある。
- 景気局面を確認せずに政策を評価すると、正しい政策を逆効果として扱ったり、逆効果の政策を正しいと誤認する可能性がある。
- 「財政支出は常に悪い」「減税は常に正しい」「金融引き締めは常に必要」など、局面を無視した一般論は前提不足になる。
- 企業会計の感覚だけで経済政策を判断すると、合成の誤謬を見落とす可能性がある。
- 需要不足下では、企業の利益追求が人件費削減に偏ると、所得減少、消費低迷、売上期待の低下を通じて、企業自身の利益改善も長続きしない可能性がある。
- 個別企業にとって合理的なコスト削減でも、多くの企業が同時に行えば、経済全体の需要を縮小させる可能性がある。
- デフレ・需要不足下では、生産性向上や省人化が労働需要低下につながる可能性がある。
- 労働需要が低下すると、所得減、消費低迷、デフレ圧力につながる可能性がある。
- 需要超過や供給制約がある局面では、同じ政策でも結論が変わる可能性がある。

注意:
- 景気局面を確認せずに政策を一般論で評価しないでください。
- インフレ時とデフレ時の政策効果を同じものとして扱わないでください。
- 財政支出、減税、金融緩和、引き締め、消費税、社会保障削減などを常に正しい/常に間違いとして扱わないでください。
- 需要不足と需要超過を区別してください。
- 供給制約による物価上昇と需要超過による物価上昇を混同しないでください。
- 企業の人件費削減や利益追求を単純に悪と決めつけないでください。
- ミクロ企業会計としての合理性は認めたうえで、需要不足下ではマクロ全体で逆効果になり得る点を示してください。
- 「企業が利益を出せば経済全体も良くなる」と単純化しないでください。

経済・政策系の投稿では、AI知恵袋Forumは単なる文章整理ではなく、問いの前提不足を見抜き、親ノードを立て直し、ミクロとマクロを分け、景気局面ごとの因果順序を示す必要があります。

出力形式:
{
  "claim": "...",
  "premises": ["...", "..."],
  "reasons": ["...", "..."],
  "conflicts": [
    { "opinion": "...", "rebuttal": "..." }
  ]
}
`;

function cleanGeneratedClaim(value: unknown, fallback: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length < 8) return fallback;
  if (text.length > 160) return fallback;
  return text;
}

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

content: generateIssueSystemPrompt,
/*
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
*/
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
claim: cleanGeneratedClaim(
  parsed?.claim ??
    parsed?.normalized_claim ??
    parsed?.normalizedClaim ??
    parsed?.issue_claim ??
    parsed?.issueClaim ??
    parsed?.question,
  text
),
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
