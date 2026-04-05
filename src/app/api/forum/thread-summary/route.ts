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

  return {
    counts,
    summary_text: `${paragraphs.join(" ")} ${debateState}`.trim(),
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
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

const summary = buildSimpleSummary((posts ?? []) as ForumPost[]);





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