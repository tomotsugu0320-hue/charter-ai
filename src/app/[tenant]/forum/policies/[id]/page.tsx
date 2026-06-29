"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";

type PolicyArea = "fiscal" | "monetary" | "other" | "combined" | "unclassified";

type PolicyGroup = {
  decision?: string;
  decision_label?: string;
  summary?: string;
  proposal_items?: string[];
  merits?: string[];
  demerits?: string[];
  countermeasures?: string[];
};

type EconomicTheoryCheck = {
  area?: string;
  concepts?: string[];
  judgment?: string;
  caveat?: string;
};

type ReferenceThread = {
  thread_id?: string;
  title?: string;
  url?: string;
};

type PolicyProposalJson = {
  title?: string;
  one_line_proposal?: string;
  policy_groups?: {
    fiscal_policy?: PolicyGroup;
    monetary_policy?: PolicyGroup;
    other_policy?: PolicyGroup;
  };
  proposal_items?: string[];
  merits?: string[];
  demerits?: string[];
  countermeasures?: string[];
  opposing_views?: string[];
  priority_judgment?: {
    decision?: string;
    priority_area?: string;
    label?: string;
    reasons?: string[];
  };
  verification_metrics?: string[];
  review_conditions?: string[];
  economic_theory_checks?: EconomicTheoryCheck[];
  missing_information?: string[];
  reference_threads?: ReferenceThread[];
};

type PublicPolicy = {
  id: string;
  thread_id: string;
  title: string;
  one_line_proposal: string;
  policy_area: PolicyArea;
  priority_area: string | null;
  priority_decision: string | null;
  status: string;
  published_at: string | null;
  created_at: string;
  proposal_json: PolicyProposalJson;
};

const pageStyle: CSSProperties = {
  maxWidth: 940,
  margin: "0 auto",
  padding: 24,
  color: "#111827",
};

const sectionStyle: CSSProperties = {
  border: "1px solid #dbe3ef",
  borderRadius: 8,
  background: "#ffffff",
  padding: 16,
};

const POLICY_AREA_LABELS: Record<PolicyArea, string> = {
  fiscal: "財政政策",
  monetary: "金融政策",
  other: "その他の政策",
  combined: "複合政策",
  unclassified: "未分類",
};

const FISCAL_DECISION_LABELS: Record<string, string> = {
  spend: "財政支出する",
  do_not_spend: "財政支出しない",
  conditional: "条件付きで財政支出する",
  insufficient: "判断材料不足",
};

const MONETARY_DECISION_LABELS: Record<string, string> = {
  ease: "金融緩和する",
  tighten: "金利引き上げ",
  hold: "金利維持",
  conditional: "条件付き",
  insufficient: "判断材料不足",
};

const OTHER_DECISION_LABELS: Record<string, string> = {
  do: "実施する",
  do_not_do: "実施しない",
  conditional: "条件付きで実施する",
  insufficient: "判断材料不足",
};

const ECONOMIC_THEORY_DESCRIPTIONS: Record<string, string> = {
  有効需要: "需要不足なら、政府支出で売上と雇用を支えやすいかを見る考え方です。",
  乗数効果: "最初の支出が所得や消費を通じてどれだけ広がるかを見る考え方です。",
  "GDPギャップ": "需要が供給力に対して足りているか、足りていないかを見る指標です。",
  需要インフレ: "需要が供給を上回って物価が上がる状態です。",
  コストプッシュ: "輸入価格や原材料費など、費用増で物価が上がる状態です。",
  供給制約: "供給力が足りず、需要増が物価上昇に回りやすい状態です。",
  フィリップス曲線: "雇用の逼迫と賃金・物価上昇の関係を見る考え方です。",
  労働需給: "働き手と求人のバランスを見る考え方です。",
  労働分配率: "企業の利益が賃金へどれだけ回っているかを見る指標です。",
  "テイラー・ルール": "物価と景気から政策金利の目安を考える考え方です。",
  実質金利: "名目金利から期待インフレを引いて、実際の引き締め度を見る指標です。",
  期待インフレ: "将来の物価見通しが消費や賃金に与える影響を見る考え方です。",
  財政乗数: "政府支出がGDPをどれだけ押し上げるかを見る考え方です。",
  クラウディングアウト: "政府支出が民間投資を押しのけないかを見る考え方です。",
  将来増税予想: "将来の増税不安が現在の消費を抑えないかを見る考え方です。",
};

