   //  src/app/api/macro/analyze/route.ts

import { NextResponse } from "next/server";

type AnalyzeResponse = {
  goal: string;
  nodes: string[];
};

function buildNodes(goal: string): string[] {
  if (goal.includes("消費税")) {
    return ["景気", "財政", "分配"];
  }

  if (goal.includes("景気")) {
    return ["需要", "賃金", "投資"];
  }

  if (goal.includes("移民")) {
    return ["労働力", "社会保障", "治安"];
  }

  return ["前提整理", "主要論点", "判断基準"];
}

export async function POST(req: Request) {
  try {
    const { goal } = await req.json();
    const trimmedGoal = String(goal || "").trim();

    if (!trimmedGoal) {
      return NextResponse.json(
        { error: "goal is required" },
        { status: 400 }
      );
    }

    const result: AnalyzeResponse = {
      goal: trimmedGoal,
      nodes: buildNodes(trimmedGoal),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("[POST /api/macro/analyze] error:", error);

    return NextResponse.json(
      { error: "failed to analyze macro goal" },
      { status: 500 }
    );
  }
}