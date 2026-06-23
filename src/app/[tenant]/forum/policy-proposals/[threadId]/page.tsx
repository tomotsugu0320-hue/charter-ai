"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";

type KeyPoints = {
  discussion_position: string[];
  added_premises: string[];
  added_evidence: string[];
  main_agreements: string[];
  main_rebuttals: string[];
  verification_metrics: string[];
  needs_review: string[];
  changes_from_initial_answer: string[];
  current_tentative_conclusion: string[];
};

type Proposal = {
  thread_id: string;
  title: string;
  category: string;
  original_post: string;
  summary_text: string;
  easy_summary_text: string;
  key_points: KeyPoints;
  post_count: number;
  classified_comment_count: number;
};

type PolicyGroup = {
  decision?: string;
  decision_label?: string;
  summary: string;
  proposal_items: string[];
  merits: string[];
  demerits: string[];
  countermeasures: string[];
};

type EconomicTheoryCheck = {
  area: string;
  concepts: string[];
  judgment: string;
  caveat: string;
};

type PolicyProposalPreview = {
  title: string;
  one_line_proposal: string;
  policy_groups?: {
    fiscal_policy: PolicyGroup;
    monetary_policy: PolicyGroup;
    other_policy: PolicyGroup;
  };
  proposal_items: string[];
  merits: string[];
  demerits: string[];
  countermeasures: string[];
  opposing_views: string[];
  priority_judgment: {
    decision: string;
    priority_area?: string;
    label: string;
    reasons: string[];
  };
  verification_metrics: string[];
  review_conditions: string[];
  economic_phase: string;
  demand_balance: string;
  inflation_causes: string[];
  monetary_policy_role: string;
  fiscal_policy_role: string;
  economic_theory_checks?: EconomicTheoryCheck[];
  missing_information: string[];
  reference_threads: Array<{
    thread_id: string;
    title: string;
    url: string;
  }>;
};

type SavedPolicyProposal = {
  id: string;
  status: string;
  created_at: string;
  published_at?: string | null;
  proposal_json: PolicyProposalPreview;
};

const pageStyle: CSSProperties = {
  maxWidth: 900,
  margin: "0 auto",
  padding: 24,
  color: "#111827",
};

