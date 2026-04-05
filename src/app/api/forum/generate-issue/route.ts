// src/app/api/forum/generate-issue/route.ts


import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { content } = await req.json();

  // 仮ロジック（あとでAIにする）
  let issue = "この意見は何について議論しているか？";

  if (content.includes("消費税")) {
    issue = "消費税は減税すべきか？";
  }

  return NextResponse.json({
    issue,
  });
}

