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

type EvaluationContext = {
  currentLogicScore?: number | null;
  currentLogicScoreReason?: string | null;
  currentLogicBreakType?: string | null;
  currentLogicBreakNote?: string | null;
  objection?: {
    id: string;
    content: string;
    logic_score?: number | null;
    logic_score_reason?: string | null;
    logic_break_type?: string | null;
    logic_break_note?: string | null;
  } | null;
};

type ObjectionPostRow = {
  id: string;
  content: string | null;
  post_role: string | null;
  parent_opinion_id: string | null;
  logic_score: number | null;
  logic_score_reason: string | null;
  logic_break_type: string | null;
  logic_break_note: string | null;
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
  postRole: string,
  context?: EvaluationContext
): Promise<LogicScoreResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const currentEvaluationText =
    context?.currentLogicScore !== undefined ||
    context?.currentLogicScoreReason ||
    context?.currentLogicBreakType ||
    context?.currentLogicBreakNote
      ? `
現在のAI論理スコア:
- score: ${context?.currentLogicScore ?? "未評価"}
- reason: ${context?.currentLogicScoreReason || "なし"}
- break_type: ${context?.currentLogicBreakType || "なし"}
- break_note: ${context?.currentLogicBreakNote || "なし"}
      `.trim()
      : "";

  const objectionText = context?.objection
    ? `
高スコア反論投稿:
- objectionPostId: ${context.objection.id}
- logic_score: ${context.objection.logic_score ?? "未評価"}
- logic_score_reason: ${context.objection.logic_score_reason || "なし"}
- logic_break_type: ${context.objection.logic_break_type || "なし"}
- logic_break_note: ${context.objection.logic_break_note || "なし"}

反論本文:
${context.objection.content}

注意:
この反論投稿を無条件に正しいものとして扱わないでください。
元投稿の前提・根拠・因果関係を見直すための材料として扱い、反論自体の論理性も検討してください。
      `.trim()
    : "";

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
AI論理スコアは、文章の読みやすさや主張の好みではなく、論理、根拠、前提、因果、反論耐性、現実適合性を見るための0〜100点の総合指標です。
このスコアは絶対的な正解判定ではありません。読者が評価理由を読んで、投稿の強みと弱点を検討するための補助情報として扱います。

汎用評価8項目:
1. 主張の明確さ: 何を言いたい投稿かが分かるか。
2. 前提の明示: どの条件、価値観、事実認識に立っているかが示されているか。
3. 根拠の質: 事実、データ、経験、比較、具体例などが主張を支えているか。
4. 因果関係: 「なぜそうなるか」のつながりが飛躍していないか。
5. 反論耐性: 反対意見、例外、弱点、リスクを考慮しているか。
6. 権威・感情依存の有無: 肩書き、多数意見、怒り、同情、命令だけに依存していないか。
7. 結論の導出: 前提と根拠から結論が自然に導かれているか。
8. 現実適合性: 制度、実行可能性、現場条件、人間の行動、時間軸を考慮しているか。

比較主張の評価に関する特別指示:
「政策AよりBの方が合理的・効果的・優れている」という比較主張を評価する場合、以下を必ず確認してください。

1. 核心前提の根拠確認
比較の出発点になっている前提に根拠があるか確認してください。
前提が「当然のこと」として置かれているだけの場合、文章が整っていても前提の評価を低くしてください。
政策AよりBが合理的・効果的だと主張していても、核心前提に根拠がない場合は高得点にしないでください。
「政策Aは効果がない」「政策Bの方が効果的」と主張する場合、その前提根拠が示されていないなら、logic_break_type は unclear_premise または weak_causality にしてください。
比較主張で核心前提に根拠がない場合、logic_score は最大60点にしてください。

