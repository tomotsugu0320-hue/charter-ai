// src/app/api/forum/thread-summary/route.ts



import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ForumPost = {
  id: string;
  post_role: string;
  content: string;
  created_at?: string;
};

type SourceType = "extracted" | "inferred";

type SourceItem = {
  text: string;
  source_type: SourceType;
  quality_score: number;
};

type ConflictPair = {
  opinion: string;
  rebuttal: string;
  source_type?: SourceType;
  quality_score?: number;
};

type ThreadSummaryPayload = ReturnType<typeof buildSimpleSummary> & {
  provisional_answer: string;
};

type ThreadSummaryResponse = {
  success: true;
  summary: ThreadSummaryPayload;
  structure_type: string;
  conflict_pairs: ConflictPair[];
};

type CachedThreadSummary = {
  value: ThreadSummaryResponse;
  expiresAt: number;
};

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_SIZE = 100;
const threadSummaryCache = new Map<string, CachedThreadSummary>();

function uniqTexts(values: string[]) {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}

function normalizeText(text: string) {
  return text.replace(/[？?]/g, "").replace(/\s+/g, "").trim();
}

function topN(values: string[], n: number) {
  return uniqTexts(values).slice(0, n);
}

function shortText(value: string, max = 70) {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function getCacheKey(threadId: string, posts: ForumPost[]) {
  const latestPost = posts[posts.length - 1];
  return [
    threadId,
    posts.length,
    latestPost?.id ?? "",
    latestPost?.created_at ?? "",
  ].join(":");
}

function getCachedSummary(cacheKey: string) {
  const cached = threadSummaryCache.get(cacheKey);
  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    threadSummaryCache.delete(cacheKey);
    return null;
  }

  return cached.value;
}

function setCachedSummary(cacheKey: string, value: ThreadSummaryResponse) {
  const now = Date.now();

  for (const [key, entry] of threadSummaryCache.entries()) {
    if (entry.expiresAt <= now) {
      threadSummaryCache.delete(key);
    }
  }

  while (threadSummaryCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = threadSummaryCache.keys().next().value;
    if (!oldestKey) break;
    threadSummaryCache.delete(oldestKey);
  }

  threadSummaryCache.set(cacheKey, {
    value,
    expiresAt: now + CACHE_TTL_MS,
  });
}

function clampQualityScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreItem(
  text: string,
  kind: "premises" | "reasons" | "counterpoints",
  context: string,
  sourceType: SourceType = "extracted"
): number {
  const normalized = normalizeText(text);
  const contextWords = new Set(
    normalizeText(context).match(/[一-龠ぁ-んァ-ヶA-Za-z0-9]{2,}/g)?.slice(0, 12) ?? []
  );
  const textWords = normalized.match(/[一-龠ぁ-んァ-ヶA-Za-z0-9]{2,}/g) ?? [];

  let score = sourceType === "extracted" ? 58 : 42;

  if (normalized.length >= 18) score += 8;
  if (normalized.length >= 35) score += 8;
  if (normalized.length > 90) score -= 10;
  if (textWords.some((word) => contextWords.has(word))) score += 12;
  if (/[0-9０-９]|%|％|年|月|円|人|件|回/.test(text)) score += 8;
  if (/ため|ので|から|なら|場合|条件|根拠|理由|影響|必要/.test(text)) {
    score += 8;
  }
  if (
    kind === "counterpoints" &&
    /反対|別の|一方|懸念|不利益|十分でない|対立|反論/.test(text)
  ) {
    score += 10;
  }
  if (/この主張|別の見方|あり得る|確認する|共通の問題意識/.test(text)) {
    score -= 12;
  }
  if (normalized.length < 12) score -= 18;

  return clampQualityScore(score);
}

