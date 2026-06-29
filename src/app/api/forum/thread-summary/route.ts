// src/app/api/forum/thread-summary/route.ts



import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActiveForumBetaSessionUser } from "@/lib/forum-auth";
import { getErrorMessage, recordForumApiUsageLog } from "@/lib/forum-api-usage";
import { ECONOMIC_POLICY_ANALYSIS_FRAME_PROMPT } from "@/lib/forum/economic-policy-analysis-frame";

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

type SaveThreadSummaryResult = {
  saved: boolean;
  save_error?: string;
};

type ThreadForSummarySave = {
  id: string;
  title: string | null;
  original_post: string | null;
  created_at: string | null;
};

type CachedThreadSummary = {
  value: ThreadSummaryResponse;
  expiresAt: number;
};

type ThreadSummaryUsageContext = {
  threadId?: string | null;
  userId?: string | null;
};

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_SIZE = 100;
const SUMMARY_REFRESH_INTERVAL_DAYS = 7;
const SUMMARY_REFRESH_INTERVAL_MS =
  SUMMARY_REFRESH_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
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

async function generateNormalSummaryWithAI(
  posts: ForumPost[],
  usageContext: ThreadSummaryUsageContext = {},
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const inputText = posts
    .map((p, i) => `[${i + 1}] role=${p.post_role}\n${p.content}`)
    .join("\n\n");

  const prompt = `
${ECONOMIC_POLICY_ANALYSIS_FRAME_PROMPT}

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
- 3層全体で400〜900文字程度
- 誇張しない
- 投稿にないことは断定しない
- 出力は本文だけ。前置きやJSONは不要。ただし「結：現時点の答え」用の3層見出しは必ず使う

経済政策、特に賃金・労働生産性・価格転嫁・物価・雇用・人手不足に関する投稿では、一般的な両論併記で終わらず、必ず以下を確認してください。
- この議論はインフレ局面か、デフレ局面か
- 需要不足か、需要超過か
- 労働市場は人手不足か、労働余剰か
- 失業率は上昇圧力か、低下圧力か
- 生産性向上が雇用拡大に使われる局面か、人員削減に使われる局面か
- 賃金上昇が物価上昇を上回る可能性があるか
- 価格転嫁が実質賃金・消費・企業収益にどう影響するか

賃金上昇については、次の因果順序を確認してください。
インフレ・需要増 → 労働需要増 → 人手不足 → 失業率低下 → 労働者の交渉力上昇 → 賃金上昇 → 企業が省力化・設備投資・業務改革・価格転嫁を迫られる → 生産性向上圧力。

一方で、デフレ・需要不足下では次のリスクも確認してください。
需要不足 → 売上期待が弱い → 生産性向上が省人化・人件費削減に使われる → 労働需要低下 → 失業率悪化 → 賃金停滞 → 所得減 → 消費低迷 → デフレ圧力。

回答・要約では、可能な範囲で、問いの再定義、不足している前提、景気局面別の整理、因果順序、暫定回答、注意点を反映してください。
禁止:
- 「どちらも一理あります」だけで終わること
- 景気局面を確認せず一般論でまとめること
- 生産性向上を常に賃金上昇につながるものとして扱うこと
- 価格転嫁を単純に悪と決めつけること
- 人手不足や失業率を無視して賃金論を語ること
- 権威者の発言だから正しいと扱うこと
- ミクロ企業会計で正しい主張を、マクロ経済政策でも常に正しいものとして扱うこと

承・転に相当する内容を本文に含める場合の品質ルール:
- 根拠は「財政支出を増やすと経済が活性化する可能性がある」のような一般論だけで終わらせないでください。
- 需要不足か需要超過か、実質賃金、個人消費、雇用、物価上昇の原因、増税や緊縮のタイミング、財政支出と需要の関係を、できるだけ因果関係としてつないでください。
- 財政・消費税・デフレ関連では、必要に応じて、1997年消費税増税後の消費や実質GDPの弱まり、2014年消費税増税後の個人消費の落ち込み、2019年消費税増税後はコロナが重なり増税単独の検証が難しい点を根拠候補として扱ってください。ただし断定しすぎず、影響を検証する必要があると書いてください。
- 消費税・財政・デフレ関連では、前提として、現在の物価高が需要超過型なのか輸入物価・円安型なのか、実質賃金と個人消費が弱い局面か、減税の対象・期間・財源をどう分けるかを確認してください。
- 反論は元の主張の繰り返しにせず、可能な限り「反論A：財源問題」「反論B：将来増税予想」「反論C：インフレ再燃・円安リスク」の形で書いてください。
- 反論Aでは、消費税減税で減った税収をどう補うか、社会保障財源との関係を説明してください。
- 反論Bでは、国債で減税を賄う場合に、将来増税を予想した家計が消費を増やさず貯蓄に回す可能性を説明してください。
- 反論Cでは、需要刺激が強すぎると輸入物価や円安を通じて物価上昇を招く可能性を説明し、需要不足局面では限定的な場合もあると補足してください。
- 金利上昇リスク、為替リスク、無駄遣いリスク、クラウディングアウト、リカードの等価定理、財政健全化論、供給力不足下で需要刺激すると物価だけ上がるリスクも、投稿内容に合う場合は反論候補にしてください。
- 専門用語を使う場合は、一言説明を添えてください。
- 「一概には言えない」「バランスが重要」だけで終わらせないでください。
- 「しかし、注意が必要です」「しかし、懸念があります」のような抽象文を複数並べるだけにしないでください。

「結：現時点の答え」として使える本文は、必ず同じ1回のAI生成結果の中に、次の3層見出しで書いてください。
起・承・転はここでは作り替えず、結に当たる答えだけを3層化します。
3層化のために別回答や追加生成が必要な形にはしないでください。

【誰でも分かる説明】
- 専門用語を使わず、中学生にも分かる言葉で短く結論を示す。
- 具体例やたとえ話を使い、「結局どういうこと？」に先に答える。
- 目安は80〜160字程度に抑える。

【もう少し詳しい説明】
- 需要、供給、賃金、物価、雇用、消費の関係で説明する。
- 専門用語を使う場合は、直後に一言説明を添える。
- 経済・政策テーマでは、物価高の原因が需要超過型か、供給制約・輸入物価型かを分ける。
- 実質賃金、雇用、個人消費を確認し、利上げ・増税・減税の判断を景気局面ごとに分ける。
- 目安は180〜300字程度に抑える。

【深層・専門的な補足】
- 理論名、モデル名、反論、専門的な補足を入れてよい。
- AD-ASモデル、フィリップス曲線、リカードの等価定理、乗数効果などを使う場合は、簡単な説明を添える。
- 反論では、財源問題、将来増税予想、インフレ再燃リスクなども必要に応じて扱う。
- 専門用語だけを並べず、一般読者向けの本文を難しくしない。
- 初期実装では長くしすぎず、目安は300〜500字程度に抑える。

投稿:
${inputText}
`.trim();

  const model = "gpt-5.4-mini";
  let data: any;
  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: prompt,
      }),
    });

    data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error?.message || "OpenAI summary generation failed");
    }

    await recordForumApiUsageLog({
      featureKey: "thread_summary",
      routePath: "/api/forum/thread-summary",
      model,
      promptVersion: "thread_summary_v1",
      targetType: "thread",
      targetId: usageContext.threadId ?? null,
      userId: usageContext.userId ?? null,
      inputText: prompt,
      outputText: data?.output_text ?? "",
      usage: data?.usage,
      status: "success",
    });
  } catch (error) {
    await recordForumApiUsageLog({
      featureKey: "thread_summary",
      routePath: "/api/forum/thread-summary",
      model,
      promptVersion: "thread_summary_v1",
      targetType: "thread",
      targetId: usageContext.threadId ?? null,
      userId: usageContext.userId ?? null,
      inputText: prompt,
      status: "error",
      errorMessage: getErrorMessage(error),
    });
    throw error;
  }