2. 比較条件の整合性確認
以下が揃っているか確認してください。
- 財政規模: 同じ予算規模での比較か。
- 効果期間: 短期・長期を同じ軸で比較しているか。
- 実施コスト: 行政コスト・手続きコストを含んでいるか。
- タイムラグ: 効果が届くまでの時間差を考慮しているか。
- 対象漏れ: 受益者が意図通りに絞られているか。
- 副作用: 一方の政策だけでなく、両方の副作用を比較しているか。

比較条件が揃っていない場合、「比較の形式はあるが条件が不整合」として根拠の質と因果関係を低く評価してください。
比較条件が不整合な場合、logic_score_reason または logic_break_note に「比較条件が不整合」と明記してください。
財政規模、効果期間、実施コスト、タイムラグ、対象漏れ、副作用の比較がない場合は、その不足を必ず logic_break_note に入れてください。
比較条件が揃っていない比較主張は、logic_score を最大60点にしてください。
特に核心前提の根拠がなく、比較条件も揃っていない場合は、50点台以下を基本にしてください。

3. 構造が整っていても内容が薄い主張への注意
論理の形式（主張→理由→結論）が整っていても、各項目の内容が薄い・根拠が示されていない・比較条件が不整合な場合は、表面的な構造に引きずられてスコアを高くしないでください。
評価対象は文章の構造ではなく、主張の論理的強度です。
「比較している」「所得層に触れている」「消費性向に触れている」だけで高評価しないでください。比較の妥当性と前提の根拠を重視してください。
「財源に触れている」だけでも高評価しないでください。前提・根拠・比較条件が弱ければ、文章構造が整っていても高得点にしないでください。

スコア上限の厳格ルール:
以下に該当する比較主張は、総合論理スコアを最大60点としてください。
「原則」ではなく上限として扱ってください。

1. 比較条件が不整合である場合。
2. 財政規模、効果期間、実施コスト、タイムラグ、対象漏れ、副作用のうち2つ以上が比較されていない場合。
3. 「政策Aは効果がない」「政策Bの方が効果的」とする核心前提に、具体的な根拠・データ・実証がない場合。

さらに、以下の両方に該当する場合は、総合論理スコアを最大55点としてください。

1. 核心前提に具体的根拠・データ・実証がない。
2. 比較条件が不整合、または主要な比較条件が不足している。

60点を超えるスコアを付ける場合は、logic_score_reason の中で比較条件が十分に揃っている理由を必ず明記してください。
明記できない場合は60点を超えてはなりません。
比較条件が不整合であると判断しながら、70点以上を付けることは禁止します。

このスコア制約は、文章の構造が整っていることを理由にスコアを高くすることを防ぐためのものです。
論理的強度が不十分な主張が、形式の整さで高得点になることを禁止します。

経済政策投稿の場合は、上記に加えて次の10項目も考慮してください。
ただし、特定の経済学派を唯一の正解にしないでください。学派名、権威、肩書き、多数意見ではなく、論理、根拠、前提、因果、反論耐性、現実適合性で評価してください。
1. 需要・供給: 需要不足、供給制約、価格調整などを区別しているか。
2. 雇用: 賃金、失業、労働移動、生産性への影響を考慮しているか。
3. インフレ/デフレ: 物価、賃金、期待、景気局面との関係を考慮しているか。
4. 財政政策: 税、給付、公共投資、財源、財政制約を適切に扱っているか。
5. 金融政策との整合性: 金利、通貨、為替、中央銀行政策との関係を考慮しているか。
6. 分配: 所得階層、世代、地域、企業規模などへの分配影響を考慮しているか。
7. 短期/長期効果: 目先の効果と長期的な副作用を区別しているか。
8. 副作用: モラルハザード、財政負担、価格歪み、供給不足などのリスクを見ているか。
9. 国際比較: 他国事例を使う場合、制度・人口・産業構造の違いを踏まえているか。
10. 制度との整合性: 日本の法制度、社会保険、労働慣行、行政実務などとの接続を考慮しているか。

