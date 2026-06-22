import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUMMARY_TYPE = "thread_summary_from_classifications";

type StructureRow = {
  thread_id: string;
  summary_text: string | null;
  easy_summary_text: string | null;
  key_points: unknown;
  updated_at: string | null;
};

type ThreadRow = {
  id: string;
  title: string | null;
  category: string | null;
  original_post: string | null;
  created_at: string | null;
};

type SavedProposalRow = {
  thread_id: string;
  status: string;
  created_at: string;
  proposal_json: unknown;
};

type PolicyArea = "fiscal" | "monetary" | "other" | "combined" | "unclassified";
type PrimaryPolicyArea = Exclude<PolicyArea, "combined" | "unclassified">;

const POLICY_THEME_RULES = [
  { tag: "消費税・減税", area: "fiscal", keywords: ["消費税", "減税", "増税", "給付", "公共投資"] },
  { tag: "雇用・賃金", area: "other", keywords: ["賃金", "実質賃金", "給料", "賃上げ"] },
  { tag: "雇用・労働市場", area: "other", keywords: ["雇用", "失業率", "有効求人倍率", "人手不足", "労働市場"] },
  { tag: "財政規律", area: "fiscal", keywords: ["財政規律", "財政健全化", "pb", "プライマリーバランス"] },
  { tag: "国債・財政", area: "fiscal", keywords: ["国債", "債務", "償還", "60年償還", "財政政策", "財政出動", "政府支出"] },
  { tag: "日銀・金融政策", area: "monetary", keywords: ["日銀", "政策金利", "利上げ", "利下げ", "金融政策", "金融緩和"] },
  { tag: "物価・インフレ", area: null, keywords: ["物価", "インフレ", "cpi", "円安", "輸入物価"] },
  { tag: "社会保険料", area: "fiscal", keywords: ["社会保険料", "社保"] },
  { tag: "需要不足・デフレ", area: null, keywords: ["需要不足", "需給ギャップ", "デフレ"] },
  { tag: "価格転嫁・生産性", area: "other", keywords: ["価格転嫁", "生産性", "省力化"] },
  { tag: "制度改革", area: "other", keywords: ["制度改革", "制度見直し", "規制改革", "情報公開", "社会制度"] },
] as const;

const FISCAL_PRIMARY_KEYWORDS = [
  "消費税", "減税", "増税", "給付", "社会保険料", "国債", "償還",
  "財政規律", "公共投資", "政府支出", "財政出動",
];
const MONETARY_PRIMARY_KEYWORDS = [
  "日銀", "政策金利", "利上げ", "利下げ", "金融緩和", "金融引き締め",
  "金利据え置き", "量的緩和", "金融政策",
];
const MONETARY_ACTION_KEYWORDS = [
  "政策金利", "利上げ", "利下げ", "金融緩和", "金融引き締め",
  "金利据え置き", "量的緩和",
];
const OTHER_PRIMARY_KEYWORDS = [
  "賃金", "雇用", "価格転嫁", "生産性", "労働市場", "制度改革",
  "労働分配率", "人手不足",
];

