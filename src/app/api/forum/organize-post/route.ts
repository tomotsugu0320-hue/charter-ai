//   src/app/api/forum/organize-post/route.ts


import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = String(body?.text ?? "").trim();

    if (!text) {
      return NextResponse.json(
        { error: "text is required" },
        { status: 400 }
      );
    }

    const prompt = `
あなたは、AI掲示板の投稿補助AIです。
ユーザーの文章を「意味を変えずに」「読みやすく」「掲示板向けに」整えてください。

## 目的
- ユーザーの考えを、他人が読みやすい形に整える
- 主張の意味は変えない
- 過度に賢そうな文章にしない
- 感情的・攻撃的な表現は少し和らげる
- 断定しすぎる表現は必要に応じて弱める
- ただし、内容を勝手に捏造しない

## summary のルール
- 2〜4行程度
- 要点だけ簡潔に
- 箇条書きでもよい
- 難しい言い回しは避ける

## postText のルール
- 掲示板にそのまま貼れる自然な文章
- 2〜5文程度
- 主張が読み取りやすい構成にする
- もとの意味・立場は維持する
- データや事実を勝手に追加しない
- 元の文にない断定を増やさない

## 出力形式
必ず次のJSONだけを返してください。前置き不要。

{
  "summary": "要点まとめ",
  "postText": "掲示板掲載文"
}

## 入力文
${text}
`;

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
    });

    const rawText =
      response.output_text?.trim() ||
      '{"summary":"要点整理に失敗しました。","postText":"投稿文の整形に失敗しました。"}';

    let parsed: { summary: string; postText: string };

    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      console.error("[organize-post parse error]", rawText);
      parsed = {
        summary: "要点整理に失敗しました。",
        postText: text,
      };
    }

    return NextResponse.json({
      summary: String(parsed.summary ?? "").trim(),
      postText: String(parsed.postText ?? "").trim() || text,
    });
  } catch (error) {
    console.error("[organize-post]", error);
    return NextResponse.json(
      { error: "failed to organize post" },
      { status: 500 }
    );
  }
}