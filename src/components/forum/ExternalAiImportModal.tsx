"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

type CandidateStatus = "unselected" | "post" | "skip";
type ExtractionMode = "category" | "auto";

type ExternalAiCandidate = {
  title: string;
  question: string;
  ai_answer: string;
  ai_answer_short: string;
  ai_answer_detail: string;
  premises: string[];
  visible_premises: string[];
  hidden_premises: string[];
  reasons: string[];
  risks: string[];
  visible_risks: string[];
  hidden_risks: string[];
  supplements: string[];
  child_topics: string[];
  not_split_reason: string;
  category: string;
  related_categories: string[];
  sub_category: string;
  tags: string[];
  node: string;
  source_ai: string;
  status: CandidateStatus;
  isEditing: boolean;
};

type ExternalAiPrivateItem = {
  kind: "todo" | "idea" | "note";
  title: string;
  content: string;
  tags: string[];
  source_ai: string;
};

type ExternalAiImportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  tenant: string;
};

type SubmitResult = {
  status: "success" | "error";
  threadId?: string;
  url?: string;
  error?: string;
  requiresLogin?: boolean;
  created?: boolean;
  existing?: boolean;
};

type RelatedThread = {
  id: string;
  title: string;
  category?: string | null;
  ai_summary?: string | null;
  reason?: string | null;
};

type RelatedSearchState = {
  loading: boolean;
  error?: string;
  threads: RelatedThread[];
};

type SaveReferenceState = {
  loading: boolean;
  saved?: boolean;
  logId?: string;
  error?: string;
};

const MAX_CANDIDATES = 20;
const MAX_PRIVATE_ITEMS = 20;
const MAX_SELECTED_CATEGORIES = 3;
const EXTERNAL_AI_IMPORT_DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const LOGIN_REQUIRED_MESSAGE =
  "投稿にはログインが必要です。候補内容は一時保存されています。ログイン後、候補を復元して投稿できます。";
const MAIN_CATEGORY_OPTIONS = [
  "経済・政策",
  "AI・技術",
  "特許・発明",
  "恋愛・人間関係",
  "仕事・経営",
  "生活・健康",
  "その他",
];

function formatSubmitSuccessMessage(result: SubmitResult) {
  if (result.created === true) return "新規投稿を作成しました：";
  if (result.existing === true) return "同じタイトルの既存スレッドに紐づきました：";
  return "投稿済み：";
}

const SOURCE_AI_OPTIONS = [
  "未指定",
  "ChatGPT",
  "Gemini",
  "Claude",
  "Grok",
  "Perplexity",
  "その他",
];

function removeExternalAiImportDraft(draftStorageKey: string) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(draftStorageKey);
  } catch (removeError) {
    console.error("[external-ai-import draft remove failed]", removeError);
  }
}

