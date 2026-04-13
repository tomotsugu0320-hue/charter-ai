//   src/app/api/forum/thread-suggestions/route.ts


import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function normalizeText(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[！!？?。、，,\.\-\—]/g, " ")
    .replace(/\s+/g, " ");
}

function buildKeywords(input: string) {
  const normalized = normalizeText(input);

  return Array.from(
    new Set(
      normalized
        .split(" ")
        .map((x) => x.trim())
        .filter((x) => x.length >= 2)
    )
  ).slice(0, 5);
}

function calcSimilarityScore(input: string, title: string, summary: string | null) {
  const source = normalizeText(input);
  const target = normalizeText(`${title} ${summary ?? ""}`);

  const sourceKeywords = buildKeywords(source);
  if (sourceKeywords.length === 0) return 0;

  let hit = 0;
  for (const kw of sourceKeywords) {
    if (target.includes(kw)) hit += 1;
  }

  return Number((hit / sourceKeywords.length).toFixed(2));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = String(body?.text ?? "").trim();

    if (!text) {
      return NextResponse.json(
        { success: false, error: "text is required" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { success: false, error: "Supabase env is missing" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);


// 1) 生の提案を保存
const { data: insertedSuggestion, error: insertError } = await supabase
  .from("thread_suggestions")
.insert({
  proposed_text: text,
})
  .select("id")
  .single();


    if (insertError) {
      console.error("[thread_suggestions insert error]", insertError);
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500 }
      );
    }

    // 2) ざっくり類似検索
    const keywords = buildKeywords(text);

    let query = supabase
      .from("forum_threads")
      .select("id, title, ai_summary, created_at")
      .order("created_at", { ascending: false })
      .limit(30);

    // いったん title の全文LIKEベース
    // 複数OR条件を簡易で組む
    if (keywords.length > 0) {
      const orConditions = keywords.map((kw) => `title.ilike.%${kw}%`).join(",");
      query = query.or(orConditions);
    }

    const { data: threads, error: threadError } = await query;

    if (threadError) {
      console.error("[forum_threads search error]", threadError);
      return NextResponse.json(
        { success: false, error: threadError.message },
        { status: 500 }
      );
    }

    // 3) 類似度計算
    const suggestions = (threads ?? [])
      .map((thread) => {
        const similarity_score = calcSimilarityScore(
          text,
          thread.title ?? "",
          thread.ai_summary ?? null
        );

        return {
          id: thread.id,
          title: thread.title ?? "",
          ai_summary: thread.ai_summary ?? null,
          similarity_score,
        };
      })
      .filter((x) => x.similarity_score > 0)
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, 5);

    const shouldCreate = suggestions.length === 0;

    return NextResponse.json({
      success: true,
      input: text,
      suggestionId: insertedSuggestion.id,
      suggestions,
      shouldCreate,
    });
  } catch (error: any) {
    console.error("[thread-suggestions route error]", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Unexpected error",
      },
      { status: 500 }
    );
  }
}