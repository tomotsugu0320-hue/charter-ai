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

const POLICY_THEME_RULES = [
  { tag: "消費税・減税", keywords: ["消費税", "減税", "増税"] },
  { tag: "雇用・賃金", keywords: ["賃金", "実質賃金", "給料"] },
  { tag: "雇用・労働市場", keywords: ["雇用", "失業率", "有効求人倍率", "人手不足"] },
  { tag: "財政規律", keywords: ["財政規律", "財政健全化", "pb", "プライマリーバランス"] },
  { tag: "国債・財政", keywords: ["国債", "債務", "償還", "60年償還"] },
  { tag: "日銀・金融政策", keywords: ["日銀", "政策金利", "利上げ", "金融政策"] },
  { tag: "物価・インフレ", keywords: ["物価", "インフレ", "cpi", "円安", "輸入物価"] },
  { tag: "社会保険料", keywords: ["社会保険料", "社保"] },
  { tag: "需要不足・デフレ", keywords: ["需要不足", "需給ギャップ", "デフレ"] },
] as const;

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

function buildPolicyThemeTags(input: {
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

  const tags = POLICY_THEME_RULES.map((rule, index) => {
    const score = weightedSources.reduce((total, source) => {
      const matchedKeywordCount = rule.keywords.filter((keyword) =>
        source.text.includes(keyword.toLowerCase())
      ).length;
      return total + matchedKeywordCount * source.weight;
    }, 0);

    return { tag: rule.tag, score, index };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 3)
    .map((item) => item.tag);

  return tags.length > 0 ? tags : ["テーマ未分類"];
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

  const threadMap = new Map(
    ((threads ?? []) as ThreadRow[]).map((thread) => [thread.id, thread])
  );

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
        policy_theme_tags: buildPolicyThemeTags({
          title,
          category,
          originalPost: thread.original_post?.trim() || "",
          easySummary,
          summary,
          conclusions,
          metrics,
        }),
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
