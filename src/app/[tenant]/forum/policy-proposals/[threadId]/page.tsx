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
