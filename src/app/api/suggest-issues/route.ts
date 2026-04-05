import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { text, issues } = await req.json();

  const prompt = `
以下の投稿を読んで、既存の論点に関連するものがあれば最大3つ選んでください。
また、既存論点に十分合わない場合は、新しい論点候補を最大2つ提案してください。

投稿:
${text}

既存の論点:
${issues.map((i: { title: string }) => i.title).join("\n")}

JSONのみで返してください。
形式:
{
  "matches": [
    {
      "title": "円安が輸出企業に与える影響",
      "reason": "円安と輸出企業の利益に直接言及しているため"
    },
    {
      "title": "円安による消費者物価への影響",
      "reason": "円安が物価に影響する可能性があるため"
    }
  ],
  "newIssues": []
}

`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    }),
  });

  const data = await res.json();

  try {
    const json = JSON.parse(data.choices[0].message.content);
    return NextResponse.json({
      matches: Array.isArray(json.matches) ? json.matches : [],
      newIssues: Array.isArray(json.newIssues) ? json.newIssues : [],
    });
  } catch {
    return NextResponse.json({ matches: [], newIssues: [] });
  }
}