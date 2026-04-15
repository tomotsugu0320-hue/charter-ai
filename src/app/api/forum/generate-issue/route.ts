// src/app/api/forum/generate-issue/route.ts


import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ConflictPair = {
  opinion: string;
  rebuttal: string;
};

export async function POST(req: Request) {
  try {
    const { content } = await req.json();

    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { error: "content is required" },
        { status: 400 }
      );
    }

    const trimmed = content.trim();

    const isQuestion =
      trimmed.includes("？") ||
      trimmed.includes("?") ||
      trimmed.includes("なぜ") ||
      trimmed.includes("なんで") ||
      trimmed.includes("どうして");

    let claim = trimmed;
    let premises: string[] = [];
    let reasons: string[] = [];

    if (trimmed.includes("消費税")) {
      claim = "消費税は減税すべきか？";
      premises.push("日本は需要不足である可能性がある");
      reasons.push("消費税は消費を抑制する可能性がある");
    }

    if (trimmed.includes("景気")) {
      premises.push("景気は需要と供給で決まる");
      reasons.push("需要が増えれば経済は活性化する");
    }

    const { data, error } = await supabase
      .from("forum_issue_drafts")
      .insert({
        raw_content: trimmed,
        claim,
        premises,
        reasons,
      })
      .select("id")
      .single();

    if (error) {
      console.error("forum_issue_drafts insert error:", error);
      return NextResponse.json(
        { error: "failed to save issue draft" },
        { status: 500 }
      );
    }

    if (isQuestion) {
      let expandClaim = trimmed;
      let expandPremises: string[] = [];
      let expandReasons: string[] = [];
      let expandConflicts: ConflictPair[] = [];

      try {
        const structurePrompt = `
以下の問いについて、議論が進みやすいように構造化してください。

【ルール】
・抽象表現は禁止
・必ず具体的に書く
・最低1つは明確な立場を仮定する
・現実にあり得る前提を書く
・根拠は因果関係で書く
・賛成理由は reasons に入れる
・反対理由は conflicts に必ず分離する（重要）
・reasons に反対意見を混ぜない
・必ず1つ以上の対立を出す

【出力形式】
{
  "claim": "仮の主張",
  "premises": ["具体的な前提1", "具体的な前提2"],
  "reasons": ["具体的な根拠1", "具体的な根拠2"],
  "conflicts": [
    { "opinion": "対立する立場A", "rebuttal": "対立する立場B" }
  ]
}

問い:
${trimmed}
`;

        const structureRes = await client.responses.create({
          model: "gpt-4.1-mini",
          input: structurePrompt,
        });

        let parsed: {
          claim?: string;
          premises?: unknown;
          reasons?: unknown;
          conflicts?: unknown;
        } = {};

        try {
          const text = structureRes.output_text?.trim() || "{}";
          const start = text.indexOf("{");
          const end = text.lastIndexOf("}");

          if (start !== -1 && end !== -1 && end > start) {
            const safeJson = text.slice(start, end + 1);
            parsed = JSON.parse(safeJson);
          } else {
            throw new Error("JSON object not found in model output");
          }
        } catch (parseError) {
          console.error("structure parse error:", parseError);
        }

        expandClaim =
          typeof parsed.claim === "string" && parsed.claim.trim()
            ? parsed.claim.trim()
            : trimmed;

        expandPremises = Array.isArray(parsed.premises)
          ? parsed.premises.filter(
              (v): v is string => typeof v === "string" && v.trim().length > 0
            )
          : [];

        expandReasons = Array.isArray(parsed.reasons)
          ? parsed.reasons.filter(
              (v): v is string => typeof v === "string" && v.trim().length > 0
            )
          : [];

        expandConflicts = Array.isArray(parsed.conflicts)
          ? parsed.conflicts
              .filter((v): v is { opinion?: unknown; rebuttal?: unknown } => !!v && typeof v === "object")
.map((v) => ({
  opinion: typeof v.opinion === "string" && v.opinion.trim() ? v.opinion.trim() : "別の見方",
  rebuttal: typeof v.rebuttal === "string" ? v.rebuttal.trim() : "",
}))
.filter((v) => v.opinion || v.rebuttal)
          : [];

        if (expandPremises.length === 0) {
          expandPremises = [
            "複数の要因が関係している可能性",
            "前提によって結論が変わる可能性",
          ];
        }

        if (expandReasons.length === 0) {
          expandReasons = [
            "データや視点によって評価が異なる",
            "立場によって重要視する点が違う",
          ];
        }
      } catch (e) {
        console.error("structure generation failed:", e);
        expandClaim = trimmed;
        expandPremises = [
          "複数の要因が関係している可能性",
          "前提によって結論が変わる可能性",
        ];
        expandReasons = [
          "データや視点によって評価が異なる",
          "立場によって重要視する点が違う",
        ];
        expandConflicts = [];
      }

      let easySummary =
        `この話は「${trimmed}」についての議論です。\n` +
        `見方によって考え方が変わるため、どこを重視するかがポイントになります。`;

      try {
const prompt = `
以下の議論を、やさしい日本語で「導入文」としてまとめてください。

目的:
・初心者が最初に読む入口にする
・議論の全体像を短く理解させる

ルール:
・最初の1文で「この話が何についてか」を説明する
・2文目以降で「なぜ意見が分かれるか」を説明する
・賛成と反対の両方の視点に軽く触れる
・専門用語はできるだけ使わない
・断定しすぎない（〜と考えられる、〜という見方がある）
・説明口調ではなく自然な文章にする
・箇条書きは禁止
・出力は本文のみ

【文字数制限】
・100文字以上200文字以内で書くこと（重要）
・短すぎ・長すぎは禁止

話題:
${trimmed}

整理されたポイント:
仮の主張: ${expandClaim}
前提: ${expandPremises.join(" / ")}
理由: ${expandReasons.join(" / ")}
対立: ${
  (expandConflicts || [])
    .map(c => `${c.opinion} vs ${c.rebuttal}`)
    .join(" / ")
}
`;

        const response = await client.responses.create({
          model: "gpt-4.1-mini",
          input: prompt,
        });

if (response.output_text?.trim()) {
  easySummary = response.output_text.trim();
}

const lastPeriod = easySummary.lastIndexOf("。");

if (easySummary.length > 200) {
  easySummary =
    lastPeriod > 100
      ? easySummary.slice(0, lastPeriod + 1)
      : easySummary.slice(0, 200) + "…";
}

      } catch (e) {
        console.error("easySummary generation failed:", e);
      }

      return NextResponse.json({
        id: data.id,
        mode: "expand",
        claim: expandClaim,
        premises: expandPremises,
        reasons: expandReasons,
        conflicts: expandConflicts,
        easySummary,
      });
    }

    let splitEasySummary =
      `この話は「${claim}」についての意見です。\n` +
      `人によって重視する点が違うため、見方が分かれやすいテーマです。`;

    try {
      const prompt = `
以下の議論を、やさしい日本語で「3〜4文」にまとめてください。

目的:
- 初心者が最初に読む入口にする
- 難しい議論を、意味を変えずに読みやすくする

ルール:
- 最初の1文で「この話は何についての話か」を簡単に言う
- 2文目以降で「なぜ意見が分かれるか」「どこがポイントか」をやさしく書く
- 専門用語はできるだけ避ける
- 「前提」「根拠」という言葉は禁止
- 小学生でもなんとなく意味が分かる言葉にする
- 説明口調より、自然な要約文にする
- 断定しすぎない
- 箇条書き禁止
- 出力は本文だけ
- 文章は長すぎない

話題:
${claim}

整理されたポイント:
主張: ${claim}
考えられる前提: ${premises.join(" / ")}
考えられる理由: ${reasons.join(" / ")}
`;

      const response = await client.responses.create({
        model: "gpt-4.1-mini",
        input: prompt,
      });

      if (response.output_text?.trim()) {
        splitEasySummary = response.output_text.trim();
      }
    } catch (e) {
      console.error("split easySummary generation failed:", e);
    }

    return NextResponse.json({
      id: data.id,
      mode: "split",
      claim,
      premises,
      reasons,
      conflicts: [],
      easySummary: splitEasySummary,
    });
  } catch (error) {
    console.error("generate-issue route error:", error);
    return NextResponse.json(
      { error: "unexpected server error" },
      { status: 500 }
    );
  }
}

