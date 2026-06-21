// src/app/api/forum/create-thread-from-draft/route.ts




import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActiveForumBetaSessionUser } from "@/lib/forum-auth";
import {
  maskForumPrivacyArray,
  maskForumPrivacyText,
} from "@/lib/forum-privacy";

function makeSlug(input: string) {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const fallback = "thread";
  const random = Math.random().toString(36).slice(2, 8);

  return `${base || fallback}-${random}`;
}

function getOrCreateAuthorKey(req: NextRequest) {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(/author_key=([^;]+)/);

  if (match?.[1]) {
    return {
      authorKey: match[1],
      shouldSetCookie: false,
    };
  }

  return {
    authorKey: "u_" + Math.random().toString(36).slice(2, 10),
    shouldSetCookie: true,
  };
}

function buildAuthorKeyCookie(authorKey: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `author_key=${encodeURIComponent(
    authorKey
  )}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly${secure}`;
}

type Conflict = {
  opinion?: string;
  rebuttal?: string;
};

const MAX_THREAD_TITLE_LENGTH = 120;
const MAX_DRAFT_CLAIM_LENGTH = 12000;
const MAX_DRAFT_TOTAL_LENGTH = 12000;
const MAX_DRAFT_ARRAY_ITEMS = 20;
const MAX_DRAFT_ITEM_LENGTH = 1000;
const MAX_DRAFT_CONFLICT_ITEM_LENGTH = 1500;

const EXTERNAL_AI_SECTION_LABELS = [
  "【誰でも分かる説明】",
  "【もう少し詳しい説明】",
  "【深層・専門的な補足】",
  "短く言うと:",
  "短く言うと：",
  "もう少し詳しく:",
  "もう少し詳しく：",
  "AI回答・整理:",
  "AI回答・整理：",
  "補足:",
  "補足：",
  "前提:",
  "前提：",
  "根拠:",
  "根拠：",
  "反論・リスク:",
  "反論・リスク：",
  "反論:",
  "反論：",
  "子論点候補:",
  "子論点候補：",
  "分割しなかった理由:",
  "分割しなかった理由：",
];

function textLength(value: unknown) {
  return String(value ?? "").trim().length;
}

function conflictTextLength(conflict: Conflict) {
  return textLength(conflict?.opinion) + textLength(conflict?.rebuttal);
}

