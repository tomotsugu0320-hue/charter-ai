"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, type CSSProperties } from "react";

type PolicyArea = "fiscal" | "monetary" | "other" | "combined" | "unclassified";

type Proposal = {
  thread_id: string;
  title: string;
  category: string;
  easy_summary_text: string;
  summary_text: string;
  current_tentative_conclusion: string[];
  verification_metrics: string[];
  card_key_points?: {
    main_points: string[];
    premises: string[];
    cautions: string[];
  };
  policy_theme_tags: string[];
  policy_area: PolicyArea;
  has_saved_proposal: boolean;
  latest_saved_proposal_status: string | null;
  latest_saved_proposal_created_at: string | null;
};

type BulkResult = {
  thread_id: string;
  title: string;
  status: "success" | "failed" | "skipped";
  message: string;
};

type BulkProgress = {
  current: number;
  total: number;
  success: number;
  failed: number;
  skipped: number;
};

const pageStyle: CSSProperties = {
  maxWidth: 1040,
  margin: "0 auto",
  padding: 24,
  color: "#111827",
};

const cardStyle: CSSProperties = {
  border: "1px solid #dbe3ef",
  borderRadius: 8,
  background: "#ffffff",
  padding: 16,
  minWidth: 0,
};

const POLICY_AREA_SECTIONS: Array<{
  key: PolicyArea;
  title: string;
  description: string;
}> = [
  {
    key: "fiscal",
    title: "財政政策",
    description:
      "政府のお金の取り方・使い方に関する提言候補です。減税、給付、社会保険料、国債、財政規律などを含みます。",
  },
  {
    key: "monetary",
    title: "金融政策",
    description:
      "日銀の金利やお金の流れに関する提言候補です。利上げ、利下げ、円安、物価、金融緩和などを含みます。",
  },
  {
    key: "other",
    title: "その他の政策",
    description:
      "制度、労働市場、産業、価格転嫁などに関する提言候補です。雇用、賃金、生産性、制度改革などを含みます。",
  },
  {
    key: "combined",
    title: "複合政策",
    description:
      "財政政策・金融政策・制度改革など、複数の政策領域にまたがる提言候補です。",
  },
  {
    key: "unclassified",
    title: "その他候補",
    description: "現時点では政策領域を明確に分類できない候補です。",
  },
];

function getParam(value: string | string[] | undefined, fallback = "") {
  return Array.isArray(value) ? value[0] ?? fallback : value ?? fallback;
}

