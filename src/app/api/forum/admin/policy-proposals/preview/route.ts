import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isForumAdminAuthenticated } from "@/lib/forum-auth";
import { getErrorMessage, recordForumApiUsageLog } from "@/lib/forum-api-usage";
import { ECONOMIC_POLICY_ANALYSIS_FRAME_PROMPT } from "@/lib/forum/economic-policy-analysis-frame";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MODEL = "gpt-5.4-mini";
const PROMPT_VERSION = "policy_proposal_preview_v2";
const SUMMARY_TYPE = "thread_summary_from_classifications";
const MAX_POSTS = 30;
const ECONOMIC_THEORY_CONCEPTS = [
  "有効需要",
  "乗数効果",
  "GDPギャップ",
  "需要インフレ",
  "コストプッシュ",
  "供給制約",
  "フィリップス曲線",
  "労働需給",
  "労働分配率",
  "テイラー・ルール",
  "実質金利",
  "期待インフレ",
  "財政乗数",
  "クラウディングアウト",
  "将来増税予想",
] as const;

type PostRow = {
  id: string;
  post_role: string | null;
  content: string | null;
  logic_score: number | null;
  created_at: string | null;
};

type ClassificationRow = {
  post_id: string | null;
  classification: string | null;
  confidence: number | string | null;
  reason: string | null;
  extracted_premise: string | null;
  extracted_evidence: string | null;
  suggested_metrics: unknown;
  created_at: string | null;
};

type ReferenceThread = {
  thread_id: string;
  title: string;
  url: string;
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) return null;
  return createClient(url, serviceRole, { auth: { persistSession: false } });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown, maxLength = 4000) {
  const text = String(value ?? "").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function asStringArray(value: unknown, maxItems = 12) {
  const source = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return source
    .map((item) => asString(isRecord(item) ? item.text ?? item.label : item, 800))
    .filter(Boolean)
    .slice(0, maxItems);
}

function toNullableNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function collectText(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) return value.flatMap(collectText);
  if (!isRecord(value)) return [];
  return [
    ...collectText(value.text),
    ...collectText(value.output_text),
    ...collectText(value.content),
    ...collectText(value.output),
  ];
}

function extractOutputText(data: unknown) {
  if (!isRecord(data)) return "";
  const direct = asString(data.output_text, 30000);
  return direct || Array.from(new Set(collectText(data.output))).join("\n").trim();
}

function parseJsonObject(value: string) {
  const text = value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizePolicyGroup(
  value: unknown,
  allowedDecisions: readonly string[],
  defaultDecisionLabel: string
) {
  const group = isRecord(value) ? value : {};
  const requestedDecision = asString(group.decision, 40);
  const decision = allowedDecisions.includes(requestedDecision)
    ? requestedDecision
    : "insufficient";

  return {
    decision,
    decision_label: asString(group.decision_label, 120) || defaultDecisionLabel,
    summary: asString(group.summary, 1200),
    proposal_items: asStringArray(group.proposal_items, 5),
    merits: asStringArray(group.merits, 5),
    demerits: asStringArray(group.demerits, 5),
    countermeasures: asStringArray(group.countermeasures, 5),
  };
}

function normalizeEconomicTheoryChecks(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isRecord)
    .map((item) => ({
      area: asString(item.area, 120),
      concepts: Array.from(
        new Set(
          asStringArray(item.concepts, 5).filter((concept) =>
            ECONOMIC_THEORY_CONCEPTS.includes(
              concept as (typeof ECONOMIC_THEORY_CONCEPTS)[number]
            )
          )
        )
      ),
      judgment: asString(item.judgment, 800),
      caveat: asString(item.caveat, 800),
    }))
    .filter(
      (item) =>
        item.area || item.concepts.length > 0 || item.judgment || item.caveat
    )
    .slice(0, 8);
}

function mergePolicyGroupItems(
  groups: ReturnType<typeof normalizePolicyGroup>[],
  key: "proposal_items" | "merits" | "demerits" | "countermeasures"
) {
  return Array.from(new Set(groups.flatMap((group) => group[key]))).slice(0, 12);
}