function buildExternalAiPrompt(
  extractionMode: ExtractionMode,
  selectedCategories: string[]
) {
  const categories = selectedCategories.filter(Boolean);
  const categoryList = MAIN_CATEGORY_OPTIONS.map((category) => `- ${category}`).join("\n");
  const selectedCategoryText = categories.length
    ? categories.map((category) => `- ${category}`).join("\n")
    : "- 未選択";
  const shouldIncludeEconomyPolicyRules =
    extractionMode === "auto" || categories.includes("経済・政策");
  const modeInstruction =
    extractionMode === "category"
      ? `抽出モード：テーマを選んで抜き出す

抽出対象カテゴリー：
${selectedCategoryText}

選択したカテゴリーに関係する内容だけを投稿候補にしてください。
選択していないカテゴリーの話題は、投稿候補に含めないでください。`
      : `抽出モード：AIに全部分類させる

カテゴリー候補：
${categoryList}

会話ログ全体を読み、投稿候補ごとに最も近いカテゴリーへ分類してください。
投稿不要な雑談、個人的内容、プライバシー情報は除外してください。`;
  const economyPolicyInstruction = shouldIncludeEconomyPolicyRules
    ? `
経済・政策カテゴリーの追加ルール：
経済・政策に関する投稿候補では、単なる賛否や感想ではなく、以下の観点をできるだけ反映してください。

- その主張がどのマクロ経済理論・経済概念と関係するか
- 主張が成立するための前提は何か
- 因果関係は明確か
- どの現実指標で検証できるか
- どの反論・リスクがあるか
- 経済理論上の妥当性と、政治的・制度的な実現可能性を混同していないか

参照してよい理論・視点：
- 有効需要
- 需給ギャップ
- 財政乗数
- クラウディングアウト
- 消費性向
- 可処分所得
- インフレ率
- 金利
- 金融政策と財政政策の組み合わせ
- 労働需給
- 賃金上昇圧力
- 供給制約
- 為替・輸入物価
- 財政収支・債務残高

経済・政策カテゴリーの最重要ルール：
会話ログ内の人物発言や賛否対立を、そのまま投稿候補にしないでください。
必ず「経済政策として何を検証すべき問いか」に再構成してください。

特に、賃金・生産性・価格転嫁・物価・雇用・人手不足に関する投稿では、
人物対立ではなく、景気局面・需要環境・労働需給・失業率・価格転嫁・生産性の因果関係へ変換してください。

経済・政策カテゴリーの独立論点ルール：
会話ログ内に「内需国」「外需国」「輸入依存」「国内供給力」「エネルギー価格」「為替」「供給不足」「賃金上昇」などの論点が含まれる場合は、財政・債務論に吸収せず、独立した投稿候補として抽出できるかを必ず検討してください。

この論点では、以下の因果関係を優先して整理してください。
- 内需が強い国では、需要増が国内企業の売上増、設備投資、雇用拡大、賃金上昇につながる可能性がある。
- 輸入依存が強い国では、物価上昇が国内賃金ではなく、輸入コスト増、通貨安、実質所得低下につながる可能性がある。
- エネルギー・食料・原材料の輸入依存度が高い場合、インフレが国内の賃金上昇に直結しない可能性がある。
- 国内供給力がある分野では、財政支出や需要回復が投資・雇用・賃金に波及する可能性がある。
- 金融引き締めや緊縮が早すぎると、需要回復から賃金上昇へ向かう経路を途中で止める可能性がある。

この論点の question は、単に「内需国と外需国の違い」とせず、以下のように検証可能な経済政策上の問いにしてください。
例: 内需国と外需国では、インフレや供給不足が賃金上昇に波及する経路がどう違うのか。

取りこぼしたくない経済論点：
1. 日本は本当に借金大国なのか
- 政府債務だけでなく、政府資産、日銀保有国債、自国通貨建て債務、対外純資産を含めて見るべきではないか。
- これは財政余地・政府バランスシートの独立論点として扱えます。

2. コロナ後、海外はどう雇用と賃金を回復させたのか
- アメリカなどは大規模な財政支出と金融緩和で需要を戻し、インフレをある程度許容しながら雇用・賃金を回復させた。
- 日本は賃金上昇が広く波及する前に財政・金融の正常化へ向かっていないか。
- これは海外比較・需要回復・雇用賃金回復の独立論点として扱えます。

3. 内需国と外需国では、インフレや供給不足が賃金上昇に波及する経路が違うのではないか
- 内需が強く国内供給力がある国では、需要増が国内企業の売上増、設備投資、雇用拡大、賃金上昇につながりやすい。
- 輸入依存が強い国では、物価上昇が国内賃金ではなく、輸入コスト増、通貨安、実質所得低下に流れやすい。
- この論点は、財政・債務論に吸収せず、独立した投稿候補として扱ってください。

4. 日本は賃金上昇が定着する前に金融引き締めへ向かっていないか
- 実質賃金、中小企業への賃上げ波及、正社員求人倍率、内需回復が十分でない段階で利上げ・緊縮に向かうと、賃金上昇を抑え込むリスクがある。
- これは金融政策・雇用・賃金・内需回復の独立論点として扱えます。

出力フィールドの意味：
- question: 人物対立ではなく、親ノード化した経済政策上の問い
- ai_answer: 景気局面別の暫定回答
- premises: 投稿者の前提ではなく、判断に不足している前提・確認条件
- reasons: 人物発言の補強ではなく、経済理論上の因果順序
- risks: 人物同士の対立ではなく、成立しない条件・逆効果・副作用
- supplements: 検証すべき指標、追加論点、確認すべきデータ
- tags: 人物名ではなく、理論・政策・指標に関するタグ

question の作り方：
悪い例: 竹中氏と竹田氏のどちらが正しいか。
良い例: 賃金上昇は、どの景気局面で、どの経路を通じて起こるのか。
良い例: 生産性向上は賃金上昇の原因なのか、それとも賃金上昇による企業改革の結果なのか。

ai_answer の作り方：
「どちらも一理あります」で終わらせないでください。
必ず、景気局面を分けて暫定回答してください。
ミクロ企業会計として正しい話と、マクロ経済政策として成立する話を分けてください。
需要増、労働需要増、人手不足、失業率低下、労働者の交渉力上昇、賃金上昇の順序を確認してください。

premises の作り方：
投稿者や登場人物が言っている前提をコピーしないでください。
判断に必要だが、投稿文だけでは不足している条件を入れてください。
「〜なのか？」という問いを書かないでください。
premises には、判断前に確認すべき条件・局面・検証前提を書いてください。
文はできるだけ「〜を確認する必要がある。」「〜を分ける必要がある。」「〜が前提になる。」「〜によって結論が変わる。」の形にしてください。
悪い例:
- ミクロでは正しい政策論が、マクロでは逆効果になることはあるのか
- 生産性向上は賃金上昇につながるのか
- どちらの主張が正しいのか
- 価格転嫁は庶民を苦しめるのか
例:
- 現在がデフレ・需要不足局面か、インフレ・需要超過局面かを確認する必要がある。
- 企業が省人化・人件費削減で対応する局面か、増産・雇用拡大で対応する局面かを分ける必要がある。
- 労働需要、失業率、実質賃金、家計所得、消費需要への影響を確認する必要がある。
- 価格転嫁が可能な需要環境か、価格転嫁によって需要が落ちる環境かを確認する必要がある。
- ミクロ企業会計上の合理性と、マクロ経済全体での合成の誤謬を分ける必要がある。
- 財政政策・金融政策・為替・物価・雇用への波及を確認する必要がある。

reasons の作り方：
人物発言の補強ではなく、経済理論上の因果順序を入れてください。
例:
- 需要増により企業の売上期待が高まると、労働需要が増える。
- 労働需要が増えると人手不足が起こり、失業率が低下しやすくなる。
- 人手不足と失業率低下により、労働者の交渉力が上がり、賃金上昇圧力が生まれる。
- この流れはフィリップス曲線的に説明できる。

risks の作り方：
人物同士の対立を書かないでください。
主張が成立しない条件、逆効果、副作用を書いてください。
例:
- デフレ・需要不足下で生産性向上だけを進めると、省人化や人件費削減に使われ、労働需要が低下する可能性がある。
- 労働需要が低下すると、失業率悪化、賃金停滞、所得減、消費低迷、デフレ圧力につながる可能性がある。
- 価格転嫁を単純に悪と見ると、企業収益や賃金原資の確保という側面を見落とす可能性がある。

承・転を強くする追加ルール：
- reasons は、一般論ではなく、できるだけ具体的な根拠・時系列・因果関係にしてください。
- 経済・政策テーマでは、需要不足か需要超過か、実質賃金、個人消費、雇用、物価上昇の原因、増税や緊縮のタイミング、財政支出と需要の関係を優先してください。
- 財政・消費税・デフレ関連では、必要に応じて、1997年消費税増税後の消費や実質GDPの弱まり、2014年消費税増税後の個人消費の落ち込み、2019年消費税増税後はコロナが重なり増税単独の検証が難しい点を根拠候補として扱ってください。ただし断定しすぎず、影響を検証する必要があると書いてください。
- 財政・消費税・デフレ関連の premises には、現在の物価高が需要超過型なのか輸入物価・円安型なのか、実質賃金と個人消費が弱い局面か、減税の対象・期間・財源をどう分けるかを入れてください。
- risks は、元の主張の繰り返しではなく、本当の反論にしてください。
- 消費税減税、財政支出、財政赤字、デフレ対策、需要刺激に関する投稿では、risks は可能な限り3件に分け、各項目の先頭を「反論A：財源問題」「反論B：将来増税予想」「反論C：インフレ再燃・円安リスク」のようにしてください。
- 反論Aでは、消費税減税で減った税収をどう補うか、社会保障財源との関係を説明してください。
- 反論Bでは、国債で減税を賄う場合に、将来増税を予想した家計が消費を増やさず貯蓄に回す可能性を説明してください。
- 反論Cでは、需要刺激が強すぎると輸入物価や円安を通じて物価上昇を招く可能性を説明し、需要不足局面では限定的な場合もあると補足してください。
- 金利上昇リスク、為替リスク、無駄遣いリスク、クラウディングアウト、リカードの等価定理、財政健全化論、供給力不足下で需要刺激すると物価だけ上がるリスクも、投稿内容に合う場合は反論候補にしてください。
- 専門用語を使う場合は、一般ユーザー向けに一言説明を添えてください。
- 「一概には言えない」「バランスが重要」だけで終わらせないでください。
- 「しかし、注意が必要です」「しかし、懸念があります」のような抽象文を複数並べるだけにしないでください。

絶対に避けること：
- 登場人物の発言を premises / reasons / risks にコピーする
- risks に「Aの主張 / Bの主張」のような対立を書く
- 景気局面を確認せず一般論にする
- 生産性向上を常に賃金上昇につながるものとして扱う
- 価格転嫁を単純に悪と決めつける

注意：
特定の経済学派や権威を唯一の正解として扱わないでください。
複数の理論が競合する場合は、「どの前提なら成立するか」「どの指標で確認できるか」を重視してください。
断定しすぎず、必要に応じて「可能性がある」と表現してください。
`
    : "";

  const economyPolicyFinalCheck = shouldIncludeEconomyPolicyRules
    ? `
経済・政策カテゴリーの最終チェック：
- question は人物対立ではなく、親ノード化した経済政策上の問いになっているか
- premises は投稿者の前提ではなく、不足している確認条件になっているか
- premises に「〜なのか？」という問いが入っていないか
- premises が、判断に必要な確認条件・局面・検証前提になっているか
- reasons は人物発言の補強ではなく、経済理論上の因果順序になっているか
- risks は人物同士の対立ではなく、成立しない条件・逆効果・副作用になっているか
- reasons が一般論だけでなく、具体的な因果関係・時系列・検証条件を含んでいるか
- risks が元の主張の繰り返しではなく、反論A/B/Cに相当する本当の反論になっているか
- 消費税減税・財政・デフレ関連では、risks が反論A/B/Cのように分かれているか
- tags は人物名ではなく、理論・政策・指標タグになっているか

`
    : "";

  return `以下の会話ログを、AI知恵袋の掲示板投稿用に整理してください。

${modeInstruction}
${economyPolicyInstruction}

目的：
雑多な会話ログから、掲示板に投稿しやすい親テーマと、その中に含める子論点・補足・反論を整理することです。

プライバシー保護：
投稿候補を作る前に、以下を必ず除去・匿名化してください。
- 個人名
- 住所
- 電話番号
- メールアドレス
- 店名や勤務先など、個人が特定されやすい情報
- LINE内容など、相手のプライバシーに関わる情報
- 恋愛・家族・健康・金銭など、投稿に不要な私的情報
- 第三者を特定できる表現

判断に迷う情報は、投稿候補に含めず、一般化してください。

ニュース記事・新聞記事・社説・経済ニュースに関する会話の扱い：
会話ログ内で新聞記事、ニュース記事、社説、解説記事、日経・朝日・読売などの媒体名、または「記事ではこう書かれていた」という話題が出ている場合でも、記事本文をそのまま投稿本文として再掲しないでください。
公開投稿候補では、記事本文の全文転載を避け、記事タイトル・媒体名・URL・公開日などが含まれていても、それらの正確性や元記事との一致を保証しない前提で扱ってください。
AIは、ユーザーが入力した文章・要約・会話内容をもとに、そこに含まれる主張・前提・反論・リスク・海外比較・検証指標を整理してください。
投稿タイトルは、記事タイトルそのものではなく、「記事の主張に対する問い」や「確認すべき前提」が分かる形にしてください。
悪い例: 日経新聞：物価上昇で利上げ必要
良い例: 物価上昇を理由に利上げを主張する記事は、輸入コスト主導か需要過熱かを区別しているのか
記事の出所については断定しないでください。
「日経新聞の記事である」「朝日新聞の記事である」「元記事と本文が一致している」と保証する表現は避けてください。
必要に応じて「ユーザー入力文では」「記事として紹介された文章では」のように表現してください。
経済・政策カテゴリーでニュース記事を扱う場合は、内容に合う範囲で tags に「経済ニュース」「ニュース読解」「記事検証」「前提確認」「検証指標」を含めてください。
経済記事・政策記事については、景気局面、需要不足 / 需要超過、需要過熱インフレ / 輸入コスト主導インフレ、財政政策、金融政策、賃金・雇用、実質賃金、政府債務だけでなく政府資産・対外純資産、海外比較、反論・リスク、あとで確認する指標を確認してください。

投稿候補数と整理方針：
- 抽出対象カテゴリーが1つの場合、投稿候補は最大5件までにしてください。
- 複数カテゴリーを扱う場合、投稿候補は全体で最大10件までにしてください。
- 複数カテゴリーの場合でも、1カテゴリーあたり最大5件までにしてください。
- 中心テーマが1つしかない場合は、原則1〜3件にまとめてください。
- ただし、同じ親テーマに属していても、読者が別々に検証できる独立した政策論点・技術論点・生活課題がある場合は、最大5件まで子投稿として分割してかまいません。
- 単なる補足、言い換え、反論だけ、具体例だけの内容は独立投稿にしないでください。
- 重要論点を取りこぼすよりは、主要な独立論点を投稿候補として残すことを優先してください。
- 迷う場合は「親テーマ1件＋主要子論点2〜3件」を基本形にしてください。
出力前に必ず「この話は同じ親テーマに統合できるか？」を判定してください。
親テーマの問いは、後から子論点を追加できるように、できるだけ広く作ってください。
重要度が高いと思われる順に並べてください。
似ている論点・重複する質問は、別々に出さず、1つの投稿候補に統合してください。
細かすぎる話題は、必要に応じて大きな論点へまとめてください。

読みやすさのための2層構造：
- ai_answer は従来互換用に必ず残してください。
- ai_answer_short は、中学生でも分かる短い説明にしてください。専門用語をなるべく避け、まず結論を示してください。
- ai_answer_detail は、専門的な因果関係・条件分岐・検証指標を含む詳しい説明にしてください。
- visible_premises は、一般ユーザーに最初から見せる重要前提を2〜3件までにしてください。
- hidden_premises は、残りの詳しい前提・確認条件を入れてください。
- visible_risks は、本質的な反論・リスクを最大3件までにしてください。
- hidden_risks は、補足的な反論・リスクを入れてください。
- premises / risks は従来互換用に残しつつ、visible / hidden の分け方を優先してください。

同じ親テーマでも分割してよい条件：
以下のうち2つ以上を満たす場合は、同じ親テーマに属していても、別投稿候補にしてかまいません。
- question が別の検証問いになっている。
- ai_answer の結論や条件分岐が別になる。
- 検証すべき指標が別になる。
- 読者がその投稿だけ読んでも意味が通る。
- 親テーマは同じでも、別ノードとして蓄積する価値がある。

ただし、以下は独立投稿にしないでください。
- 単なる言い換え
- 具体例だけ
- 感想だけ
- 反論だけ
- 元投稿の補足説明だけ
- 同じ question に対する小さな補助論点

分割してよい例：
- 税制の話とAI著作権の話のように、問いも結論も対象分野も別である
- 政策判断の話と個人の生活相談の話のように、投稿先カテゴリーが明確に別である

分割してはいけない例：
- 同じ主張を言い換えただけの投稿候補を複数作る
- 1つの政策テーマを細切れにして5件以上にする
- 補足説明だけを独立投稿にする
- 反論だけを親テーマなしで独立投稿にする

ルール：
- 個人情報、住所、電話番号、氏名、メールアドレス、個人的すぎる内容は除去または匿名化してください。
- 雑談や投稿に不要な内容は除外してください。
- 複数の論点があっても、同じ親テーマに属する場合は1つの投稿候補にまとめてください。
- 別投稿にした場合は、別テーマとして分けた理由が分かるようにしてください。
- 事実と推測を混同しないでください。
- 断定しすぎず、必要に応じて「可能性がある」と表現してください。
- 各投稿候補に main_category を必ず1つ付けてください。
- related_categories は必要に応じて複数付けてください。
- sub_category と tags も付けてください。
- tags は3〜8個程度にしてください。
- 本人用のToDo、アイデア、非公開メモはpostsに混ぜず、todos / ideas / private_notesに分けてください。
- todos / ideas / private_notesは公開投稿ではありません。
- 出力は必ずJSONにしてください。
- JSON以外の説明文は出力しないでください。

${economyPolicyFinalCheck}
出力形式：
{
  "posts": [
    {
      "main_category": "主カテゴリー",
      "related_categories": ["関連カテゴリー"],
      "sub_category": "小カテゴリー",
      "tags": ["タグ1", "タグ2", "タグ3"],
      "title": "投稿タイトル案",
      "question": "問題・質問",
      "ai_answer": "AI回答・整理",
      "ai_answer_short": "誰でも分かる短い説明",
      "ai_answer_detail": "専門的な因果関係・条件分岐・検証指標を含む詳しい説明",
      "premises": ["前提1", "前提2"],
      "visible_premises": ["最初から見せる前提1", "最初から見せる前提2"],
      "hidden_premises": ["詳しい前提1"],
      "reasons": ["根拠1", "根拠2"],
      "risks": ["反論・リスク1", "反論・リスク2"],
      "visible_risks": ["本質的な反論・リスク1", "本質的な反論・リスク2"],
      "hidden_risks": ["補足的な反論・リスク1"],
      "supplements": ["補足1", "補足2"],
      "child_topics": ["子論点候補1", "子論点候補2"],
      "not_split_reason": "同じ親テーマに統合した理由",
      "category": "主カテゴリー",
      "node": "候補ノード"
    }
  ],
  "todos": [
    {
      "title": "やること",
      "content": "本人が後で実行する内容",
      "tags": ["タグ"]
    }
  ],
  "ideas": [
    {
      "title": "アイデア",
      "content": "発信・実装・調査の候補",
      "tags": ["タグ"]
    }
  ],
  "private_notes": [
    {
      "title": "非公開メモ",
      "content": "公開投稿にはしないメモ",
      "tags": ["タグ"]
    }
  ]
}`;
}

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  background: "rgba(15, 23, 42, 0.58)",
  color: "#111827",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const dialogStyle: CSSProperties = {
  width: "min(100%, 960px)",
  maxHeight: "92vh",
  overflowY: "auto",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#111827",
  boxShadow: "0 24px 70px rgba(15, 23, 42, 0.24)",
};

const sectionStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: 14,
  background: "#f8fafc",
  color: "#111827",
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: 6,
  color: "#475569",
  fontSize: 13,
  fontWeight: 800,
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  padding: "10px 12px",
  background: "#ffffff",
  color: "#111827",
  fontSize: 15,
  lineHeight: 1.6,
};

const buttonStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "9px 12px",
  background: "#ffffff",
  color: "#111827",
  cursor: "pointer",
  fontWeight: 800,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toTextArray(value: unknown) {
  if (typeof value === "string") {
    const text = value.trim();
    return text ? [text] : [];
  }
  if (!Array.isArray(value)) return [];
  return value.map(toText).filter(Boolean).slice(0, 8);
}

function getParsedCandidateList(value: unknown) {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return null;
  if (Array.isArray(value.posts)) return value.posts;
  if (Array.isArray(value.candidates)) return value.candidates;
  if (Array.isArray(value.items)) return value.items;
  return null;
}

function isCandidateStatus(value: unknown): value is CandidateStatus {
  return value === "unselected" || value === "post" || value === "skip";
}

function isExtractionMode(value: unknown): value is ExtractionMode {
  return value === "category" || value === "auto";
}

function linesToArray(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function stripMarkdownJsonFence(value: string) {
  const trimmed = value.trim();
  const fencedBlock = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fencedBlock?.[1]) return fencedBlock[1].trim();

  const embeddedFence = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (embeddedFence?.[1]) return embeddedFence[1].trim();

  return trimmed;
}

function normalizeJsonInputText(value: string) {
  return stripMarkdownJsonFence(value)
    .replace(/[“”„＂]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

function normalizeCandidate(value: unknown): ExternalAiCandidate | null {
  const record = isRecord(value) ? value : {};
  const title = toText(record.title);
  const question = toText(record.question);
  const aiAnswerShort = toText(record.ai_answer_short) || toText(record.short_answer);
  const aiAnswerDetail = toText(record.ai_answer_detail) || toText(record.detail_answer);
  const aiAnswer =
    toText(record.ai_answer) ||
    toText(record.answer) ||
    toText(record.summary) ||
    toText(record.content) ||
    [aiAnswerShort, aiAnswerDetail].filter(Boolean).join("\n\n");
  const mainCategory = toText(record.main_category) || toText(record.category);
  const subCategory = toText(record.sub_category);
  const childTopics =
    toTextArray(record.child_topics).length > 0
      ? toTextArray(record.child_topics)
      : toTextArray(record.child_issues).length > 0
      ? toTextArray(record.child_issues)
      : toTextArray(record.sub_topics).length > 0
      ? toTextArray(record.sub_topics)
      : toTextArray(record.related_points);
  const notSplitReason =
    toText(record.not_split_reason) ||
    toText(record.merge_reason) ||
    toText(record.consolidation_reason) ||
    toText(record.not_separated_reason);

  if (!title && !question && !aiAnswer && !aiAnswerShort && !aiAnswerDetail) {
    return null;
  }

  return {
    title,
    question,
    ai_answer: aiAnswer,
    ai_answer_short: aiAnswerShort,
    ai_answer_detail: aiAnswerDetail,
    premises: toTextArray(record.premises),
    visible_premises: toTextArray(record.visible_premises),
    hidden_premises: toTextArray(record.hidden_premises),
    reasons: toTextArray(record.reasons),
    risks: toTextArray(record.risks),
    visible_risks: toTextArray(record.visible_risks),
    hidden_risks: toTextArray(record.hidden_risks),
    supplements: toTextArray(record.supplements),
    child_topics: childTopics,
    not_split_reason: notSplitReason,
    category: mainCategory,
    related_categories: toTextArray(record.related_categories),
    sub_category: subCategory,
    tags: toTextArray(record.tags),
    node: toText(record.node) || subCategory,
    source_ai: toText(record.source_ai) || "未指定",
    status: "unselected",
    isEditing: false,
  };
}

function normalizePrivateItem(
  value: unknown,
  kind: ExternalAiPrivateItem["kind"]
): ExternalAiPrivateItem | null {
  const record = isRecord(value) ? value : {};
  const rawText = typeof value === "string" ? value.trim() : "";
  const content =
    toText(record.content) ||
    toText(record.body) ||
    toText(record.description) ||
    toText(record.memo) ||
    toText(record.note) ||
    toText(record.text) ||
    rawText;
  const title =
    toText(record.title) ||
    toText(record.task) ||
    toText(record.idea) ||
    toText(record.summary) ||
    (content.length > 60 ? `${content.slice(0, 60)}...` : content);

  if (!title && !content) return null;

  return {
    kind,
    title,
    content,
    tags: toTextArray(record.tags),
    source_ai: toText(record.source_ai) || "未指定",
  };
}

function getParsedPrivateItems(value: unknown) {
  if (!isRecord(value)) return [];

  const groups: Array<{
    kind: ExternalAiPrivateItem["kind"];
    items: unknown;
  }> = [
    { kind: "todo", items: value.todos },
    { kind: "idea", items: value.ideas },
    { kind: "note", items: value.private_notes },
  ];

  return groups
    .flatMap(({ kind, items }) =>
      Array.isArray(items)
        ? items.map((item) => normalizePrivateItem(item, kind))
        : []
    )
    .filter((item): item is ExternalAiPrivateItem => Boolean(item))
    .slice(0, MAX_PRIVATE_ITEMS);
}

function normalizeStoredCandidate(value: unknown): ExternalAiCandidate | null {
  const candidate = normalizeCandidate(value);
  if (!candidate || !isRecord(value)) return candidate;

  return {
    ...candidate,
    status: isCandidateStatus(value.status) ? value.status : candidate.status,
    isEditing:
      typeof value.isEditing === "boolean" ? value.isEditing : candidate.isEditing,
  };
}

function normalizeRelatedThread(value: unknown): RelatedThread | null {
  if (!isRecord(value)) return null;

  const id = toText(value.id);
  if (!id) return null;

  return {
    id,
    title: toText(value.title) || "無題スレッド",
    category: toText(value.category) || null,
    ai_summary: toText(value.ai_summary) || null,
    reason: toText(value.reason) || null,
  };
}

function safeItems(items: string[] | undefined) {
  return Array.isArray(items) ? items.filter(Boolean) : [];
}

function uniqueItems(...groups: Array<string[] | undefined>) {
  const seen = new Set<string>();
  return groups.flatMap(safeItems).filter((item) => {
    if (seen.has(item)) return false;
    seen.add(item);
    return true;
  });
}

function buildCandidateClaim(candidate: ExternalAiCandidate) {
  const supplements = safeItems(candidate.supplements);
  const childTopics = safeItems(candidate.child_topics);
  const answerParts = [
    candidate.ai_answer_short
      ? `【誰でも分かる説明】\n${candidate.ai_answer_short}`
      : "",
    candidate.ai_answer_detail
      ? `【もう少し詳しい説明】\n${candidate.ai_answer_detail}`
      : "",
    candidate.ai_answer
      ? `AI回答・整理:\n${candidate.ai_answer}`
      : "",
  ].filter(Boolean);
  const parts = [
    candidate.question,
    ...answerParts,
    supplements.length ? `補足:\n${supplements.join("\n")}` : "",
    childTopics.length ? `子論点候補:\n${childTopics.join("\n")}` : "",
    candidate.not_split_reason
      ? `分割しなかった理由:\n${candidate.not_split_reason}`
      : "",
  ].filter(Boolean);

  return parts.join("\n\n") || candidate.title || "外部AI整理からの投稿";
}

function buildPrivateLogCandidate(candidate: ExternalAiCandidate) {
  return {
    title: candidate.title,
    question: candidate.question,
    ai_answer: candidate.ai_answer,
    ai_answer_short: candidate.ai_answer_short,
    ai_answer_detail: candidate.ai_answer_detail,
    premises: safeItems(candidate.premises),
    visible_premises: safeItems(candidate.visible_premises),
    hidden_premises: safeItems(candidate.hidden_premises),
    reasons: safeItems(candidate.reasons),
    risks: safeItems(candidate.risks),
    visible_risks: safeItems(candidate.visible_risks),
    hidden_risks: safeItems(candidate.hidden_risks),
    supplements: safeItems(candidate.supplements),
    child_topics: safeItems(candidate.child_topics),
    not_split_reason: candidate.not_split_reason,
    category: candidate.category,
    main_category: candidate.category,
    related_categories: safeItems(candidate.related_categories),
    sub_category: candidate.sub_category,
    tags: safeItems(candidate.tags),
    node: candidate.node,
    source_ai: candidate.source_ai || "未指定",
  };
}

function FieldBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ ...labelStyle, marginBottom: 4 }}>{label}</div>
      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{children || "-"}</div>
    </div>
  );
}

