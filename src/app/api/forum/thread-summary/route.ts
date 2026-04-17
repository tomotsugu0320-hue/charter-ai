// src/app/api/forum/thread-summary/route.ts


import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ForumPost = {
  id: string;
  post_role: string;
  content: string;
  created_at?: string;
};

function uniqTexts(values: string[]) {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}

function normalizeText(text: string) {
  return text
    .replace(/[？?]/g, "")
    .replace(/\s+/g, "")
    .trim()
}

function topN(values: string[], n: number) {
  return uniqTexts(values).slice(0, n);
}


async function generateNormalSummaryWithAI(posts: ForumPost[]) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const inputText = posts
    .map((p, i) => {
      return `[${i + 1}] role=${p.post_role}\n${p.content}`;
    })
    .join("\n\n");

  const prompt = `
あなたは議論整理AIです。
以下の投稿群を読んで、日本語で「通常モード向けのAIまとめ」を作ってください。

要件:
- 難しい言葉は使ってよい
- ただし冗長にしない
- 4つの観点を自然な文章で要約する
  1. 何が論点か
  2. 主な賛成・意見
  3. 主な反対・反論
  4. 現時点の議論状況
- 200〜350文字程度
- 誇張しない
- 投稿にないことは断定しない
- 出力は本文だけ。見出し不要

投稿:
${inputText}
`.trim();

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-5.4-mini",
      input: prompt,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error?.message || "OpenAI summary generation failed");
  }

  const text = data?.output_text?.trim();

  if (!text) {
    throw new Error("OpenAI returned empty summary");
  }

  return text;
}


async function generateEasySummaryWithAI(posts: ForumPost[]) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const inputText = posts
    .map((p, i) => {
      return `[${i + 1}] role=${p.post_role}\n${p.content}`;
    })
    .join("\n\n");

  const prompt = `
あなたは子ども向け説明AIです。
以下の投稿群を読んで、日本語で「小学生でもわかるやさしい要約」を作ってください。

要件:
- 難しい言葉はなるべく使わない
- 使う場合はかんたんに言い換える
- 2〜4文で短くまとめる
- 何について話しているか
- どんな意見があるか
- 反対意見があるなら、それもやさしく入れる
- 出力は本文だけ。見出し不要

投稿:
${inputText}
`.trim();

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-5.4-mini",
      input: prompt,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error?.message || "OpenAI easy summary generation failed");
  }

  const text = data?.output_text?.trim();

  if (!text) {
    throw new Error("OpenAI returned empty easy summary");
  }

  return text;
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


const issueMap = new Map<string, string>();

issueRaises.forEach((text) => {
  const key = normalizeText(text);
  if (!issueMap.has(key)) {
    issueMap.set(key, text);
  }
});
const issueList = Array.from(issueMap.values()).slice(0, 3);
  const opinionList = topN(opinions, 3);
  const rebuttalList = topN(rebuttals, 3);
  const supplementList = topN(supplements, 2);
  const explanationList = topN(explanations, 2);

  const counts = {
    total: posts.length,
    issue_raise: issueRaises.length,
    opinion: opinions.length,
    rebuttal: rebuttals.length,
    supplement: supplements.length,
    explanation: explanations.length,
  };

  const paragraphs: string[] = [];

  if (issueList.length > 0) {
    paragraphs.push(
      `このスレでは主に「${issueList.join(" / ")}」といった論点が提起されている。`
    );
  }

  if (opinionList.length > 0) {
    paragraphs.push(
      `主な意見としては「${opinionList.join(" / ")}」が挙がっている。`
    );
  }

  if (rebuttalList.length > 0) {
    paragraphs.push(
      `これに対して「${rebuttalList.join(" / ")}」といった反論や異論も出ている。`
    );
  }

  if (supplementList.length > 0) {
    paragraphs.push(
      `補足として「${supplementList.join(" / ")}」が追加されている。`
    );
  }

  if (explanationList.length > 0) {
    paragraphs.push(
      `解説として「${explanationList.join(" / ")}」が投稿されている。`
    );
  }

  if (paragraphs.length === 0) {
    paragraphs.push("まだ要約できるほど投稿が集まっていない。");
  }

  let debateState = "論点提起が中心で、議論はまだ初期段階。";

  if (counts.rebuttal > 0 && counts.opinion > 0) {
    debateState = "賛否や見解の違いが出始めており、議論が立体化している。";
  } else if (counts.opinion >= 2 && counts.rebuttal === 0) {
    debateState = "意見は増えているが、まだ本格的な反論は少ない。";
  } else if (counts.supplement + counts.explanation >= 2) {
    debateState = "論点の整理や補足情報が追加され、理解が進みつつある。";
  }