function getParam(value: string | string[] | undefined, fallback = "") {
  return Array.isArray(value) ? value[0] ?? fallback : value ?? fallback;
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function formatDate(value: string | null) {
  if (!value) return "未記載";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未記載";
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatProposalStatus(status?: string | null) {
  if (status === "published") return "公開済み";
  if (status === "draft") return "下書き";
  if (status === "review") return "確認中";
  return "未確認";
}

function getDecisionLabel(group: PolicyGroup | undefined, labels: Record<string, string>) {
  if (group?.decision_label) return group.decision_label;
  if (group?.decision && labels[group.decision]) return labels[group.decision];
  return null;
}

function ListSection({
  title,
  description,
  items,
}: {
  title: string;
  description?: string;
  items: string[];
}) {
  const visibleItems = items.filter(Boolean);

  return (
    <section style={{ marginTop: 18, ...sectionStyle }}>
      <h2 style={{ margin: 0, fontSize: 22 }}>{title}</h2>
      {description && (
        <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.7 }}>
          {description}
        </p>
      )}
      {visibleItems.length > 0 ? (
        <ul style={{ margin: "10px 0 0", paddingLeft: 22, lineHeight: 1.8 }}>
          {visibleItems.map((item, index) => (
            <li key={`${title}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p style={{ margin: "10px 0 0", color: "#64748b" }}>未記載</p>
      )}
    </section>
  );
}

function InlineListBlock({ title, items }: { title: string; items: string[] }) {
  const visibleItems = items.filter(Boolean);

  if (visibleItems.length === 0) {
    return (
      <section style={{ marginTop: 14 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
        <p style={{ margin: "6px 0 0", color: "#64748b" }}>未記載</p>
      </section>
    );
  }

  return (
    <section style={{ marginTop: 14 }}>
      <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
      <ul style={{ margin: "6px 0 0", paddingLeft: 22, lineHeight: 1.8 }}>
        {visibleItems.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function PolicyGroupSection({
  title,
  description,
  group,
  labels,
}: {
  title: string;
  description: string;
  group?: PolicyGroup;
  labels: Record<string, string>;
}) {
  const proposalItems = asStringArray(group?.proposal_items);
  const demerits = asStringArray(group?.demerits);
  const countermeasures = asStringArray(group?.countermeasures);
  const decisionLabel = getDecisionLabel(group, labels);

  return (
    <section style={{ marginTop: 18, ...sectionStyle }}>
      <h2 style={{ margin: 0, fontSize: 22 }}>{title}</h2>
      <p style={{ margin: "6px 0 0", color: "#475569", lineHeight: 1.7 }}>{description}</p>
      {decisionLabel && (
        <div style={{ marginTop: 12, fontWeight: 900 }}>
          判断：{decisionLabel}
        </div>
      )}
      <section style={{ marginTop: 14 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>理由</h3>
        <p style={{ margin: "6px 0 0", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
        {group?.summary || "未記載"}
        </p>
      </section>
      <InlineListBlock title="方法" items={proposalItems} />
      <InlineListBlock title="注意点" items={demerits} />
      <InlineListBlock title="対策" items={countermeasures} />
    </section>
  );
}

function EconomicTheorySection({ checks }: { checks: EconomicTheoryCheck[] }) {
  const visibleChecks = checks.filter(
    (check) => check.area || check.judgment || asStringArray(check.concepts).length > 0
  );

  return (
    <section style={{ marginTop: 18, ...sectionStyle }}>
      <h2 style={{ margin: 0, fontSize: 22 }}>使った経済理論</h2>
      {visibleChecks.length > 0 ? (
        <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
          {visibleChecks.map((check, index) => (
            <section key={`${check.area ?? "theory"}-${index}`} style={{ borderTop: "1px solid #e2e8f0", paddingTop: 10 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>{check.area || "判断項目"}</h3>
              {asStringArray(check.concepts).length > 0 && (
                <ul style={{ margin: "8px 0 0", paddingLeft: 22, lineHeight: 1.8 }}>
                  {asStringArray(check.concepts).map((concept) => (
                    <li key={`${check.area}-${concept}`}>
                      <strong>{concept}</strong>：
                      {ECONOMIC_THEORY_DESCRIPTIONS[concept] ?? "政策判断の確認に使う考え方です。"}
                    </li>
                  ))}
                </ul>
              )}
              {check.judgment && (
                <p style={{ margin: "8px 0 0", lineHeight: 1.8 }}>{check.judgment}</p>
              )}
              {check.caveat && (
                <p style={{ margin: "6px 0 0", color: "#475569", lineHeight: 1.8 }}>
                  注意：{check.caveat}
                </p>
              )}
            </section>
          ))}
        </div>
      ) : (
        <p style={{ margin: "10px 0 0", color: "#64748b" }}>未記載</p>
      )}
    </section>
  );
}

export default function PolicyDetailPage() {
  const params = useParams<{
    tenant?: string | string[];
    id?: string | string[];
  }>();
  const tenant = getParam(params.tenant, "dev");
  const id = getParam(params.id);
  const [policy, setPolicy] = useState<PublicPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) {
      setError("政策提言を特定できませんでした。");
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadPolicy() {
      try {
        setLoading(true);
        setError("");
        const response = await fetch(
          `/api/forum/policies/${encodeURIComponent(id)}?tenant=${encodeURIComponent(tenant)}`,
          { cache: "no-store", signal: controller.signal }
        );
        const result = await response.json().catch(() => null);

        if (!response.ok || result?.ok !== true) {
          throw new Error(result?.error || "公開済み政策提言を取得できませんでした。");
        }

        setPolicy(result.policy ?? null);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "公開済み政策提言を取得できませんでした。");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadPolicy();
    return () => controller.abort();
  }, [id, tenant]);

  const proposal = policy?.proposal_json ?? {};
  const hasPolicyGroups = Boolean(proposal.policy_groups);
  const priorityReasons = asStringArray(proposal.priority_judgment?.reasons);
  const referenceThreads = Array.isArray(proposal.reference_threads)
    ? proposal.reference_threads
    : [];

  return (
    <main style={pageStyle}>
      <Link href={`/${tenant}/forum/policies`} style={{ color: "#334155", fontWeight: 700 }}>
        ← 公開済み政策提言一覧へ戻る
      </Link>

      {loading && <p style={{ marginTop: 24 }}>公開済み政策提言を読み込んでいます...</p>}
      {error && <p style={{ marginTop: 24, color: "#b91c1c" }}>{error}</p>}

      {policy && (
        <article style={{ marginTop: 22 }}>
          <header
            style={{
              border: "1px solid #dbe3ef",
              borderRadius: 10,
              background: "#ffffff",
              padding: 16,
            }}
          >
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
            <h1 style={{ margin: "10px 0 0", color: "#0f172a", fontSize: 30, lineHeight: 1.45, letterSpacing: 0 }}>
              {proposal.title || policy.title}
            </h1>
            <p style={{ margin: "10px 0 0", color: "#334155", fontSize: 18, fontWeight: 800, lineHeight: 1.7 }}>
              {proposal.one_line_proposal || policy.one_line_proposal || "未記載"}
            </p>
            <div style={{ marginTop: 10, color: "#475569", fontSize: 13 }}>
              公開日: {formatDate(policy.published_at)}
            </div>
            <div style={{ marginTop: 10, fontSize: 18, fontWeight: 900 }}>
              判断：{proposal.priority_judgment?.label || "未記載"}
            </div>
            <p
              style={{
                margin: "12px 0 0",
                border: "1px solid #bfdbfe",
                borderRadius: 8,
                background: "#eff6ff",
                color: "#1e3a8a",
                padding: "8px 10px",
                fontSize: 14,
                fontWeight: 800,
                lineHeight: 1.7,
              }}
            >
              この政策提言は、Forum投稿とAI再総括をもとに生成された暫定整理です。管理人の最終回答ではなく、根拠・反対意見・確認指標を検証するためのたたき台です。
            </p>
          </header>

          <section style={{ marginTop: 18, ...sectionStyle }}>
            <h2 style={{ margin: 0, fontSize: 22 }}>まず結論</h2>
            <div style={{ marginTop: 10, fontWeight: 900 }}>
              判断：{proposal.priority_judgment?.label || "未記載"}
            </div>
            {priorityReasons.length > 0 ? (
              <ul style={{ margin: "10px 0 0", paddingLeft: 22, lineHeight: 1.8 }}>
                {priorityReasons.map((reason, index) => (
                  <li key={`priority-${index}`}>{reason}</li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: "10px 0 0", color: "#64748b" }}>未記載</p>
            )}
          </section>

          <PolicyGroupSection
            title="財政政策"
            description="政府のお金の出し方"
            group={proposal.policy_groups?.fiscal_policy}
            labels={FISCAL_DECISION_LABELS}
          />
          <PolicyGroupSection
            title="金融政策"
            description="日銀のお金の流れ"
            group={proposal.policy_groups?.monetary_policy}
            labels={MONETARY_DECISION_LABELS}
          />
          <PolicyGroupSection
            title="その他政策"
            description="制度・働き方・価格転嫁"
            group={proposal.policy_groups?.other_policy}
            labels={OTHER_DECISION_LABELS}
          />

          {!hasPolicyGroups && (
            <section style={{ marginTop: 18, ...sectionStyle }}>
              <h2 style={{ margin: 0, fontSize: 22 }}>政策提言（旧形式）</h2>
              <ListSection title="提言内容" items={asStringArray(proposal.proposal_items)} />
              <ListSection title="メリット" items={asStringArray(proposal.merits)} />
              <ListSection title="デメリット" items={asStringArray(proposal.demerits)} />
              <ListSection title="デメリット対策" items={asStringArray(proposal.countermeasures)} />
            </section>
          )}

          <EconomicTheorySection checks={proposal.economic_theory_checks ?? []} />
          <ListSection title="反対意見" items={asStringArray(proposal.opposing_views)} />
          <ListSection
            title="あとで確認する指標"
            description="この提言が妥当だったかを後から確認するために見る指標です。"
            items={asStringArray(proposal.verification_metrics)}
          />
          <ListSection
            title="判断を見直す条件"
            description="以下の条件が変わった場合、この政策判断は再検討が必要です。"
            items={asStringArray(proposal.review_conditions)}
          />
          <ListSection title="不足情報" items={asStringArray(proposal.missing_information)} />

          <section style={{ marginTop: 18, ...sectionStyle }}>
            <h2 style={{ margin: 0, fontSize: 22 }}>参考スレッド</h2>
            <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.7 }}>
              この政策提言の作成時に参照した掲示板スレッドです。元の議論を確認しながら、提言内容を検証できます。
            </p>
            {referenceThreads.length > 0 ? (
              <ul style={{ margin: "10px 0 0", paddingLeft: 22, lineHeight: 1.8 }}>
                {referenceThreads.map((reference, index) => {
                  const href =
                    reference.url ||
                    (reference.thread_id ? `/${tenant}/forum/thread/${reference.thread_id}` : "");
                  return (
                    <li key={`${reference.thread_id ?? "reference"}-${index}`}>
                      {href ? (
                        <Link href={href} style={{ color: "#075985", fontWeight: 800 }}>
                          {reference.title || "掲示板スレッド"}
                        </Link>
                      ) : (
                        reference.title || "未記載"
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p style={{ margin: "10px 0 0", color: "#64748b" }}>未記載</p>
            )}
          </section>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 22 }}>
            <Link href={`/${tenant}/forum/thread/${policy.thread_id}`} style={{ color: "#075985", fontWeight: 900 }}>
              元スレッドを見る
            </Link>
            <Link href={`/${tenant}/forum/policy-proposals/${policy.thread_id}`} style={{ color: "#475569", fontWeight: 800 }}>
              政策提言候補ページを見る
            </Link>
          </div>
        </article>
      )}
    </main>
  );
}
