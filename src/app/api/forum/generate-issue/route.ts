// src/app/api/forum/generate-issue/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

    // 👉 問い判定
    const isQuestion =
      trimmed.includes("？") ||
      trimmed.includes("?") ||
      trimmed.includes("なぜ") ||
      trimmed.includes("なんで") ||
      trimmed.includes("どうして");

    let claim = trimmed;
    let premises: string[] = [];
    let reasons: string[] = [];

    // 仮ロジック（あとでAIに差し替え）
    if (trimmed.includes("消費税")) {
      claim = "消費税は減税すべきか？";
      premises.push("日本は需要不足である可能性がある");
      reasons.push("消費税は消費を抑制する可能性がある");
    }

    if (trimmed.includes("景気")) {
      premises.push("景気は需要と供給で決まる");
      reasons.push("需要が増えれば経済は活性化する");
    }

    // 👉 DB保存
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

    // 👉 分岐レスポンス
if (isQuestion) {
  let expandPremises: string[] = [];
  let expandReasons: string[] = [];

  // 🔥 日本経済系
  if (
    trimmed.includes("日本") ||
    trimmed.includes("経済") ||
    trimmed.includes("成長")
  ) {
    expandPremises = [
      "需要不足が続いている可能性",
      "実質賃金が伸びていない可能性",
      "投資や政府支出が弱い可能性",
    ];

    expandReasons = [
      "GDP成長率が長期的に低迷している",
      "実質賃金が伸びず消費が弱い",
      "企業の内部留保が投資に回っていない可能性",
    ];
  }

  // 🔥 移民
  else if (trimmed.includes("移民")) {
    expandPremises = [
      "労働力不足を補う必要がある",
      "文化や治安への影響を考慮する必要がある",
      "賃金への影響がある可能性",
    ];

    expandReasons = [
      "人口減少による労働力不足",
      "海外の移民政策の成功例・失敗例",
      "低賃金労働市場への影響",
    ];
  }

  // 🔥 社会保障・福祉
  else if (
    trimmed.includes("社会保障") ||
    trimmed.includes("福祉")
  ) {
    expandPremises = [
      "弱者救済を優先する考え",
      "財政の持続性を重視する考え",
      "自己責任を重視する考え",
    ];

    expandReasons = [
      "高齢化による支出増加",
      "税収と支出のバランス",
      "働くインセンティブへの影響",
    ];
  }

  // 🔥 デフォルト
  else {
    expandPremises = [
      "複数の要因が関係している可能性",
      "前提によって結論が変わる可能性",
    ];

    expandReasons = [
      "データや視点によって評価が異なる",
      "立場によって重要視する点が違う",
    ];
  }

  return NextResponse.json({
    id: data.id,
    mode: "expand",
    claim: trimmed,
    premises: expandPremises,
    reasons: expandReasons,
  });
}

    return NextResponse.json({
      id: data.id,
      mode: "split",
      claim,
      premises,
      reasons,
    });
  } catch (error) {
    console.error("generate-issue route error:", error);
    return NextResponse.json(
      { error: "unexpected server error" },
      { status: 500 }
    );
  }
}