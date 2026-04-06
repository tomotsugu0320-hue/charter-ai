// src/app/api/forum/suggest-assumption/route.ts

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { content } = await req.json();
    const text = String(content || "").trim();

    if (!text) {
      return NextResponse.json(
        { error: "content is required" },
        { status: 400 }
      );
    }

    let assumptions: string[] = [];

    if (text.includes("消費税")) {
      assumptions = [
        "消費税は消費行動を抑制する可能性がある、という前提",
        "税率の変更は家計の可処分所得に影響する、という前提",
        "消費税は景気や需要に対して中立ではない、という前提",
      ];
    } else if (text.includes("景気")) {
      assumptions = [
        "景気は需要や投資の強さに左右される、という前提",
        "個人消費の弱さは景気停滞の要因になりうる、という前提",
        "政府や民間の支出は景気に影響を与える、という前提",
      ];
    } else if (text.includes("借金")) {
      assumptions = [
        "政府債務の増加は将来的な不安定要因になりうる、という前提",
        "国の借金は民間の借金と同じように捉えるべき、という前提",
        "債務残高の大きさは経済運営上の制約になる、という前提",
      ];
    } else {
      assumptions = [
        "この主張には明示されていない前提が存在する可能性がある",
        "言葉の定義や比較基準が共有されている、という前提",
        "因果関係が成立している、という前提",
      ];
    }

    return NextResponse.json({ assumptions });
  } catch (e) {
    console.error("[suggest-assumption] error:", e);

    return NextResponse.json(
      { error: "failed to suggest assumptions" },
      { status: 500 }
    );
  }
}