function toSourceItems(
  values: string[],
  sourceType: SourceType,
  kind: "premises" | "reasons" | "counterpoints",
  context: string
): SourceItem[] {
  return topN(values.map((value) => shortText(value)).filter(Boolean), 3).map((text) => ({
    text,
    source_type: sourceType,
    quality_score: scoreItem(text, kind, context, sourceType),
  }));
}

function inferItems(
  kind: "premises" | "reasons" | "counterpoints",
  context: string
): SourceItem[] {
  const target = shortText(context, 48) || "この主張";

  const templates: Record<typeof kind, string[]> = {
    premises: [
      `${target}が現実の状況に基づいていること`,
      `${target}について共通の問題意識があること`,
      `${target}を評価する前提条件が共有されていること`,
    ],
    reasons: [
      `${target}を支持する具体的な事実や経験があること`,
      `${target}によって改善される点があること`,
      `${target}を選ぶ合理的な理由があること`,
    ],
    counterpoints: [
      `${target}には別の見方や反対意見もあり得ること`,
      `${target}によって不利益を受ける立場があること`,
      `${target}の根拠が十分でないという反論があり得ること`,
    ],
  };

  return templates[kind].map((text) => ({
    text,
    source_type: "inferred" as const,
    quality_score: scoreItem(text, kind, context, "inferred"),
  }));
}

function ensureSourceItems(
  extractedValues: string[],
  kind: "premises" | "reasons" | "counterpoints",
  context: string
): SourceItem[] {
  const extracted = toSourceItems(extractedValues, "extracted", kind, context);
  if (extracted.length >= 1) return extracted.slice(0, 3);
  return inferItems(kind, context).slice(0, 1);
}

function ensureConflictPairs(
  opinions: string[],
  rebuttals: string[],
  context: string
): ConflictPair[] {
  if (opinions.length > 0 && rebuttals.length > 0) {
    const minLength = Math.min(opinions.length, rebuttals.length, 3);
    const pairs: ConflictPair[] = [];

    for (let i = 0; i < minLength; i++) {
      const opinion = shortText(opinions[i]);
      const rebuttal = shortText(rebuttals[i]);

      pairs.push({
        opinion,
        rebuttal,
        source_type: "extracted",
        quality_score: Math.min(
          scoreItem(opinion, "counterpoints", context, "extracted"),
          scoreItem(rebuttal, "counterpoints", context, "extracted")
        ),
      });
    }

    return pairs;
  }

  const inferred = inferItems("counterpoints", context)[0];
  return [
    {
      opinion: shortText(opinions[0] || context || "この主張"),
      rebuttal: inferred.text,
      source_type: "inferred",
      quality_score: inferred.quality_score,
    },
  ];
}

async function generateNormalSummaryWithAI(posts: ForumPost[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const inputText = posts
    .map((p, i) => `[${i + 1}] role=${p.post_role}\n${p.content}`)
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
  return "このスレッドは、まだ議論の整理が十分に進んでいません。";
}

return text;
}

async function generateEasySummaryWithAI(posts: ForumPost[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const inputText = posts
    .map((p, i) => `[${i + 1}] role=${p.post_role}\n${p.content}`)
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
    return "このスレッドの要点はまだ十分に整理されていません。";
  }

  return text;
}