const normalText = `${paragraphs.join(" ")} ${debateState}`.trim();

let easyText = "まだ投稿が少なくて、やさしく説明できるほど情報が集まっていない。";

if (issueList.length > 0 || opinionList.length > 0 || rebuttalList.length > 0) {
  const parts: string[] = [];

  if (issueList.length > 0) {
    parts.push(`この話では「${issueList.join(" / ")}」が話題になっている。`);
  }

  if (opinionList.length > 0) {
    parts.push(`主な意見は「${opinionList.join(" / ")}」です。`);
  }

  if (rebuttalList.length > 0) {
    parts.push(`それに対して「${rebuttalList.join(" / ")}」という反対意見もあります。`);
  }

  easyText = parts.join(" ");
}

return {
  counts,
  summary_text: normalText,
  easy_summary_text: easyText,
  key_points: {
    issues: issueList,
    opinions: opinionList,
    rebuttals: rebuttalList,
    supplements: supplementList,
    explanations: explanationList,
  },
};
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const threadId = searchParams.get("threadId");

    if (!threadId) {
      return NextResponse.json(
        { success: false, error: "threadId is required" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: posts, error } = await supabase
      .from("forum_posts")
      .select("id, post_role, content, created_at")
      .eq("thread_id", threadId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }


// 既存キャッシュ確認
const { data: existingStructure, error: existingError } = await supabase
  .from("thread_ai_structures")
.select(`
  thread_id,
  summary_type,
  summary_text,
  easy_summary_text,
  issues,
  opinions,
  rebuttals,
  supplements,
  explanations,
  source_post_count,
  updated_at
`)
  .eq("thread_id", threadId)
  .maybeSingle();


if (existingError) {
  console.error("[thread_ai_structures select error]", existingError);
}


const currentPostCount = (posts ?? []).length;
const generatedAt = existingStructure?.updated_at
  ? new Date(existingStructure.updated_at).getTime()
  : 0;
const now = Date.now();
const days30 = 30 * 24 * 60 * 60 * 1000;

const postDiff =
  currentPostCount - (existingStructure?.source_post_count ?? 0);

const dynamicThreshold =
  currentPostCount >= 101 ? 10 : currentPostCount >= 21 ? 5 : 3;

const shouldRefresh =
  !existingStructure ||
  existingStructure.summary_type !== "normal" ||
  now - generatedAt >= days30 ||
  postDiff >= dynamicThreshold;

if (existingStructure && !shouldRefresh) {
  const issues = Array.isArray(existingStructure.issues)
    ? existingStructure.issues
    : [];
  const opinions = Array.isArray(existingStructure.opinions)
    ? existingStructure.opinions
    : [];
  const rebuttals = Array.isArray(existingStructure.rebuttals)
    ? existingStructure.rebuttals
    : [];
  const supplements = Array.isArray(existingStructure.supplements)
    ? existingStructure.supplements
    : [];
  const explanations = Array.isArray(existingStructure.explanations)
    ? existingStructure.explanations
    : [];

  const conflict_pairs: { opinion: string; rebuttal: string }[] = [];

  if (opinions.length > 0 && rebuttals.length > 0) {
    const minLength = Math.min(opinions.length, rebuttals.length);
    const maxPairs = 2;

    for (let i = 0; i < Math.min(minLength, maxPairs); i++) {
      conflict_pairs.push({
        opinion: opinions[i],
        rebuttal: rebuttals[i],
      });
    }
  }

  let structure_type = "初期議論";

  if (rebuttals.length > 0 && opinions.length > 0) {
    structure_type = "対立あり（意見 vs 反論が衝突中）";
  } else if (supplements.length + explanations.length >= 2) {
    structure_type = "整理・解説フェーズ";
  } else if (opinions.length >= 2) {
    structure_type = "意見集約中";
  }

  return NextResponse.json({
    success: true,
summary: {
  counts: {
    total: currentPostCount,
    issue_raise: (posts ?? []).filter((p) => p.post_role === "issue_raise").length,
    opinion: (posts ?? []).filter((p) => p.post_role === "opinion").length,
    rebuttal: (posts ?? []).filter((p) => p.post_role === "rebuttal").length,
    supplement: (posts ?? []).filter((p) => p.post_role === "supplement").length,
    explanation: (posts ?? []).filter((p) => p.post_role === "explanation").length,
  },
  summary_text: existingStructure.summary_text ?? "",
  easy_summary_text: existingStructure.easy_summary_text ?? "",
  key_points: {
    issues,
    opinions,
    rebuttals,
    supplements,
    explanations,
  },
},
    structure_type,
    conflict_pairs,
    cached: true,
  });
}


let summary = buildSimpleSummary((posts ?? []) as ForumPost[]);

try {
  const [normalAiText, easyAiText] = await Promise.all([
    generateNormalSummaryWithAI((posts ?? []) as ForumPost[]),
    generateEasySummaryWithAI((posts ?? []) as ForumPost[]),
  ]);

  summary = {
    ...summary,
    summary_text: normalAiText,
    easy_summary_text: easyAiText,
  };
} catch (aiError) {
  console.error("[thread-summary ai fallback]", aiError);
}

let conflict_pairs: { opinion: string; rebuttal: string }[] = [];

if (
  summary.key_points.opinions.length > 0 &&
  summary.key_points.rebuttals.length > 0
) {
  const minLength = Math.min(
    summary.key_points.opinions.length,
    summary.key_points.rebuttals.length
  );

const maxPairs = 2;

for (let i = 0; i < Math.min(minLength, maxPairs); i++) {
  conflict_pairs.push({
    opinion: summary.key_points.opinions[i],
    rebuttal: summary.key_points.rebuttals[i],
  });
}
}

let structure_type = "初期議論";

if (summary.counts.rebuttal > 0 && summary.counts.opinion > 0) {
  structure_type = "対立あり（意見 vs 反論が衝突中）";
} else if (
  summary.counts.supplement + summary.counts.explanation >= 2
) {
  structure_type = "整理・解説フェーズ";
} else if (summary.counts.opinion >= 2) {
  structure_type = "意見集約中";
}

const { error: upsertError } = await supabase
  .from("thread_ai_structures")
  .upsert(
{
  thread_id: threadId,
  summary_type: "normal",
  summary_text: summary.summary_text,
  easy_summary_text: summary.easy_summary_text,
  issues: summary.key_points.issues,
  opinions: summary.key_points.opinions,
  rebuttals: summary.key_points.rebuttals,
  supplements: summary.key_points.supplements,
  explanations: summary.key_points.explanations,
  source_post_count: (posts ?? []).length,
  updated_at: new Date().toISOString(),
},
    { onConflict: "thread_id" }
  );

if (upsertError) {
  console.error("[thread_ai_structures upsert error]", upsertError);
}

return NextResponse.json({
  success: true,
  summary,
  structure_type,
  conflict_pairs,
});

  } catch (e: any) {
    console.error("[thread-summary error]", e);

    return NextResponse.json(
      { success: false, error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

