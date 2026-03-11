export type Mode = "standard" | "buddy" | "sayaka";

type RulesJson = {
  mode?: Mode | string;
  system_hint?: string;
  must_question?: boolean;
  max_length?: number;
  praise_prefix?: Record<Mode, string>;
};


type ReplyContext = {
  prev_action_done?: boolean;
  last_suggested_action?: string | null;
  streak?: number;
  action_success_rates?: Record<string, number>;
  current_time_bucket?: "morning" | "afternoon" | "night";
  action_success_rates_by_time?: {
    action_type: string;
    time_bucket: string;
    success_rate: number;
    attempt_count: number;
    success_count: number;
  }[];
  fatigue_count?: number;

recent_actions?: {
  action_type?: string;
  action_text?: string;
  completed?: boolean;
  failure_reason?: string | null;
  created_at?: string;
  success_score?: number | null;
}[];

  success_stats?: Record<
    string,
    {
      total: number;
      success: number;
      success_rate: number;
      easy: number;
      normal: number;
      hard: number;
    }
  >;
};


function normalizeInput(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function normalizeText(s: string) {
  return s.replace(/\n{3,}/g, "\n\n").trim();
}

function ensureQuestionEnd(s: string) {
  const t = s.trimEnd();
  if (/[？\?]\s*$/.test(t)) return t;
  return `${t}\n\nで、今いちばん大事なのは何？`;
}

function ensureQuestionEndSayaka(s: string) {
  const t = s.trimEnd();
  if (/[？\?]\s*$/.test(t)) return t;
  return `${t}\n\n今、いちばん大事にしたいのは何ですか？`;
}

function detectIntent(input: string) {
  const s = input.toLowerCase();
  if (s.includes("眠") || s.includes("だる") || s.includes("やる気")) return "low_energy";
  if (s.includes("不安") || s.includes("怖")) return "anxiety";
  if (s.includes("変え") || s.includes("頑張")) return "motivation";
  return "general";
}

function pickKeyword(userText: string) {
  const cleaned = userText
    .replace(/[！!？\?。．、,]/g, "")
    .replace(/さやか|先生/g, "")
    .replace(/です|だ/g, "")
    .trim();

  if (cleaned.length >= 2) return cleaned.slice(0, 10);
  return null;
}

function looksLikeActionReport(userText: string) {
  return /(やった|できた|した|終わった|完了|行った|済んだ)/.test(userText);
}

function getBestActionTypeFromRates(
  rates: Record<string, number>
): "exercise" | "study" | "cleanup" | "dev" | "other" {
  const candidates: Array<"exercise" | "study" | "cleanup" | "dev" | "other"> = [
    "exercise",
    "study",
    "cleanup",
    "dev",
    "other",
  ];

  let best: "exercise" | "study" | "cleanup" | "dev" | "other" = "other";
  let bestScore = -1;

  for (const c of candidates) {
    const score = typeof rates[c] === "number" ? rates[c] : -1;
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
  }

  return best;
}


export function detectActionType(
  text: string
): "exercise" | "study" | "cleanup" | "dev" | "other" {

  const t = normalizeInput(text);

  if (
    ["スクワット", "腕立て", "腹筋", "ストレッチ", "歩", "ラン", "筋トレ", "トレーニング"].some((w) =>
      t.includes(w)
    )
  ) {
    return "exercise";
  }

  if (
    ["勉強", "読書", "暗記", "問題集", "英語", "復習", "ノート"].some((w) =>
      t.includes(w)
    )
  ) {
    return "study";
  }

  if (
    ["片づけ", "片付け", "掃除", "整理", "捨てた", "洗い物", "洗濯"].some((w) =>
      t.includes(w)
    )
  ) {
    return "cleanup";
  }

  if (
    ["コード", "実装", "修正", "デバッグ", "開発", "commit", "SQL"].some((w) =>
      t.includes(w)
    )
  ) {
    return "dev";
  }

  return "other";
}








function extractActionLabel(text: string): string {
  const t = normalizeInput(text);

  if (t.includes("スクワット")) return "スクワット";
  if (t.includes("腕立て")) return "腕立て";
  if (t.includes("腹筋")) return "腹筋";
  if (t.includes("ストレッチ")) return "ストレッチ";
  if (t.includes("散歩") || t.includes("歩")) return "散歩";

  if (t.includes("勉強")) return "勉強";
  if (t.includes("読書")) return "読書";
  if (t.includes("英語")) return "英語";
  if (t.includes("問題集")) return "問題集";

  if (t.includes("机")) return "机の上の片づけ";
  if (t.includes("片づけ") || t.includes("片付け")) return "片づけ";
  if (t.includes("掃除")) return "掃除";
  if (t.includes("洗い物")) return "洗い物";

  if (t.includes("一行")) return "一行修正";
  if (t.includes("修正")) return "修正";
  if (t.includes("デバッグ")) return "デバッグ";
  if (t.includes("開発")) return "開発";

  return "小さな行動";
}




function getActionLevel(successRate: number | null) {
  if (successRate === null || successRate === undefined) return "normal";
  if (successRate >= 0.7) return "high";
  if (successRate >= 0.4) return "normal";
  return "low";
}

function isGreetingLike(text: string): boolean {
  const t = normalizeInput(text);
  return [
    "お疲れ様",
    "お疲れさま",
    "ありがとう",
    "おはよう",
    "こんにちは",
    "こんばんは",
  ].some((w) => t.includes(w));
}

function isDoneReport(text: string): boolean {
  const t = normalizeInput(text);
  return [
    "やった",
    "できた",
    "終わった",
    "押した",
    "行った",
    "やりました",
    "しました",
  ].some((w) => t.includes(w));
}


function isNotDoneReport(text: string): boolean {
  const t = normalizeInput(text);

  return (
    /できなかった/.test(t) ||
    /やってない/.test(t) ||
    /無理だった/.test(t) ||
    /何もできなかった/.test(t)
  );
}


function isTiredLike(text: string): boolean {
  const t = normalizeInput(text);
  return [
    "疲れた",
    "しんどい",
    "だるい",
    "眠い",
    "きつい",
  ].some((w) => t.includes(w));
}

function buildSayakaReply(input: string): string {
  const t = normalizeInput(input);

  if (isGreetingLike(t)) {
    return `お疲れさまです✨
今日はどんな一日でしたか？

少しでもトレーニングできましたか？`;
  }

  if (isDoneReport(t)) {
    return `いいですね✨
ちゃんと行動できていてえらいです。

今日は他に何かできたことはありましたか？`;
  }

  if (isNotDoneReport(t)) {
    return `大丈夫です✨
そういう日もあります。

明日できそうなことを一つだけ決めてみましょうか？`;
  }

  if (isTiredLike(t)) {
    return `お疲れさまです✨
無理しすぎないでくださいね。

今日は少し休めそうですか？`;
  }

  return `ありがとうございます✨
今日はどんな感じでしたか？`;
}

function getPraisePrefix(rulesJson: any, mode: Mode): string {
  const fallback: Record<Mode, string> = {
    standard: "いいですね。続けましょう。",
    buddy: "ナイス。続けよ😏",
    sayaka: "素晴らしいです。継続していきましょう。",
  };

  const fromJson = rulesJson?.praise_prefix?.[mode];
  if (typeof fromJson === "string" && fromJson.trim().length > 0) return fromJson;

  return fallback[mode];
}


export function generateReply(
  mode: Mode,
  userText: string,
  rulesJson: any = null,
  context: ReplyContext = {}
) {

  const rules: RulesJson | null =
    rulesJson && typeof rulesJson === "object" ? rulesJson : null;

  const mustQuestion = rules?.must_question === true;

  const maxLength =
    typeof rules?.max_length === "number" &&
    Number.isFinite(rules.max_length) &&
    rules.max_length > 10
      ? Math.floor(rules.max_length)
      : null;

  const clamp = (s: string) => {
    if (!maxLength) return s;
    if (s.length <= maxLength) return s;
    const cut = Math.max(0, maxLength - 1);
    return s.slice(0, cut) + "…";
  };

  const timeBucketLabel =
    context.current_time_bucket === "morning"
      ? "朝"
      : context.current_time_bucket === "afternoon"
      ? "昼"
      : context.current_time_bucket === "night"
      ? "夜"
      : null;

  const sortedTimeRates = [...(context.action_success_rates_by_time ?? [])].sort(
    (a, b) => (b.success_rate ?? 0) - (a.success_rate ?? 0)
  );

  const bestTimeActionType =
    sortedTimeRates.length > 0 ? sortedTimeRates[0].action_type : null;

  const actionTypeLabel =
    bestTimeActionType === "exercise"
      ? "運動"
      : bestTimeActionType === "study"
      ? "勉強"
      : bestTimeActionType === "cleanup"
      ? "片付け"
      : bestTimeActionType === "dev"
      ? "開発"
      : bestTimeActionType === "other"
      ? "軽い行動"
      : null;

  const timeBasedGuidance =
    timeBucketLabel && actionTypeLabel
      ? `今は${timeBucketLabel}なので、${actionTypeLabel}系の行動提案が向いています。`
      : "";

  const prevDone = context?.prev_action_done === true;

  const streak =
    typeof context?.streak === "number"
      ? context.streak
      : 0;

  const fatigueCount =
    typeof context?.fatigue_count === "number"
      ? context.fatigue_count
      : 0;

  const recentActions = Array.isArray(context?.recent_actions)
    ? context.recent_actions
    : [];


const successStreak = (() => {
  let streak = 0;

  for (const a of recentActions) {
    if (a?.completed === true) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
})();


  const recentFailures = recentActions.filter(
    (a) => a?.completed === false && a?.failure_reason
  );

  const lastFailureReason =
    recentFailures.length > 0
      ? recentFailures[recentFailures.length - 1]?.failure_reason ?? null
      : null;

  const actionSuccessRates =
    context?.action_success_rates && typeof context.action_success_rates === "object"
      ? context.action_success_rates
      : {};

  const otherStats = context.success_stats?.other ?? {
    total: 0,
    success: 0,
    success_rate: 0,
    easy: 0,
    normal: 0,
    hard: 0,
  };


let suggestionLevel: "soft" | "normal" | "push" = "normal";

if (otherStats.total >= 3) {
  const easyRate =
    otherStats.total > 0 ? otherStats.easy / otherStats.total : 0;

  const hardRate =
    otherStats.total > 0 ? otherStats.hard / otherStats.total : 0;

  if (hardRate >= 0.4) {
    suggestionLevel = "soft";
  } else if (easyRate >= 0.5) {
    suggestionLevel = "push";
  } else if (otherStats.success_rate < 0.34) {
    suggestionLevel = "soft";
  }
}


if (successStreak >= 3 && suggestionLevel === "normal") {
  suggestionLevel = "push";
}

if (successStreak >= 5) {
  suggestionLevel = "push";
}


const failureStats = (() => {

  const rows = recentActions;

  const map: Record<string, number> = {};

  for (const r of rows) {
    if (!r.failure_reason) continue;
    map[r.failure_reason] = (map[r.failure_reason] ?? 0) + 1;
  }

  return map;
})();










const topFailureReason =
  Object.entries(failureStats).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

const sameFailureCount = topFailureReason
  ? recentActions.filter(
      (a) => a?.completed === false && a?.failure_reason === topFailureReason
    ).length
  : 0;

if (sameFailureCount >= 3) {
  suggestionLevel = "soft";
} else if (sameFailureCount >= 2 && suggestionLevel === "push") {
  suggestionLevel = "normal";
}

if (fatigueCount >= 2) {
  suggestionLevel = "soft";
}


const successHours = recentActions
  .filter((a) => a?.completed === true)
  .map((a) => {
    if (!a?.created_at) return null;
    return new Date(a.created_at).getHours();
  })
  .filter((h) => h !== null);



let bestHour: number | null = null;

if (successHours.length > 0) {
  const hourCount: Record<number, number> = {};

  successHours.forEach((h) => {
    hourCount[h] = (hourCount[h] ?? 0) + 1;
  });

  bestHour = Number(
    Object.entries(hourCount).sort((a, b) => b[1] - a[1])[0][0]
  );
}

const recentSuccessPatterns = recentActions
  .filter((a) => a?.completed === true && (a?.success_score ?? 0) >= 2)
  .slice(0, 3)
  .map((a) => {
    const reasonPart = a?.failure_reason ? `失敗理由:${a.failure_reason} → ` : "";
    const actionPart = a?.action_text ?? a?.action_type ?? "行動";
    return `${reasonPart}${actionPart}`;
  });


const successfulActionLabels = recentActions
  .filter((a) => a?.completed === true && (a?.success_score ?? 0) >= 2)
  .map((a) => extractActionLabel(a?.action_text ?? a?.action_type ?? ""));

const actionLabelCount = successfulActionLabels.reduce<Record<string, number>>(
  (acc, label) => {
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  },
  {}
);

const favoriteActionLabel =
  Object.entries(actionLabelCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;




const lastSuccessActionType =
  recentActions.find((a) => a?.completed === true)?.action_type ?? null;

const yesterdaySuccessBoost =
  lastSuccessActionType === "exercise"
    ? "exercise"
    : lastSuccessActionType === "study"
    ? "study"
    : lastSuccessActionType === "cleanup"
    ? "cleanup"
    : lastSuccessActionType === "dev"
    ? "dev"
    : "other";

const pastSuccessHint =
  recentSuccessPatterns.length > 0
    ? mode === "sayaka"
      ? `ちなみに、最近うまくいった流れはこうです。\n${recentSuccessPatterns.join("\n")}`
      : mode === "buddy"
      ? `ちなみに最近うまくいった流れはこれや。\n${recentSuccessPatterns.join("\n")}`
      : `最近うまくいった行動例:\n${recentSuccessPatterns.join("\n")}`
    : "";


const favoriteActionHint =
  favoriteActionLabel
    ? mode === "sayaka"
      ? `最近は「${favoriteActionLabel}」が比較的うまくいっていますね。`
      : mode === "buddy"
      ? `最近は「${favoriteActionLabel}」がまだ通りやすいな。`
      : `最近は「${favoriteActionLabel}」の成功率が高い傾向です。`
    : "";


  const praisePrefix = prevDone
    ? `${getPraisePrefix(rulesJson, mode)}\n\n`
    : "";

  const finalize = (body: string) => {
    let out = normalizeText(praisePrefix ? praisePrefix + body : body);

    if (mode === "sayaka") {
      out = out
        .replace(/やな。/g, "ですね。")
        .replace(/やな/g, "ですね")
        .replace(/しよう。/g, "整理しましょう。")
        .replace(/まず/g, "ひとまず")
        .replace(/\n\n+/g, "\n\n");
    }

    if (mustQuestion) {
      out = mode === "sayaka" ? ensureQuestionEndSayaka(out) : ensureQuestionEnd(out);
    }

    out = clamp(out);
    return out;
  };

  const intent = detectIntent(userText);
  const isBuddy = mode === "buddy" || mode === "sayaka";

  if (intent === "low_energy") {
    if (mode === "sayaka") {
      return finalize(`眠いのは、体が正直なサインですね。

無理に頑張るより、
「今できる最小」を決めませんか。

2分だけ、どうですか？`);
    }

    if (mode === "buddy") {
      return finalize(`眠いなら、今から2分だけ動こう。

「やる気が出ない」なら、
→ タイマー2分だけセットして始める。`);
    }

    return finalize(`低エネルギー状態と判断しました。

If: やる気が出ない
Then: 2分だけ開始する

まず2分だけ実行してください。`);
  }

  if (intent === "anxiety") {
    if (mode === "sayaka") {
      return finalize(`不安があるなら、いったん整理しましょう。

「何が怖いか」ではなく、
「何が失いたくないか」を一つだけ選べますか。`);
    }

    if (mode === "buddy") {
      return finalize(`不安な時は、行動で薄める。

いま出来るのはこの2つだけ👇
① 紙に3行で書く
② 1分だけ片づける

どっちやる？`);
    }

    return finalize(`不安状態を検知しました。

If: 思考が混乱している
Then: 3行で外部化する

まず書き出してください。`);
  }

  if (intent === "motivation") {
    if (mode === "sayaka") {
      return finalize(`変えたいなら、理由を一つだけ明確にしましょう。

「なぜ今、変えたい」のですか？
一言で言うと何ですか。`);
    }

    if (mode === "buddy") {
      return finalize(`変えたいなら、今日の一手を決めるで。

制限はこれ👇
・2分以内にできる
・道具いらん
・今すぐできる

何する？`);
    }

    return finalize(`変化意欲を検知しました。

If: 変わりたい
Then: 今日の具体行動を1つ決める

何を実行しますか？`);
  }



if (isNotDoneReport(userText)) {
  if (fatigueCount >= 3) {
    if (mode === "sayaka") {
      return finalize(`お疲れさまです✨
ここまで頑張ろうとしていたのは十分伝わっています。

今日は無理に進めるより、回復日にしましょう。
深呼吸をして、水を飲んで、少し休めますか？`);
    }

    if (mode === "buddy") {
      return finalize(`今日は無理に攻めんでいい。

回復優先でいこ。
水飲んで、深呼吸して、10秒だけ休むので十分や。`);
    }

    return finalize(`疲労が強い可能性があります。

今日は回復優先にしてください。
深呼吸と水分補給だけでも十分です。`);
  }


const avoidType =
  lastFailureReason === "疲れている" || lastFailureReason === "やる気が出ない"
    ? bestTimeActionType === "exercise"
      ? "exercise"
      : null
    : null;



const successRateBestType = getBestActionTypeFromRates(actionSuccessRates);



const candidateOrder: Array<"exercise" | "study" | "cleanup" | "dev" | "other"> = [
  bestTimeActionType &&
  ["exercise", "study", "cleanup", "dev", "other"].includes(bestTimeActionType)
    ? (bestTimeActionType as "exercise" | "study" | "cleanup" | "dev" | "other")
    : "other",
  successRateBestType !== "other"
    ? successRateBestType
    : "other",
  yesterdaySuccessBoost as "exercise" | "study" | "cleanup" | "dev" | "other",
  "other",
];

let bestType: "exercise" | "study" | "cleanup" | "dev" | "other" = "other";

for (const c of candidateOrder) {
  if (avoidType && c === avoidType) continue;
  bestType = c;
  break;
}

const bestTypeRate =
  typeof actionSuccessRates?.[bestType] === "number"
    ? actionSuccessRates[bestType]
    : null;

if (bestTypeRate !== null && bestTypeRate < 0.3) {
  if (yesterdaySuccessBoost !== "other") {
    bestType = yesterdaySuccessBoost as
      | "exercise"
      | "study"
      | "cleanup"
      | "dev"
      | "other";
  } else if (successRateBestType !== "other") {
    bestType = successRateBestType;
  } else {
    bestType = "other";
  }
}


const recommendedActionLabel =
  favoriteActionLabel ??
  (bestType === "exercise"
    ? "スクワット"
    : bestType === "study"
    ? "勉強"
    : bestType === "cleanup"
    ? "机の上の片づけ"
    : bestType === "dev"
    ? "一行修正"
    : "小さな行動");

const bestTypeFocusHint =
  bestType === "exercise"
    ? mode === "sayaka"
      ? "今日は運動系から入るのがいちばん自然そうですね。"
      : mode === "buddy"
      ? "今日は運動系から入るのが一番通しやすい。"
      : "今日は運動系の行動から始めるのが適しています。"
    : bestType === "study"
    ? mode === "sayaka"
      ? "今日は勉強系から入るのが自然そうですね。"
      : mode === "buddy"
      ? "今日は勉強系から入るのが通しやすい。"
      : "今日は勉強系の行動から始めるのが適しています。"
    : bestType === "cleanup"
    ? mode === "sayaka"
      ? "今日は片づけ系から入るのが自然そうですね。"
      : mode === "buddy"
      ? "今日は片づけ系から入るのが通しやすい。"
      : "今日は片づけ系の行動から始めるのが適しています。"
    : bestType === "dev"
    ? mode === "sayaka"
      ? "今日は開発系から入るのが自然そうですね。"
      : mode === "buddy"
      ? "今日は開発系から入るのが通しやすい。"
      : "今日は開発系の行動から始めるのが適しています。"
    : mode === "sayaka"
    ? "今日はかなり軽い行動から入るのがよさそうですね。"
    : mode === "buddy"
    ? "今日は軽いやつから入るのがよさそう。"
    : "今日は軽い行動から始めるのが適しています。";


const recommendedActionHint =
  recommendedActionLabel
    ? mode === "sayaka"
      ? `今日は「${recommendedActionLabel}」くらいの具体行動が合いそうですね。`
      : mode === "buddy"
      ? `今日は「${recommendedActionLabel}」あたりがちょうどええ。`
      : `今日は「${recommendedActionLabel}」のような具体行動が適しています。`
    : "";



const successRateHint =
  successRateBestType === "exercise"
    ? mode === "sayaka"
      ? "最近は運動系が続きやすい流れですね。"
      : mode === "buddy"
      ? "最近は運動系がまだ通りやすいな。"
      : "最近は運動系の成功率が高い傾向です。"
    : successRateBestType === "study"
    ? mode === "sayaka"
      ? "最近は勉強系が続きやすい流れですね。"
      : mode === "buddy"
      ? "最近は勉強系がまだ通りやすいな。"
      : "最近は勉強系の成功率が高い傾向です。"
    : successRateBestType === "cleanup"
    ? mode === "sayaka"
      ? "最近は片づけ系が続きやすい流れですね。"
      : mode === "buddy"
      ? "最近は片づけ系がまだ通りやすいな。"
      : "最近は片づけ系の成功率が高い傾向です。"
    : successRateBestType === "dev"
    ? mode === "sayaka"
      ? "最近は開発系が続きやすい流れですね。"
      : mode === "buddy"
      ? "最近は開発系がまだ通りやすいな。"
      : "最近は開発系の成功率が高い傾向です。"
    : "";

const successControlHint =
  bestTypeRate !== null && bestTypeRate < 0.3
    ? mode === "sayaka"
      ? "この行動はまだ成功率が低いので、今日はさらに軽くしましょう。"
      : mode === "buddy"
      ? "この系統はまだ成功率低い。今日はかなり軽くいこ。"
      : "この行動タイプは成功率が低いため、難易度を下げます。"
    : bestTypeRate !== null && bestTypeRate >= 0.6
    ? mode === "sayaka"
      ? "この行動は比較的通りやすいので、今日も候補に入れます。"
      : mode === "buddy"
      ? "この系統はまだ通りやすい。候補として残しとこ。"
      : "この行動タイプは成功率が高いため優先候補です。"
    : "";


const typeSwitchHint =
  avoidType === "exercise"
    ? mode === "sayaka"
      ? "今日は無理に運動へ寄せず、別の軽い行動に切り替えましょう。"
      : mode === "buddy"
      ? "今日は運動にこだわらんでええ。別系統に逃がそ。"
      : "今日は運動以外の軽い行動へ切り替えます。"
    : "";



let bestTimeHint = "";

if (bestHour !== null) {
  bestTimeHint =
    mode === "sayaka"
      ? `ちなみに、あなたは${bestHour}時ごろに成功することが多いみたいです。`
      : mode === "buddy"
      ? `ちなみに${bestHour}時あたり成功率高いぞ。`
      : `あなたは${bestHour}時ごろに成功する傾向があります。`;
}




const recentMomentumHint =
  yesterdaySuccessBoost !== "other"
    ? mode === "sayaka"
      ? `直近では${yesterdaySuccessBoost === "exercise"
          ? "運動"
          : yesterdaySuccessBoost === "study"
          ? "勉強"
          : yesterdaySuccessBoost === "cleanup"
          ? "片づけ"
          : "開発"}系が動けていますね。`
      : mode === "buddy"
      ? `直近は${yesterdaySuccessBoost === "exercise"
          ? "運動"
          : yesterdaySuccessBoost === "study"
          ? "勉強"
          : yesterdaySuccessBoost === "cleanup"
          ? "片づけ"
          : "開発"}系がまだ通りやすいな。`
      : `直近では${yesterdaySuccessBoost}系の行動が成功しています。`
    : "";





const streakHint =
  successStreak >= 5
    ? mode === "sayaka"
      ? `かなり良い流れです。もう習慣になり始めていますね。`
      : mode === "buddy"
      ? `かなり流れええやん。もう習慣になりかけてる。`
      : `連続成功が続いています。習慣化が進んでいます。`
    : successStreak >= 3
    ? mode === "sayaka"
      ? `良い流れが続いています。この勢いを使いましょう。`
      : mode === "buddy"
      ? `流れきてるな。この勢いでいこ。`
      : `連続成功中です。この流れを維持してください。`
    : "";




const repeatedFailureHint =
  sameFailureCount >= 3
    ? mode === "sayaka"
      ? `同じ理由で止まりやすい流れが続いているので、今日は作戦を変えましょう。`
      : mode === "buddy"
      ? `同じ理由で止まりやすいな。今日は作戦変えるで。`
      : `同じ失敗理由が続いているため、提案方針を変更します。`
    : sameFailureCount >= 2
    ? mode === "sayaka"
      ? `同じ理由が続いているので、今日はさらに軽くしてみましょう。`
      : mode === "buddy"
      ? `同じ理由続いてるし、今日はもっと軽くいこ。`
      : `同じ失敗理由が続いているため、さらに軽い提案に変更します。`
    : "";



const difficultyTuningHint =
  suggestionLevel === "soft"
    ? mode === "sayaka"
      ? "今日はかなり軽めにして、確実にできる形に寄せましょう。"
      : mode === "buddy"
      ? "今日はかなり軽めでいこ。成功優先や。"
      : "今日は成功優先で、かなり軽い提案に調整します。"
    : suggestionLevel === "push"
    ? mode === "sayaka"
      ? "今日は少しだけ前に進める日として使えそうですね。"
      : mode === "buddy"
      ? "今日はちょい攻めてもよさそう。"
      : "今日は少しだけ難易度を上げてもよさそうです。"
    : "";


  const successRate =
    typeof actionSuccessRates?.[bestType] === "number"
      ? actionSuccessRates[bestType]
      : null;

  const actionLevel = getActionLevel(successRate);

  let failureAdjustedLine = "";

if (lastFailureReason === "空腹") {
  failureAdjustedLine =
    mode === "sayaka"
      ? "まず水を一杯飲んでから、いちばん軽い行動にしましょう。"
      : mode === "buddy"
      ? "まず水飲も。空腹の時は最小行動でええ。"
      : "まず水を飲んでから、最小行動にしてください。";
}

if (lastFailureReason === "疲れている") {
  failureAdjustedLine =
    mode === "sayaka"
      ? "今日は回数より、30秒だけの軽い行動で十分です。"
      : mode === "buddy"
      ? "今日は30秒だけでええ。重くせんでいい。"
      : "今日は30秒だけの軽い行動にしてください。";
}

if (lastFailureReason === "時間がない") {
  failureAdjustedLine =
    mode === "sayaka"
      ? "今は時間優先で、10秒〜30秒で終わる行動にしましょう。"
      : mode === "buddy"
      ? "時間ない日は10秒で終わるやつにしよ。"
      : "10秒〜30秒で終わる行動にしてください。";
}

if (lastFailureReason === "やる気が出ない") {
  failureAdjustedLine =
    mode === "sayaka"
      ? "やる気は待たずに、1回だけ・10秒だけの最小行動にしましょう。"
      : mode === "buddy"
      ? "やる気待ちは捨てよ。1回だけでええ。"
      : "1回だけ・10秒だけの最小行動にしてください。";
}

if (!failureAdjustedLine) {
  if (topFailureReason?.includes("空腹")) {
    failureAdjustedLine =
      mode === "sayaka"
        ? "最近は空腹で止まりやすいので、まず水を一杯飲んでから始めましょう。"
        : mode === "buddy"
        ? "最近は空腹で止まりやすいな。まず水飲んでからいこ。"
        : "まず水を飲んでから始めてください。";
  } else if (topFailureReason === "疲れている") {
    failureAdjustedLine =
      mode === "sayaka"
        ? "最近は疲れで止まりやすいので、今日は30秒だけで十分です。"
        : mode === "buddy"
        ? "最近は疲れで止まりやすいな。今日は30秒だけでええ。"
        : "今日は30秒だけの軽い行動にしてください。";
  } else if (topFailureReason === "時間がない") {
    failureAdjustedLine =
      mode === "sayaka"
        ? "最近は時間不足で止まりやすいので、10秒で終わる行動にしましょう。"
        : mode === "buddy"
        ? "最近は時間不足が多いな。10秒で終わるやつにしよ。"
        : "10秒で終わる行動にしてください。";
  } else if (topFailureReason === "やる気が出ない") {
    failureAdjustedLine =
      mode === "sayaka"
        ? "最近はやる気待ちで止まりやすいので、1回だけの最小行動にしましょう。"
        : mode === "buddy"
        ? "最近はやる気待ちが多いな。1回だけでええ。"
        : "1回だけの最小行動にしてください。";
  }
}






let failureActionSuggestion = "";

if (topFailureReason?.includes("空腹")) {
  failureActionSuggestion =
    mode === "sayaka"
      ? "まず水を一杯飲むか、軽く散歩してみますか？"
      : mode === "buddy"
      ? "まず水飲むか、軽く歩こう。"
      : "まず水分補給か短い散歩を試してみてください。";
} else if (topFailureReason === "疲れている") {
  failureActionSuggestion =
    mode === "sayaka"
      ? "ストレッチだけでもやってみますか？"
      : mode === "buddy"
      ? "ストレッチだけやろう。"
      : "軽いストレッチから始めるのがおすすめです。";
} else if (topFailureReason === "時間がない") {
  failureActionSuggestion =
    mode === "sayaka"
      ? "10秒だけの行動にしてみますか？"
      : mode === "buddy"
      ? "10秒だけやろう。"
      : "10秒だけの行動に縮小してみましょう。";
} else if (topFailureReason === "やる気が出ない") {
  failureActionSuggestion =
    mode === "sayaka"
      ? "1回だけやってみますか？"
      : mode === "buddy"
      ? "1回だけでいい。"
      : "1回だけの行動にしてみましょう。";
}




if (topFailureReason === "疲れている" && sameFailureCount >= 3) {
  failureActionSuggestion =
    mode === "sayaka"
      ? "疲れが続いているので、今日は回復だけで十分です。水を飲んで、少し休みましょうか？"
      : mode === "buddy"
      ? "疲れが続いてる。今日は回復だけでええ。水飲んで休も。"
      : "疲労が続いているため、今日は回復を優先してください。";
} else if (topFailureReason === "疲れている" && sameFailureCount >= 2) {
  failureActionSuggestion =
    mode === "sayaka"
      ? "疲れが続いているので、今日は10秒だけの行動にしてみますか？"
      : mode === "buddy"
      ? "疲れ続きやな。今日は10秒だけにしよ。"
      : "疲労が続いているため、今日は10秒だけの行動にしてください。";
}

if (topFailureReason === "時間がない" && sameFailureCount >= 3) {
  failureActionSuggestion =
    mode === "sayaka"
      ? "時間不足が続いているので、行動そのものを1秒で決められる形にしましょう。"
      : mode === "buddy"
      ? "時間ないの続いてるし、1秒で決められるやつに変えよ。"
      : "時間不足が続いているため、1秒で決められる行動に変更してください。";
} else if (topFailureReason === "時間がない" && sameFailureCount >= 2) {
  failureActionSuggestion =
    mode === "sayaka"
      ? "時間がない日が続いているので、今日は10秒だけで終わる行動にしましょう。"
      : mode === "buddy"
      ? "時間ないの続いてるし、10秒で終わるやつにしよ。"
      : "時間不足が続いているため、今日は10秒で終わる行動にしてください。";
}

if (topFailureReason === "やる気が出ない" && sameFailureCount >= 3) {
  failureActionSuggestion =
    mode === "sayaka"
      ? "やる気待ちが続いているので、今日は『やるかどうか』を考えず、1回だけで終えましょう。"
      : mode === "buddy"
      ? "やる気待ち続いてるな。考えんで1回だけやろ。"
      : "やる気待ちが続いているため、考えずに1回だけ実行してください。";
} else if (topFailureReason === "やる気が出ない" && sameFailureCount >= 2) {
  failureActionSuggestion =
    mode === "sayaka"
      ? "やる気待ちが続いているので、今日は10秒だけに縮めてみましょうか？"
      : mode === "buddy"
      ? "やる気待ち続きやし、今日は10秒だけにしよ。"
      : "やる気待ちが続いているため、今日は10秒だけに縮小してください。";
}

if (topFailureReason === "空腹" && sameFailureCount >= 3) {
  failureActionSuggestion =
    mode === "sayaka"
      ? "空腹で止まりやすい流れが続いているので、先に飲み物を取ること自体を今日の行動にしましょう。"
      : mode === "buddy"
      ? "空腹続きやし、今日は水飲むだけでクリアにしよ。"
      : "空腹による失敗が続いているため、水分補給だけを今日の行動にしてください。";
} else if (topFailureReason === "空腹" && sameFailureCount >= 2) {
  failureActionSuggestion =
    mode === "sayaka"
      ? "空腹が続いているので、まず水を飲んでから10秒だけ動いてみますか？"
      : mode === "buddy"
      ? "空腹続きやな。まず水飲んで10秒だけ動こ。"
      : "空腹による失敗が続いているため、水を飲んでから10秒だけ動いてください。";
}


  const retryByTypeSayaka = {
    exercise:
      suggestionLevel === "soft"
        ? `大丈夫です✨
そういう日もあります。

今日はスクワットを1回だけにしてみますか？`
        : suggestionLevel === "push"
        ? `大丈夫です✨
そういう日もあります。

今日はスクワットを10回だけやってみますか？`
        : `大丈夫です✨
そういう日もあります。

${
  actionLevel === "high"
    ? "今日はスクワットを15回だけやってみますか？"
    : actionLevel === "normal"
    ? "今日はスクワットを5回だけやってみますか？"
    : "今日はスクワットを3回だけにしてみますか？"
}`,

    study:
      suggestionLevel === "soft"
        ? `大丈夫です✨
そういう日もあります。

今日は勉強を1分だけにしてみますか？`
        : suggestionLevel === "push"
        ? `大丈夫です✨
そういう日もあります。

今日は勉強を10分だけやってみますか？`
        : `大丈夫です✨
そういう日もあります。

今日は勉強を5分だけにしてみますか？`,

    cleanup:
      suggestionLevel === "soft"
        ? `大丈夫です✨
そういう日もあります。

今日は机の上を10秒だけ整えてみますか？`
        : suggestionLevel === "push"
        ? `大丈夫です✨
そういう日もあります。

今日は机の上と、もう一か所だけ整えてみますか？`
        : `大丈夫です✨
そういう日もあります。

今日は机の上だけ、軽く整えてみますか？`,

    dev:
      suggestionLevel === "soft"
        ? `大丈夫です✨
そういう日もあります。

今日は一行だけ見直してみますか？`
        : suggestionLevel === "push"
        ? `大丈夫です✨
そういう日もあります。

今日は二か所だけ、軽く修正してみますか？`
        : `大丈夫です✨
そういう日もあります。

今日は一か所だけ、軽く修正してみますか？`,


other:
  suggestionLevel === "soft"
    ? `大丈夫です✨
そういう日もあります。

明日は「${recommendedActionLabel}」を10秒だけにしてみますか？`
    : suggestionLevel === "push"
    ? `大丈夫です✨
そういう日もあります。

明日は「${recommendedActionLabel}」を少しだけ進めてみますか？`
    : `大丈夫です✨
そういう日もあります。

明日は「${recommendedActionLabel}」を一つだけやってみますか？`,
  } as const;


  const retryByTypeBuddy = {
    exercise:
      suggestionLevel === "soft"
        ? `大丈夫。今日はスクワット1回だけでええ。やってみる？`
        : suggestionLevel === "push"
        ? `大丈夫。今日はスクワット10回だけやってみる？`
        : actionLevel === "high"
        ? `大丈夫。今日はスクワット15回だけやってみる？`
        : actionLevel === "normal"
        ? `大丈夫。今日はスクワット5回だけやってみる？`
        : `大丈夫。今日はスクワット3回だけにしよか？`,

    study:
      suggestionLevel === "soft"
        ? `大丈夫。今日は勉強1分だけでええ。やってみる？`
        : suggestionLevel === "push"
        ? `大丈夫。今日は勉強10分だけやってみる？`
        : `大丈夫。今日は勉強5分だけにしよか？`,

    cleanup:
      suggestionLevel === "soft"
        ? `大丈夫。今日は机の上を10秒だけ整えよか？`
        : suggestionLevel === "push"
        ? `大丈夫。今日は机の上と、もう一か所だけ整えよか？`
        : `大丈夫。今日は机の上だけ整えよか？`,

    dev:
      suggestionLevel === "soft"
        ? `大丈夫。今日は一行だけ見直してみる？`
        : suggestionLevel === "push"
        ? `大丈夫。今日は二か所だけ軽く直してみる？`
        : `大丈夫。今日は一か所だけ軽く直してみる？`,

other:
  suggestionLevel === "soft"
    ? `大丈夫。明日は「${recommendedActionLabel}」を10秒だけやってみよか？`
    : suggestionLevel === "push"
    ? `大丈夫。明日は「${recommendedActionLabel}」を少しだけ進めてみよか？`
    : `大丈夫。明日は「${recommendedActionLabel}」を一つだけやってみよか？`,
  } as const;



  const retryByTypeStandard = {
    exercise: "今日はスクワットを3回だけ実行してみてください。",
    study: "今日は勉強を1分だけ実行してみてください。",
    cleanup: "今日は机の上だけ整えてみてください。",
    dev: "今日は一か所だけ軽く修正してみてください。",
other: `明日は「${recommendedActionLabel}」を一つだけ実行してみてください。`,
  } as const;

  const body =
    mode === "sayaka"
      ? retryByTypeSayaka[bestType]
      : mode === "buddy"
      ? retryByTypeBuddy[bestType]
      : retryByTypeStandard[bestType];




const leadHints = [
  pastSuccessHint,
  favoriteActionHint,
  recentMomentumHint,
  streakHint,
  bestTimeHint,
  successRateHint,
  successControlHint,
  bestTypeFocusHint,
  recommendedActionHint,
  typeSwitchHint,
  failureAdjustedLine,
  repeatedFailureHint,
  difficultyTuningHint,
  failureActionSuggestion,
].filter((s) => typeof s === "string" && s.trim().length > 0);
const trimmedHints = leadHints.slice(0, 4).join("\n\n");




const finalBody = timeBasedGuidance
  ? `${timeBasedGuidance}\n\n${trimmedHints ? `${trimmedHints}\n\n` : ""}${body}`
  : `${trimmedHints ? `${trimmedHints}\n\n` : ""}${body}`;

return finalize(finalBody);

}



if (isBuddy) {
  if (looksLikeActionReport(userText)) {
    const actionType = detectActionType(userText);

    if (streak >= 3 && mode === "sayaka") {
      return finalize(`すごいです✨
もう${streak}回も行動できていますね。

この流れ、大事にしていきましょう。`);
    }

    const sayakaBodyByType = {
      exercise: `いいですね✨
ちゃんと体を動かせていてえらいです。

今日はこの流れで、もう少しだけ軽く動いてみますか？`,
      study: `いいですね✨
ちゃんと積み上げできていてえらいです。

今日はこのあと、5分だけでも続けてみますか？`,
      cleanup: `いいですね✨
ちゃんと整えられていてえらいです。

もう一か所だけ、軽く片づけてみますか？`,
      dev: `いいですね✨
ちゃんと進められていてえらいです。

今日はこの流れで、あと一か所だけ直してみますか？`,
      other: `いいですね✨
ちゃんと行動できていてえらいです。

今日は他に何かできたことはありましたか？`,
    } as const;

    const body =
      mode === "sayaka"
        ? sayakaBodyByType[actionType]
        : `やったなら勝ち。次は「もう一回」か「ちょい増やす」どっち？`;

    return finalize(body);
  }

  if (mode === "sayaka") {
    return finalize(buildSayakaReply(userText));
  }

  const kw = pickKeyword(userText);

  const looksLikeAdj = kw
    ? /(い|しい|しいよ|すぎ|ぽい|かわいい|美人|素敵|最高|最強|かっこいい|すごい)$/.test(kw)
    : false;

  const q = !kw
    ? `それ、どういう意味で言ってる？`
    : looksLikeAdj
    ? `「${kw}」って、あなたの基準では何が決め手？`
    : `「${kw}」って、あなたの中では何が根拠？`;

  return finalize(`${q}\n\n一言でまとめると？`);
}

return finalize(`入力内容を確認しました。

現状の要点を一文で表すと、どうなりますか？`);
}