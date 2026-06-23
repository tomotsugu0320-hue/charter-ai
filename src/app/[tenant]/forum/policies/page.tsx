"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";

type PolicyArea = "fiscal" | "monetary" | "other" | "combined" | "unclassified";

type PolicyProposalJson = {
  one_line_proposal?: string;
  proposal_items?: string[];
  priority_judgment?: {
    label?: string;
    reasons?: string[];
  };
};

type PublicPolicy = {
  id: string;
  thread_id: string;
  title: string;
  one_line_proposal: string;
  policy_area: PolicyArea;
  status: string;
  published_at: string | null;
  created_at: string;
  proposal_json: PolicyProposalJson;
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

const POLICY_AREA_LABELS: Record<PolicyArea, string> = {
  fiscal: "財政政策",
  monetary: "金融政策",
  other: "その他の政策",
  combined: "複合政策",
  unclassified: "未分類",
};

const POLICY_AREA_SECTIONS: Array<{
  key: PolicyArea;
  title: string;
}> = [
  { key: "fiscal", title: "財政政策" },
  { key: "monetary", title: "金融政策" },
  { key: "other", title: "その他の政策" },
  { key: "combined", title: "複合政策" },
  { key: "unclassified", title: "その他" },
];

function getParam(value: string | string[] | undefined, fallback = "") {
  return Array.isArray(value) ? value[0] ?? fallback : value ?? fallback;
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function compactText(value: string, max = 150) {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function formatDate(value: string | null) {
  if (!value) return "未記載";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未記載";
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatProposalStatus(status?: string | null) {
  if (status === "published") return "公開済み";
  if (status === "draft") return "下書き";
  if (status === "review") return "確認中";
  return "未確認";
}

function buildPolicyPoints(policy: PublicPolicy) {
  const points = [
    policy.one_line_proposal || policy.proposal_json.one_line_proposal || "",
    ...asStringArray(policy.proposal_json.priority_judgment?.reasons),
    ...asStringArray(policy.proposal_json.proposal_items),
  ];
  const seen = new Set<string>();

  return points
    .map((item) => compactText(item))
    .filter((item) => {
      if (!item || seen.has(item)) return false;
      seen.add(item);
      return true;
    })
    .slice(0, 3);
}

function PolicyCard({ policy, tenant }: { policy: PublicPolicy; tenant: string }) {
  const points = buildPolicyPoints(policy);
  const decisionLabel = policy.proposal_json.priority_judgment?.label?.trim() || "未記載";

  return (
    <article style={cardStyle}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <span
          style={{
            display: "inline-block",
            padding: "3px 8px",
            borderRadius: 999,
            background: "#e0f2fe",
            color: "#334155",
            fontSize: 12,
            fontWeight: 900,
          }}
        >
          {POLICY_AREA_LABELS[policy.policy_area] ?? "未分類"}
        </span>
        <span
          style={{
            display: "inline-block",
            padding: "3px 8px",
            borderRadius: 999,
            background: "#dcfce7",
            color: "#166534",
            fontSize: 12,
            fontWeight: 900,
          }}
        >
          {formatProposalStatus(policy.status)}
        </span>
      </div>

      <h2 style={{ margin: "10px 0 0", fontSize: 21, lineHeight: 1.5 }}>{policy.title}</h2>
      <div style={{ marginTop: 7, color: "#64748b", fontSize: 13 }}>
        公開日: {formatDate(policy.published_at)}
      </div>
      <div style={{ marginTop: 8, fontWeight: 900, color: "#334155" }}>
        判断：{decisionLabel}
      </div>

      <section style={{ marginTop: 12, borderTop: "1px solid #e2e8f0", paddingTop: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: "#334155" }}>要点</div>
        {points.length > 0 ? (
          <ul style={{ margin: "6px 0 0", paddingLeft: 20, lineHeight: 1.7 }}>
            {points.map((point, index) => (
              <li key={`${policy.id}-point-${index}`}>{point}</li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: "6px 0 0", color: "#64748b" }}>未記載</p>
        )}
      </section>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 16 }}>
        <Link href={`/${tenant}/forum/policies/${policy.id}`} style={{ color: "#075985", fontWeight: 900 }}>
          根拠と検証を見る
        </Link>
        <Link href={`/${tenant}/forum/thread/${policy.thread_id}`} style={{ color: "#475569", fontWeight: 700 }}>
          元スレッド
        </Link>
      </div>
    </article>
  );
}

export default function PoliciesPage() {
  const params = useParams<{ tenant?: string | string[] }>();
  const tenant = getParam(params.tenant, "dev");
  const [policies, setPolicies] = useState<PublicPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadPolicies() {
      try {
        setLoading(true);
        setError("");
        const response = await fetch(
          `/api/forum/policies?tenant=${encodeURIComponent(tenant)}`,
          { cache: "no-store", signal: controller.signal }
        );
        const result = await response.json().catch(() => null);

        if (!response.ok || result?.ok !== true) {
          throw new Error(result?.error || "公開済み政策提言を取得できませんでした。");
        }

        setPolicies(Array.isArray(result.policies) ? result.policies : []);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "公開済み政策提言を取得できませんでした。");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadPolicies();
    return () => controller.abort();
  }, [tenant]);

  return (
    <main style={pageStyle}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <Link href={`/${tenant}/forum`} style={{ color: "#334155", fontWeight: 700 }}>
          ← Forumトップへ戻る
        </Link>
        <Link href={`/${tenant}/forum/policy-proposals`} style={{ color: "#075985", fontWeight: 900 }}>
          政策提言候補へ戻る
        </Link>
      </div>

      <header style={{ margin: "22px 0 18px" }}>
        <h1 style={{ margin: 0, fontSize: 30, letterSpacing: 0 }}>公開済み政策提言</h1>
        <p style={{ margin: "10px 0 0", color: "#475569", lineHeight: 1.8 }}>
          AI再総括をもとに生成・保存された公開済み政策提言です。AIの判断は最終結論ではなく、議論と検証のためのたたき台です。詳細ページで根拠・反対意見・確認指標を確認できます。
        </p>
      </header>

      {loading && <p>公開済み政策提言を読み込んでいます...</p>}
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
      {!loading && !error && policies.length === 0 && (
        <div style={cardStyle}>現在、公開済み政策提言はありません。</div>
      )}

      {!loading && !error && policies.length > 0 && (
        <div style={{ display: "grid", gap: 30 }}>
          {POLICY_AREA_SECTIONS.map((section) => {
            const sectionPolicies = policies.filter((policy) =>
              section.key === "unclassified"
                ? policy.policy_area === "unclassified" ||
                  !POLICY_AREA_SECTIONS.some((item) => item.key === policy.policy_area)
                : policy.policy_area === section.key
            );

            if (sectionPolicies.length === 0) return null;

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
                    {sectionPolicies.length}件
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
                    gap: 14,
                    marginTop: 14,
                  }}
                >
                  {sectionPolicies.map((policy) => (
                    <PolicyCard key={policy.id} policy={policy} tenant={tenant} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