function normalizePreview(outputText: string, references: ReferenceThread[]) {
  const parsed = parseJsonObject(outputText);
  if (!parsed) throw new Error("政策提言AIプレビューのJSONを解析できませんでした。");

  const priority = isRecord(parsed.priority_judgment) ? parsed.priority_judgment : {};
  const decision = ["prioritize", "conditional", "do_not_prioritize", "insufficient"].includes(
    String(priority.decision ?? "")
  )
    ? String(priority.decision)
    : "insufficient";
  const defaultLabels: Record<string, string> = {
    prioritize: "優先すべき",
    conditional: "条件付きで優先",
    do_not_prioritize: "優先しない",
    insufficient: "判断材料不足",
  };
  const priorityAreas = ["fiscal", "monetary", "other", "combined", "hold", "insufficient"];
  const priorityArea = priorityAreas.includes(String(priority.priority_area ?? ""))
    ? String(priority.priority_area)
    : "insufficient";
  const policyGroupsRecord = isRecord(parsed.policy_groups) ? parsed.policy_groups : {};
  const policyGroups = {
    fiscal_policy: normalizePolicyGroup(
      policyGroupsRecord.fiscal_policy,
      ["spend", "do_not_spend", "conditional", "insufficient"],
      "判断材料不足"
    ),
    monetary_policy: normalizePolicyGroup(
      policyGroupsRecord.monetary_policy,
      ["ease", "tighten", "hold", "conditional", "insufficient"],
      "判断材料不足"
    ),
    other_policy: normalizePolicyGroup(
      policyGroupsRecord.other_policy,
      ["do", "do_not_do", "conditional", "insufficient"],
      "判断材料不足"
    ),
  };
  const policyGroupValues = Object.values(policyGroups);

  return {
    title: asString(parsed.title, 240) || "政策提言候補",
    one_line_proposal: asString(parsed.one_line_proposal, 500),
    policy_groups: policyGroups,
    proposal_items: mergePolicyGroupItems(policyGroupValues, "proposal_items"),
    merits: mergePolicyGroupItems(policyGroupValues, "merits"),
    demerits: mergePolicyGroupItems(policyGroupValues, "demerits"),
    countermeasures: mergePolicyGroupItems(policyGroupValues, "countermeasures"),
    opposing_views: asStringArray(parsed.opposing_views),
    priority_judgment: {
      decision,
      priority_area: priorityArea,
      label: asString(priority.label, 120) || defaultLabels[decision],
      reasons: asStringArray(priority.reasons),
    },
    verification_metrics: asStringArray(parsed.verification_metrics),
    review_conditions: asStringArray(parsed.review_conditions),
    economic_phase: asString(parsed.economic_phase, 800),
    demand_balance: asString(parsed.demand_balance, 800),
    inflation_causes: asStringArray(parsed.inflation_causes),
    monetary_policy_role: asString(parsed.monetary_policy_role, 800),
    fiscal_policy_role: asString(parsed.fiscal_policy_role, 800),
    economic_theory_checks: normalizeEconomicTheoryChecks(parsed.economic_theory_checks),
    missing_information: asStringArray(parsed.missing_information),
    reference_threads: references,
  };
}

function normalizeKeyPoints(value: unknown) {
  const record = isRecord(value) ? value : {};
  return {
    discussion_position: asStringArray(record.discussion_position, 8),
    added_premises: asStringArray(record.added_premises, 8),
    added_evidence: asStringArray(record.added_evidence, 8),
    main_agreements: asStringArray(record.main_agreements, 8),
    main_rebuttals: asStringArray(record.main_rebuttals, 8),
    verification_metrics: asStringArray(record.verification_metrics, 8),
    needs_review: asStringArray(record.needs_review, 8),
    changes_from_initial_answer: asStringArray(record.changes_from_initial_answer, 8),
    current_tentative_conclusion: asStringArray(record.current_tentative_conclusion, 8),
  };
}

function getRelatedThreadIds(mapJson: unknown, threadId: string, limit: number) {
  if (!isRecord(mapJson) || !Array.isArray(mapJson.nodes)) return [];

  const matchingNodes = mapJson.nodes
    .filter(isRecord)
    .map((node) => ({
      ids: asStringArray(node.source_thread_ids, 500),
    }))
    .filter((node) => node.ids.includes(threadId))
    .sort((a, b) => a.ids.length - b.ids.length);

  const relatedIds: string[] = [];
  for (const node of matchingNodes) {
    for (const id of node.ids) {
      if (id !== threadId && !relatedIds.includes(id)) relatedIds.push(id);
      if (relatedIds.length >= limit) return relatedIds;
    }
  }
  return relatedIds;
}

