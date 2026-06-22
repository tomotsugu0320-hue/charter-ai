"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";

type PolicyArea = "fiscal" | "monetary" | "other" | "combined" | "unclassified";

type Proposal = {
  thread_id: string;
  title: string;
  category: string;
  easy_summary_text: string;
  summary_text: string;
  current_tentative_conclusion: string[];
  verification_metrics: string[];
  policy_theme_tags: string[];
  policy_area: PolicyArea;
  has_saved_proposal: boolean;
  latest_saved_proposal_status: string | null;
  latest_saved_proposal_created_at: string | null;
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

function ProposalCard({ proposal, tenant }: { proposal: Proposal; tenant: string }) {
  const conclusion = proposal.current_tentative_conclusion[0] || proposal.summary_text;

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
      <p style={{ color: "#475569", lineHeight: 1.75 }}>
        {compactText(proposal.easy_summary_text || proposal.summary_text)}
      </p>
      {conclusion && (
        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: "#334155" }}>
            現時点の結論候補
          </div>
          <p style={{ margin: "5px 0 0", lineHeight: 1.7 }}>{compactText(conclusion, 180)}</p>
        </div>
      )}
      {proposal.verification_metrics.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: "#334155" }}>検証指標</div>
          <ul style={{ margin: "5px 0 0", paddingLeft: 20, lineHeight: 1.7 }}>
            {proposal.verification_metrics.slice(0, 2).map((item, index) => (
              <li key={`${proposal.thread_id}-metric-${index}`}>{compactText(item, 100)}</li>
            ))}
          </ul>
        </div>
      )}
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

  useEffect(() => {
    const controller = new AbortController();

    async function loadProposals() {
      try {
        setLoading(true);
        setError("");
        const response = await fetch("/api/forum/policy-proposals", {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await response.json();

        if (!response.ok || result?.ok !== true) {
          throw new Error(result?.error || "政策提言候補を取得できませんでした。");
        }

        setProposals(Array.isArray(result.proposals) ? result.proposals : []);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "政策提言候補を取得できませんでした。");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadProposals();
    return () => controller.abort();
  }, []);

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