const text = data?.output_text?.trim();
if (!text) {
  return "このスレッドは、まだ議論の整理が十分に進んでいません。";
}

return text;
}

async function generateEasySummaryWithAI(
  posts: ForumPost[],
  usageContext: ThreadSummaryUsageContext = {},
) {
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

  const model = "gpt-5.4-mini";
  let data: any;
  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: prompt,
      }),
    });

    data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error?.message || "OpenAI easy summary generation failed");
    }

    await recordForumApiUsageLog({
      featureKey: "thread_summary_easy",
      routePath: "/api/forum/thread-summary",
      model,
      promptVersion: "thread_summary_easy_v1",
      targetType: "thread",
      targetId: usageContext.threadId ?? null,
      userId: usageContext.userId ?? null,
      inputText: prompt,
      outputText: data?.output_text ?? "",
      usage: data?.usage,
      status: "success",
    });
  } catch (error) {
    await recordForumApiUsageLog({
      featureKey: "thread_summary_easy",
      routePath: "/api/forum/thread-summary",
      model,
      promptVersion: "thread_summary_easy_v1",
      targetType: "thread",
      targetId: usageContext.threadId ?? null,
      userId: usageContext.userId ?? null,
      inputText: prompt,
      status: "error",
      errorMessage: getErrorMessage(error),
    });
    throw error;
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

function hasLayeredProvisionalAnswerText(text: string) {
  return (
    text.includes("【誰でも分かる説明】") &&
    text.includes("【もう少し詳しい説明】") &&
    text.includes("【深層・専門的な補足】")
  );
}

function buildProvisionalAnswer(
  summary: ReturnType<typeof buildSimpleSummary>,
  conflictPairs: ConflictPair[]
) {
  const summaryText = summary.summary_text?.trim() ?? "";

  if (hasLayeredProvisionalAnswerText(summaryText)) {
    return summaryText;
  }

  const discussionCount =
    summary.counts.opinion +
    summary.counts.rebuttal +
    summary.counts.supplement +
    summary.counts.explanation;

  if (summary.counts.total <= 1 || discussionCount === 0) {
    return "現時点では投稿が少ないため、AIの初期整理を叩き台として確認している段階です。";
  }

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

async function saveThreadSummary(
  supabase: any,
  threadId: string,
  summary: ReturnType<typeof buildSimpleSummary>
) : Promise<SaveThreadSummaryResult> {
  const { data: thread, error: threadError } = await supabase
    .from("forum_threads")
    .select("id, title, original_post, created_at")
    .eq("id", threadId)
    .maybeSingle();

  if (threadError) {
    const message = threadError.message || "Failed to load thread for summary save";
    console.error("[thread-summary save thread load failed]", message);
    return { saved: false, save_error: message };
  }

  const threadRow = (thread ?? null) as ThreadForSummarySave | null;
  const originalPost =
    threadRow?.original_post?.trim() ||
    threadRow?.title?.trim() ||
    summary.summary_text?.trim() ||
    "保存済みAIまとめ";
  const normalizedTheme =
    threadRow?.title?.trim() ||
    shortText(summary.summary_text, 80) ||
    "forum-thread-summary";
  const keyPoints = {
    issues: summary.key_points.issues,
    opinions: summary.key_points.opinions,
    rebuttals: summary.key_points.rebuttals,
    supplements: summary.key_points.supplements,
    explanations: summary.key_points.explanations,
  };
  const payload = {
    thread_id: threadId,
    original_post: originalPost,
    normalized_theme: normalizedTheme,
    summary_text: summary.summary_text,
    easy_summary_text:
      summary.easy_summary_text || shortText(summary.summary_text, 160),
    key_points: keyPoints,
    issues: summary.key_points.issues,
    opinions: summary.key_points.opinions,
    rebuttals: summary.key_points.rebuttals,
    supplements: summary.key_points.supplements,
    explanations: summary.key_points.explanations,
    trust_status: "trusted",
    status: "active",
    summary_type: "thread_summary",
    source_post_count: summary.counts.total,
    updated_at: new Date().toISOString(),
  };

  const { data: existingRow, error: selectError } = await supabase
    .from("thread_ai_structures")
    .select("thread_id")
    .eq("thread_id", threadId)
    .maybeSingle();

  if (selectError) {
    const message = selectError.message || "Failed to check existing summary";
    console.error("[thread-summary save check failed]", message);
    return { saved: false, save_error: message };
  }

  const saveQuery = existingRow
    ? supabase
        .from("thread_ai_structures")
        .update(payload)
        .eq("thread_id", threadId)
    : supabase.from("thread_ai_structures").insert(payload);

  const { error: saveError } = await saveQuery.select("thread_id").maybeSingle();

  if (!saveError) {
    return { saved: true };
  }

  if (!existingRow && saveError.code === "23505") {
    const { error: retryError } = await supabase
      .from("thread_ai_structures")
      .update(payload)
      .eq("thread_id", threadId)
      .select("thread_id")
      .maybeSingle();

    if (!retryError) {
      return { saved: true };
    }

    const retryMessage = retryError.message || "Failed to update summary";
    console.error("[thread-summary save retry failed]", retryMessage);
    return { saved: false, save_error: retryMessage };
  }

  const message = saveError.message || "Failed to save summary";
  console.error("[thread-summary save failed]", message);
  return { saved: false, save_error: message };
}

export async function GET(req: NextRequest) {
  try {
    const activeUser = await getActiveForumBetaSessionUser(req);
    if (!activeUser.ok) {
      return NextResponse.json(
        { ok: false, error: activeUser.error },
        { status: activeUser.status }
      );
    }

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
    const forceParam = (searchParams.get("force") ?? "").toLowerCase();
    const hardForce = forceParam === "hard";
    const cacheKey = getCacheKey(threadId, safePosts);

    if (!hardForce) {
      const { data: existingSummary, error: existingSummaryError } = await supabase
        .from("thread_ai_structures")
        .select(
          "summary_text, issues, opinions, rebuttals, supplements, explanations, updated_at, source_post_count"
        )
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

        const updatedAtMs = new Date(existingSummary.updated_at ?? "").getTime();
        const nextRefreshAtMs = updatedAtMs + SUMMARY_REFRESH_INTERVAL_MS;
        const savedPostCount = Number(existingSummary.source_post_count);
        const isFresh =
          Number.isFinite(updatedAtMs) && Date.now() < nextRefreshAtMs;
        const isSamePostCount =
          Number.isFinite(savedPostCount) && savedPostCount === safePosts.length;

        if (isFresh && isSamePostCount) {
          const response = buildSummaryResponse(summary, safePosts);

          return NextResponse.json({
            ...response,
            reused: true,
            source: "existing",
            skipped_generation: true,
            next_refresh_at: new Date(nextRefreshAtMs).toISOString(),
            refresh_interval_days: SUMMARY_REFRESH_INTERVAL_DAYS,
            saved: true,
          });
        }
      }

      const cached = getCachedSummary(cacheKey);
      if (cached) {
        const saveResult = await saveThreadSummary(
          supabase,
          threadId,
          cached.summary
        );

        return NextResponse.json({
          ...cached,
          cached: true,
          reused: true,
          source: "memory",
          ...saveResult,
        });
      }
    }

    try {
      const normalAiText = await generateNormalSummaryWithAI(safePosts, {
        threadId,
        userId: activeUser.user.id,
      });

      summary = {
        ...summary,
        summary_text: normalAiText,
      };
    } catch (aiError) {
      console.error("[thread-summary ai fallback]", aiError);
    }

    const response = buildSummaryResponse(summary, safePosts);
    const saveResult = await saveThreadSummary(supabase, threadId, summary);
    setCachedSummary(cacheKey, response);

    return NextResponse.json({
      ...response,
      ...saveResult,
    });


  } catch (e: any) {
    console.error("[thread-summary error]", e);

    return NextResponse.json(
      { success: false, error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