function buildPrompt(input: {
  mainThread: Record<string, unknown>;
  posts: Record<string, unknown>[];
  relatedThreads: Record<string, unknown>[];
  references: ReferenceThread[];
}) {
  return `
${ECONOMIC_POLICY_ANALYSIS_FRAME_PROMPT}

あなたはAI知恵袋Forumの政策判断プレビューAIです。
掲示板の主張をそのまま政策として採用せず、議論材料を論理的な政策判断へ再構成してください。

重要原則:
- 投稿、AI分類、既存AI再総括はすべて判断材料であり、確定事実ではありません。
- 入力にない事実、数値、出典、URLを作らないでください。
- 根拠不足の場合は missing_information に明記し、priority_judgment.decision を insufficient にできます。
- 「どちらにも一理があります」「バランスが重要」だけで終わらず、何を優先するかを選んでください。
- 出力は文章を長く連ねず、箇条書き用の短い配列を中心にしてください。

政策の3分類:
- fiscal_policy は「政府がお金を出すべきか」です。decision は spend、do_not_spend、conditional、insufficient から選び、decision_label は「支出する」「支出しない」「条件付きで支出する」「判断材料不足」のような簡単な日本語にしてください。
- monetary_policy は「日銀がお金の流れをどうするべきか」です。decision は ease、tighten、hold、conditional、insufficient から選び、decision_label は「緩和する」「引き締める」「据え置く」「条件付き」「判断材料不足」のような簡単な日本語にしてください。
- other_policy は「制度、規制、労働市場、価格転嫁、生産性などをどう直すか」です。decision は do、do_not_do、conditional、insufficient から選び、decision_label は「実施する」「実施しない」「条件付き」「判断材料不足」のような簡単な日本語にしてください。
- 同じ政策行動を複数分類へ重複させず、主となる分類を1つ選んでください。
- 材料がない分類は無理に埋めず、summary は空文字、各配列は空配列にしてください。

判断に使う経済理論:
- 需要不足は、有効需要、乗数効果、GDPギャップで確認してください。
- 物価上昇は、需要インフレ、コストプッシュ、供給制約を分けてください。
- 賃金は、フィリップス曲線、労働需給、労働分配率で確認してください。
- 金融政策は、テイラー・ルール、実質金利、期待インフレで確認してください。
- 財政政策は、財政乗数、クラウディングアウト、将来増税予想で確認してください。
- economic_theory_checks には実際に判断へ使った理論だけを入れてください。concepts は指定候補から選び、judgment に理論から見た判断理由、caveat に注意点を短い日本語で書いてください。
- 理論名を並べるだけにせず、今回の政策判断とどうつながるかを一般ユーザーにも分かる言葉で説明してください。

出力件数と内容:
- 各分類の proposal_items は、材料がある場合は原則1〜4件。具体的な政策行動を1項目ずつ書いてください。
- 各分類の merits は原則1〜4件。誰に、どの経路で、どのような効果があるかを具体化してください。
- 各分類の demerits は原則1〜4件。財政負担、インフレ再燃、円安、制度悪用、政策依存など、その分類の提言に実際に関係する副作用だけを書いてください。
- 各分類の countermeasures は demerits と対応させ、可能な限り各デメリットに1件以上の対策を示してください。どのデメリットへの対策か分かる文にしてください。
- opposing_views は原則2件以上。単なる感想ではなく政策上の反論を書いてください。
- priority_judgment.priority_area は fiscal、monetary、other、combined、hold、insufficient のいずれかを選んでください。
- priority_judgment.reasons は原則2件以上。どの政策分類を優先するのか、または条件付き・見送り・判断材料不足とする理由を明示してください。
- verification_metrics は原則3〜6件。指標名だけでなく、見る方向、確認時期、見直し条件との関係を可能な範囲で書いてください。
- review_conditions は原則2〜5件。政策を停止、縮小、変更すべき条件を書いてください。
- reference_threads は実際に参照した入力済みスレッドだけを最大5件まで入れてください。関連スレッドがない場合は捏造しないでください。
- 材料が十分にある場合は各配列を1件だけで終わらせないでください。
- 材料不足の場合は件数を無理に埋めず、不足論点を missing_information に書いてください。

必ず次の順序で判断してください:
1. まず結論として、何を優先するかを整理する。
2. 財政政策を「支出する・支出しない・条件付き・判断材料不足」から選ぶ。
3. 金融政策を「緩和・引き締め・据え置き・条件付き・判断材料不足」から選ぶ。
4. その他政策を「実施・実施しない・条件付き・判断材料不足」から選ぶ。
5. 判断に使った経済理論を選ぶ。
6. 景気局面、需給、物価原因、賃金、実質金利などを理論に照らして判断理由を整理する。
7. 反対意見を検討する。
8. 確認すべき指標を設定する。
9. 見直し条件を設定する。
10. 不足情報を明記する。
11. 実際に参照したスレッドを示す。

主スレッド材料:
${JSON.stringify(input.mainThread)}

公開投稿とactive AI分類（最大${MAX_POSTS}件）:
${JSON.stringify(input.posts)}

同じ議論マップノードに属する関連スレッド:
${input.relatedThreads.length > 0 ? JSON.stringify(input.relatedThreads) : "関連議論不足"}

使用可能な参考リンク（この一覧以外のURLは禁止）:
${JSON.stringify(input.references)}
`.trim();
}

