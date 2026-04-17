    // src/app/api/forum/add-post/route.ts


import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPrivacyRisk } from "@/lib/privacy";

type ForumPost = {
  id: string;
  post_role: string;
  content: string;
  created_at?: string;
};

function uniqTexts(values: string[]) {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}

function topN(values: string[], n: number) {
  return uniqTexts(values).slice(0, n);
}

function getOrCreateAuthorKey(req: NextRequest) {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(/author_key=([^;]+)/);

  if (match?.[1]) {
    return match[1];
  }

  return "u_" + Math.random().toString(36).slice(2, 10);
}


function buildSimpleSummary(posts: ForumPost[]) {
  const issueRaises = posts
    .filter((p) => p.post_role === "issue_raise")
    .map((p) => p.content);

  const opinions = posts
    .filter((p) => p.post_role === "opinion")
    .map((p) => p.content);

  const rebuttals = posts
    .filter((p) => p.post_role === "rebuttal")
    .map((p) => p.content);

  const supplements = posts
    .filter((p) => p.post_role === "supplement")
    .map((p) => p.content);

  const explanations = posts
    .filter((p) => p.post_role === "explanation")
    .map((p) => p.content);

  const issueList = topN(issueRaises, 3);
  const opinionList = topN(opinions, 3);
  const rebuttalList = topN(rebuttals, 3);
  const supplementList = topN(supplements, 2);
  const explanationList = topN(explanations, 2);

  const paragraphs: string[] = [];

  if (issueList.length > 0) {
    paragraphs.push(`このスレでは主に「${issueList.join(" / ")}」といった論点が提起されている。`);
  }

  if (opinionList.length > 0) {
    paragraphs.push(`主な意見としては「${opinionList.join(" / ")}」が挙がっている。`);
  }

  if (rebuttalList.length > 0) {
    paragraphs.push(`これに対して「${rebuttalList.join(" / ")}」といった反論や異論も出ている。`);
  }

  if (supplementList.length > 0) {
    paragraphs.push(`補足として「${supplementList.join(" / ")}」が追加されている。`);
  }

  if (explanationList.length > 0) {
    paragraphs.push(`解説として「${explanationList.join(" / ")}」が投稿されている。`);
  }

  if (paragraphs.length === 0) {
    paragraphs.push("まだ要約できるほど投稿が集まっていない。");
  }

  return {
    summary_text: paragraphs.join(" "),
    key_points: {
      issues: issueList,
      opinions: opinionList,
      rebuttals: rebuttalList,
      supplements: supplementList,
      explanations: explanationList,
    },
  };
}

const ALLOWED_POST_ROLES = [
  "issue_raise",
  "opinion",
  "rebuttal",
  "supplement",
  "explanation",
] as const;

type AllowedPostRole = (typeof ALLOWED_POST_ROLES)[number];


function isAllowedPostRole(value: string): value is AllowedPostRole {
  return ALLOWED_POST_ROLES.includes(value as AllowedPostRole);
}


type LogicScoreResult = {
  score: number;
  reason: string;
};

function calcLogicScoreFallback(
  content: string,
  postRole: AllowedPostRole
): LogicScoreResult {
  let score = 50;

  const text = content.trim();

  if (text.length >= 40) score += 10;
  if (text.length >= 80) score += 10;
  if (text.length < 15) score -= 15;

  const logicalWords = [
    "なぜなら",
    "つまり",
    "一方で",
    "ただし",
    "例えば",
    "根拠",
    "理由",
    "具体的",
    "比較",
  ];
  for (const word of logicalWords) {
    if (text.includes(word)) score += 5;
  }

  const weakWords = [
    "やばい",
    "むかつく",
    "最悪",
    "意味不明",
    "カス",
    "死ね",
  ];
  for (const word of weakWords) {
    if (text.includes(word)) score -= 8;
  }

  if (postRole === "issue_raise") score += 5;
  if (postRole === "rebuttal") score += 5;
  if (postRole === "explanation") score += 8;

  if (score > 100) score = 100;
  if (score < 0) score = 0;

let weight = 0;

switch (postRole) {
  case "issue_raise":
    weight = 3;
    break;
  case "rebuttal":
    weight = 10;
    break;
  case "supplement":
    weight = 5;
    break;
  case "explanation":
    weight = 12;
    break;
}

const finalScore = Math.max(0, Math.min(100, score + weight));

return {
  score: finalScore,
  reason: `fallback + weight(${weight})`,
};
}


