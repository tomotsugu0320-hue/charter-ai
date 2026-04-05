import { NextResponse } from "next/server";

type VerifyResponse = {
  status?: string;
  reason_type?: string | string[] | null;
  note?: string;
};

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          status: "weak",
          reason_type: "data_insufficient",
          note: "OPENAI_API_KEY が設定されていません",
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
You are an issue verification AI.

IMPORTANT:
- Always respond in Japanese.
- note must be written in natural Japanese.
- Do NOT use English in note.

Return JSON in this format:

{
  "status": "verified" | "disputed" | "weak",
  "reason_type": ["premise_difference"] | ["definition_difference"] | ["data_insufficient"] | ["value_judgment"] | ["timeframe_mismatch"] | ["causal_uncertain"] | null,
  "note": "日本語で1文"
}

Rules:
- verified: the claim is reasonably supported
- disputed: interpretation depends on perspective
- weak: insufficient evidence

Return JSON only.
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

    let parsed: VerifyResponse;

    try {
      parsed = JSON.parse(message);
    } catch {
      parsed = {
        status: "disputed",
        reason_type: "data_insufficient",
        note: "AIの応答解析に失敗",
      };
    }

    const newStatus =
      parsed.status === "verified"
        ? "verified"
        : parsed.status === "disputed"
        ? "disputed"
        : "weak";

    const allowedReasonTypes = new Set([
      "premise_difference",
      "definition_difference",
      "data_insufficient",
      "value_judgment",
      "timeframe_mismatch",
      "causal_uncertain",
    ]);

    let normalizedReasonType: string[] | null = null;

    if (Array.isArray(parsed.reason_type)) {
      normalizedReasonType = parsed.reason_type.filter((r) =>
        allowedReasonTypes.has(r)
      );
    } else if (typeof parsed.reason_type === "string") {
      if (allowedReasonTypes.has(parsed.reason_type)) {
        normalizedReasonType = [parsed.reason_type];
      }
    }

    return NextResponse.json({
      status: newStatus,
      reason_type: normalizedReasonType,
      note: parsed.note ?? "判定理由なし",
    });
  } catch (error) {
    console.error("verify route error:", error);

    return NextResponse.json(
      {
        status: "weak",
        reason_type: "data_insufficient",
        note: "検証APIエラー",
      },
      { status: 500 }
    );
  }
}