function buildSimpleSummary(posts: ForumPost[]) {
  const issueRaises = posts.filter((p) => p.post_role === "issue_raise").map((p) => p.content);
  const opinions = posts.filter((p) => p.post_role === "opinion").map((p) => p.content);
  const rebuttals = posts.filter((p) => p.post_role === "rebuttal").map((p) => p.content);
  const supplements = posts.filter((p) => p.post_role === "supplement").map((p) => p.content);
  const explanations = posts.filter((p) => p.post_role === "explanation").map((p) => p.content);

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

  let debateState = "論点提起が中心で、議論はまだ初期段階。";

  if (counts.rebuttal > 0 && counts.opinion > 0) {
    debateState = "賛否や見解の違いが出始めており、議論が立体化している。";
  } else if (counts.opinion >= 2 && counts.rebuttal === 0) {
    debateState = "意見は増えているが、まだ本格的な反論は少ない。";
  } else if (counts.supplement + counts.explanation >= 2) {
    debateState = "論点の整理や補足情報が追加され、理解が進みつつある。";
  }

  const normalText = `${paragraphs.join(" ")} ${debateState}`.trim();
  const sourceContext = issueList[0] || opinionList[0] || posts[0]?.content || "この主張";

  const premiseItems = ensureSourceItems(
    [...issueList, ...supplementList],
    "premises",
    sourceContext
  );

  const reasonItems = ensureSourceItems(
    [...explanationList, ...opinionList],
    "reasons",
    sourceContext
  );

  const counterpointItems = ensureSourceItems(
    rebuttalList,
    "counterpoints",
    sourceContext
  );

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
      premises: premiseItems,
      reasons: reasonItems,
      counterpoints: counterpointItems,
    },
  };
}

function isImmatureSummaryText(text: string) {
  const normalized = text.replace(/\s+/g, "");
  return [
    "まだ議論の整理が十分に進んでいません",
    "まだAIまとめはありません",
    "議論の整理が十分に進んでいません",
    "まだ要約できるほど投稿が集まっていない",
  ].some((phrase) => normalized.includes(phrase.replace(/\s+/g, "")));
}

