   //  src/app/api/macro/analyze/route.ts


import { NextResponse } from "next/server";
import type { MacroStructure } from "@/types/macro";

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

    const result: MacroStructure = {
      goal: trimmedGoal,
      issues: ["景気への影響", "財政への影響", "分配への影響"],
      bottlenecks: ["財源", "インフレ懸念", "効果測定の難しさ"],
      levers: ["減税", "財政出動", "金融政策"],
      sideEffects: ["短期的インフレ", "国債増加", "政策の偏り"],
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