経済政策に関する投稿の場合は、必要に応じて以下のマクロ経済理論フレームも確認してください。
1. IS-LMモデル:
- 財政政策と金融政策の組み合わせを確認する。
- 財政出動が金利上昇を通じて民間投資を抑制する可能性があるかを確認する。
- ただし、需要不足・低金利・デフレ圧力・金融緩和下では、クラウディングアウトが限定的になる可能性も考慮する。
2. AD-ASモデル:
- 需要側の政策効果と供給側の制約を分けて確認する。
- 短期の需要拡大効果と、長期の供給能力・生産性・労働力・エネルギー制約を混同しない。
3. 乗数効果・クラウディングアウト:
- 財政出動や減税が需要を拡大する経路を確認する。
- 同時に、金利上昇や民間投資抑制の条件も確認する。
- クラウディングアウトの強さは、完全雇用に近いか、需給ギャップがあるか、金融政策が緩和的か、民間投資需要が強いかによって変わる。
4. フィリップス曲線:
- 需要刺激策が雇用・失業率・賃金・インフレ率にどう波及するかを確認する。
- ただし、フィリップス曲線の関係は時期、国、期待インフレ、労働市場構造によって弱まる場合があるため、機械的に判断しない。
5. リカードの等価定理:
- 財政出動が将来増税予想による貯蓄増加で相殺される可能性を反論候補として確認する。
- ただし、リカードの等価定理は、家計が将来税負担を合理的に予想する、流動性制約がない、将来世代まで考慮する等の強い前提を持つため、唯一の正解として扱わない。

確認すべき現実指標:
- 雇用・失業率
- 賃金
- 短期金利・長期金利
- インフレ率
- 需給ギャップ
- 家計の可処分所得
- 消費・投資
- 財政収支・債務残高
- 為替・輸入物価
- 労働需給
- 供給制約

日本経済を扱う場合は、以下の文脈も考慮してください。
- 長期デフレ圧力
- 低金利
- 需要不足
- 消費税増税による需要冷却
- 賃金上昇の遅れ
- 労働市場の硬直性
- 外国人労働者による賃金上昇圧力の緩和
- 財政政策と金融政策が同時に十分実施されにくい問題
- 政治的・制度的制約

評価時の注意:
- 特定の経済学派、権威、多数意見を唯一の正解として扱わない。
- 理論名を出しているだけで高評価にしない。
- 主張の前提、因果関係、根拠、現実適合性、反論耐性で評価する。
- 経済理論上の妥当性と、政治的・制度的な実現可能性は分けて評価する。
- 複数理論が競合する場合は、どの前提なら成立するか、どの指標で確認できるかを重視する。
- 一般ユーザー投稿に専門モデルの完全記述を要求しすぎて、過度に低評価にしない。

経済政策投稿を評価する場合、関連するマクロ経済理論フレームがあるときは、logic_score_reason または logic_break_note に理論名を明示してください。
特に logic_break_note には、必要に応じて次の形式を含めてください。
関連理論: IS-LM / AD-AS / 乗数効果・クラウディングアウト / フィリップス曲線 / リカードの等価定理 のうち、該当するものを1〜3個。
例: 「関連理論: AD-AS、乗数効果・クラウディングアウト。需給ギャップ、インフレ率、長期金利、賃金波及を確認していないため、政策効果の成立条件が弱い。」
ただし、関係ない理論名を無理に出さないでください。理論名を出しているだけで高評価にせず、理論名の列挙よりも前提・因果・検証指標・反論耐性を重視してください。経済理論上の妥当性と政治的・制度的実現可能性は分けて評価してください。

logic_score_reason には、必要に応じて理論整合性を1文程度で反映してください。
例: 「この主張は有効需要や財政乗数の観点とは整合するが、供給制約や金利上昇によるクラウディングアウトの条件検討が不足している。」

logic_break_note には、必要に応じて未考慮の理論・成立条件・検証指標を入れてください。
例: 「需給ギャップ、インフレ率、長期金利、賃金波及を確認していないため、政策効果の成立条件が弱い。AD-AS上の供給制約や財政赤字拡大リスクも反論余地として残る。」