export async function POST(request: NextRequest) {
  if (!isForumAdminAuthenticated(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase environment is not configured." }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const threadId = asString(isRecord(body) ? body.thread_id : "", 120);
  const tenantInput = asString(isRecord(body) ? body.tenant : "dev", 80);
  const tenant = /^[a-zA-Z0-9_-]+$/.test(tenantInput) ? tenantInput : "dev";
  const requestedRelated = Number(isRecord(body) ? body.max_related_threads : 5);
  const maxRelatedThreads = Math.max(1, Math.min(5, Number.isFinite(requestedRelated) ? Math.floor(requestedRelated) : 5));

  if (!threadId) {
    return NextResponse.json({ ok: false, error: "thread_id is required." }, { status: 400 });
  }

  const { data: thread, error: threadError } = await supabase
    .from("forum_threads")
    .select("id, title, category, original_post")
    .eq("id", threadId)
    .eq("is_deleted", false)
    .maybeSingle();

  if (threadError || !thread) {
    return NextResponse.json({ ok: false, error: threadError?.message || "thread not found." }, { status: threadError ? 500 : 404 });
  }

  const { data: structure, error: structureError } = await supabase
    .from("thread_ai_structures")
    .select("summary_text, easy_summary_text, key_points")
    .eq("thread_id", threadId)
    .eq("summary_type", SUMMARY_TYPE)
    .eq("status", "active")
    .maybeSingle();

  if (structureError || !structure) {
    return NextResponse.json({ ok: false, error: structureError?.message || "classification-based summary not found." }, { status: structureError ? 500 : 400 });
  }

  const { data: postData, error: postsError } = await supabase
    .from("forum_posts")
    .select("id, post_role, content, logic_score, created_at")
    .eq("thread_id", threadId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(MAX_POSTS);

  if (postsError) {
    return NextResponse.json({ ok: false, error: postsError.message }, { status: 500 });
  }

  const posts = ((postData ?? []) as PostRow[]).reverse();
  const postIds = posts.map((post) => post.id).filter(Boolean);
  const classificationMap = new Map<string, ClassificationRow>();

  if (postIds.length > 0) {
    const { data: classifications, error: classificationError } = await supabase
      .from("forum_post_ai_classifications")
      .select("post_id, classification, confidence, reason, extracted_premise, extracted_evidence, suggested_metrics, created_at")
      .eq("thread_id", threadId)
      .eq("is_active", true)
      .in("post_id", postIds)
      .order("created_at", { ascending: false });

    if (classificationError) {
      return NextResponse.json({ ok: false, error: classificationError.message }, { status: 500 });
    }

    for (const row of (classifications ?? []) as ClassificationRow[]) {
      const postId = row.post_id ?? "";
      if (postId && !classificationMap.has(postId)) classificationMap.set(postId, row);
    }
  }

  const postMaterials = posts.map((post) => {
    const classification = classificationMap.get(post.id);
    return {
      post_role: post.post_role,
      content: asString(post.content, 1000),
      logic_score: toNullableNumber(post.logic_score),
      ai_classification: classification
        ? {
            classification: classification.classification,
            confidence: toNullableNumber(classification.confidence),
            reason: asString(classification.reason, 600),
            extracted_premise: asString(classification.extracted_premise, 600),
            extracted_evidence: asString(classification.extracted_evidence, 600),
            suggested_metrics: asStringArray(classification.suggested_metrics, 6),
          }
        : null,
    };
  });

  let relatedIds: string[] = [];
  const { data: mapVersion, error: mapError } = await supabase
    .from("forum_discussion_map_versions")
    .select("map_json")
    .eq("is_active", true)
    .order("applied_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (mapError) {
    console.warn("[policy-proposal-preview related map skipped]", mapError.message);
  } else {
    relatedIds = getRelatedThreadIds(mapVersion?.map_json, threadId, maxRelatedThreads);
  }

  const relatedThreads: Record<string, unknown>[] = [];
  if (relatedIds.length > 0) {
    const [{ data: relatedThreadRows }, { data: relatedStructures }] = await Promise.all([
      supabase
        .from("forum_threads")
        .select("id, title, category")
        .in("id", relatedIds)
        .eq("is_deleted", false),
      supabase
        .from("thread_ai_structures")
        .select("thread_id, summary_text, key_points")
        .in("thread_id", relatedIds)
        .eq("summary_type", SUMMARY_TYPE)
        .eq("status", "active"),
    ]);

    const relatedStructureMap = new Map(
      (relatedStructures ?? []).map((row) => [String(row.thread_id), row])
    );
    for (const relatedThread of relatedThreadRows ?? []) {
      const relatedStructure = relatedStructureMap.get(String(relatedThread.id));
      if (!relatedStructure) continue;
      const keyPoints = normalizeKeyPoints(relatedStructure.key_points);
      relatedThreads.push({
        thread_id: relatedThread.id,
        title: relatedThread.title,
        category: relatedThread.category,
        summary_text: asString(relatedStructure.summary_text, 1600),
        tentative_conclusion: keyPoints.current_tentative_conclusion,
        rebuttals: keyPoints.main_rebuttals,
        premises: keyPoints.added_premises,
        evidence: keyPoints.added_evidence,
        verification_metrics: keyPoints.verification_metrics,
        url: `/${tenant}/forum/thread/${relatedThread.id}`,
      });
    }
  }

  const keyPoints = normalizeKeyPoints(structure.key_points);
  const references: ReferenceThread[] = [
    {
      thread_id: String(thread.id),
      title: asString(thread.title, 240) || "元スレッド",
      url: `/${tenant}/forum/thread/${thread.id}`,
    },
    ...relatedThreads.map((item) => ({
      thread_id: String(item.thread_id),
      title: asString(item.title, 240) || "関連スレッド",
      url: String(item.url),
    })),
  ];
  const prompt = buildPrompt({
    mainThread: {
      thread_id: thread.id,
      title: thread.title,
      category: thread.category,
      original_post: asString(thread.original_post, 1800),
      summary_text: asString(structure.summary_text, 3000),
      easy_summary_text: asString(structure.easy_summary_text, 800),
      key_points: keyPoints,
    },
    posts: postMaterials,
    relatedThreads,
    references,
  });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "OPENAI_API_KEY is not set." }, { status: 500 });
  }

  let responseData: unknown = null;
  try {
    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        input: prompt,
        text: {
          format: {
            type: "json_schema",
            name: "policy_proposal_preview",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                title: { type: "string" },
                one_line_proposal: { type: "string" },
                policy_groups: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    fiscal_policy: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        decision: { type: "string", enum: ["spend", "do_not_spend", "conditional", "insufficient"] },
                        decision_label: { type: "string" },
                        summary: { type: "string" },
                        proposal_items: { type: "array", maxItems: 5, items: { type: "string" } },
                        merits: { type: "array", maxItems: 5, items: { type: "string" } },
                        demerits: { type: "array", maxItems: 5, items: { type: "string" } },
                        countermeasures: { type: "array", maxItems: 5, items: { type: "string" } },
                      },
                      required: ["decision", "decision_label", "summary", "proposal_items", "merits", "demerits", "countermeasures"],
                    },
                    monetary_policy: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        decision: { type: "string", enum: ["ease", "tighten", "hold", "conditional", "insufficient"] },
                        decision_label: { type: "string" },
                        summary: { type: "string" },
                        proposal_items: { type: "array", maxItems: 5, items: { type: "string" } },
                        merits: { type: "array", maxItems: 5, items: { type: "string" } },
                        demerits: { type: "array", maxItems: 5, items: { type: "string" } },
                        countermeasures: { type: "array", maxItems: 5, items: { type: "string" } },
                      },
                      required: ["decision", "decision_label", "summary", "proposal_items", "merits", "demerits", "countermeasures"],
                    },
                    other_policy: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        decision: { type: "string", enum: ["do", "do_not_do", "conditional", "insufficient"] },
                        decision_label: { type: "string" },
                        summary: { type: "string" },
                        proposal_items: { type: "array", maxItems: 5, items: { type: "string" } },
                        merits: { type: "array", maxItems: 5, items: { type: "string" } },
                        demerits: { type: "array", maxItems: 5, items: { type: "string" } },
                        countermeasures: { type: "array", maxItems: 5, items: { type: "string" } },
                      },
                      required: ["decision", "decision_label", "summary", "proposal_items", "merits", "demerits", "countermeasures"],
                    },
                  },
                  required: ["fiscal_policy", "monetary_policy", "other_policy"],
                },
                opposing_views: { type: "array", maxItems: 5, items: { type: "string" } },
                priority_judgment: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    decision: { type: "string", enum: ["prioritize", "conditional", "do_not_prioritize", "insufficient"] },
                    priority_area: { type: "string", enum: ["fiscal", "monetary", "other", "combined", "hold", "insufficient"] },
                    label: { type: "string" },
                    reasons: { type: "array", maxItems: 5, items: { type: "string" } },
                  },
                  required: ["decision", "priority_area", "label", "reasons"],
                },
                verification_metrics: { type: "array", maxItems: 6, items: { type: "string" } },
                review_conditions: { type: "array", maxItems: 5, items: { type: "string" } },
                economic_phase: { type: "string" },
                demand_balance: { type: "string" },
                inflation_causes: { type: "array", maxItems: 5, items: { type: "string" } },
                monetary_policy_role: { type: "string" },
                fiscal_policy_role: { type: "string" },
                economic_theory_checks: {
                  type: "array",
                  maxItems: 8,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      area: { type: "string" },
                      concepts: {
                        type: "array",
                        maxItems: 5,
                        items: { type: "string", enum: ECONOMIC_THEORY_CONCEPTS },
                      },
                      judgment: { type: "string" },
                      caveat: { type: "string" },
                    },
                    required: ["area", "concepts", "judgment", "caveat"],
                  },
                },
                missing_information: { type: "array", maxItems: 12, items: { type: "string" } },
                reference_threads: {
                  type: "array",
                  maxItems: 5,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      thread_id: { type: "string" },
                      title: { type: "string" },
                      url: { type: "string" },
                    },
                    required: ["thread_id", "title", "url"],
                  },
                },
              },
              required: [
                "title", "one_line_proposal", "policy_groups", "opposing_views", "priority_judgment",
                "verification_metrics", "review_conditions", "economic_phase",
                "demand_balance", "inflation_causes", "monetary_policy_role",
                "fiscal_policy_role", "economic_theory_checks", "missing_information",
                "reference_threads"
              ],
            },
          },
        },
      }),
    });

    responseData = await openAiResponse.json().catch(() => ({}));
    const outputText = extractOutputText(responseData);
    if (!openAiResponse.ok) {
      const apiError = isRecord(responseData) && isRecord(responseData.error)
        ? asString(responseData.error.message, 500)
        : "OpenAI policy proposal preview failed.";
      throw new Error(apiError);
    }

    const preview = normalizePreview(outputText, references);
    await recordForumApiUsageLog({
      featureKey: "policy_proposal_preview",
      routePath: "/api/forum/admin/policy-proposals/preview",
      model: MODEL,
      promptVersion: PROMPT_VERSION,
      targetType: "thread",
      targetId: threadId,
      inputText: prompt,
      outputText,
      usage: isRecord(responseData) ? responseData.usage : null,
      status: "success",
    });

    return NextResponse.json({
      ok: true,
      thread_id: threadId,
      used_post_count: postMaterials.length,
      related_thread_count: relatedThreads.length,
      preview,
    });
  } catch (error) {
    await recordForumApiUsageLog({
      featureKey: "policy_proposal_preview",
      routePath: "/api/forum/admin/policy-proposals/preview",
      model: MODEL,
      promptVersion: PROMPT_VERSION,
      targetType: "thread",
      targetId: threadId,
      inputText: prompt,
      outputText: extractOutputText(responseData),
      usage: isRecord(responseData) ? responseData.usage : null,
      status: "error",
      errorMessage: getErrorMessage(error),
    });
    return NextResponse.json({ ok: false, error: getErrorMessage(error) }, { status: 500 });
  }
}