function shortText(value: string, max = 160) {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function toCleanStringArray(values: unknown[], max = 5) {
  return values
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .slice(0, max);
}

function extractLabeledSection(text: string, labels: string[], stopLabels: string[]) {
  const matchedLabel = labels.find((label) => text.includes(label));
  if (!matchedLabel) return "";

  const afterLabel = text.slice(text.indexOf(matchedLabel) + matchedLabel.length).trim();
  if (!afterLabel) return "";

  const nextIndex = stopLabels.reduce<number | null>((current, label) => {
    if (labels.includes(label)) return current;
    const index = afterLabel.indexOf(label);
    if (index < 0) return current;
    return current === null ? index : Math.min(current, index);
  }, null);

  return (nextIndex === null ? afterLabel : afterLabel.slice(0, nextIndex)).trim();
}

function extractAiAnswerFromClaim(claim: string) {
  const shortAnswer = extractLabeledSection(
    claim,
    ["【誰でも分かる説明】", "短く言うと:", "短く言うと："],
    EXTERNAL_AI_SECTION_LABELS
  );
  const detailedAnswer = extractLabeledSection(
    claim,
    ["【もう少し詳しい説明】", "もう少し詳しく:", "もう少し詳しく："],
    EXTERNAL_AI_SECTION_LABELS
  );
  const deepAnswer = extractLabeledSection(
    claim,
    ["【深層・専門的な補足】"],
    EXTERNAL_AI_SECTION_LABELS
  );

  if (shortAnswer || detailedAnswer || deepAnswer) {
    return buildLayeredAnswerText({
      simple: shortAnswer || shortText(detailedAnswer || deepAnswer, 160),
      detailed: detailedAnswer || shortAnswer || deepAnswer,
      deep: deepAnswer,
    });
  }

  const legacyAnswer = extractLabeledSection(
    claim,
    ["AI回答・整理:", "AI回答・整理："],
    EXTERNAL_AI_SECTION_LABELS
  );
  const legacySupplement = extractLabeledSection(
    claim,
    ["補足:", "補足："],
    EXTERNAL_AI_SECTION_LABELS
  );

  if (legacyAnswer || legacySupplement) {
    return buildLayeredAnswerText({
      simple: legacyAnswer || shortText(legacySupplement, 160),
      detailed: legacySupplement || legacyAnswer,
      deep: "",
    });
  }

  return "";
}

function getExternalAiQuestionPart(claim: string) {
  const firstLabelIndex = EXTERNAL_AI_SECTION_LABELS.reduce<number | null>(
    (current, label) => {
      const index = claim.indexOf(label);
      if (index < 0) return current;
      return current === null ? index : Math.min(current, index);
    },
    null
  );

  return (firstLabelIndex === null ? claim : claim.slice(0, firstLabelIndex)).trim();
}

function buildExternalAiDraftClaim({
  claim,
  aiAnswerShort,
  aiAnswerDetail,
  aiAnswer,
  supplements,
  childTopics,
  notSplitReason,
}: {
  claim: string;
  aiAnswerShort: string;
  aiAnswerDetail: string;
  aiAnswer: string;
  supplements: string[];
  childTopics: string[];
  notSplitReason: string;
}) {
  if (!aiAnswerShort && !aiAnswerDetail) return claim;

  const question = getExternalAiQuestionPart(claim);
  const parts = [
    question,
    aiAnswerShort ? `${ANSWER_LAYER_LABELS[0]}\n${aiAnswerShort}` : "",
    aiAnswerDetail ? `${ANSWER_LAYER_LABELS[1]}\n${aiAnswerDetail}` : "",
    aiAnswer ? `AI回答・整理:\n${aiAnswer}` : "",
    supplements.length ? `補足:\n${supplements.join("\n")}` : "",
    childTopics.length ? `子論点候補:\n${childTopics.join("\n")}` : "",
    notSplitReason ? `分割しなかった理由:\n${notSplitReason}` : "",
  ].filter(Boolean);

  return parts.join("\n\n") || claim;
}

function looksLikeEconomyPolicyText(text: string) {
  return [
    "経済",
    "政策",
    "財政",
    "金融",
    "消費税",
    "減税",
    "生産性",
    "賃金",
    "雇用",
    "失業",
    "需要",
    "デフレ",
    "インフレ",
    "価格転嫁",
    "企業",
    "家計",
    "所得",
    "消費",
    "社会保険料",
    "社会保険",
    "社会保障",
    "可処分所得",
    "現役世代",
    "少子化",
    "合成の誤謬",
  ].some((keyword) => text.includes(keyword));
}

function includesAnyKeyword(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function looksLikePriceRateTaxPolicyText(text: string) {
  return includesAnyKeyword(text, [
    "物価上昇",
    "物価高",
    "利上げ",
    "金融引き締め",
    "金融引締め",
    "増税",
    "日銀",
    "需要抑制",
    "インフレ率",
    "CPI",
    "消費税増税",
  ]);
}

function looksLikeSocialInsuranceBurdenText(text: string) {
  if (includesAnyKeyword(text, [
    "社会保険料",
    "社会保険",
    "保険料",
    "厚生年金",
    "健康保険",
    "介護保険",
    "年金保険",
    "給与天引き",
    "天引き",
    "労使折半",
  ])) {
    return true;
  }

  return (
    includesAnyKeyword(text, [
      "社会保障負担",
      "現役世代負担",
    ]) &&
    includesAnyKeyword(text, [
      "可処分所得",
      "給与",
      "手取り",
      "雇用コスト",
      "企業負担",
    ])
  );
}

function looksLikeLaborCostRationalizationText(text: string) {
  return includesAnyKeyword(text, [
    "人件費削減",
    "省人化",
    "企業の合理化",
    "合理化",
    "ミクロ",
    "マクロ",
    "合成の誤謬",
    "生産性向上",
  ]);
}

function looksLikeFiscalConsolidationText(text: string) {
  return includesAnyKeyword(text, [
    "財政健全化",
    "財政再建",
    "政府支出削減",
    "支出削減",
    "歳出削減",
    "緊縮",
    "緊縮財政",
    "財政赤字削減",
    "赤字削減",
    "プライマリーバランス",
    "PB黒字化",
    "政府の支出",
    "公共支出",
  ]);
}

const ANSWER_LAYER_LABELS = [
  "【誰でも分かる説明】",
  "【もう少し詳しい説明】",
  "【深層・専門的な補足】",
] as const;

function hasLayeredProvisionalAnswerText(text: string) {
  return ANSWER_LAYER_LABELS.every((label) => text.includes(label));
}

function getInitialSummaryTopic(claim: string, title: string) {
  const text = (title || claim)
    .replace(/\s*(AI回答・整理|補足|前提|根拠|反論|反論・リスク)[:：][\s\S]*$/u, "")
    .replace(/\s+/g, " ")
    .trim();

  return shortText(text || "この投稿の論点", 72);
}

function buildLayeredAnswerText({
  simple,
  detailed,
  deep,
}: {
  simple: string;
  detailed: string;
  deep: string;
}) {
  return [
    `${ANSWER_LAYER_LABELS[0]}\n${simple.trim()}`,
    `${ANSWER_LAYER_LABELS[1]}\n${detailed.trim()}`,
    `${ANSWER_LAYER_LABELS[2]}\n${deep.trim()}`,
  ].join("\n\n");
}

function buildLayeredInitialSummaryText(
  rawAnswer: string,
  claim: string,
  title: string
) {
  const answer = rawAnswer.trim();
  if (hasLayeredProvisionalAnswerText(answer)) return answer;

  const targetText = `${claim}\n${title}\n${answer}`;
  const topic = getInitialSummaryTopic(claim, title);

  if (looksLikeSocialInsuranceBurdenText(targetText)) {
    return buildLayeredAnswerText({
      simple:
        "社会保険料が重くなると、給料から引かれるお金が増えて手取りが減ります。会社側の負担も増えるため、賃上げに回せる余地や、現役世代の生活設計に影響する可能性があります。",
      detailed:
        "社会保険料は家計の可処分所得を減らすだけでなく、企業にとっては雇用コストにもなります。そのため、現役世代の消費、企業の賃上げ余地、雇用判断、少子化対策への影響を分けて検証する必要があります。消費税との比較では、給与天引きで負担が見えにくい点や、現役世代に負担が集中しやすい点も重要です。",
      deep:
        "専門的には、社会保険料を税に近い負担として見るだけでなく、労働コスト、手取り賃金、社会保障財源の三つに分けて確認します。労使折半と表示されても、経済的には企業の雇用コストや賃金形成に影響し、負担増が可処分所得、労働需要、賃上げ余地、出生行動に波及する可能性があります。一方で、医療・年金・介護の財源をどう確保するかという反論も残るため、消費税との比較では負担の見え方、世代配分、給付との対応関係を検証する必要があります。",
    });
  }

  if (looksLikePriceRateTaxPolicyText(targetText)) {
    return buildLayeredAnswerText({
      simple:
        "物価が上がっているだけでは、利上げや増税が正しいとは言えません。物価高の原因が、景気の強さなのか、輸入品やエネルギーの値上がりなのかを分けて考える必要があります。",
      detailed:
        "需要が強すぎて物価が上がっているなら、利上げや増税で需要を抑える意味があります。一方、円安、輸入物価、エネルギー価格などが原因で、実質賃金や個人消費が弱いなら、需要を冷やす政策は家計と企業活動をさらに弱める可能性があります。雇用、賃金、消費が本当に強いかを確認することが重要です。",
      deep:
        "専門的には、需要超過型インフレと供給制約・輸入物価型インフレを分ける必要があります。AD-ASモデルでは、需要が右に動く物価上昇と、供給制約で供給が左に動く物価上昇では政策判断が変わります。フィリップス曲線的にも、雇用と賃金が強い局面なら引き締めが有効になり得ますが、実質賃金や消費が弱い局面では逆効果になり得ます。財源問題、将来増税予想、インフレ再燃リスクも反論として残ります。",
    });
  }

  if (looksLikeFiscalConsolidationText(targetText)) {
    return buildLayeredAnswerText({
      simple:
        "財政を健全にすることは大切ですが、不景気のときに政府支出を急に減らすと、かえって景気が悪くなることがあります。政府の支出は、誰かの所得にもなっているからです。",
      detailed:
        "デフレや需要不足の局面では、政府支出の削減は家計所得、企業売上、雇用を弱める可能性があります。景気が悪くなると税収も伸びにくくなり、短期的な赤字削減を狙っても、財政健全化が遅れる場合があります。一方、需要が強すぎる局面では支出抑制が有効になることもあるため、景気局面を分ける必要があります。",
      deep:
        "専門的には、財政乗数と自動安定化装置を確認する論点です。需要不足下では政府支出の削減が乗数効果を通じて所得と消費を縮小させ、税収減で財政改善を弱める可能性があります。一方、完全雇用に近い局面ではクラウディングアウトやインフレ再燃リスクもあります。財源制約、将来増税予想、金利上昇リスクは反論として残るため、財政健全化そのものではなく、時期と手段が問題になります。",
    });
  }

  if (
    looksLikeLaborCostRationalizationText(targetText)
  ) {
    return buildLayeredAnswerText({
      simple:
        "会社にとって正しい節約が、社会全体でも正しいとは限りません。多くの会社が同時に人件費を削ると、家計の収入が減り、買い物も減って、結局は企業の売上も弱くなることがあります。",
      detailed:
        "企業単体では、人件費削減や省人化は短期的に利益改善につながります。しかし需要不足の局面で多くの企業が同じことをすると、家計所得が減り、消費需要が弱まり、企業の売上期待も下がります。その結果、投資、雇用、賃上げが抑えられ、デフレ圧力が強まる可能性があります。ミクロの合理性とマクロの合成の誤謬を分ける必要があります。",
      deep:
        "専門的には、合成の誤謬、有効需要、フィリップス曲線的な労働需給を確認する論点です。個別企業のコスト削減は合理的でも、経済全体では誰かの支出が誰かの所得になります。需要不足下では所得減が消費減を通じて売上期待を下げ、さらに雇用や賃金を抑える循環が起き得ます。一方、需要超過や人手不足が強い局面では、省力化投資や生産性向上が賃金上昇を支える場合もあります。",
    });
  }

  if (looksLikeEconomyPolicyText(targetText)) {
    const baseAnswer =
      answer ||
      `${topic}については、家計、企業、雇用、物価、財源への影響を分けて確認する必要があります。`;

    return buildLayeredAnswerText({
      simple: `${topic}については、単純に良い悪いで決めず、誰の負担が増え、誰の所得や消費が弱くなるのかを見る必要があります。まず家計と企業への影響を分けて考える論点です。`,
      detailed:
        baseAnswer.length > 180
          ? baseAnswer
          : `${baseAnswer} とくに、需要不足か需要超過か、家計の可処分所得、企業のコスト、雇用や賃上げへの影響を分けて確認する必要があります。政策の効果は、負担の見え方だけでなく、消費、投資、財源、世代間の配分によって変わります。`,
      deep:
        `専門的には、「${topic}」を所得分配、労働需要、消費需要、財源制約の四つに分けて検証します。税や保険料、補助金、支出削減は、家計の可処分所得と企業行動を通じて需要に影響します。一方で、財源の持続性、将来負担、インフレ再燃、制度の公平性という反論も残ります。投稿直後の初期回答では結論を固定せず、どの条件なら成立し、どの条件なら逆効果になるかを整理する段階です。`,
    });
  }

  const fallbackAnswer =
    answer ||
    "この問いは、投稿された主張だけで結論を出すのではなく、前提・根拠・反論リスクを分けて確認する必要があります。";

  return buildLayeredAnswerText({
    simple: shortText(fallbackAnswer, 160),
    detailed:
      fallbackAnswer.length > 180
        ? fallbackAnswer
        : `${fallbackAnswer} 現時点では、どの前提なら主張が成り立つのか、どの根拠が強いのか、どの反論リスクが残るのかを分けて見る段階です。`,
    deep:
      "専門的には、主張の前提、因果関係、検証できる指標、反論可能性を分けて確認します。まだ投稿が少ない場合は、結論を固定するよりも、どの条件で成立し、どの条件で弱くなるかを整理することが重要です。今後の補足や反論によって、この暫定回答は更新される可能性があります。",
  });
}

function buildInitialSummaryText(claim: string, title: string) {
  const targetText = `${claim}\n${title}`;
  const topic = getInitialSummaryTopic(claim, title);

  if (looksLikeSocialInsuranceBurdenText(targetText)) {
    return "社会保険料は、家計の可処分所得を減らし、企業側の雇用コストも増やすため、賃上げや少子化対策に影響する可能性があります。消費税との比較では、給与天引きで負担が見えにくい点、現役世代に負担が集中しやすい点、社会保障財源として何を維持するかを分けて確認する必要があります。";
  }

  if (looksLikePriceRateTaxPolicyText(targetText)) {
    return "物価が上がっているだけでは、利上げや増税が適切とは判断できません。まず雇用統計、賃金、実質賃金、個人消費を見て、労働市場と家計が本当に強い局面かを確認する必要があります。雇用・賃金・消費が強く、需要超過による物価上昇なら、利上げや増税による需要抑制が有効になる場合があります。一方、物価上昇が供給制約や輸入物価によるもので、実質賃金や消費が弱い場合は、利上げや増税が家計と企業活動をさらに弱める可能性があります。したがって、政策判断では物価だけでなく、まず雇用統計で経済が本当に過熱しているかを確認する必要があります。";
  }

  if (looksLikeFiscalConsolidationText(targetText)) {
    return "デフレ・需要不足の局面では、政府支出の削減は財政健全化に見えても、経済全体の需要をさらに弱める可能性があります。政府の支出は誰かの所得でもあるため、支出削減が家計所得、企業売上、雇用を弱めると、税収も伸びにくくなります。その結果、短期的な赤字削減を狙っても、景気悪化によって財政健全化がかえって遅れる可能性があります。したがって、財政健全化は重要でも、デフレ局面では支出削減だけでなく、雇用・所得・消費を支える政策とのバランスを確認する必要があります。";
  }

  if (looksLikeLaborCostRationalizationText(targetText)) {
    return "ミクロ企業会計として正しい主張が、マクロ経済政策として常に正しいとは限りません。企業単体では合理的でも、経済全体が需要不足の局面で多くの企業が同時に人件費削減や省人化を進めると、労働所得が減り、消費需要が弱まり、デフレ圧力が強まる可能性があります。したがって、景気局面、需要環境、労働需給、合成の誤謬を分けて検証する必要があります。";
  }

  if (looksLikeEconomyPolicyText(targetText)) {
    return `${topic}については、投稿された主張だけで結論を出すのではなく、家計、企業、雇用、物価、財源への影響を分けて確認する必要があります。現時点では、どの前提なら主張が成り立つのか、どの根拠が強いのか、どの反論リスクが残るのかを整理する段階です。`;
  }

  return "この問いは、投稿された主張だけで結論を出すのではなく、前提・根拠・反論リスクを分けて確認する必要があります。現時点では、提示された問いを軸に、根拠と反論可能性を整理する段階です。";
}

export async function POST(req: NextRequest) {
  try {
    const activeUser = await getActiveForumBetaSessionUser(req);
    if (!activeUser.ok) {
      return NextResponse.json(
        { ok: false, error: activeUser.error },
        { status: activeUser.status }
      );
    }

    const body = await req.json();

    const title = maskForumPrivacyText(String(body?.title || "").trim());
    const claim = maskForumPrivacyText(
      String(body?.claim || body?.question || body?.body || "").trim()
    );
    const category = maskForumPrivacyText(
      String(
        body?.category || body?.main_category || body?.mainCategory || ""
      ).trim()
    );
    const aiAnswerShort = maskForumPrivacyText(
      String(body?.ai_answer_short || body?.aiAnswerShort || "").trim()
    );
    const aiAnswerDetail = maskForumPrivacyText(
      String(body?.ai_answer_detail || body?.aiAnswerDetail || "").trim()
    );
    const aiAnswer = maskForumPrivacyText(
      String(body?.ai_answer || body?.aiAnswer || "").trim()
    );
    const draftSupplements = maskForumPrivacyArray(
      Array.isArray(body?.supplements)
        ? body.supplements.map((value: unknown) => String(value ?? ""))
        : []
    );
    const draftChildTopics = maskForumPrivacyArray(
      (Array.isArray(body?.child_topics)
        ? body.child_topics
        : Array.isArray(body?.childTopics)
        ? body.childTopics
        : []
      ).map((value: unknown) => String(value ?? ""))
    );
    const notSplitReason = maskForumPrivacyText(
      String(body?.not_split_reason || body?.notSplitReason || "").trim()
    );
    const premises = maskForumPrivacyArray(
      Array.isArray(body?.premises)
        ? body.premises.map((value: unknown) => String(value ?? ""))
        : []
    );
    const reasons = maskForumPrivacyArray(
      Array.isArray(body?.reasons)
        ? body.reasons.map((value: unknown) => String(value ?? ""))
        : []
    );
    const conflicts: Conflict[] = Array.isArray(body?.conflicts)
      ? body.conflicts.map((conflict: Conflict) => ({
          opinion: maskForumPrivacyText(String(conflict?.opinion || "").trim()),
          rebuttal: maskForumPrivacyText(String(conflict?.rebuttal || "").trim()),
        }))
      : [];
    const postType = body?.postType === "auto" ? "auto" : "human";

    if (!title || !claim) {
      return NextResponse.json(
        { success: false, error: "title and claim are required" },
        { status: 400 }
      );
    }

    if (title.length > MAX_THREAD_TITLE_LENGTH) {
      return NextResponse.json(
        { success: false, error: "タイトルは120文字以内にしてください。" },
        { status: 400 }
      );
    }

    const draftClaim = buildExternalAiDraftClaim({
      claim,
      aiAnswerShort,
      aiAnswerDetail,
      aiAnswer,
      supplements: toCleanStringArray(draftSupplements, 8),
      childTopics: toCleanStringArray(draftChildTopics, 8),
      notSplitReason,
    });

    if (draftClaim.length > MAX_DRAFT_CLAIM_LENGTH) {
      return NextResponse.json(
        { success: false, error: "投稿候補の本文が長すぎます。短くしてから投稿してください。" },
        { status: 400 }
      );
    }

    if (
      premises.length > MAX_DRAFT_ARRAY_ITEMS ||
      reasons.length > MAX_DRAFT_ARRAY_ITEMS ||
      conflicts.length > MAX_DRAFT_ARRAY_ITEMS
    ) {
      return NextResponse.json(
        { success: false, error: "前提・根拠・反論は各20件以内にしてください。" },
        { status: 400 }
      );
    }

    if (
      premises.some((premise) => textLength(premise) > MAX_DRAFT_ITEM_LENGTH) ||
      reasons.some((reason) => textLength(reason) > MAX_DRAFT_ITEM_LENGTH)
    ) {
      return NextResponse.json(
        { success: false, error: "前提・根拠の各項目は1000文字以内にしてください。" },
        { status: 400 }
      );
    }

    if (
      conflicts.some(
        (conflict) => conflictTextLength(conflict) > MAX_DRAFT_CONFLICT_ITEM_LENGTH
      )
    ) {
      return NextResponse.json(
        { success: false, error: "反論・リスクの各項目は1500文字以内にしてください。" },
        { status: 400 }
      );
    }

    const totalDraftLength =
      title.length +
      draftClaim.length +
      premises.reduce<number>((sum, premise) => sum + textLength(premise), 0) +
      reasons.reduce<number>((sum, reason) => sum + textLength(reason), 0) +
      conflicts.reduce<number>((sum, conflict) => sum + conflictTextLength(conflict), 0);

    if (totalDraftLength > MAX_DRAFT_TOTAL_LENGTH) {
      return NextResponse.json(
        { success: false, error: "投稿候補の内容が長すぎます。短くしてから投稿してください。" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { success: false, error: "Supabase env is missing" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const slug = makeSlug(title);

    const { data: existing } = await supabase
      .from("forum_threads")
      .select("id")
      .eq("title", title)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        success: true,
        threadId: existing.id,
      });
    }

    const { authorKey, shouldSetCookie } = getOrCreateAuthorKey(req);

    const { data: thread, error: threadError } = await supabase
      .from("forum_threads")
      .insert({
        title,
        slug,
        original_post: draftClaim,
        category: category || null,
        ai_summary: null,
        is_deleted: false,
      })
      .select("id")
      .single();

    if (threadError || !thread) {
      return NextResponse.json(
        { success: false, error: threadError?.message || "thread insert failed" },
        { status: 500 }
      );
    }

    const threadId = thread.id;

    const seedPosts: {
      thread_id: string;
      content: string;
      source_type: string;
      post_role: string;
      trust_status: string;
      logic_score: number;
      author_key: string;
    }[] = [
    {
      thread_id: threadId,
      content: draftClaim,
      source_type: postType === "auto" ? "ai" : "human",
      post_role: "issue_raise",
      trust_status: "trusted",
      logic_score: 70,
      author_key: authorKey,
    },
    ];

    for (const premise of premises) {
      const text = String(premise || "").trim();
      if (!text) continue;

      seedPosts.push({
        thread_id: threadId,
        content: text,
        source_type: "ai",
        post_role: "supplement",
        trust_status: "trusted",
        logic_score: 85,
        author_key: authorKey,
      });
    }

    for (const reason of reasons) {
      const text = String(reason || "").trim();
      if (!text) continue;
      seedPosts.push({
        thread_id: threadId,
        content: `根拠: ${reason}`,
        source_type: "ai",
        post_role: "explanation",
        trust_status: "trusted",
        logic_score: 90,
        author_key: authorKey,
      });
    }


    for (const conflict of conflicts) {
      const opinion = String(conflict?.opinion || "").trim();
      const rebuttal = String(conflict?.rebuttal || "").trim();

      if (opinion) {
        seedPosts.push({
          thread_id: threadId,
          content: opinion,
          source_type: "ai",
          post_role: "opinion",
          trust_status: "trusted",
          logic_score: 75,
          author_key: authorKey,
        });
      }

      if (rebuttal) {
        seedPosts.push({
          thread_id: threadId,
          content: rebuttal,
          source_type: "ai",
          post_role: "rebuttal",
          trust_status: "trusted",
          logic_score: 95,
          author_key: authorKey,
        });
      }
    }

    const { error: postError } = await supabase
      .from("forum_posts")
      .insert(seedPosts);

    if (postError) {
      return NextResponse.json(
        { success: false, error: postError.message },
        { status: 500 }
      );
    }

    const rawInitialAiAnswer =
      extractAiAnswerFromClaim(draftClaim) || buildInitialSummaryText(draftClaim, title);
    const initialAiAnswer = buildLayeredInitialSummaryText(
      rawInitialAiAnswer,
      draftClaim,
      title
    );

    if (initialAiAnswer) {
      const initialRebuttals = conflicts
        .map((conflict) => String(conflict?.rebuttal ?? "").trim())
        .filter(Boolean)
        .slice(0, 5);
      const initialOpinions = conflicts
        .map((conflict) => String(conflict?.opinion ?? "").trim())
        .filter(Boolean)
        .slice(0, 5);
      const keyPoints = {
        issues: [title],
        opinions: initialOpinions,
        rebuttals: initialRebuttals,
        supplements: toCleanStringArray(premises),
        explanations: toCleanStringArray(reasons),
      };

      const { error: initialSummaryError } = await supabase
        .from("thread_ai_structures")
        .insert({
          thread_id: threadId,
          original_post: draftClaim,
          normalized_theme: title,
          summary_text: initialAiAnswer,
          easy_summary_text: shortText(initialAiAnswer),
          key_points: keyPoints,
          issues: keyPoints.issues,
          opinions: keyPoints.opinions,
          rebuttals: keyPoints.rebuttals,
          supplements: keyPoints.supplements,
          explanations: keyPoints.explanations,
          trust_status: "trusted",
          status: "active",
          summary_type: "initial_thread_summary",
          source_post_count: 0,
          updated_at: new Date().toISOString(),
        });

      if (initialSummaryError) {
        console.warn(
          "[create-thread-from-draft initial summary skipped]",
          initialSummaryError.message
        );
      }
    }

    const response = NextResponse.json({
      success: true,
      threadId,
    });

    if (shouldSetCookie) {
      response.headers.set(
        "Set-Cookie",
        buildAuthorKeyCookie(authorKey)
      );
    }

    return response;
  } catch (e: any) {
    console.error("[create-thread-from-draft error]", e);

    return NextResponse.json(
      {
        success: false,
        error: e?.message || "unexpected error",
      },
      { status: 500 }
    );
  }
}