function getParam(value: string | string[] | undefined, fallback = "") {
  return Array.isArray(value) ? value[0] ?? fallback : value ?? fallback;
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <section style={{ padding: "18px 0", borderTop: "1px solid #e2e8f0" }}>
      <h2 style={{ margin: 0, fontSize: 20, lineHeight: 1.5 }}>{title}</h2>
      <ul style={{ margin: "10px 0 0", paddingLeft: 22, lineHeight: 1.8 }}>
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function PreviewList({ title, items }: { title: string; items: string[] }) {
  return (
    <section style={{ padding: "14px 0", borderTop: "1px solid #e2e8f0" }}>
      <h3 style={{ margin: 0, fontSize: 18 }}>{title}</h3>
      {items.length > 0 ? (
        <ul style={{ margin: "8px 0 0", paddingLeft: 22, lineHeight: 1.8 }}>
          {items.map((item, index) => (
            <li key={`${title}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p style={{ margin: "8px 0 0", color: "#64748b" }}>判断材料が不足しています。</p>
      )}
    </section>
  );
}

function PolicyGroupPreview({
  title,
  description,
  group,
}: {
  title: string;
  description: string;
  group: PolicyGroup;
}) {
  const hasProposal = Boolean(
    group.summary ||
      group.proposal_items.length ||
      group.merits.length ||
      group.demerits.length ||
      group.countermeasures.length
  );

  return (
    <section
      style={{
        marginTop: 16,
        border: "1px solid #cbd5e1",
        borderRadius: 8,
        padding: 14,
        minWidth: 0,
      }}
    >
      <h3 style={{ margin: 0, fontSize: 20 }}>{title}</h3>
      <p style={{ margin: "6px 0 0", color: "#475569", lineHeight: 1.7 }}>{description}</p>
      {hasProposal ? (
        <>
          {group.summary && (
            <p style={{ margin: "12px 0 0", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
              {group.summary}
            </p>
          )}
          <PreviewList title="実施案" items={group.proposal_items} />
          <PreviewList title="メリット" items={group.merits} />
          <PreviewList title="デメリット" items={group.demerits} />
          <PreviewList title="デメリット対策" items={group.countermeasures} />
        </>
      ) : (
        <p style={{ margin: "12px 0 0", color: "#64748b" }}>この分類の提案は未整理です。</p>
      )}
    </section>
  );
}

const ECONOMIC_THEORY_DESCRIPTIONS: Record<string, string> = {
  有効需要: "需要不足なら、政府支出で売上と雇用を支えやすいかを見る",
  乗数効果: "最初の支出が所得と消費を通じてどこまで広がるかを見る",
  "GDPギャップ": "需要が供給力に対して足りているかを見る",
  需要インフレ: "需要が供給を上回って物価が上がっているかを見る",
  コストプッシュ: "輸入価格や原材料費による物価上昇かを見る",
  供給制約: "供給力不足で、増えた需要が物価上昇に回らないかを見る",
  フィリップス曲線: "雇用の逼迫と賃金・物価上昇の関係を見る",
  労働需給: "働き手と求人のバランスを見る",
  労働分配率: "企業の利益が賃金へどれだけ回っているかを見る",
  "テイラー・ルール": "物価と景気から政策金利の目安を考える",
  実質金利: "名目金利から期待インフレを引いて、実際の引き締め度を見る",
  期待インフレ: "将来の物価予想が消費や賃金に与える影響を見る",
  財政乗数: "政府支出がGDPをどれだけ押し上げるかを見る",
  クラウディングアウト: "政府支出が民間投資を押しのけないかを見る",
  将来増税予想: "将来の増税不安が現在の消費を抑えないかを見る",
};

function PolicyDecisionCard({
  title,
  description,
  group,
  decisionLabels,
}: {
  title: string;
  description: string;
  group: PolicyGroup;
  decisionLabels: Record<string, string>;
}) {
  const decisionLabel =
    group.decision_label ||
    (group.decision ? decisionLabels[group.decision] : "") ||
    "判断材料不足";
  const cautions = [
    ...group.demerits.slice(0, 3).map((item) => `注意: ${item}`),
    ...group.countermeasures.slice(0, 3).map((item) => `対策: ${item}`),
  ];

  return (
    <section
      style={{
        marginTop: 16,
        border: "1px solid #cbd5e1",
        borderRadius: 8,
        padding: 14,
        minWidth: 0,
      }}
    >
      <h3 style={{ margin: 0, fontSize: 20 }}>{title}</h3>
      <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>{description}</p>
      <div style={{ marginTop: 10, fontWeight: 900 }}>判断: {decisionLabel}</div>
      <div style={{ marginTop: 10, color: "#334155", lineHeight: 1.8 }}>
        <strong>理由:</strong> {group.summary || "判断理由は未整理です。"}
      </div>
      <PreviewList title="方法" items={group.proposal_items} />
      <PreviewList title="注意点" items={cautions} />
    </section>
  );
}

function EconomicTheoryChecks({ checks }: { checks: EconomicTheoryCheck[] }) {
  if (checks.length === 0) return null;

  return (
    <section style={{ marginTop: 18, borderTop: "1px solid #e2e8f0", paddingTop: 16 }}>
      <h3 style={{ margin: 0, fontSize: 20 }}>使った経済理論</h3>
      <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
        {checks.map((check, index) => (
          <section
            key={`${check.area}-${index}`}
            style={{ border: "1px solid #dbe3ef", borderRadius: 8, padding: 12 }}
          >
            <h4 style={{ margin: 0, fontSize: 17 }}>{check.area || "判断項目"}</h4>
            {check.concepts.length > 0 && (
              <ul style={{ margin: "8px 0 0", paddingLeft: 20, lineHeight: 1.75 }}>
                {check.concepts.map((concept) => (
                  <li key={`${check.area}-${concept}`}>
                    <strong>{concept}</strong>: {ECONOMIC_THEORY_DESCRIPTIONS[concept] || "政策判断の確認に使う考え方"}
                  </li>
                ))}
              </ul>
            )}
            {check.judgment && (
              <p style={{ margin: "8px 0 0", lineHeight: 1.75 }}>
                <strong>この議論での判断:</strong> {check.judgment}
              </p>
            )}
            {check.caveat && (
              <p style={{ margin: "6px 0 0", color: "#475569", lineHeight: 1.75 }}>
                <strong>注意:</strong> {check.caveat}
              </p>
            )}
          </section>
        ))}
      </div>
    </section>
  );
}

const FISCAL_DECISION_LABELS: Record<string, string> = {
  spend: "支出する",
  do_not_spend: "支出しない",
  conditional: "条件付きで支出する",
  insufficient: "判断材料不足",
};

const MONETARY_DECISION_LABELS: Record<string, string> = {
  ease: "緩和する",
  tighten: "引き締める",
  hold: "据え置く",
  conditional: "条件付き",
  insufficient: "判断材料不足",
};

const OTHER_DECISION_LABELS: Record<string, string> = {
  do: "実施する",
  do_not_do: "実施しない",
  conditional: "条件付き",
  insufficient: "判断材料不足",
};

const PRIORITY_AREA_LABELS: Record<string, string> = {
  fiscal: "財政政策を優先",
  monetary: "金融政策を優先",
  other: "その他の政策を優先",
  combined: "複合政策を優先",
  hold: "現時点では見送り",
  insufficient: "判断材料不足",
};

type PolicyJudgmentItem = {
  key: string;
  title: string;
  items: string[];
  source: string;
  dataType: "direct" | "proxy" | "keyword";
};

const BASIC_POLICY_JUDGMENT_KEYS = new Set([
  "economic-situation",
  "demand-balance",
  "inflation-causes",
  "policy-roles",
]);

const DATA_TYPE_LABELS: Record<PolicyJudgmentItem["dataType"], string> = {
  direct: "直接整理済み",
  proxy: "代理データ",
  keyword: "キーワード検出",
};

function uniqueItems(...groups: string[][]) {
  return Array.from(
    new Set(
      groups
        .flat()
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function findByKeywords(items: string[], keywords: string[], limit = 4) {
  return items
    .filter((item) => keywords.some((keyword) => item.includes(keyword)))
    .slice(0, limit);
}

function buildPolicyJudgmentItems(proposal: Proposal): PolicyJudgmentItem[] {
  const points = proposal.key_points;
  const discussionMaterials = uniqueItems(
    proposal.summary_text ? [proposal.summary_text] : [],
    proposal.easy_summary_text ? [proposal.easy_summary_text] : [],
    points.discussion_position,
    points.added_premises,
    points.added_evidence,
    points.main_agreements,
    points.main_rebuttals,
    points.verification_metrics,
    points.needs_review,
    points.changes_from_initial_answer,
    points.current_tentative_conclusion
  );

  const economicSituation = findByKeywords(discussionMaterials, [
    "景気",
    "局面",
    "好況",
    "不況",
    "景気後退",
    "景気拡大",
    "デフレ",
    "インフレ",
    "スタグフレーション",
  ]);
  const demandBalance = findByKeywords(discussionMaterials, [
    "需要不足",
    "需要超過",
    "需要が弱",
    "需要が強",
    "総需要",
    "需給",
    "過熱",
  ]);
  const inflationCauses = findByKeywords(discussionMaterials, [
    "物価上昇",
    "物価高",
    "インフレ",
    "円安",
    "輸入物価",
    "供給制約",
    "コストプッシュ",
    "需要超過",
  ]);
  const policyRoles = findByKeywords(discussionMaterials, [
    "金融政策",
    "財政政策",
    "日銀",
    "政府",
    "金利",
    "利上げ",
    "利下げ",
    "減税",
    "給付",
    "財政支出",
  ]);
  const countermeasures = findByKeywords(discussionMaterials, [
    "対策",
    "緩和",
    "補完",
    "段階的",
    "対象を限定",
    "時限",
    "給付",
    "セーフティネット",
    "軽減策",
    "代替",
  ]);
  const reviewConditions = uniqueItems(
    points.needs_review,
    findByKeywords(points.added_premises, [
      "条件",
      "場合",
      "局面",
      "確認",
      "見直し",
      "需要不足",
      "需要超過",
    ])
  ).slice(0, 4);

  return [
    { key: "economic-situation", title: "景気局面", items: economicSituation, source: "再総括全体から景気・局面に関する記述を抽出", dataType: "keyword" },
    { key: "demand-balance", title: "需要不足 / 需要超過", items: demandBalance, source: "再総括全体から需要・需給に関する記述を抽出", dataType: "keyword" },
    { key: "inflation-causes", title: "物価上昇の原因", items: inflationCauses, source: "再総括全体から物価・円安・供給制約に関する記述を抽出", dataType: "keyword" },
    { key: "policy-roles", title: "金融政策と財政政策の役割分担", items: policyRoles, source: "再総括全体から日銀・政府・金融・財政に関する記述を抽出", dataType: "keyword" },
    { key: "benefits", title: "賛成材料・メリット候補", items: points.main_agreements.slice(0, 4), source: "主な同意をメリット候補として配置", dataType: "proxy" },
    { key: "drawbacks", title: "反論・リスク候補", items: uniqueItems(points.main_rebuttals, points.needs_review).slice(0, 4), source: "主な反論・要確認事項をリスク候補として配置", dataType: "proxy" },
    { key: "countermeasures", title: "対策候補", items: countermeasures, source: "再総括全体から対策・緩和策に関する記述を抽出", dataType: "keyword" },
    { key: "rebuttals", title: "反論", items: points.main_rebuttals.slice(0, 4), source: "AI再総括の主な反論", dataType: "direct" },
    { key: "metrics", title: "検証指標", items: points.verification_metrics.slice(0, 4), source: "AI再総括の検証すべき指標", dataType: "direct" },
    { key: "tentative-decision", title: "暫定判断候補", items: points.current_tentative_conclusion.slice(0, 4), source: "AI再総括の現時点の暫定結論", dataType: "direct" },
    { key: "review-conditions", title: "見直し条件", items: reviewConditions, source: "要確認事項と条件付き前提を配置", dataType: "proxy" },
  ];
}

export default function PolicyProposalDetailPage() {
  const params = useParams<{
    tenant?: string | string[];
    threadId?: string | string[];
  }>();
  const tenant = getParam(params.tenant, "dev");
  const threadId = getParam(params.threadId);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isForumAdmin, setIsForumAdmin] = useState(false);
  const [isAdminStatusChecked, setIsAdminStatusChecked] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [preview, setPreview] = useState<PolicyProposalPreview | null>(null);
  const [savedProposal, setSavedProposal] = useState<SavedPolicyProposal | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveMessageIsError, setSaveMessageIsError] = useState(false);
  const [saveConfirmed, setSaveConfirmed] = useState(false);

  useEffect(() => {
    if (!threadId) {
      setError("政策提言候補を特定できませんでした。");
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadProposal() {
      try {
        setLoading(true);
        setError("");
        const response = await fetch(
          `/api/forum/policy-proposals/${encodeURIComponent(threadId)}`,
          { cache: "no-store", signal: controller.signal }
        );
        const result = await response.json();

        if (!response.ok || result?.ok !== true) {
          throw new Error(result?.error || "政策提言候補を取得できませんでした。");
        }

        setProposal(result.proposal ?? null);
        setSavedProposal(result.saved_proposal ?? null);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "政策提言候補を取得できませんでした。");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadProposal();
    return () => controller.abort();
  }, [threadId]);

  useEffect(() => {
    let cancelled = false;

    async function loadAdminStatus() {
      try {
        const response = await fetch("/api/forum/admin/session", { cache: "no-store" });
        const result = await response.json().catch(() => null);
        if (!cancelled) {
          setIsForumAdmin(response.ok && result?.is_admin === true);
        }
      } catch {
        if (!cancelled) setIsForumAdmin(false);
      } finally {
        if (!cancelled) setIsAdminStatusChecked(true);
      }
    }

    void loadAdminStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreatePolicyPreview() {
    if (!threadId || previewLoading) return;

    setPreviewLoading(true);
    setPreviewError("");
    setPreview(null);
    setSaveMessage("");
    setSaveMessageIsError(false);
    setSaveConfirmed(false);

    try {
      const response = await fetch("/api/forum/admin/policy-proposals/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thread_id: threadId,
          tenant,
          max_related_threads: 5,
        }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || result?.ok !== true) {
        throw new Error(
          response.status === 401
            ? "管理セッションが切れました。管理トップで再認証してください。"
            : result?.error || "政策提言AIプレビューを作成できませんでした。"
        );
      }

      setPreview(result.preview ?? null);
    } catch (previewLoadError) {
      setPreviewError(
        previewLoadError instanceof Error
          ? previewLoadError.message
          : "政策提言AIプレビューを作成できませんでした。"
      );
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleSavePolicyProposal() {
    if (!threadId || !preview || !saveConfirmed || saveLoading) return;

    setSaveLoading(true);
    setSaveMessage("");
    setSaveMessageIsError(false);

    try {
      const response = await fetch("/api/forum/admin/policy-proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thread_id: threadId,
          tenant,
          confirm_save: true,
          preview,
        }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || result?.ok !== true) {
        throw new Error(
          response.status === 401
            ? "管理セッションが切れました。管理トップで再認証してください。"
            : result?.error || "政策提言候補を保存できませんでした。"
        );
      }

      const saved = result.saved_proposal;
      setSavedProposal({
        id: String(saved?.id ?? ""),
        status: String(saved?.status ?? "published"),
        created_at: String(saved?.created_at ?? new Date().toISOString()),
        published_at: saved?.published_at ? String(saved.published_at) : null,
        proposal_json: preview,
      });
      setPreview(null);
      setSaveConfirmed(false);
      setSaveMessageIsError(false);
      setSaveMessage(
        result.duplicate
          ? "同じ内容はすでに保存済みです。"
          : "政策提言候補を公開済みとして保存しました。"
      );
    } catch (saveError) {
      setSaveMessageIsError(true);
      setSaveMessage(
        saveError instanceof Error ? saveError.message : "政策提言候補を保存できませんでした。"
      );
    } finally {
      setSaveLoading(false);
    }
  }

  const displayedPreview = preview ?? savedProposal?.proposal_json ?? null;
  const isUnsavedPreview = Boolean(preview);
  const hasStructuredPolicyDecisions = Boolean(
    displayedPreview?.policy_groups &&
      [
        displayedPreview.policy_groups.fiscal_policy,
        displayedPreview.policy_groups.monetary_policy,
        displayedPreview.policy_groups.other_policy,
      ].some((group) => group.decision || group.decision_label)
  );

  return (
    <main style={pageStyle}>
      <Link
        href={`/${tenant}/forum/policy-proposals`}
        style={{ color: "#334155", fontWeight: 700 }}
      >
        ← 政策提言候補一覧へ戻る
      </Link>

      {loading && <p style={{ marginTop: 24 }}>政策提言候補を読み込んでいます...</p>}
      {error && <p style={{ marginTop: 24, color: "#b91c1c" }}>{error}</p>}

      {proposal && (() => {
        const policyJudgmentItems = buildPolicyJudgmentItems(proposal);
        const organizedJudgmentCount = policyJudgmentItems.filter(
          (item) => item.items.length > 0
        ).length;
        const basicJudgmentItems = policyJudgmentItems.filter((item) =>
          BASIC_POLICY_JUDGMENT_KEYS.has(item.key)
        );
        const organizedBasicJudgmentCount = basicJudgmentItems.filter(
          (item) => item.items.length > 0
        ).length;
        const hasMissingBasicJudgments =
          organizedBasicJudgmentCount < basicJudgmentItems.length;

        return (
        <article style={{ marginTop: 22 }}>
          <header style={{ borderBottom: "1px solid #cbd5e1", paddingBottom: 18 }}>
            <div style={{ color: "#475569", fontSize: 13, fontWeight: 800 }}>
              {proposal.category} / AI生成の提言候補
            </div>
            <h1 style={{ margin: "8px 0 0", fontSize: 30, lineHeight: 1.45, letterSpacing: 0 }}>
              {proposal.title}
            </h1>
            <p style={{ margin: "12px 0 0", color: "#475569", lineHeight: 1.8 }}>
              AI再総括済みの議論材料を、政策判断に必要な項目へ機械的に並べ替えた確認ページです。確定判断や正式な政策提言ではありません。
            </p>
            <div style={{ marginTop: 10, color: "#64748b", fontSize: 13 }}>
              投稿 {proposal.post_count}件 / AI分類済みコメント {proposal.classified_comment_count}件
            </div>
          </header>

          {isAdminStatusChecked && isForumAdmin && (
            <section
              style={{
                marginTop: 18,
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                background: "#f8fafc",
                padding: 14,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 20 }}>管理者用AIプレビュー</h2>
              <p style={{ margin: "7px 0 12px", color: "#475569", lineHeight: 1.7 }}>
                OpenAI APIを1回使用します。生成後に内容を確認し、公開済み政策提言として保存できます。既存AI再総括は更新しません。
              </p>
              <button
                type="button"
                onClick={() => void handleCreatePolicyPreview()}
                disabled={previewLoading}
                style={{
                  border: "1px solid #0f172a",
                  borderRadius: 8,
                  background: previewLoading ? "#cbd5e1" : "#0f172a",
                  color: "#ffffff",
                  cursor: previewLoading ? "not-allowed" : "pointer",
                  fontWeight: 900,
                  padding: "10px 14px",
                }}
              >
                {previewLoading ? "政策提言AIプレビュー作成中..." : "政策提言AIプレビュー作成"}
              </button>
              {previewError && (
                <p style={{ margin: "10px 0 0", color: "#b91c1c", lineHeight: 1.7 }}>
                  {previewError}
                </p>
              )}
              {saveMessage && (
                <p
                  style={{
                    margin: "10px 0 0",
                    color: saveMessageIsError ? "#b91c1c" : "#166534",
                    lineHeight: 1.7,
                  }}
                >
                  {saveMessage}
                </p>
              )}
            </section>
          )}

          {isAdminStatusChecked && !isForumAdmin && (
            <section
              style={{
                marginTop: 18,
                border: "1px solid #dbe3ef",
                borderRadius: 8,
                background: "#f8fafc",
                padding: 14,
              }}
            >
              <div style={{ color: "#475569", lineHeight: 1.7 }}>
                政策提言AIプレビューは管理者認証後に利用できます。
              </div>
              <Link
                href={`/${tenant}/forum/admin`}
                style={{
                  display: "inline-block",
                  marginTop: 8,
                  color: "#075985",
                  fontWeight: 900,
                }}
              >
                管理トップで認証
              </Link>
            </section>
          )}

          {displayedPreview && (
            <section
              style={{
                marginTop: 20,
                border: "2px solid #60a5fa",
                borderRadius: 8,
                background: "#ffffff",
                padding: 16,
              }}
            >
              <div style={{ color: "#1d4ed8", fontSize: 13, fontWeight: 900 }}>
                {isUnsavedPreview
                  ? "管理者用・未保存プレビュー"
                  : savedProposal?.status === "published"
                    ? "公開済み政策提言"
                    : "保存済み政策提言候補"}
              </div>
              {!isUnsavedPreview && savedProposal && (
                <div style={{ marginTop: 6, color: "#475569", fontSize: 13 }}>
                  status: {savedProposal.status}
                </div>
              )}
              <h2 style={{ margin: "6px 0 0", fontSize: 26, lineHeight: 1.45 }}>
                {displayedPreview.title}
              </h2>
              <p style={{ margin: "10px 0 0", fontSize: 18, fontWeight: 800, lineHeight: 1.7 }}>
                {displayedPreview.one_line_proposal}
              </p>

              <section
                style={{
                  marginTop: 16,
                  border: "1px solid #bfdbfe",
                  borderRadius: 8,
                  background: "#eff6ff",
                  padding: 14,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 20 }}>まず結論</h3>
                <div style={{ marginTop: 8, fontWeight: 900 }}>
                  優先対象：
                  {displayedPreview.priority_judgment.priority_area
                    ? PRIORITY_AREA_LABELS[displayedPreview.priority_judgment.priority_area] ??
                      displayedPreview.priority_judgment.label
                    : displayedPreview.priority_judgment.label}
                </div>
                <div style={{ marginTop: 6, color: "#334155" }}>
                  判断：{displayedPreview.priority_judgment.label}
                </div>
                {displayedPreview.priority_judgment.reasons.length > 0 && (
                  <ul style={{ margin: "8px 0 0", paddingLeft: 22, lineHeight: 1.8 }}>
                    {displayedPreview.priority_judgment.reasons.map((reason, index) => (
                      <li key={`priority-reason-${index}`}>{reason}</li>
                    ))}
                  </ul>
                )}
              </section>

              {hasStructuredPolicyDecisions && displayedPreview.policy_groups ? (
                <>
                  <PolicyDecisionCard
                    title="財政政策"
                    description="政府のお金の出し方"
                    group={displayedPreview.policy_groups.fiscal_policy}
                    decisionLabels={FISCAL_DECISION_LABELS}
                  />
                  <PolicyDecisionCard
                    title="金融政策"
                    description="日銀のお金の流れ"
                    group={displayedPreview.policy_groups.monetary_policy}
                    decisionLabels={MONETARY_DECISION_LABELS}
                  />
                  <PolicyDecisionCard
                    title="その他の政策"
                    description="制度・働き方・価格転嫁"
                    group={displayedPreview.policy_groups.other_policy}
                    decisionLabels={OTHER_DECISION_LABELS}
                  />
                  <EconomicTheoryChecks
                    checks={displayedPreview.economic_theory_checks ?? []}
                  />
                </>
              ) : (
                <>
                  <section style={{ marginTop: 16, padding: 14, background: "#f8fafc" }}>
                    <h3 style={{ margin: 0, fontSize: 18 }}>政策判断の前提</h3>
                    <ul style={{ margin: "8px 0 0", paddingLeft: 22, lineHeight: 1.8 }}>
                      <li>景気局面：{displayedPreview.economic_phase || "判断材料不足"}</li>
                      <li>需要・需給：{displayedPreview.demand_balance || "判断材料不足"}</li>
                      <li>
                        物価上昇の原因：
                        {displayedPreview.inflation_causes.length > 0
                          ? displayedPreview.inflation_causes.join(" / ")
                          : "判断材料不足"}
                      </li>
                      <li>
                        金融政策の役割：
                        {displayedPreview.monetary_policy_role || "判断材料不足"}
                      </li>
                      <li>
                        財政政策の役割：
                        {displayedPreview.fiscal_policy_role || "判断材料不足"}
                      </li>
                    </ul>
                  </section>

                  {displayedPreview.policy_groups ? (
                    <>
                      <PolicyGroupPreview
                        title="財政政策"
                        description="政府がお金の取り方・使い方をどうするか"
                        group={displayedPreview.policy_groups.fiscal_policy}
                      />
                      <PolicyGroupPreview
                        title="金融政策"
                        description="日銀が金利やお金の流れをどうするか"
                        group={displayedPreview.policy_groups.monetary_policy}
                      />
                      <PolicyGroupPreview
                        title="その他の政策"
                        description="制度・規制・産業・労働市場などをどう直すか"
                        group={displayedPreview.policy_groups.other_policy}
                      />
                    </>
                  ) : (
                    <>
                      <PreviewList title="提言内容" items={displayedPreview.proposal_items} />
                      <PreviewList title="メリット" items={displayedPreview.merits} />
                      <PreviewList title="デメリット" items={displayedPreview.demerits} />
                      <PreviewList title="デメリット対策" items={displayedPreview.countermeasures} />
                    </>
                  )}
                </>
              )}

              <PreviewList title="反対意見" items={displayedPreview.opposing_views} />

              <PreviewList title="検証指標" items={displayedPreview.verification_metrics} />
              <PreviewList title="見直し条件" items={displayedPreview.review_conditions} />
              <PreviewList title="不足情報" items={displayedPreview.missing_information} />

              <section style={{ padding: "14px 0 0", borderTop: "1px solid #e2e8f0" }}>
                <h3 style={{ margin: 0, fontSize: 18 }}>参考にした掲示板リンク</h3>
                <ul style={{ margin: "8px 0 0", paddingLeft: 22, lineHeight: 1.8 }}>
                  {displayedPreview.reference_threads.map((reference) => (
                    <li key={reference.thread_id}>
                      <Link href={reference.url} style={{ color: "#075985", fontWeight: 800 }}>
                        {reference.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>

              {isUnsavedPreview && isForumAdmin && (
                <section
                  style={{
                    marginTop: 18,
                    borderTop: "1px solid #cbd5e1",
                    paddingTop: 16,
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      lineHeight: 1.7,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={saveConfirmed}
                      onChange={(event) => setSaveConfirmed(event.target.checked)}
                      disabled={saveLoading}
                      style={{ marginTop: 5 }}
                    />
                    このAIプレビューを公開済み政策提言として保存します
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleSavePolicyProposal()}
                    disabled={!saveConfirmed || saveLoading}
                    style={{
                      marginTop: 10,
                      border: "1px solid #166534",
                      borderRadius: 8,
                      background: !saveConfirmed || saveLoading ? "#cbd5e1" : "#166534",
                      color: "#ffffff",
                      cursor: !saveConfirmed || saveLoading ? "not-allowed" : "pointer",
                      fontWeight: 900,
                      padding: "10px 14px",
                    }}
                  >
                    {saveLoading ? "保存中..." : "この内容で保存"}
                  </button>
                </section>
              )}
            </section>
          )}

          <section style={{ marginTop: 24 }}>
            <h2 style={{ margin: 0, fontSize: 24 }}>掲示板から得られた議論材料</h2>
            <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.8 }}>
              投稿者の問題意識、コメント、AI分類、AI再総括から得られた材料です。政策判断そのものではありません。
            </p>

            {proposal.easy_summary_text && (
              <div
                style={{
                  marginTop: 16,
                  border: "1px solid #bfdbfe",
                  borderRadius: 8,
                  background: "#f8fbff",
                  padding: 16,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 18 }}>AI再総括の概要</h3>
                <p style={{ margin: "8px 0 0", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                  {proposal.easy_summary_text}
                </p>
              </div>
            )}

            <ListSection title="議論後の現在地" items={proposal.key_points.discussion_position} />
            <ListSection title="追加された前提" items={proposal.key_points.added_premises} />
            <ListSection title="追加された根拠" items={proposal.key_points.added_evidence} />
            <ListSection title="主な同意" items={proposal.key_points.main_agreements} />
            <ListSection title="主な反論" items={proposal.key_points.main_rebuttals} />
            <ListSection title="要確認事項" items={proposal.key_points.needs_review} />

            <section style={{ padding: "18px 0", borderTop: "1px solid #e2e8f0" }}>
              <h3 style={{ margin: 0, fontSize: 20 }}>投稿者の問題意識</h3>
              <p style={{ margin: "8px 0 0", color: "#64748b", lineHeight: 1.7 }}>
                新しい投稿ではプライバシー情報をマスクした原文を表示します。古い投稿ではAI整理文を含む場合があります。
              </p>
              <div
                style={{
                  marginTop: 10,
                  border: "1px solid #dbe3ef",
                  borderRadius: 8,
                  background: "#f8fafc",
                  padding: 14,
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.8,
                  overflowWrap: "anywhere",
                }}
              >
                {proposal.original_post || "投稿者の問題意識は取得できませんでした。"}
              </div>
            </section>
          </section>

          <section style={{ marginTop: 30, borderTop: "2px solid #94a3b8", paddingTop: 24 }}>
            <h2 style={{ margin: 0, fontSize: 24 }}>政策提言として必要な判断項目</h2>
            <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.8 }}>
              既存のAI再総括を新規生成せずに並べ替えています。明示的な材料がない項目は未整理として残します。
            </p>
            <div
              style={{
                marginTop: 14,
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                background: "#f8fafc",
                padding: "12px 14px",
                lineHeight: 1.7,
                fontWeight: 800,
              }}
            >
              既存データが見つかった項目：{organizedJudgmentCount} / {policyJudgmentItems.length}項目
              <div style={{ marginTop: 4, color: "#475569", fontWeight: 700 }}>
                基礎判断条件：{basicJudgmentItems.length}項目中
                {organizedBasicJudgmentCount}項目整理済み
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
                gap: 12,
                marginTop: 14,
              }}
            >
              {policyJudgmentItems.map((item) => (
                <section
                  key={item.key}
                  style={{
                    border: "1px solid #dbe3ef",
                    borderRadius: 8,
                    background: "#ffffff",
                    padding: 14,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <h3 style={{ margin: 0, fontSize: 18, lineHeight: 1.5 }}>{item.title}</h3>
                    <span
                      style={{
                        border: "1px solid #cbd5e1",
                        borderRadius: 999,
                        background: item.items.length > 0 ? "#f8fafc" : "#f1f5f9",
                        color: "#475569",
                        fontSize: 12,
                        fontWeight: 800,
                        padding: "3px 8px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.items.length > 0
                        ? DATA_TYPE_LABELS[item.dataType]
                        : "未整理"}
                    </span>
                  </div>
                  {item.items.length > 0 ? (
                    <ul style={{ margin: "8px 0 0", paddingLeft: 20, lineHeight: 1.75 }}>
                      {item.items.map((value, index) => (
                        <li key={`${item.key}-${index}`}>{value}</li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ margin: "8px 0 0", color: "#64748b", lineHeight: 1.7 }}>
                      既存のAI再総括では未整理です。
                    </p>
                  )}
                  <div style={{ marginTop: 10, color: "#64748b", fontSize: 12, lineHeight: 1.6 }}>
                    {item.source}
                  </div>
                  {item.key === "tentative-decision" && hasMissingBasicJudgments && (
                    <div
                      style={{
                        marginTop: 10,
                        border: "1px solid #fde68a",
                        borderRadius: 8,
                        background: "#fffbeb",
                        color: "#78350f",
                        padding: "9px 10px",
                        fontSize: 13,
                        lineHeight: 1.7,
                      }}
                    >
                      景気局面・需給・物価原因・政策の役割分担の確認が不足しています。この暫定判断は、政策提言としてはまだ前提確認中の候補です。
                    </div>
                  )}
                </section>
              ))}
            </div>
          </section>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 8 }}>
            <Link
              href={`/${tenant}/forum/thread/${proposal.thread_id}`}
              style={{ color: "#075985", fontWeight: 900 }}
            >
              元スレッドで議論を見る
            </Link>
            <Link href={`/${tenant}/forum`} style={{ color: "#475569", fontWeight: 700 }}>
              Forumトップへ戻る
            </Link>
          </div>
        </article>
        );
      })()}
    </main>
  );
}