function includesAny(text: string, keywords: readonly string[]) {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function classifyExplicitPolicyArea(text: string): PolicyArea | null {
  const hasFiscal = includesAny(text, FISCAL_PRIMARY_KEYWORDS);
  const hasMonetary = includesAny(text, MONETARY_PRIMARY_KEYWORDS);
  const hasMonetaryAction = includesAny(text, MONETARY_ACTION_KEYWORDS);
  const hasOther = includesAny(text, OTHER_PRIMARY_KEYWORDS);

  if (hasFiscal && hasMonetaryAction) return "combined";
  if (hasFiscal) return "fiscal";
  if (hasMonetary) return "monetary";
  if (hasOther) return "other";
  return null;
}

function classifyConclusions(conclusions: string[]) {
  const areas = conclusions
    .map(classifyExplicitPolicyArea)
    .filter((area): area is PolicyArea => area !== null);
  if (areas.includes("combined")) return "combined";
  if (areas.length === 0) return null;

  const counts = areas.reduce<Record<string, number>>((result, area) => {
    result[area] = (result[area] ?? 0) + 1;
    return result;
  }, {});
  return areas.reduce((selected, area) =>
    (counts[area] ?? 0) > (counts[selected] ?? 0) ? area : selected
  );
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) return null;

  return createClient(url, serviceRole, {
    auth: { persistSession: false },
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function buildCardItems(sources: unknown[], maxItems: number, maxLength = 160) {
  const items: string[] = [];
  const seen = new Set<string>();

  for (const source of sources) {
    for (const value of asStringArray(source)) {
      const compact = value.replace(/\s+/g, " ").trim();
      if (!compact || seen.has(compact)) continue;
      seen.add(compact);
      items.push(compact.length > maxLength ? `${compact.slice(0, maxLength)}...` : compact);
      if (items.length >= maxItems) return items;
    }
  }

  return items;
}

function getSavedPolicyJudgment(value: unknown, policyArea: PolicyArea) {
  if (!value || policyArea === "combined" || policyArea === "unclassified") return null;

  const proposal = asRecord(value);
  const groups = asRecord(proposal.policy_groups);
  const groupKey =
    policyArea === "fiscal"
      ? "fiscal_policy"
      : policyArea === "monetary"
        ? "monetary_policy"
        : "other_policy";
  const group = asRecord(groups[groupKey]);
  const priority = asRecord(proposal.priority_judgment);
  const priorityArea = String(priority.priority_area ?? "");
  const priorityReasons = asStringArray(priority.reasons);
  const decision = String(group.decision ?? "").trim();
  const decisionLabel = String(group.decision_label ?? "").trim();
  const reason = String(group.summary ?? "").trim();
  const oneLineProposal = String(proposal.one_line_proposal ?? "").trim();
  const fallbackLabel = priorityArea === policyArea ? String(priority.label ?? "").trim() : "";

  return {
    decision,
    decision_label: decisionLabel || fallbackLabel,
    reason: reason || priorityReasons[0] || oneLineProposal,
  };
}

function buildPolicyThemeAnalysis(input: {
  title: string;
  category: string;
  originalPost: string;
  easySummary: string;
  summary: string;
  conclusions: string[];
  metrics: string[];
}) {
  const weightedSources = [
    { text: input.title, weight: 4 },
    { text: input.category, weight: 1 },
    { text: input.originalPost, weight: 2 },
    { text: input.easySummary, weight: 3 },
    { text: input.summary, weight: 2 },
    { text: input.conclusions.join("\n"), weight: 3 },
    { text: input.metrics.join("\n"), weight: 1 },
  ].map((source) => ({ ...source, text: source.text.toLowerCase() }));

  const scoredThemes = POLICY_THEME_RULES.map((rule, index) => {
    const score = weightedSources.reduce((total, source) => {
      const matchedKeywordCount = rule.keywords.filter((keyword) =>
        source.text.includes(keyword.toLowerCase())
      ).length;
      return total + matchedKeywordCount * source.weight;
    }, 0);

    return { tag: rule.tag, area: rule.area, score, index };
  });
  const tags = scoredThemes
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 3)
    .map((item) => item.tag);

  const areaScores: Record<PrimaryPolicyArea, number> = {
    fiscal: 0,
    monetary: 0,
    other: 0,
  };
  for (const theme of scoredThemes) {
    if (theme.area) areaScores[theme.area] += theme.score;
  }

  const [firstArea] = (Object.entries(areaScores) as Array<[PrimaryPolicyArea, number]>)
    .sort((a, b) => b[1] - a[1]);
  const titlePolicyArea = classifyExplicitPolicyArea(input.title);
  const conclusionPolicyArea = classifyConclusions(input.conclusions);
  const isClearlyOutsideEconomicPolicy =
    Boolean(input.category) && input.category !== "未設定" && input.category !== "経済・政策";

  let policyArea: PolicyArea = "unclassified";
  if (!isClearlyOutsideEconomicPolicy) {
    if (titlePolicyArea) {
      policyArea = titlePolicyArea;
    } else if (conclusionPolicyArea) {
      policyArea = conclusionPolicyArea;
    } else if (firstArea[1] > 0) {
      policyArea = firstArea[0];
    }
  }

  return {
    policy_theme_tags: tags.length > 0 ? tags : ["テーマ未分類"],
    policy_area: policyArea,
  };
}

export async function GET() {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase environment is not configured." },
      { status: 500 }
    );
  }

  const { data: structures, error: structuresError } = await supabase
    .from("thread_ai_structures")
    .select("thread_id, summary_text, easy_summary_text, key_points, updated_at")
    .eq("summary_type", SUMMARY_TYPE)
    .eq("status", "active")
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(100);

  if (structuresError) {
    return NextResponse.json(
      { ok: false, error: "政策提言候補を取得できませんでした。" },
      { status: 500 }
    );
  }

  const structureRows = (structures ?? []) as StructureRow[];
  const threadIds = Array.from(
    new Set(structureRows.map((row) => row.thread_id).filter(Boolean))
  );

  if (threadIds.length === 0) {
    return NextResponse.json({ ok: true, proposals: [] });
  }

  const { data: threads, error: threadsError } = await supabase
    .from("forum_threads")
    .select("id, title, category, original_post, created_at")
    .eq("is_deleted", false)
    .in("id", threadIds);

  if (threadsError) {
    return NextResponse.json(
      { ok: false, error: "政策提言候補のスレッドを取得できませんでした。" },
      { status: 500 }
    );
  }

  const { data: savedProposals, error: savedProposalsError } = await supabase
    .from("forum_policy_proposals")
    .select("thread_id, status, created_at, proposal_json")
    .in("thread_id", threadIds)
    .in("status", ["draft", "review", "published"])
    .order("created_at", { ascending: false });

  if (savedProposalsError) {
    return NextResponse.json(
      { ok: false, error: "保存済み政策提言候補を取得できませんでした。" },
      { status: 500 }
    );
  }

  const threadMap = new Map(
    ((threads ?? []) as ThreadRow[]).map((thread) => [thread.id, thread])
  );
  const latestSavedProposalMap = new Map<string, SavedProposalRow>();
  for (const savedProposal of (savedProposals ?? []) as SavedProposalRow[]) {
    if (!latestSavedProposalMap.has(savedProposal.thread_id)) {
      latestSavedProposalMap.set(savedProposal.thread_id, savedProposal);
    }
  }

  const proposals = structureRows
    .map((structure) => {
      const thread = threadMap.get(structure.thread_id);
      if (!thread) return null;

      const keyPoints = asRecord(structure.key_points);
      const title = thread.title?.trim() || "無題の議論";
      const category = thread.category?.trim() || "未設定";
      const easySummary = structure.easy_summary_text?.trim() || "";
      const summary = structure.summary_text?.trim() || "";
      const conclusions = asStringArray(keyPoints.current_tentative_conclusion);
      const metrics = asStringArray(keyPoints.verification_metrics);
      const cardKeyPoints = {
        main_points: buildCardItems(
          [keyPoints.current_tentative_conclusion, keyPoints.discussion_position],
          3
        ),
        premises: buildCardItems([keyPoints.added_premises], 2),
        cautions: buildCardItems([keyPoints.main_rebuttals, keyPoints.needs_review], 2),
      };
      const latestSavedProposal = latestSavedProposalMap.get(thread.id);
      const policyThemeAnalysis = buildPolicyThemeAnalysis({
        title,
        category,
        originalPost: thread.original_post?.trim() || "",
        easySummary,
        summary,
        conclusions,
        metrics,
      });
      const policyJudgment = latestSavedProposal
        ? getSavedPolicyJudgment(
            latestSavedProposal.proposal_json,
            policyThemeAnalysis.policy_area
          )
        : null;
      return {
        thread_id: thread.id,
        title,
        category,
        created_at: thread.created_at,
        summary_updated_at: structure.updated_at,
        easy_summary_text: easySummary,
        summary_text: summary,
        current_tentative_conclusion: conclusions,
        verification_metrics: metrics,
        card_key_points: cardKeyPoints,
        policy_theme_tags: policyThemeAnalysis.policy_theme_tags,
        policy_area: policyThemeAnalysis.policy_area,
        has_saved_proposal: Boolean(latestSavedProposal),
        latest_saved_proposal_status: latestSavedProposal?.status ?? null,
        latest_saved_proposal_created_at: latestSavedProposal?.created_at ?? null,
        policy_judgment: policyJudgment,
      };
    })
    .filter((proposal): proposal is NonNullable<typeof proposal> => proposal !== null)
    .sort((a, b) => {
      const categoryPriority = Number(b.category === "経済・政策") - Number(a.category === "経済・政策");
      if (categoryPriority !== 0) return categoryPriority;
      return (
        new Date(b.summary_updated_at ?? b.created_at ?? 0).getTime() -
        new Date(a.summary_updated_at ?? a.created_at ?? 0).getTime()
      );
    });

  return NextResponse.json({ ok: true, proposals });
}
