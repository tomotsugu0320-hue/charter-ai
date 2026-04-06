// src/app/api/forum/feedback/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_FEEDBACK_TYPES = [
  "term_unknown",
  "premise_unknown",
  "conclusion_unknown",
  "evidence_unknown",
  "counterargument_unknown",
] as const;

type AllowedFeedbackType = (typeof ALLOWED_FEEDBACK_TYPES)[number];

function isAllowedFeedbackType(value: string): value is AllowedFeedbackType {
  return ALLOWED_FEEDBACK_TYPES.includes(value as AllowedFeedbackType);
}

function buildInstruction(feedbackType: AllowedFeedbackType, content: string) {
  switch (feedbackType) {
    case "term_unknown":
      return `
次の投稿について、「言葉がわからん」と感じた読者向けに、
専門用語や分かりにくい表現をやさしく短く説明してください。
100文字以内、日本語、断定しすぎず、やさしい説明にしてください。

投稿:
${content}
      `.trim();

    case "premise_unknown":
      return `
次の投稿について、「前提がわからん」と感じた読者向けに、
この主張がどんな前提に立っているかをやさしく短く説明してください。
120文字以内、日本語、簡潔にしてください。

投稿:
${content}
      `.trim();

    case "conclusion_unknown":
      return `
次の投稿について、「結論がわからん」と感じた読者向けに、
この投稿が最終的に何を言いたいのかをやさしく短く説明してください。
100文字以内、日本語で簡潔にしてください。

投稿:
${content}
      `.trim();

    case "evidence_unknown":
      return `
次の投稿について、「根拠がわからん」と感じた読者向けに、
この主張で不足していそうな根拠やデータの種類をやさしく短く説明してください。
120文字以内、日本語で簡潔にしてください。

投稿:
${content}
      `.trim();

    case "counterargument_unknown":
      return `
次の投稿について、「反対意見がわからん」と感じた読者向けに、
考えられる別視点や反対意見の方向性をやさしく短く説明してください。
120文字以内、日本語で簡潔にしてください。

投稿:
${content}
      `.trim();
  }
}

async function generateExplanation(
  feedbackType: AllowedFeedbackType,
  content: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    // APIキー未設定時のフォールバック
    switch (feedbackType) {
      case "term_unknown":
        return "この部分では専門用語や表現がやや分かりにくい可能性があります。";
      case "premise_unknown":
        return "この意見は、共有されていない前提条件に立っている可能性があります。";
      case "conclusion_unknown":
        return "この意見は、結論に至る流れが省略されている可能性があります。";
      case "evidence_unknown":
        return "この主張には、根拠やデータの補足が必要な可能性があります。";
      case "counterargument_unknown":
        return "この主張には、別の見方や反対意見も考えられる可能性があります。";
    }
  }

  const prompt = buildInstruction(feedbackType, content);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      input: prompt,
    }),
  });

const result = await response.json();
console.log("OpenAI raw:", result);

if (!response.ok) {
  throw new Error(result?.error?.message || "OpenAI explanation generation failed");
}


let explanation = "";

const contentArr = result?.output?.[0]?.content;

if (Array.isArray(contentArr)) {
  const textItem = contentArr.find((c: any) => c.type === "output_text");

  if (textItem?.text) {
    explanation = textItem.text;
  }
}

if (!explanation && result?.error?.message) {
  explanation = `OpenAI error: ${result.error.message}`;
}

if (!explanation) {
  explanation = "説明の生成に失敗しました。もう一度試してください。";
}

return explanation;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const threadId = String(body?.threadId ?? "").trim();
    const postId = String(body?.postId ?? "").trim();
    const feedbackType = String(body?.feedbackType ?? "").trim();

    if (!threadId) {
      return NextResponse.json(
        { success: false, error: "threadId is required" },
        { status: 400 }
      );
    }

    if (!postId) {
      return NextResponse.json(
        { success: false, error: "postId is required" },
        { status: 400 }
      );
    }

    if (!isAllowedFeedbackType(feedbackType)) {
      return NextResponse.json(
        { success: false, error: "invalid feedbackType" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: feedbackData, error: feedbackError } = await supabase
      .from("forum_post_feedback")
      .insert({
        thread_id: threadId,
        post_id: postId,
        feedback_type: feedbackType,
      })
      .select("id, thread_id, post_id, feedback_type, created_at");

    if (feedbackError) {
      return NextResponse.json(
        { success: false, error: feedbackError.message },
        { status: 500 }
      );
    }

    const { data: postData, error: postError } = await supabase
      .from("forum_posts")
      .select("content")
      .eq("id", postId)
      .single();

    if (postError) {
      return NextResponse.json(
        { success: false, error: postError.message },
        { status: 500 }
      );
    }

    const content = String(postData?.content ?? "").trim();

    if (!content) {
      return NextResponse.json(
        { success: false, error: "post content not found" },
        { status: 404 }
      );
    }

    const explanation = await generateExplanation(feedbackType, content);

    return NextResponse.json({
      success: true,
      feedback: feedbackData ?? [],
      explanation,
    });
  } catch (e: any) {
    console.error("[forum feedback error]", e);

    return NextResponse.json(
      { success: false, error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

