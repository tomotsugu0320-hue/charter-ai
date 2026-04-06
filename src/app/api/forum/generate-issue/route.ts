// src/app/api/forum/generate-issue/route.ts


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

    // 仮ロジック（あとでAIに差し替え）
    let claim = trimmed;
    let premises: string[] = [];
    let reasons: string[] = [];

    // 超簡易ルールベース（とりあえず動かす）
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

    return NextResponse.json({
      id: data.id,
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