import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { content, postId, force } = await req.json();

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "content がありません。" },
        { status: 400 }
      );
    }

    if (postId && force !== true) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data, error } = await supabase
        .from("posts")
        .select("ai_summary")
        .eq("id", postId)
        .maybeSingle();

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }

      const existingSummary = String(data?.ai_summary ?? "").trim();

      if (existingSummary) {
        return NextResponse.json({
          success: true,
          summary: existingSummary,
          reused: true,
          source: "existing",
        });
      }
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY が未設定です。" },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `
以下の文章を構造整理してください。

【主題】
【前提】
【混同している点】
【別視点】

※結論は出さない
※短く整理する

文章:
${content}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const summary = completion.choices[0]?.message?.content ?? "";

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("bbs summary api error:", error);

    return NextResponse.json(
      { error: "AI整理APIでエラーが発生しました。" },
      { status: 500 }
    );
  }
}