function ListBlock({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div style={{ ...labelStyle, marginBottom: 4 }}>{label}</div>
      {items.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
          {items.map((item, index) => (
            <li key={`${label}-${index}-${item}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <div style={{ color: "#64748b" }}>-</div>
      )}
    </div>
  );
}

function privateItemKindLabel(kind: ExternalAiPrivateItem["kind"]) {
  if (kind === "todo") return "ToDo";
  if (kind === "idea") return "アイデア";
  return "非公開メモ";
}

export default function ExternalAiImportModal({
  isOpen,
  onClose,
  tenant,
}: ExternalAiImportModalProps) {
  const [jsonInput, setJsonInput] = useState("");
  const [candidates, setCandidates] = useState<ExternalAiCandidate[]>([]);
  const [privateItems, setPrivateItems] = useState<ExternalAiPrivateItem[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [extractionMode, setExtractionMode] =
    useState<ExtractionMode>("category");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    "経済・政策",
  ]);
  const [categoryLimitMessage, setCategoryLimitMessage] = useState("");
  const [sourceAi, setSourceAi] = useState("未指定");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [submitResults, setSubmitResults] = useState<Record<number, SubmitResult>>(
    {}
  );
  const [relatedByCandidate, setRelatedByCandidate] = useState<
    Record<number, RelatedSearchState>
  >({});
  const [savedReferences, setSavedReferences] = useState<
    Record<string, SaveReferenceState>
  >({});

  const selectedCount = useMemo(
    () => candidates.filter((candidate) => candidate.status === "post").length,
    [candidates]
  );
  const externalAiPrompt = useMemo(
    () => buildExternalAiPrompt(extractionMode, selectedCategories),
    [extractionMode, selectedCategories]
  );
  const draftStorageKey = `forum_external_ai_import_draft_${tenant}`;
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  useEffect(() => {
    if (!isOpen || hasRestoredDraft || typeof window === "undefined") return;

    try {
      const saved = window.sessionStorage.getItem(draftStorageKey);
      if (!saved) return;

      const parsed: unknown = JSON.parse(saved);
      if (!isRecord(parsed)) {
        removeExternalAiImportDraft(draftStorageKey);
        return;
      }

      const savedAt = parsed.savedAt;
      if (
        typeof savedAt !== "number" ||
        !Number.isFinite(savedAt) ||
        Date.now() - savedAt > EXTERNAL_AI_IMPORT_DRAFT_MAX_AGE_MS
      ) {
        removeExternalAiImportDraft(draftStorageKey);
        return;
      }

      if (!Array.isArray(parsed.candidates)) {
        removeExternalAiImportDraft(draftStorageKey);
        return;
      }

      const restoredCandidates = parsed.candidates
        .map(normalizeStoredCandidate)
        .filter((candidate): candidate is ExternalAiCandidate => Boolean(candidate));
      if (parsed.candidates.length > 0 && restoredCandidates.length === 0) {
        removeExternalAiImportDraft(draftStorageKey);
        return;
      }
      const restoredCategories = Array.isArray(parsed.selectedCategories)
        ? parsed.selectedCategories
            .map(toText)
            .filter((category) => MAIN_CATEGORY_OPTIONS.includes(category))
            .slice(0, MAX_SELECTED_CATEGORIES)
        : [];
      const restoredSourceAi = toText(parsed.sourceAi);

      setJsonInput(toText(parsed.jsonInput));
      setCandidates(restoredCandidates);
      setPrivateItems([]);
      if (isExtractionMode(parsed.extractionMode)) {
        setExtractionMode(parsed.extractionMode);
      }
      if (restoredCategories.length > 0) {
        setSelectedCategories(restoredCategories);
      }
      if (restoredSourceAi) {
        setSourceAi(restoredSourceAi);
      }
      setError("");
      setSubmitError("");
      setSubmitResults({});
      setRelatedByCandidate({});
      setSavedReferences({});
      setNotice(
        "ログイン前の投稿候補を復元しました。内容を確認して「選んだ候補を投稿する」を押してください。"
      );
    } catch (restoreError) {
      console.error("[external-ai-import draft restore failed]", restoreError);
      removeExternalAiImportDraft(draftStorageKey);
    } finally {
      setHasRestoredDraft(true);
    }
  }, [draftStorageKey, hasRestoredDraft, isOpen]);

  if (!isOpen) return null;

  const saveImportDraft = () => {
    if (typeof window === "undefined") return;

    try {
      window.sessionStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          jsonInput,
          candidates,
          extractionMode,
          selectedCategories,
          sourceAi,
          savedAt: Date.now(),
        })
      );
    } catch (saveError) {
      console.error("[external-ai-import draft save failed]", saveError);
    }
  };

  const redirectToLogin = () => {
    if (typeof window === "undefined") return;

    window.location.assign(
      `/${tenant}/forum/login?next=${encodeURIComponent(
        `/${tenant}/forum?externalAiImport=1#create`
      )}`
    );
  };

  const checkForumLoginStatus = async () => {
    try {
      const response = await fetch("/api/forum/login/status", {
        cache: "no-store",
      });
      const data: unknown = await response.json().catch(() => null);

      if (!response.ok || !isRecord(data)) return null;

      return data.loggedIn === true;
    } catch {
      return null;
    }
  };

  const updateCandidate = (
    index: number,
    patch: Partial<ExternalAiCandidate>
  ) => {
    setCandidates((current) =>
      current.map((candidate, candidateIndex) =>
        candidateIndex === index ? { ...candidate, ...patch } : candidate
      )
    );
  };

  const toggleCategory = (category: string) => {
    setCopyMessage("");
    setCategoryLimitMessage("");
    setSelectedCategories((current) => {
      if (current.includes(category)) {
        return current.filter((item) => item !== category);
      }

      if (current.length >= MAX_SELECTED_CATEGORIES) {
        setCategoryLimitMessage(
          "選択できるカテゴリーは最大3つまでです。多い場合は「AIに全部分類させる」を使ってください。"
        );
        return current;
      }

      return [...current, category];
    });
  };

  const submitCandidate = async (
    candidate: ExternalAiCandidate
  ): Promise<SubmitResult> => {
    const premises = uniqueItems(
      candidate.visible_premises,
      candidate.hidden_premises,
      candidate.premises
    );
    const risks = uniqueItems(
      candidate.visible_risks,
      candidate.hidden_risks,
      candidate.risks
    );
    const body = {
      tenantSlug: tenant,
      title: candidate.title || candidate.question || "外部AI整理からの投稿",
      claim: buildCandidateClaim(candidate),
      ai_answer_short: candidate.ai_answer_short,
      ai_answer_detail: candidate.ai_answer_detail,
      ai_answer: candidate.ai_answer,
      category: candidate.category,
      main_category: candidate.category,
      sub_category: candidate.sub_category,
      node: candidate.node,
      supplements: safeItems(candidate.supplements),
      child_topics: safeItems(candidate.child_topics),
      not_split_reason: candidate.not_split_reason,
      premises,
      reasons: safeItems(candidate.reasons),
      conflicts: risks.map((risk) => ({
        opinion: "",
        rebuttal: risk,
      })),
      postType: "auto",
    };

    try {
      const response = await fetch("/api/forum/create-thread-from-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const message = isRecord(data)
          ? toText(data.error) || "投稿できませんでした。"
          : "投稿できませんでした。";
        if (response.status === 401 || message === "Login required.") {
          return {
            status: "error",
            error: "投稿するにはログインが必要です。ログイン後に投稿候補へ戻ります。",
            requiresLogin: true,
          };
        }
        return { status: "error", error: message };
      }

      const threadId = isRecord(data)
        ? toText(data.threadId) || toText(data.id)
        : "";
      const created = isRecord(data) ? data.created === true : undefined;
      const existing = isRecord(data) ? data.existing === true : undefined;

      if (!threadId) {
        return {
          status: "error",
          error: "投稿は完了しましたが、スレッドIDを取得できませんでした。",
        };
      }

      return {
        status: "success",
        threadId,
        url: `/${tenant}/forum/thread/${threadId}`,
        created,
        existing,
      };
    } catch {
      return {
        status: "error",
        error: "投稿中に通信エラーが発生しました。",
      };
    }
  };

  const handleSubmitSelectedCandidates = async () => {
    const selected = candidates
      .map((candidate, index) => ({ candidate, index }))
      .filter(({ candidate }) => candidate.status === "post");

    if (selected.length === 0) {
      setSubmitError("投稿する候補を選んでください。");
      return;
    }

    setSubmitError("");
    setShowLoginPrompt(false);
    setNotice("");

    const loggedIn = await checkForumLoginStatus();
    if (loggedIn === false) {
      saveImportDraft();
      setSubmitError(LOGIN_REQUIRED_MESSAGE);
      setShowLoginPrompt(true);
      return;
    }

    setIsSubmitting(true);

    let allSubmitted = true;
    const successfulResults: SubmitResult[] = [];
    for (const { candidate, index } of selected) {
      const result = await submitCandidate(candidate);
      setSubmitResults((current) => ({
        ...current,
        [index]: result,
      }));

      if (result.requiresLogin) {
        saveImportDraft();
        setSubmitError(
          result.error ?? "投稿するにはログインが必要です。ログイン後に投稿候補へ戻ります。"
        );
        setIsSubmitting(false);
        redirectToLogin();
        return;
      }

      if (result.status !== "success") {
        allSubmitted = false;
      } else {
        successfulResults.push(result);
      }
    }

    if (allSubmitted) {
      const selectedIndexes = new Set(selected.map(({ index }) => index));
      const createdCount = successfulResults.filter(
        (result) => result.created === true
      ).length;
      const existingCount = successfulResults.filter(
        (result) => result.existing === true
      ).length;
      const statusParts = [
        createdCount > 0 ? `新規作成${createdCount}件` : "",
        existingCount > 0 ? `既存スレッド紐づき${existingCount}件` : "",
      ].filter(Boolean);

      removeExternalAiImportDraft(draftStorageKey);
      setJsonInput("");
      setCandidates((current) =>
        current.map((candidate, index) =>
          selectedIndexes.has(index) ? { ...candidate, status: "skip" } : candidate
        )
      );
      setPrivateItems([]);
      setRelatedByCandidate({});
      setSavedReferences({});
      setSubmitError("");
      setShowLoginPrompt(false);
      setNotice(
        `${selected.length}件の投稿処理が完了しました。${
          statusParts.length > 0 ? `（${statusParts.join(" / ")}）` : ""
        }各カードの「詳しく見る」から詳細ページを確認できます。`
      );
    }
    setIsSubmitting(false);
  };

  const handleSearchRelatedThreads = async (
    index: number,
    candidate: ExternalAiCandidate
  ) => {
    setRelatedByCandidate((current) => ({
      ...current,
      [index]: {
        loading: true,
        threads: current[index]?.threads ?? [],
      },
    }));

    try {
      const response = await fetch("/api/forum/search-related", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: [
            candidate.title,
            candidate.question,
            candidate.ai_answer_short,
            candidate.ai_answer_detail,
            candidate.ai_answer,
          ]
            .filter(Boolean)
            .join("\n\n"),
          claim: candidate.question || candidate.title,
          premises: uniqueItems(
            candidate.visible_premises,
            candidate.hidden_premises,
            candidate.premises
          ),
          reasons: safeItems(candidate.reasons),
          disableFallback: true,
        }),
      });

      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const message = isRecord(data)
          ? toText(data.error) || "類似スレッドを確認できませんでした。"
          : "類似スレッドを確認できませんでした。";
        throw new Error(message);
      }

      const threads = isRecord(data) && Array.isArray(data.threads)
        ? data.threads
            .map(normalizeRelatedThread)
            .filter((thread): thread is RelatedThread => Boolean(thread))
        : [];

      setRelatedByCandidate((current) => ({
        ...current,
        [index]: {
          loading: false,
          threads,
        },
      }));
    } catch (searchError) {
      setRelatedByCandidate((current) => ({
        ...current,
        [index]: {
          loading: false,
          threads: [],
          error:
            searchError instanceof Error
              ? searchError.message
              : "類似スレッドを確認できませんでした。",
        },
      }));
    }
  };

  const handleSaveReference = async (
    index: number,
    candidate: ExternalAiCandidate,
    thread: RelatedThread
  ) => {
    const key = `${index}:${thread.id}`;
    const relatedThreadUrl = `/${tenant}/forum/thread/${thread.id}`;

    setSavedReferences((current) => ({
      ...current,
      [key]: {
        loading: true,
        saved: current[key]?.saved,
      },
    }));

    try {
      const response = await fetch("/api/forum/save-private-log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenantSlug: tenant,
          candidate: buildPrivateLogCandidate(candidate),
          relatedThread: thread,
          relatedThreadUrl,
          memo: "",
        }),
      });

      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const message = isRecord(data)
          ? toText(data.error) || "保存できませんでした。"
          : "保存できませんでした。";
        throw new Error(message);
      }

      const log = isRecord(data) && isRecord(data.log) ? data.log : null;

      setSavedReferences((current) => ({
        ...current,
        [key]: {
          loading: false,
          saved: true,
          logId: log ? toText(log.id) : undefined,
        },
      }));
    } catch (saveError) {
      setSavedReferences((current) => ({
        ...current,
        [key]: {
          loading: false,
          saved: false,
          error:
            saveError instanceof Error
              ? saveError.message
              : "保存できませんでした。",
        },
      }));
    }
  };

  const handleCopyPrompt = async () => {
    setCopyMessage("");

    try {
      await navigator.clipboard.writeText(stripMarkdownJsonFence(externalAiPrompt));
      setCopyMessage("プロンプトをコピーしました。");
    } catch (copyError) {
      console.error(copyError);
      setCopyMessage("コピーできませんでした。手動で選択してコピーしてください。");
    }
  };

  const handleParseJson = () => {
    setError("");
    setNotice("");

    try {
      const normalizedJsonText = normalizeJsonInputText(jsonInput);
      const parsed: unknown = JSON.parse(normalizedJsonText);
      const parsedCandidates = getParsedCandidateList(parsed);
      const normalizedPrivateItems = getParsedPrivateItems(parsed).map((item) => ({
        ...item,
        source_ai: sourceAi || item.source_ai || "未指定",
      }));

      if (!parsedCandidates && normalizedPrivateItems.length === 0) {
        setCandidates([]);
        setPrivateItems([]);
        setSubmitResults({});
        setRelatedByCandidate({});
        setSavedReferences({});
        setError("JSONはposts / candidates / items配列、またはtodos / ideas / private_notes配列を含む形式で貼り付けてください。");
        return;
      }

      const normalized = (parsedCandidates ?? [])
        .slice(0, MAX_CANDIDATES)
        .map(normalizeCandidate)
        .filter((candidate): candidate is ExternalAiCandidate =>
          Boolean(candidate)
        )
        .map((candidate) => ({
          ...candidate,
          source_ai: sourceAi || "未指定",
        }));

      if (normalized.length === 0 && normalizedPrivateItems.length === 0) {
        setCandidates([]);
        setPrivateItems([]);
        setSubmitResults({});
        setRelatedByCandidate({});
        setSavedReferences({});
        setError("投稿候補または非公開候補として読める項目がありません。公開投稿は title / question / ai_answer / answer / summary / content、非公開候補は title / content などを含めてください。");
        return;
      }

      setCandidates(normalized);
      setPrivateItems(normalizedPrivateItems);
      setSubmitResults({});
      setRelatedByCandidate({});
      setSavedReferences({});
      setSubmitError("");
      if ((parsedCandidates?.length ?? 0) > MAX_CANDIDATES) {
        setNotice(`投稿候補は最大${MAX_CANDIDATES}件まで読み取りました。非公開候補は${normalizedPrivateItems.length}件読み取りました。`);
      } else {
        setNotice(`${normalized.length}件の投稿候補、${normalizedPrivateItems.length}件の非公開候補を読み取りました。`);
      }
    } catch {
      setCandidates([]);
      setPrivateItems([]);
      setSubmitResults({});
      setRelatedByCandidate({});
      setSavedReferences({});
      setError(
        "これはJSON形式ではありません。\nこの欄には、外部AIが出力したposts / candidates / items配列、またはtodos / ideas / private_notes配列を含むJSONを貼り付けてください。\n会話ログをそのまま貼る場合は、上のプロンプトをあなたのChatGPTや外部AIに貼り、返ってきたJSONだけをここに貼り付けてください。"
      );
    }
  };

  return (
    <div style={overlayStyle} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="external-ai-import-title"
        style={dialogStyle}
      >
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 1,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "flex-start",
            borderBottom: "1px solid #e2e8f0",
            padding: 18,
            background: "#ffffff",
            color: "#111827",
          }}
        >
          <div>
            <h2 id="external-ai-import-title" style={{ margin: 0, fontSize: 22 }}>
              外部AIで整理した内容を取り込む
            </h2>
            <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.7 }}>
              外部AIで会話ログを整理し、返ってきたJSONから投稿候補を作ります。
            </p>
          </div>
          <button type="button" onClick={onClose} style={buttonStyle}>
            閉じる
          </button>
        </div>

        <div style={{ display: "grid", gap: 16, padding: 18 }}>
          <div
            style={{
              border: "1px solid #fed7aa",
              borderRadius: 10,
              padding: 12,
              background: "#fff7ed",
              color: "#9a3412",
              lineHeight: 1.7,
              fontWeight: 700,
            }}
          >
            個人情報や投稿したくない内容が含まれていないか、投稿前に必ず確認してください。
          </div>

          <section
            style={{
              ...sectionStyle,
              background: "#eff6ff",
              color: "#0f172a",
              borderColor: "#bfdbfe",
            }}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: 18 }}>
              外部AIで整理した内容を取り込む使い方
            </h3>
            <p
              style={{
                margin: "0 0 12px",
                color: "#1e3a8a",
                lineHeight: 1.7,
                fontWeight: 700,
              }}
            >
              コピーしたプロンプトを外部AIに貼り、返ってきたJSONをここに戻します。
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
                gap: 12,
              }}
            >
              <div>
                <div style={{ ...labelStyle, color: "#1d4ed8" }}>手順</div>
                <ol
                  style={{
                    margin: 0,
                    paddingLeft: 20,
                    color: "#1f2937",
                    lineHeight: 1.7,
                  }}
                >
                  <li>プロンプトをコピーする</li>
                  <li>外部AIに貼り、会話ログも渡す</li>
                  <li>返ってきたJSONをこの画面に貼る</li>
                  <li>候補を確認して投稿するか選ぶ</li>
                </ol>
              </div>

              <div>
                <div style={{ ...labelStyle, color: "#1d4ed8" }}>
                  貼れるもの
                </div>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 20,
                    color: "#1f2937",
                    lineHeight: 1.7,
                  }}
                >
                  <li>過去にChatGPTと話した経済・政策の会話</li>
                  <li>自分のメモや長くなった考え</li>
                  <li>SNSに投稿する前の下書き</li>
                  <li>複数の論点が混ざった文章</li>
                </ul>
              </div>

              <div>
                <div style={{ ...labelStyle, color: "#b91c1c" }}>
                  貼らないもの
                </div>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 20,
                    color: "#7f1d1d",
                    lineHeight: 1.7,
                  }}
                >
                  <li>個人名、住所、電話番号、メールアドレス</li>
                  <li>LINEなどの個人的なやりとり</li>
                  <li>第三者が特定される情報</li>
                  <li>店名や勤務先など個人特定につながる情報</li>
                </ul>
              </div>

              <div>
                <div style={{ ...labelStyle, color: "#047857" }}>
                  この機能でできること
                </div>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 20,
                    color: "#064e3b",
                    lineHeight: 1.7,
                  }}
                >
                  <li>複数の投稿候補をまとめて作れる</li>
                  <li>投稿前に内容を確認・編集できる</li>
                  <li>類似スレッドを確認できる</li>
                  <li>参考投稿として保存できる</li>
                </ul>
              </div>
            </div>

            <div
              style={{
                marginTop: 12,
                border: "1px solid #93c5fd",
                borderRadius: 8,
                background: "#dbeafe",
                color: "#1e3a8a",
                padding: 10,
                lineHeight: 1.7,
                fontWeight: 800,
              }}
            >
              読み取っただけでは投稿されません。投稿する候補を自分で選んでから投稿します。
            </div>
          </section>

          <section style={sectionStyle}>
            <div style={{ marginBottom: 16 }}>
              <div style={labelStyle}>抽出モード</div>
              <div
                style={{
                  marginBottom: 10,
                  color: "#64748b",
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                会話ログから投稿候補にしたいテーマだけを抜き出すか、外部AIに全体を分類させるかを選べます。
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                {(
                  [
                    {
                      value: "category",
                      label: "テーマを選んで抜き出す",
                    },
                    {
                      value: "auto",
                      label: "AIに全部分類させる",
                    },
                  ] as const
                ).map((mode) => (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => {
                      setExtractionMode(mode.value);
                      setCategoryLimitMessage("");
                      setCopyMessage("");
                    }}
                    style={{
                      ...buttonStyle,
                      padding: "7px 10px",
                      background:
                        extractionMode === mode.value ? "#e0f2fe" : "#ffffff",
                      color:
                        extractionMode === mode.value ? "#075985" : "#111827",
                      borderColor:
                        extractionMode === mode.value ? "#38bdf8" : "#cbd5e1",
                    }}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
              {extractionMode === "category" ? (
                <div
                  style={{
                    border: "1px solid #dbeafe",
                    borderRadius: 10,
                    padding: 12,
                    background: "#eff6ff",
                    color: "#1e3a8a",
                  }}
                >
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>
                    大カテゴリーを選ぶ
                  </div>
                  <div
                    style={{
                      marginBottom: 10,
                      color: "#334155",
                      fontSize: 13,
                      lineHeight: 1.6,
                    }}
                  >
                    複数選択できます。選択できるカテゴリーは最大3つまでです。
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {MAIN_CATEGORY_OPTIONS.map((category) => {
                      const selected = selectedCategories.includes(category);

                      return (
                        <button
                          key={category}
                          type="button"
                          onClick={() => toggleCategory(category)}
                          style={{
                            ...buttonStyle,
                            padding: "7px 10px",
                            background: selected ? "#1d4ed8" : "#ffffff",
                            color: selected ? "#ffffff" : "#1e3a8a",
                            borderColor: selected ? "#1d4ed8" : "#bfdbfe",
                          }}
                        >
                          {category}
                        </button>
                      );
                    })}
                  </div>
                  {categoryLimitMessage && (
                    <div
                      style={{
                        marginTop: 10,
                        color: "#991b1b",
                        fontSize: 13,
                        fontWeight: 800,
                        lineHeight: 1.6,
                      }}
                    >
                      {categoryLimitMessage}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    padding: 12,
                    background: "#f8fafc",
                    color: "#334155",
                    fontSize: 13,
                    lineHeight: 1.7,
                  }}
                >
                  会話ログ全体を外部AIに読ませ、投稿候補ごとに最も近いカテゴリーへ分類させます。投稿不要な雑談や個人的な内容は除外するよう指示します。
                </div>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label htmlFor="external-ai-source-ai" style={labelStyle}>
                整理に使ったAI
              </label>
              <div
                style={{
                  marginBottom: 8,
                  color: "#64748b",
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                外部AIで整理した投稿候補を、あとで見返す時の目印にできます。
              </div>
              <select
                id="external-ai-source-ai"
                value={sourceAi}
                onChange={(event) => {
                  const nextSourceAi = event.target.value || "未指定";
                  setSourceAi(nextSourceAi);
                  setCandidates((current) =>
                    current.map((candidate) => ({
                      ...candidate,
                      source_ai: nextSourceAi,
                    }))
                  );
                }}
                style={inputStyle}
              >
                {SOURCE_AI_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 18 }}>外部AIに貼るプロンプト</h3>
              <button type="button" onClick={handleCopyPrompt} style={buttonStyle}>
                プロンプトをコピー
              </button>
            </div>
            {copyMessage && (
              <div style={{ marginBottom: 8, color: "#475569", fontSize: 13 }}>
                {copyMessage}
              </div>
            )}
            <textarea
              readOnly
              value={externalAiPrompt}
              rows={14}
              style={{
                ...inputStyle,
                resize: "vertical",
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: 13,
                background: "#ffffff",
                color: "#0f172a",
              }}
            />
          </section>

          <section style={sectionStyle}>
            <label htmlFor="external-ai-json-input" style={labelStyle}>
              外部AIの整理結果を貼り付け
            </label>
            <div
              style={{
                marginBottom: 8,
                color: "#64748b",
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              外部AIが返したJSONだけを貼り付けてください。会話ログ本文はここでは読み取れません。
            </div>
            <textarea
              id="external-ai-json-input"
              value={jsonInput}
              onChange={(event) => setJsonInput(event.target.value)}
              placeholder="外部AIが返したJSONだけを貼り付けてください。"
              rows={10}
              style={{ ...inputStyle, resize: "vertical", minHeight: 180 }}
            />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
              <button type="button" onClick={handleParseJson} style={buttonStyle}>
                投稿候補を読み取る
              </button>
              <button
                type="button"
                onClick={() => {
                  setJsonInput("");
                  setCandidates([]);
                  setPrivateItems([]);
                  setError("");
                  setNotice("");
                  setSubmitError("");
                  setSubmitResults({});
                  setRelatedByCandidate({});
                  setSavedReferences({});
                }}
                style={buttonStyle}
              >
                クリア
              </button>
            </div>
            {error && (
              <div
                style={{
                  marginTop: 12,
                  border: "1px solid #fecaca",
                  borderRadius: 8,
                  padding: 10,
                  background: "#fef2f2",
                  color: "#991b1b",
                  fontWeight: 700,
                }}
              >
                <span style={{ whiteSpace: "pre-wrap" }}>{error}</span>
              </div>
            )}
            {notice && (
              <div style={{ marginTop: 12, color: "#475569", fontWeight: 700 }}>
                {notice}
              </div>
            )}
          </section>

          {privateItems.length > 0 && (
            <section style={sectionStyle}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: 18 }}>
                    非公開候補
                  </h3>
                  <p style={{ margin: "6px 0 0", color: "#64748b", lineHeight: 1.6 }}>
                    ToDo・アイデア・メモとして読み取った内容です。ここから公開投稿にはなりません。
                  </p>
                </div>
                <span
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 999,
                    padding: "4px 10px",
                    background: "#ffffff",
                    color: "#334155",
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  非公開 {privateItems.length}件
                </span>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {privateItems.map((item, index) => (
                  <article
                    key={`external-ai-private-item-${item.kind}-${index}`}
                    style={{
                      border: "1px solid #cbd5e1",
                      borderRadius: 10,
                      padding: 12,
                      background: "#ffffff",
                      color: "#111827",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                        flexWrap: "wrap",
                        marginBottom: 8,
                      }}
                    >
                      <strong>{item.title}</strong>
                      <span
                        style={{
                          border: "1px solid #cbd5e1",
                          borderRadius: 999,
                          padding: "2px 9px",
                          background: "#f8fafc",
                          color: "#475569",
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      >
                        {privateItemKindLabel(item.kind)}
                      </span>
                    </div>
                    {item.content && item.content !== item.title && (
                      <div
                        style={{
                          color: "#334155",
                          lineHeight: 1.7,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {item.content}
                      </div>
                    )}
                    {item.tags.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <ListBlock label="タグ" items={item.tags} />
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          {candidates.length > 0 && (
            <section style={sectionStyle}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: 18 }}>投稿候補プレビュー</h3>
                  <p style={{ margin: "6px 0 0", color: "#64748b", lineHeight: 1.6 }}>
                    投稿候補を確認・編集できます。読み取っただけでは投稿されません。
                  </p>
                </div>
                <span
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 999,
                    padding: "4px 10px",
                    background: "#ffffff",
                    color: "#334155",
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  投稿予定 {selectedCount}件
                </span>
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                {candidates.map((candidate, index) => (
                  <article
                    key={`external-ai-candidate-${index}`}
                    style={{
                      border: "1px solid #d7dde8",
                      borderRadius: 10,
                      padding: 14,
                      background: "#ffffff",
                      color: "#111827",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        flexWrap: "wrap",
                        marginBottom: 12,
                      }}
                    >
                      <strong>候補 {index + 1}</strong>
                      <span
                        style={{
                          border: "1px solid #cbd5e1",
                          borderRadius: 999,
                          padding: "2px 9px",
                          background:
                            candidate.status === "post"
                              ? "#dcfce7"
                              : candidate.status === "skip"
                              ? "#fee2e2"
                              : "#f8fafc",
                          color:
                            candidate.status === "post"
                              ? "#166534"
                              : candidate.status === "skip"
                              ? "#991b1b"
                              : "#475569",
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      >
                        {candidate.status === "post"
                          ? "投稿対象"
                          : candidate.status === "skip"
                          ? "今回は投稿しない"
                          : "未選択"}
                      </span>
                    </div>

                    {candidate.isEditing ? (
                      <div style={{ display: "grid", gap: 10 }}>
                        <label style={labelStyle}>
                          タイトル
                          <input
                            value={candidate.title}
                            onChange={(event) =>
                              updateCandidate(index, { title: event.target.value })
                            }
                            style={{ ...inputStyle, marginTop: 6 }}
                          />
                        </label>
                        <label style={labelStyle}>
                          問題・質問
                          <textarea
                            value={candidate.question}
                            onChange={(event) =>
                              updateCandidate(index, { question: event.target.value })
                            }
                            rows={3}
                            style={{ ...inputStyle, marginTop: 6 }}
                          />
                        </label>
                        <label style={labelStyle}>
                          AI回答・整理
                          <textarea
                            value={candidate.ai_answer}
                            onChange={(event) =>
                              updateCandidate(index, { ai_answer: event.target.value })
                            }
                            rows={4}
                            style={{ ...inputStyle, marginTop: 6 }}
                          />
                        </label>
                        <label style={labelStyle}>
                          短い説明
                          <textarea
                            value={candidate.ai_answer_short}
                            onChange={(event) =>
                              updateCandidate(index, {
                                ai_answer_short: event.target.value,
                              })
                            }
                            rows={3}
                            style={{ ...inputStyle, marginTop: 6 }}
                          />
                        </label>
                        <label style={labelStyle}>
                          詳しい説明
                          <textarea
                            value={candidate.ai_answer_detail}
                            onChange={(event) =>
                              updateCandidate(index, {
                                ai_answer_detail: event.target.value,
                              })
                            }
                            rows={4}
                            style={{ ...inputStyle, marginTop: 6 }}
                          />
                        </label>
                        {(
                          [
                            "premises",
                            "visible_premises",
                            "hidden_premises",
                            "reasons",
                            "risks",
                            "visible_risks",
                            "hidden_risks",
                            "supplements",
                            "child_topics",
                          ] as const
                        ).map((field) => (
                          <label key={field} style={labelStyle}>
                            {field === "premises"
                              ? "前提"
                              : field === "visible_premises"
                              ? "表示する前提"
                              : field === "hidden_premises"
                              ? "詳しい前提"
                              : field === "reasons"
                              ? "根拠"
                              : field === "risks"
                              ? "反論・リスク"
                              : field === "visible_risks"
                              ? "表示する反論・リスク"
                              : field === "hidden_risks"
                              ? "詳しい反論・リスク"
                              : field === "child_topics"
                              ? "子論点候補"
                              : "補足"}
                            <textarea
                              value={candidate[field].join("\n")}
                              onChange={(event) =>
                                updateCandidate(index, {
                                  [field]: linesToArray(event.target.value),
                                })
                              }
                              rows={3}
                              style={{ ...inputStyle, marginTop: 6 }}
                            />
                          </label>
                        ))}
                        <label style={labelStyle}>
                          分割しなかった理由
                          <textarea
                            value={candidate.not_split_reason}
                            onChange={(event) =>
                              updateCandidate(index, {
                                not_split_reason: event.target.value,
                              })
                            }
                            rows={2}
                            style={{ ...inputStyle, marginTop: 6 }}
                          />
                        </label>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
                            gap: 10,
                          }}
                        >
                          <label style={labelStyle}>
                            主カテゴリー
                            <input
                              value={candidate.category}
                              onChange={(event) =>
                                updateCandidate(index, { category: event.target.value })
                              }
                              style={{ ...inputStyle, marginTop: 6 }}
                            />
                          </label>
                          <label style={labelStyle}>
                            小カテゴリー
                            <input
                              value={candidate.sub_category}
                              onChange={(event) =>
                                updateCandidate(index, {
                                  sub_category: event.target.value,
                                })
                              }
                              style={{ ...inputStyle, marginTop: 6 }}
                            />
                          </label>
                          <label style={labelStyle}>
                            候補ノード
                            <input
                              value={candidate.node}
                              onChange={(event) =>
                                updateCandidate(index, { node: event.target.value })
                              }
                              style={{ ...inputStyle, marginTop: 6 }}
                            />
                          </label>
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
                            gap: 10,
                          }}
                        >
                          <label style={labelStyle}>
                            関連カテゴリー
                            <textarea
                              value={candidate.related_categories.join("\n")}
                              onChange={(event) =>
                                updateCandidate(index, {
                                  related_categories: linesToArray(event.target.value),
                                })
                              }
                              rows={3}
                              style={{ ...inputStyle, marginTop: 6 }}
                            />
                          </label>
                          <label style={labelStyle}>
                            タグ
                            <textarea
                              value={candidate.tags.join("\n")}
                              onChange={(event) =>
                                updateCandidate(index, {
                                  tags: linesToArray(event.target.value),
                                })
                              }
                              rows={3}
                              style={{ ...inputStyle, marginTop: 6 }}
                            />
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: 12 }}>
                        <FieldBlock label="タイトル">{candidate.title}</FieldBlock>
                        <FieldBlock label="問題・質問">{candidate.question}</FieldBlock>
                        <FieldBlock label="短い説明">
                          {candidate.ai_answer_short}
                        </FieldBlock>
                        <FieldBlock label="詳しい説明">
                          {candidate.ai_answer_detail}
                        </FieldBlock>
                        <FieldBlock label="AI回答・整理">
                          {candidate.ai_answer}
                        </FieldBlock>
                        <ListBlock
                          label="表示する前提"
                          items={candidate.visible_premises}
                        />
                        <ListBlock
                          label="詳しい前提"
                          items={candidate.hidden_premises}
                        />
                        <ListBlock label="前提" items={candidate.premises} />
                        <ListBlock label="根拠" items={candidate.reasons} />
                        <ListBlock
                          label="表示する反論・リスク"
                          items={candidate.visible_risks}
                        />
                        <ListBlock
                          label="詳しい反論・リスク"
                          items={candidate.hidden_risks}
                        />
                        <ListBlock label="反論・リスク" items={candidate.risks} />
                        <ListBlock label="補足" items={candidate.supplements} />
                        <ListBlock label="子論点候補" items={candidate.child_topics} />
                        <FieldBlock label="分割しなかった理由">
                          {candidate.not_split_reason}
                        </FieldBlock>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
                            gap: 10,
                          }}
                        >
                          <FieldBlock label="主カテゴリー">
                            {candidate.category}
                          </FieldBlock>
                          <FieldBlock label="小カテゴリー">
                            {candidate.sub_category}
                          </FieldBlock>
                          <FieldBlock label="候補ノード">{candidate.node}</FieldBlock>
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
                            gap: 10,
                          }}
                        >
                          <ListBlock
                            label="関連カテゴリー"
                            items={candidate.related_categories}
                          />
                          <ListBlock label="タグ" items={candidate.tags} />
                        </div>
                      </div>
                    )}

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        marginTop: 14,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => updateCandidate(index, { status: "post" })}
                        disabled={isSubmitting}
                        style={{
                          ...buttonStyle,
                          background:
                            candidate.status === "post" ? "#047857" : "#ffffff",
                          color: candidate.status === "post" ? "#ffffff" : "#111827",
                          borderColor:
                            candidate.status === "post" ? "#047857" : "#cbd5e1",
                        }}
                      >
                        投稿対象にする
                      </button>
                      <button
                        type="button"
                        onClick={() => updateCandidate(index, { status: "skip" })}
                        disabled={isSubmitting}
                        style={{
                          ...buttonStyle,
                          background:
                            candidate.status === "skip" ? "#b91c1c" : "#ffffff",
                          color: candidate.status === "skip" ? "#ffffff" : "#111827",
                          borderColor:
                            candidate.status === "skip" ? "#b91c1c" : "#cbd5e1",
                        }}
                      >
                        今回は投稿しない
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateCandidate(index, {
                            isEditing: !candidate.isEditing,
                          })
                        }
                        disabled={isSubmitting}
                        style={buttonStyle}
                      >
                        {candidate.isEditing ? "編集を閉じる" : "編集する"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSearchRelatedThreads(index, candidate)}
                        disabled={Boolean(relatedByCandidate[index]?.loading)}
                        style={{
                          ...buttonStyle,
                          background: "#f8fafc",
                          color: "#0f172a",
                          borderColor: "#cbd5e1",
                        }}
                      >
                        {relatedByCandidate[index]?.loading
                          ? "確認中..."
                          : "類似スレッドを確認"}
                      </button>
                    </div>

                    {relatedByCandidate[index] && (
                      <div
                        style={{
                          marginTop: 12,
                          border: "1px solid #cbd5e1",
                          borderRadius: 8,
                          padding: 12,
                          background: "#f8fafc",
                          color: "#111827",
                          lineHeight: 1.7,
                        }}
                      >
                        <div style={{ fontWeight: 900, marginBottom: 4 }}>
                          近い可能性がある既存スレッド
                        </div>
                        <div
                          style={{
                            color: "#64748b",
                            fontSize: 13,
                            marginBottom: 10,
                          }}
                        >
                          完全一致とは限りません。内容を確認して、新規投稿するか判断してください。今回は確認のみです。
                        </div>
                        {relatedByCandidate[index].error ? (
                          <div style={{ color: "#991b1b", fontWeight: 800 }}>
                            {relatedByCandidate[index].error}
                          </div>
                        ) : relatedByCandidate[index].loading ? (
                          <div style={{ color: "#475569", fontWeight: 800 }}>
                            類似スレッドを確認しています...
                          </div>
                        ) : relatedByCandidate[index].threads.length > 0 ? (
                          <div style={{ display: "grid", gap: 8 }}>
                            {relatedByCandidate[index].threads.map((thread) => {
                              const saveKey = `${index}:${thread.id}`;
                              const saveState = savedReferences[saveKey];

                              return (
                                <div
                                  key={thread.id}
                                  style={{
                                    border: "1px solid #e2e8f0",
                                    borderRadius: 8,
                                    padding: 10,
                                    background: "#ffffff",
                                    color: "#111827",
                                  }}
                                >
                                  <div style={{ fontWeight: 900 }}>
                                    {thread.title}
                                  </div>
                                  {thread.category && (
                                    <div
                                      style={{
                                        color: "#64748b",
                                        fontSize: 13,
                                        marginTop: 2,
                                      }}
                                    >
                                      {thread.category}
                                    </div>
                                  )}
                                  {(thread.ai_summary || thread.reason) && (
                                    <div
                                      style={{
                                        marginTop: 6,
                                        color: "#334155",
                                        fontSize: 13,
                                      }}
                                    >
                                      {thread.ai_summary || thread.reason}
                                    </div>
                                  )}
                                  <div
                                    style={{
                                      display: "flex",
                                      flexWrap: "wrap",
                                      gap: 10,
                                      alignItems: "center",
                                      marginTop: 8,
                                    }}
                                  >
                                    <a
                                      href={`/${tenant}/forum/thread/${thread.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{
                                        display: "inline-block",
                                        color: "#0369a1",
                                        fontWeight: 900,
                                        textDecoration: "underline",
                                        textUnderlineOffset: 3,
                                      }}
                                    >
                                      開く
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleSaveReference(index, candidate, thread)
                                      }
                                      disabled={Boolean(saveState?.loading || saveState?.saved)}
                                      style={{
                                        ...buttonStyle,
                                        padding: "6px 10px",
                                        background: saveState?.saved
                                          ? "#dcfce7"
                                          : "#ffffff",
                                        color: saveState?.saved
                                          ? "#166534"
                                          : "#0f172a",
                                        borderColor: saveState?.saved
                                          ? "#86efac"
                                          : "#cbd5e1",
                                      }}
                                    >
                                      {saveState?.loading
                                        ? "保存中..."
                                        : saveState?.saved
                                          ? "保存済み"
                                          : "参考投稿として保存"}
                                    </button>
                                  </div>
                                  {saveState?.error && (
                                    <div
                                      style={{
                                        marginTop: 6,
                                        color: "#991b1b",
                                        fontSize: 13,
                                        fontWeight: 800,
                                      }}
                                    >
                                      保存できませんでした：{saveState.error}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div style={{ color: "#475569", fontWeight: 800 }}>
                            近い既存スレッドは見つかりませんでした。必要なら新規投稿してください。
                          </div>
                        )}
                      </div>
                    )}

                    {submitResults[index] && (
                      <div
                        style={{
                          marginTop: 12,
                          border:
                            submitResults[index].status === "success"
                              ? "1px solid #bbf7d0"
                              : "1px solid #fecaca",
                          borderRadius: 8,
                          padding: 10,
                          background:
                            submitResults[index].status === "success"
                              ? "#f0fdf4"
                              : "#fef2f2",
                          color:
                            submitResults[index].status === "success"
                              ? "#166534"
                              : "#991b1b",
                          fontWeight: 700,
                          lineHeight: 1.7,
                        }}
                      >
                        {submitResults[index].status === "success" ? (
                          <>
                            {formatSubmitSuccessMessage(submitResults[index])}
                            {submitResults[index].url ? (
                              <a
                                href={submitResults[index].url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  color: "#166534",
                                  textDecoration: "underline",
                                  textUnderlineOffset: 3,
                                }}
                              >
                                詳しく見る
                              </a>
                            ) : (
                              submitResults[index].threadId
                            )}
                          </>
                        ) : (
                          <>
                            投稿できませんでした：
                            {submitResults[index].error ?? "不明なエラー"}
                          </>
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </div>

              {submitError && (
                <div
                  style={{
                    marginTop: 14,
                    border: "1px solid #fecaca",
                    borderRadius: 8,
                    padding: 10,
                    background: "#fef2f2",
                    color: "#991b1b",
                    fontWeight: 700,
                  }}
                >
                  {submitError}
                </div>
              )}

              {showLoginPrompt && (
                <button
                  type="button"
                  onClick={redirectToLogin}
                  style={{
                    marginTop: 10,
                    border: "1px solid #f59e0b",
                    borderRadius: 8,
                    padding: "9px 12px",
                    background: "#fffbeb",
                    color: "#92400e",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  ログインして投稿を再開する
                </button>
              )}

              <button
                type="button"
                onClick={handleSubmitSelectedCandidates}
                disabled={selectedCount === 0 || isSubmitting}
                style={{
                  marginTop: 14,
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  padding: "10px 14px",
                  background:
                    selectedCount === 0 || isSubmitting ? "#e5e7eb" : "#111827",
                  color: selectedCount === 0 || isSubmitting ? "#64748b" : "#ffffff",
                  fontWeight: 800,
                  cursor: selectedCount === 0 || isSubmitting ? "not-allowed" : "pointer",
                }}
              >
                {isSubmitting ? "投稿中..." : "選んだ候補を投稿する"}
              </button>
              <div style={{ marginTop: 8, color: "#64748b", lineHeight: 1.6 }}>
                カテゴリと論点タグは参考表示です。投稿後のリンクから内容を確認できます。
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
