import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const LOGIC_BREAK_TYPES = [
  "none",
  "emotional",
  "authority_based",
  "weak_causality",
  "unclear_premise",
  "off_topic",
  "other",
] as const;

type LogicBreakType = (typeof LOGIC_BREAK_TYPES)[number];

type LogicScoreResult = {
  logic_score: number;
  logic_score_reason: string;
  logic_break_type: LogicBreakType;
  logic_break_note: string;
};

function clampScore(value: unknown) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 50;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeBreakType(value: unknown): LogicBreakType {
  const type = String(value ?? "").trim();
  return LOGIC_BREAK_TYPES.includes(type as LogicBreakType)
    ? (type as LogicBreakType)
    : "other";
}

function extractOutputText(json: any) {
  return (
    json?.output_text ??
    json?.output?.[0]?.content?.[0]?.text ??
    ""
  );
}

async function evaluateLogicScore(
  content: string,
  postRole: string
): Promise<LogicScoreResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      instructions: `
あなたは掲示板投稿のAI論理スコアを評価する採点者です。
投稿を0から100点で採点してください。

このスコアは絶対的な正解判定ではありません。
ただし、この掲示板では読む順番・表示優先度の重要基準として扱います。

評価基準:
- 日本国内の政治的空気、慣習、財源論、家計簿財政論、感情論、権威論ではなく、国際的に共有される標準的なマクロ経済理論・ミクロ経済理論に基づいて評価する
- 日本の制度、人口構造、労働慣行、政治制約は、理論を適用する際の条件として考慮する
- 感情的に理解できる主張と、経済理論上の論理性は分けて評価する
- 弱者保護などの価値判断は尊重するが、それだけでは高スコアにしない

高く評価する要素:
- 前提が明確
- 因果関係がある
- 需給関係、インセンティブ、短期効果と長期効果、景気局面を考慮している
- 労働移動、生産性、金融政策と財政政策の関係を適切に扱っている
- 反論や弱点も考慮している
- 感情論ではなく、制度設計や代替案まで示している
- 日本の現実条件を考慮しつつも、評価基準そのものは世界標準の経済理論に置いている

低く評価する要素:
- 「かわいそう」「ひどい」「守るべき」だけで因果関係がない
- 「財源がない」「国の借金があるから無理」だけで政策効果を検討していない
- 「有名人が言っている」「政府が言っている」「みんなそう思っている」など権威依存が強い
- 日本国内の常識だけを前提にして、標準的な経済理論との整合性を検討していない
- 景気局面、需給、インセンティブ、短期/長期効果を無視している

必ずJSONのみで返してください。
logic_break_type は次のいずれかです:
none, emotional, authority_based, weak_causality, unclear_premise, off_topic, other
      `.trim(),
      input: `
投稿分類: ${postRole}

投稿本文:
${content}
      `.trim(),
      temperature: 0,
      text: {
        format: {
          type: "json_schema",
          name: "logic_score_result",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              logic_score: {
                type: "number",
                minimum: 0,
                maximum: 100,
              },
              logic_score_reason: {
                type: "string",
              },
              logic_break_type: {
                type: "string",
                enum: LOGIC_BREAK_TYPES,
              },
              logic_break_note: {
                type: "string",
              },
            },
            required: [
              "logic_score",
              "logic_score_reason",
              "logic_break_type",
              "logic_break_note",
            ],
          },
          strict: true,
        },
      },
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenAI API error: ${errorText}`);
  }

  const json = await res.json();
  const outputText = extractOutputText(json);

  if (!outputText) {
    throw new Error("OpenAI did not return logic score JSON");
  }

  let parsed: any;

  try {
    parsed = JSON.parse(outputText);
  } catch {
    throw new Error("Failed to parse OpenAI logic score JSON");
  }

  return {
    logic_score: clampScore(parsed.logic_score),
    logic_score_reason: String(parsed.logic_score_reason ?? "").trim(),
    logic_break_type: normalizeBreakType(parsed.logic_break_type),
    logic_break_note: String(parsed.logic_break_note ?? "").trim(),
  };
}

export async function POST(req: NextRequest) {
  if (req.headers.get("x-admin-key") !== process.env.ADMIN_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const body = await req.json();
    const postId = String(body?.postId ?? "").trim();

    if (!postId) {
      return NextResponse.json(
        { success: false, error: "postId is required" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: post, error: postError } = await supabase
      .from("forum_posts")
      .select("id, content, post_role")
      .eq("id", postId)
      .maybeSingle();

    if (postError) {
      return NextResponse.json(
        { success: false, error: postError.message },
        { status: 500 }
      );
    }

    if (!post) {
      return NextResponse.json(
        { success: false, error: "post not found" },
        { status: 404 }
      );
    }

    const content = String(post.content ?? "").trim();

    if (!content) {
      return NextResponse.json(
        { success: false, error: "post content is empty" },
        { status: 400 }
      );
    }

    const result = await evaluateLogicScore(
      content,
      String(post.post_role ?? "opinion")
    );

    const { data: updatedPost, error: updateError } = await supabase
      .from("forum_posts")
      .update({
        logic_score: result.logic_score,
        logic_score_reason: result.logic_score_reason,
        logic_break_type: result.logic_break_type,
        logic_break_note: result.logic_break_note,
      })
      .eq("id", postId)
      .select(
        "id, post_role, logic_score, logic_score_reason, logic_break_type, logic_break_note"
      )
      .maybeSingle();

    if (updateError) {
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      post: updatedPost,
      evaluated: true,
      source: "openai",
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "failed to re-evaluate logic score" },
      { status: 500 }
    );
  }
}
