import { NextResponse } from "next/server";

type StructureResponse = {
  side_a?: string;
  side_b?: string;
  core_conflict?: string;
};

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          side_a: "API key missing",
          side_b: "API key missing",
          core_conflict: "OPENAI_API_KEY is not set",
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
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `
You are a debate structure AI.

Read the issue title and related posts, then extract:
- side_a: one short summary of one major position
- side_b: one short summary of the opposing or contrasting position
- core_conflict: one short sentence describing the core disagreement

Return JSON only:

{
  "side_a": "...",
  "side_b": "...",
  "core_conflict": "..."
}
`,
          },
          {
            role: "user",
            content: text,
          },
        ],
      }),
    });

    const data = await res.json();
    const message = data.choices?.[0]?.message?.content ?? "{}";

    let parsed: StructureResponse;

    try {
      parsed = JSON.parse(message);
    } catch {
      parsed = {
        side_a: "立場Aの抽出に失敗",
        side_b: "立場Bの抽出に失敗",
        core_conflict: "争点の抽出に失敗",
      };
    }

    return NextResponse.json({
      side_a: parsed.side_a ?? "",
      side_b: parsed.side_b ?? "",
      core_conflict: parsed.core_conflict ?? "",
    });
  } catch (error) {
    console.error("issue-structure route error:", error);

    return NextResponse.json(
      {
        side_a: "",
        side_b: "",
        core_conflict: "構造抽出APIエラー",
      },
      { status: 500 }
    );
  }
}