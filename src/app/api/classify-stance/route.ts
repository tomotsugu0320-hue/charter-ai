import { NextResponse } from "next/server";

type StanceResponse = {
  stance_label?: string | null;
  note?: string;
};

export async function POST(req: Request) {
  try {
    const { issueTitle, sideA, sideB, postContent } = await req.json();
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          stance_label: "unknown",
          note: "OPENAI_API_KEY is not set",
        },
        { status: 500 }
      );
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `
あなたは投稿の立場を分類するAIです。

以下の論点と投稿内容をもとに、
必ず以下のいずれか1つを選んでください：

- side_a
- side_b
- neutral
- unknown

【最重要ルール】
・必ずどれか1つを選ぶこと
・side_a または side_b を最優先で選択すること
・迷った場合でも必ず side_a か side_b のどちらかに寄せること
・unknown は「完全に意味不明・情報ゼロ」の場合のみ許可

【判断基準】
・投稿がポジティブに近いなら side_a
・ネガティブまたは否定的なら side_b
・両方の要素がある場合はより強い方に寄せる
・少しでもどちらかに傾いていれば必ずその側に分類する

出力はJSONのみ：

{
  "stance_label": "side_a" または "side_b" または "neutral" または "unknown"
}
`,
          },
{
  role: "user",
  content: `
論点: ${issueTitle}

立場A: ${sideA}
立場B: ${sideB}

投稿:
${postContent}

この投稿はどの立場か？
`,
},
        ],
      }),
    });

    const data = await res.json();
    const message = data.choices?.[0]?.message?.content ?? "{}";

    let parsed: StanceResponse;

    try {
      parsed = JSON.parse(message);
    } catch {
      parsed = {
        stance_label: "unknown",
        note: "Failed to parse AI response",
      };
    }

    const allowed = new Set(["side_a", "side_b", "neutral", "unknown"]);
    const stanceLabel =
      parsed.stance_label && allowed.has(parsed.stance_label)
        ? parsed.stance_label
        : "unknown";

    return NextResponse.json({
      stance_label: stanceLabel,
      note: parsed.note ?? "",
    });
  } catch (error) {
    console.error("classify-stance route error:", error);

    return NextResponse.json(
      {
        stance_label: "unknown",
        note: "stance api error",
      },
      { status: 500 }
    );
  }
}