async function evaluateLogicScore(
  content: string,
  postRole: AllowedPostRole
): Promise<LogicScoreResult> {
  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        instructions: `
あなたは議論評価AIです。
次の投稿を 0〜100 点で採点してください。

評価基準:
1. 具体性があるか
2. 理由・因果・比較などの論理接続があるか
3. 感情だけに偏っていないか

必ずJSONのみで返してください。
形式:
{"score": number, "reason": string}

reason は40文字以内、日本語で簡潔にしてください。
        `.trim(),
        input: `
投稿分類: ${postRole}

本文:
${content}
        `.trim(),
        temperature: 0,
        text: {
          format: {
            type: "json_schema",
            name: "logic_score_result",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                score: {
                  type: "number",
                },
                reason: {
                  type: "string",
                },
              },
              required: ["score", "reason"],
            },
            strict: true,
          },
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI API error: ${errText}`);
    }

    const json = await res.json();

    const outputText =
      json.output?.[0]?.content?.[0]?.text ??
      json.output_text ??
      "";

    if (!outputText) {
      throw new Error("No model output");
    }

    const parsed = JSON.parse(outputText);

const baseScore = Math.max(0, Math.min(100, Number(parsed.score ?? 50)));

let weight = 0;

switch (postRole) {
  case "issue_raise":
    weight = 3;
    break;
  case "opinion":
    weight = 0;
    break;
  case "rebuttal":
    weight = 10;
    break;
  case "supplement":
    weight = 5;
    break;
  case "explanation":
    weight = 12;
    break;
}

const finalScore = Math.max(0, Math.min(100, baseScore + weight));

return {
  score: finalScore,
  reason: `${parsed.reason}（重み補正+${weight}）`,
};


  } catch (e) {
    console.error("[evaluateLogicScore fallback]", e);
    return calcLogicScoreFallback(content, postRole);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const threadId = body?.threadId;
    const content = String(body?.content ?? "").trim();
    const postRole = String(body?.postRole ?? "").trim();
const authorKey = getOrCreateAuthorKey(req);
const predictionFlag = Boolean(body?.prediction_flag);
const predictionTarget = predictionFlag
  ? String(body?.prediction_target ?? "").trim() || null
  : null;
const predictionDeadline =
  predictionFlag && body?.prediction_deadline
    ? String(body.prediction_deadline)
    : null;
const predictionResult = predictionFlag
  ? String(body?.prediction_result ?? "pending")
  : null;


    if (!threadId) {
      return NextResponse.json({ success: false, error: "threadId is required" }, { status: 400 });
    }

    if (!content) {
      return NextResponse.json({ success: false, error: "content is required" }, { status: 400 });
    }

if (!isAllowedPostRole(postRole)) {
  return NextResponse.json({ success: false, error: "invalid postRole" }, { status: 400 });
}

const privacy = checkPrivacyRisk(content);
const logicResult = await evaluateLogicScore(content, postRole);
let logicBreakType: string | null = null;
let logicBreakNote: string | null = null;

const text = content;

// 因果ワード
const hasCausal =
  text.includes("ため") ||
  text.includes("ので") ||
  text.includes("だから") ||
  text.includes("結果") ||
  text.includes("影響") ||
  text.includes("よって") ||
  text.includes("そのため");

const hasData =
  /\d/.test(text) ||
  text.includes("%") ||
  text.includes("兆") ||
  text.includes("億") ||
  text.includes("万人") ||
  text.includes("円") ||
  text.includes("統計") ||
  text.includes("データ") ||
  text.includes("内閣府") ||
  text.includes("総務省");


// 抽象ワード
const vagueWords = [
  "必要",
  "問題",
  "重要",
  "多い",
  "少ない",
  "やばい",
  "危険",
  "不足",
  "回復",
  "悪い",
  "高い",
  "低い",
];
const hasVague = vagueWords.some((w) => text.includes(w));

// 判定
if (!hasCausal) {
  logicBreakType = "premise_gap";
  logicBreakNote = "主張と理由の因果関係が不明確";
} else if (hasCausal && !hasData && hasVague) {
  logicBreakType = "premise_gap";
  logicBreakNote = "前提条件が抽象的で根拠が弱い";
} else if (hasCausal && !hasData) {
  logicBreakType = "data_insufficient";
  logicBreakNote = "具体的なデータや根拠が不足している";
} else if (logicResult.score < 40) {
  logicBreakType = "off_point";
  logicBreakNote = "論点からずれている可能性が高い";
} else {
  logicBreakType = "none";
  logicBreakNote = "";
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ① 投稿保存
const { data: insertedRows, error } = await supabase
  .from("forum_posts")
.insert({
  thread_id: threadId,
  source_type: "human",
  post_role: postRole,
  content,
  author_key: authorKey,
  trust_status: "trusted",
  raw_text: content,
  sanitized_text: privacy.maskedText,
  is_sensitive: privacy.isSensitive,
  privacy_flags: privacy.flags,
  privacy_score: privacy.score,
  logic_score: logicResult.score,
  logic_score_reason: logicResult.reason,
  logic_break_type: logicBreakType,
  logic_break_note: logicBreakNote,
  prediction_flag: predictionFlag,
  prediction_target: predictionTarget,
  prediction_deadline: predictionDeadline,
  prediction_result: predictionResult,
  updated_at: new Date().toISOString(),
})
  .select("id, content, logic_score, logic_score_reason, logic_break_type, logic_break_note");

if (error) {
  return NextResponse.json(
    { success: false, error: error.message },
    { status: 500 }
  );
}

// ② 投稿一覧取得
const { data: postRows } = await supabase
  .from("forum_posts")
  .select("id, post_role, content, created_at, logic_score, logic_score_reason")
  .eq("thread_id", threadId)
  .eq("is_deleted", false)
  .order("created_at", { ascending: true });

// ③ 要約生成
const summary = buildSimpleSummary((postRows ?? []) as ForumPost[]);

// ④ 保存
await supabase
  .from("thread_ai_structures")
  .upsert(
    {
      thread_id: threadId,
      summary_text: summary.summary_text,
      issues: summary.key_points.issues,
      opinions: summary.key_points.opinions,
      rebuttals: summary.key_points.rebuttals,
      supplements: summary.key_points.supplements,
      explanations: summary.key_points.explanations,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "thread_id" }
  );

const res = NextResponse.json({
  success: true,
  debug: {
    logicResult,
    logicBreakType,
    logicBreakNote,
    insertedRows,
    authorKey,
  },
});

res.headers.set(
  "Set-Cookie",
  `author_key=${authorKey}; Path=/; Max-Age=31536000; SameSite=Lax`
);

return res;

  } catch (e: any) {
    console.error("[add-post error]", e);
    return NextResponse.json(
      { success: false, error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