function compactText(value: string, max = 220) {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function firstSentence(value: string, max = 150) {
  const text = value.replace(/\s+/g, " ").trim();
  const endIndex = text.search(/[。！？!?]/);
  const sentence = endIndex >= 0 ? text.slice(0, endIndex + 1) : text;
  return compactText(sentence, max);
}

function CardBulletSection({
  title,
  items,
  maxItems,
}: {
  title: string;
  items: string[];
  maxItems: number;
}) {
  const visibleItems = items.filter(Boolean).slice(0, maxItems);
  if (visibleItems.length === 0) return null;

  return (
    <section style={{ marginTop: 12, borderTop: "1px solid #e2e8f0", paddingTop: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 900, color: "#334155" }}>{title}</div>
      <ul style={{ margin: "6px 0 0", paddingLeft: 20, lineHeight: 1.7 }}>
        {visibleItems.map((item, index) => (
          <li key={`${title}-${index}`}>{compactText(item, 150)}</li>
        ))}
      </ul>
    </section>
  );
}

function ProposalCard({ proposal, tenant }: { proposal: Proposal; tenant: string }) {
  const cardMainPoints = proposal.card_key_points?.main_points ?? [];
  const fallbackConclusions = proposal.current_tentative_conclusion.slice(0, 3);
  const summaryFallback = firstSentence(proposal.easy_summary_text || proposal.summary_text);
  const mainPoints = cardMainPoints.length > 0
    ? cardMainPoints
    : fallbackConclusions.length > 0
      ? fallbackConclusions
      : summaryFallback
        ? [summaryFallback]
        : [];
  const premises = proposal.card_key_points?.premises ?? [];
  const cautions = proposal.card_key_points?.cautions ?? [];

  return (
    <article style={cardStyle}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {(proposal.policy_theme_tags.length > 0
          ? proposal.policy_theme_tags
          : ["テーマ未分類"]
        ).slice(0, 3).map((tag) => (
          <span
            key={`${proposal.thread_id}-${tag}`}
            style={{
              display: "inline-block",
              padding: "3px 8px",
              borderRadius: 999,
              background: tag === "テーマ未分類" ? "#f1f5f9" : "#e0f2fe",
              color: "#334155",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            {tag}
          </span>
        ))}
        <span
          style={{
            display: "inline-block",
            padding: "3px 8px",
            borderRadius: 999,
            background: proposal.has_saved_proposal ? "#dcfce7" : "#f1f5f9",
            color: proposal.has_saved_proposal ? "#166534" : "#64748b",
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          {proposal.has_saved_proposal
            ? `保存済み / ${proposal.latest_saved_proposal_status ?? "draft"}`
            : "未保存"}
        </span>
      </div>
      <div style={{ marginTop: 7, color: "#64748b", fontSize: 12 }}>
        カテゴリ: {proposal.category}
      </div>
      <h2 style={{ margin: "10px 0 0", fontSize: 20, lineHeight: 1.5 }}>{proposal.title}</h2>
      <CardBulletSection title="要点" items={mainPoints} maxItems={3} />
      <CardBulletSection title="前提" items={premises} maxItems={2} />
      <CardBulletSection title="注意点" items={cautions} maxItems={2} />
      <CardBulletSection title="検証指標" items={proposal.verification_metrics} maxItems={3} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 16 }}>
        <Link
          href={`/${tenant}/forum/policy-proposals/${proposal.thread_id}`}
          style={{ color: "#075985", fontWeight: 900 }}
        >
          提言候補の詳細
        </Link>
        <Link
          href={`/${tenant}/forum/thread/${proposal.thread_id}`}
          style={{ color: "#475569", fontWeight: 700 }}
        >
          元スレッド
        </Link>
      </div>
    </article>
  );
}

export default function PolicyProposalsPage() {
  const params = useParams<{ tenant?: string | string[] }>();
  const tenant = getParam(params.tenant, "dev");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isForumAdmin, setIsForumAdmin] = useState(false);
  const [isAdminStatusChecked, setIsAdminStatusChecked] = useState(false);
  const [bulkConfirmed, setBulkConfirmed] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<BulkProgress | null>(null);
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([]);

  const loadProposals = useCallback(async (signal?: AbortSignal) => {
      try {
        setLoading(true);
        setError("");
        const response = await fetch("/api/forum/policy-proposals", {
          cache: "no-store",
          signal,
        });
        const result = await response.json();

        if (!response.ok || result?.ok !== true) {
          throw new Error(result?.error || "政策提言候補を取得できませんでした。");
        }

        setProposals(Array.isArray(result.proposals) ? result.proposals : []);
      } catch (loadError) {
        if (signal?.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "政策提言候補を取得できませんでした。");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void loadProposals(controller.signal);
    return () => controller.abort();
  }, [loadProposals]);

  useEffect(() => {
    let cancelled = false;

    async function loadAdminStatus() {
      try {
        const response = await fetch("/api/forum/admin/session", { cache: "no-store" });
        const result = await response.json().catch(() => null);
        if (!cancelled) setIsForumAdmin(response.ok && result?.is_admin === true);
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

  const proposalsInDisplayOrder = POLICY_AREA_SECTIONS.flatMap((section) =>
    proposals.filter((proposal) => proposal.policy_area === section.key)
  );
  const bulkCandidates = proposalsInDisplayOrder
    .filter((proposal) => !proposal.has_saved_proposal)
    .slice(0, 5);

  async function handleBulkGenerateAndSave() {
    if (bulkLoading || !bulkConfirmed || bulkCandidates.length === 0) return;

    const targets = [...bulkCandidates];
    const results: BulkResult[] = [];
    let success = 0;
    let failed = 0;
    let skipped = 0;

    setBulkLoading(true);
    setBulkResults([]);
    setBulkProgress({ current: 0, total: targets.length, success, failed, skipped });

    try {
      for (let index = 0; index < targets.length; index += 1) {
        const target = targets[index];
        setBulkProgress({
          current: index + 1,
          total: targets.length,
          success,
          failed,
          skipped,
        });

        try {
          const detailResponse = await fetch(
            `/api/forum/policy-proposals/${encodeURIComponent(target.thread_id)}`,
            { cache: "no-store" }
          );
          const detailResult = await detailResponse.json().catch(() => null);
          if (!detailResponse.ok || detailResult?.ok !== true) {
            throw new Error(detailResult?.error || "候補の最新状態を確認できませんでした。");
          }

          if (detailResult.saved_proposal) {
            skipped += 1;
            results.push({
              thread_id: target.thread_id,
              title: target.title,
              status: "skipped",
              message: "すでに保存済みです。",
            });
          } else {
            const previewResponse = await fetch("/api/forum/admin/policy-proposals/preview", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tenant,
                thread_id: target.thread_id,
                max_related_threads: 5,
              }),
            });
            const previewResult = await previewResponse.json().catch(() => null);
            if (!previewResponse.ok || previewResult?.ok !== true || !previewResult.preview) {
              throw new Error(
                previewResponse.status === 401
                  ? "管理セッションが切れています。"
                  : previewResult?.error || "AIプレビューを生成できませんでした。"
              );
            }

            const saveResponse = await fetch("/api/forum/admin/policy-proposals", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tenant,
                thread_id: target.thread_id,
                confirm_save: true,
                preview: previewResult.preview,
              }),
            });
            const saveResult = await saveResponse.json().catch(() => null);
            if (!saveResponse.ok || saveResult?.ok !== true) {
              throw new Error(
                saveResponse.status === 401
                  ? "管理セッションが切れています。"
                  : saveResult?.error || "draft保存できませんでした。"
              );
            }

            if (saveResult.duplicate) {
              skipped += 1;
              results.push({
                thread_id: target.thread_id,
                title: target.title,
                status: "skipped",
                message: "同じ内容が保存済みです。",
              });
            } else {
              success += 1;
              results.push({
                thread_id: target.thread_id,
                title: target.title,
                status: "success",
                message: "draft保存しました。",
              });
            }
          }
        } catch (itemError) {
          failed += 1;
          results.push({
            thread_id: target.thread_id,
            title: target.title,
            status: "failed",
            message: itemError instanceof Error ? itemError.message : "処理に失敗しました。",
          });
        }

        setBulkResults([...results]);
        setBulkProgress({
          current: index + 1,
          total: targets.length,
          success,
          failed,
          skipped,
        });
      }
    } finally {
      await loadProposals();
      setBulkConfirmed(false);
      setBulkLoading(false);
    }
  }

  return (
    <main style={pageStyle}>
      <Link href={`/${tenant}/forum`} style={{ color: "#334155", fontWeight: 700 }}>
        ← Forumトップへ戻る
      </Link>

      <header style={{ margin: "22px 0 18px" }}>
        <h1 style={{ margin: 0, fontSize: 30, letterSpacing: 0 }}>政策提言候補</h1>
        <p style={{ margin: "10px 0 0", color: "#475569", lineHeight: 1.8 }}>
          AI再総括済みの議論をもとにした提言候補です。正式な政策提言ではありません。
        </p>
      </header>

      {isAdminStatusChecked && isForumAdmin && (
        <section
          style={{
            marginBottom: 24,
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            background: "#f8fafc",
            padding: 16,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 21 }}>管理者用一括生成</h2>
          <p style={{ margin: "7px 0 0", color: "#475569", lineHeight: 1.7 }}>
            未保存候補を最大5件まで順番にAI生成し、draft保存します。
            OpenAI APIは候補数ぶん使用します。既存AI再総括は更新しません。
          </p>

          {!loading && !error && (
            <div style={{ marginTop: 10, fontWeight: 800 }}>
              今回の対象：{bulkCandidates.length}件
            </div>
          )}
          {!loading && !error && bulkCandidates.length === 0 && (
            <p style={{ margin: "8px 0 0", color: "#166534" }}>未保存候補はありません。</p>
          )}

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              marginTop: 12,
              lineHeight: 1.7,
            }}
          >
            <input
              type="checkbox"
              checked={bulkConfirmed}
              onChange={(event) => setBulkConfirmed(event.target.checked)}
              disabled={bulkLoading || loading || bulkCandidates.length === 0}
              style={{ marginTop: 5 }}
            />
            未保存候補を最大5件までAI生成してdraft保存します
          </label>

          <button
            type="button"
            onClick={() => void handleBulkGenerateAndSave()}
            disabled={bulkLoading || !bulkConfirmed || loading || bulkCandidates.length === 0}
            style={{
              marginTop: 10,
              border: "1px solid #0f172a",
              borderRadius: 8,
              background:
                bulkLoading || !bulkConfirmed || loading || bulkCandidates.length === 0
                  ? "#cbd5e1"
                  : "#0f172a",
              color: "#ffffff",
              cursor:
                bulkLoading || !bulkConfirmed || loading || bulkCandidates.length === 0
                  ? "not-allowed"
                  : "pointer",
              fontWeight: 900,
              padding: "10px 14px",
            }}
          >
            {bulkLoading
              ? "AI生成・保存を実行中..."
              : "未保存候補を最大5件AI生成して保存"}
          </button>

          {bulkProgress && (
            <div
              style={{
                marginTop: 14,
                borderTop: "1px solid #dbe3ef",
                paddingTop: 12,
                lineHeight: 1.8,
              }}
            >
              <div style={{ fontWeight: 900 }}>
                {bulkLoading ? "実行中" : "実行結果"}：{bulkProgress.current} / {bulkProgress.total}件
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 14, color: "#334155" }}>
                <span>成功：{bulkProgress.success}件</span>
                <span>失敗：{bulkProgress.failed}件</span>
                <span>スキップ：{bulkProgress.skipped}件</span>
              </div>
            </div>
          )}

          {bulkResults.length > 0 && (
            <ul style={{ margin: "12px 0 0", paddingLeft: 20, lineHeight: 1.8 }}>
              {bulkResults.map((result) => {
                const statusLabel =
                  result.status === "success"
                    ? "成功"
                    : result.status === "skipped"
                      ? "スキップ"
                      : "失敗";
                return (
                  <li key={result.thread_id}>
                    <span
                      style={{
                        fontWeight: 900,
                        color:
                          result.status === "success"
                            ? "#166534"
                            : result.status === "failed"
                              ? "#b91c1c"
                              : "#475569",
                      }}
                    >
                      {statusLabel}：
                    </span>
                    {result.title}（{result.message}）
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {loading && <p>政策提言候補を読み込んでいます...</p>}
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
      {!loading && !error && proposals.length === 0 && (
        <div style={cardStyle}>現在、表示できる政策提言候補はありません。</div>
      )}

      {!loading && !error && proposals.length > 0 && (
        <div style={{ display: "grid", gap: 30 }}>
          {POLICY_AREA_SECTIONS.map((section) => {
            const sectionProposals = proposals.filter(
              (proposal) => proposal.policy_area === section.key
            );

            return (
              <section key={section.key}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <h2 style={{ margin: 0, fontSize: 24 }}>{section.title}</h2>
                  <span style={{ color: "#475569", fontSize: 14, fontWeight: 800 }}>
                    {sectionProposals.length}件
                  </span>
                </div>
                <p style={{ margin: "7px 0 14px", color: "#475569", lineHeight: 1.75 }}>
                  {section.description}
                </p>
                {sectionProposals.length > 0 ? (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
                      gap: 14,
                    }}
                  >
                    {sectionProposals.map((proposal) => (
                      <ProposalCard
                        key={proposal.thread_id}
                        proposal={proposal}
                        tenant={tenant}
                      />
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      border: "1px dashed #cbd5e1",
                      borderRadius: 8,
                      padding: 14,
                      color: "#64748b",
                    }}
                  >
                    この分類の候補はまだありません。
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