function buildProvisionalAnswer(
  summary: ReturnType<typeof buildSimpleSummary>,
  conflictPairs: ConflictPair[]
) {
  const discussionCount =
    summary.counts.opinion +
    summary.counts.rebuttal +
    summary.counts.supplement +
    summary.counts.explanation;

  if (summary.counts.total <= 1 || discussionCount === 0) {
    return "現時点では投稿が少ないため、AIの初期整理を叩き台として確認している段階です。";
  }

  const summaryText = summary.summary_text?.trim() ?? "";
  const wholeSummary = isImmatureSummaryText(summaryText)
    ? ""
    : shortText(summaryText, 140);
  const focusText =
    summary.key_points.issues[0] ||
    summary.key_points.reasons?.[0]?.text ||
    summary.key_points.explanations[0] ||
    summary.key_points.supplements[0] ||
    "";
  const remainingConcern =
    conflictPairs[0]?.rebuttal ||
    summary.key_points.rebuttals[0] ||
    summary.key_points.counterpoints?.[0]?.text ||
    "";

  if (wholeSummary && remainingConcern) {
    return `現時点では、単純な賛成・反対や成功・失敗で判断するより、「${wholeSummary}」という全体整理をもとに、前提・根拠・反論リスクを見比べる段階です。ただし、「${shortText(
      remainingConcern,
      70
    )}」という反論・リスクも残ります。論理性の目安として確認してください。`;
  }

  if (wholeSummary) {
    return `暫定的には、「${wholeSummary}」という全体整理をもとに確認できます。単一の立場に寄せず、前提・根拠・反論リスクを見比べる段階です。論理性の目安として見てください。`;
  }

  if (focusText && remainingConcern) {
    return `現時点では、単純な賛成・反対や成功・失敗で判断するより、「${shortText(
      focusText,
      70
    )}」を軸に、主要な主張・根拠・反論リスクを分けて確認する段階です。ただし、「${shortText(
      remainingConcern,
      70
    )}」という反論・リスクも残ります。論理性の目安として確認してください。`;
  }

  if (focusText) {
    return `現時点では、単純な賛成・反対や成功・失敗で判断するより、「${shortText(
      focusText,
      70
    )}」を軸に、主要な主張・根拠・反論リスクを分けて確認する段階です。論理性の目安として確認してください。`;
  }

  if (remainingConcern) {
    return `現時点では、単純な賛成・反対や成功・失敗で判断するより、主要な主張・根拠・反論リスクを分けて確認する段階です。ただし、「${shortText(
      remainingConcern,
      70
    )}」という反論・リスクも残ります。論理性の目安として確認してください。`;
  }

  return "現時点では、投稿内容と論点整理をもとに、どの見方が論理的に強いかを確認している段階です。";
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function buildStructureType(summary: ReturnType<typeof buildSimpleSummary>) {
  if (summary.counts.rebuttal > 0 && summary.counts.opinion > 0) {
    return "対立あり（意見 vs 反論が衝突中）";
  }

  if (summary.counts.supplement + summary.counts.explanation >= 2) {
    return "整理・解説フェーズ";
  }

  if (summary.counts.opinion >= 2) {
    return "意見集約中";
  }

  return "初期議論";
}

function buildSummaryResponse(
  summary: ReturnType<typeof buildSimpleSummary>,
  posts: ForumPost[]
): ThreadSummaryResponse {
  const conflict_pairs = ensureConflictPairs(
    summary.key_points.opinions,
    summary.key_points.rebuttals,
      summary.key_points.issues[0] ||
      summary.key_points.opinions[0] ||
      posts[0]?.content ||
      "この主張"
  );
  const provisional_answer = buildProvisionalAnswer(summary, conflict_pairs);

  return {
    success: true,
    summary: {
      ...summary,
      provisional_answer,
    },
    structure_type: buildStructureType(summary),
    conflict_pairs,
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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { success: false, error: "Supabase env is missing" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

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

    const safePosts = (posts ?? []) as ForumPost[];
    let summary = buildSimpleSummary(safePosts);
    const force = ["true", "1"].includes(
      (searchParams.get("force") ?? "").toLowerCase()
    );
    const cacheKey = getCacheKey(threadId, safePosts);

    if (!force) {
      const { data: existingSummary, error: existingSummaryError } = await supabase
        .from("thread_ai_structures")
        .select("summary_text, issues, opinions, rebuttals, supplements, explanations")
        .eq("thread_id", threadId)
        .maybeSingle();

      if (existingSummaryError) {
        console.warn("[thread-summary existing summary skipped]", existingSummaryError.message);
      }

      if (
        typeof existingSummary?.summary_text === "string" &&
        existingSummary.summary_text.trim()
      ) {
        const issues = asStringArray(existingSummary.issues);
        const opinions = asStringArray(existingSummary.opinions);
        const rebuttals = asStringArray(existingSummary.rebuttals);
        const supplements = asStringArray(existingSummary.supplements);
        const explanations = asStringArray(existingSummary.explanations);

        summary = {
          ...summary,
          summary_text: existingSummary.summary_text,
          key_points: {
            ...summary.key_points,
            issues: issues.length > 0 ? issues : summary.key_points.issues,
            opinions: opinions.length > 0 ? opinions : summary.key_points.opinions,
            rebuttals: rebuttals.length > 0 ? rebuttals : summary.key_points.rebuttals,
            supplements:
              supplements.length > 0 ? supplements : summary.key_points.supplements,
            explanations:
              explanations.length > 0 ? explanations : summary.key_points.explanations,
          },
        };

        return NextResponse.json({
          ...buildSummaryResponse(summary, safePosts),
          reused: true,
          source: "existing",
        });
      }

      const cached = getCachedSummary(cacheKey);
      if (cached) {
        return NextResponse.json({
          ...cached,
          cached: true,
          reused: true,
          source: "memory",
        });
      }
    }

    try {
      const normalAiText = await generateNormalSummaryWithAI(safePosts);

      summary = {
        ...summary,
        summary_text: normalAiText,
      };
    } catch (aiError) {
      console.error("[thread-summary ai fallback]", aiError);
    }

    const response = buildSummaryResponse(summary, safePosts);
    setCachedSummary(cacheKey, response);

    return NextResponse.json(response);


  } catch (e: any) {
    console.error("[thread-summary error]", e);

    return NextResponse.json(
      { success: false, error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