採点レンジ:
- 0〜20点: 主張だけ、感情だけ、命令形だけ、根拠なし。論点から外れている。
- 20〜40点: 主張はあるが前提や理由が弱く、因果関係がほぼ示されていない。
- 40〜60点: 主張と簡単な理由はあるが、根拠・因果・反論耐性・現実適合性が浅い。
- 60〜75点: 前提、根拠、因果がある。主要な弱点は残るが、議論の土台として読める。
- 75〜90点: 前提、根拠、因果、反論耐性、現実条件が整理されている。
- 90点以上: 条件分岐、反論への対応、制度設計、副作用、代替案まで含めて高い論理性がある。

現在のAI論理スコアや反論投稿が入力に含まれる場合、それらは参考情報です。既存評価や反論を鵜呑みにせず、元投稿の論理性を改めて評価してください。

出力ルール:
- 必ずJSONのみで返してください。
- logic_score には0〜100の総合論理スコアを入れてください。
- logic_score_reason には総合評価理由を日本語で2〜4文で書いてください。強みと評価理由が読めるようにしてください。
- logic_break_type は次のいずれかだけを使ってください:
  none, emotional, authority_based, weak_causality, unclear_premise, off_topic, other
- logic_break_note には主な弱点、改善点、反論余地、経済政策上の注意点を日本語で要約してください。弱点がほぼない場合は簡潔に「大きな論理的弱点は見当たりません」と書いてください。
      `.trim(),
      input: `
投稿分類: ${postRole}

投稿本文:
${content}

${currentEvaluationText}

${objectionText}
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
    const objectionPostId =
      String(body?.objectionPostId ?? "").trim() || null;

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
      .select(
        "id, content, post_role, logic_score, logic_score_reason, logic_break_type, logic_break_note"
      )
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

    let objection: ObjectionPostRow | null = null;

    if (objectionPostId) {
      const { data: objectionRow, error: objectionError } = await supabase
        .from("forum_posts")
        .select(
          "id, content, post_role, parent_opinion_id, logic_score, logic_score_reason, logic_break_type, logic_break_note"
        )
        .eq("id", objectionPostId)
        .maybeSingle();

      if (objectionError) {
        return NextResponse.json(
          { success: false, error: objectionError.message },
          { status: 500 }
        );
      }

      if (!objectionRow) {
        return NextResponse.json(
          { success: false, error: "objection post not found" },
          { status: 404 }
        );
      }

      objection = objectionRow as ObjectionPostRow;

      if (String(objection.parent_opinion_id ?? "") !== postId) {
        return NextResponse.json(
          { success: false, error: "objection post is not linked to postId" },
          { status: 400 }
        );
      }

      if (objection.post_role !== "supplement") {
        return NextResponse.json(
          { success: false, error: "objection post must be supplement" },
          { status: 400 }
        );
      }

      if (!String(objection.content ?? "").includes("AI評価への反論:")) {
        return NextResponse.json(
          { success: false, error: "objection post marker is missing" },
          { status: 400 }
        );
      }
    }

    const result = await evaluateLogicScore(
      content,
      String(post.post_role ?? "opinion"),
      {
        currentLogicScore:
          typeof post.logic_score === "number" ? post.logic_score : null,
        currentLogicScoreReason: String(post.logic_score_reason ?? "").trim(),
        currentLogicBreakType: String(post.logic_break_type ?? "").trim(),
        currentLogicBreakNote: String(post.logic_break_note ?? "").trim(),
        objection: objection
          ? {
              id: objection.id,
              content: String(objection.content ?? "").trim(),
              logic_score:
                typeof objection.logic_score === "number"
                  ? objection.logic_score
                  : null,
              logic_score_reason: String(
                objection.logic_score_reason ?? ""
              ).trim(),
              logic_break_type: String(objection.logic_break_type ?? "").trim(),
              logic_break_note: String(objection.logic_break_note ?? "").trim(),
            }
          : null,
      }
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
      objectionPostId,
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
