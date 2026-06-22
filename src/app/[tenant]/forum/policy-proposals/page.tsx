"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";

type Proposal = {
  thread_id: string;
  title: string;
  category: string;
  easy_summary_text: string;
  summary_text: string;
  current_tentative_conclusion: string[];
  verification_metrics: string[];
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

function getParam(value: string | string[] | undefined, fallback = "") {
  return Array.isArray(value) ? value[0] ?? fallback : value ?? fallback;
}

function compactText(value: string, max = 220) {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
          gap: 14,
        }}
      >
        {proposals.map((proposal) => {
          const conclusion = proposal.current_tentative_conclusion[0] || proposal.summary_text;
          return (
            <article key={proposal.thread_id} style={cardStyle}>
              <div
                style={{
                  display: "inline-block",
                  padding: "3px 8px",
                  borderRadius: 999,
                  background: proposal.category === "経済・政策" ? "#e0f2fe" : "#f1f5f9",
                  color: "#334155",
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {proposal.category}
              </div>
              <h2 style={{ margin: "10px 0 0", fontSize: 20, lineHeight: 1.5 }}>
                {proposal.title}
              </h2>
              <p style={{ color: "#475569", lineHeight: 1.75 }}>
                {compactText(proposal.easy_summary_text || proposal.summary_text)}
              </p>
              {conclusion && (
                <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#334155" }}>
                    現時点の結論候補
                  </div>
                  <p style={{ margin: "5px 0 0", lineHeight: 1.7 }}>
                    {compactText(conclusion, 180)}
                  </p>
                </div>
              )}
              {proposal.verification_metrics.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#334155" }}>
                    検証指標
                  </div>
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
        })}
      </div>
    </main>
  );
}
