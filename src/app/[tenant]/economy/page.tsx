import Link from "next/link";
import type { CSSProperties } from "react";
import ForumGuideTree from "@/components/forum/ForumGuideTree";

type PageProps = {
  params: Promise<{
    tenant: string;
  }>;
};

const pageStyle: CSSProperties = {
  maxWidth: 1080,
  margin: "0 auto",
  padding: 24,
  color: "#111827",
};

const heroStyle: CSSProperties = {
  border: "1px solid #2f3747",
  borderRadius: 8,
  padding: 22,
  background: "#141923",
  color: "#f9fafb",
  marginBottom: 18,
};

const leadStyle: CSSProperties = {
  margin: "12px 0 0",
  color: "#d1d5db",
  lineHeight: 1.8,
  fontSize: 16,
};

const ctaGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
  gap: 10,
  marginTop: 18,
};

const primaryLinkStyle: CSSProperties = {
  display: "block",
  borderRadius: 8,
  padding: "12px 14px",
  background: "#2563eb",
  color: "#ffffff",
  textDecoration: "none",
  fontWeight: 900,
  textAlign: "center",
};

const secondaryLinkStyle: CSSProperties = {
  display: "block",
  borderRadius: 8,
  padding: "12px 14px",
  background: "#ffffff",
  color: "#111827",
  border: "1px solid #cbd5e1",
  textDecoration: "none",
  fontWeight: 800,
  textAlign: "center",
};

const topicSectionStyle: CSSProperties = {
  marginBottom: 18,
};

const topicGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
  gap: 12,
};

const topicCardStyle: CSSProperties = {
  border: "1px solid #dbe3ef",
  borderRadius: 8,
  padding: 16,
  background: "#ffffff",
  color: "#111827",
};

const topicLabelStyle: CSSProperties = {
  margin: "12px 0 4px",
  color: "#475569",
  fontSize: 12,
  fontWeight: 900,
};

const topicTextStyle: CSSProperties = {
  margin: 0,
  color: "#334155",
  lineHeight: 1.7,
  fontSize: 14,
};

const detailLinkStyle: CSSProperties = {
  display: "inline-block",
  marginTop: 12,
  color: "#1d4ed8",
  fontWeight: 800,
  textDecoration: "underline",
};

const topicCards = [
  {
    title: "消費税",
    nodeId: "consumption-tax",
    aiView:
      "消費税は安定財源ですが、需要不足局面では消費を抑える可能性があります。",
    discussion:
      "可処分所得を減らし、需要不足を悪化させるという見方があります。",
  },
  {
    title: "需要不足",
    nodeId: "demand-shortage",
    aiView: "需要不足が続くと、投資や賃上げが弱くなる可能性があります。",
    discussion:
      "日本の停滞は供給力不足より需要不足が大きいという見方があります。",
  },
  {
    title: "減税",
    nodeId: "tax-cuts",
    aiView: "減税は可処分所得を増やしますが、対象と期間設計が重要です。",
    discussion: "一時給付より、恒久的な負担軽減を重視する意見があります。",
  },
  {
    title: "財政政策",
    nodeId: "fiscal-policy",
    aiView: "財政政策は需要を支えますが、使い道と規模の設計が重要です。",
    discussion:
      "緊縮よりも、需要不足を補う支出が必要という見方があります。",
  },
  {
    title: "社会保険料",
    nodeId: "tax-social-insurance",
    aiView: "社会保険料は現役世代の可処分所得に大きく影響します。",
    discussion:
      "税金以上に重い負担として、生活実感を圧迫している可能性があります。",
  },
  {
    title: "インフレ",
    nodeId: "inflation",
    aiView: "インフレは需要要因と供給要因を分けて見る必要があります。",
    discussion: "物価高だけを見て、需要不足を見落とす危険があります。",
  },
  {
    title: "財源",
    nodeId: "funding-source",
    aiView:
      "財源論は重要ですが、経済全体への影響も同時に見る必要があります。",
    discussion:
      "財源だけで政策を止めると、需要不足が長引くという懸念があります。",
  },
  {
    title: "アベノミクス",
    nodeId: "abenomics",
    aiView:
      "金融緩和はデフレ脱却に合理的でしたが、財政政策と増税が効果を弱めました。",
    discussion:
      "成功か失敗かではなく、何が正しく、どこでブレーキがかかったかを分解すべきです。",
  },
];

export default async function EconomyPage({ params }: PageProps) {
  const { tenant } = await params;

  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <h1
          style={{
            margin: 0,
            fontSize: 32,
            lineHeight: 1.25,
            letterSpacing: 0,
          }}
        >
          日本経済を良くするには？
        </h1>

        <p style={leadStyle}>
          消費税、需要不足、減税などの論点を選び、AIの整理と人間の議論を見ながら、日本経済を良くするための政策を考える入口です。
        </p>

        <div style={ctaGridStyle}>
          <Link href={`/${tenant}/forum`} style={primaryLinkStyle}>
            議論一覧を見る
          </Link>
          <Link
            href={`/${tenant}/forum?node=consumption-tax`}
            style={secondaryLinkStyle}
          >
            消費税を考える
          </Link>
          <Link
            href={`/${tenant}/forum?node=demand-shortage`}
            style={secondaryLinkStyle}
          >
            需要不足を考える
          </Link>
          <Link href={`/${tenant}/forum?node=tax-cuts`} style={secondaryLinkStyle}>
            減税を考える
          </Link>
        </div>
      </section>

      <section style={topicSectionStyle}>
        <h2 style={{ margin: "0 0 12px", fontSize: 22, letterSpacing: 0 }}>
          主要論点
        </h2>

        <div style={topicGridStyle}>
          {topicCards.map((topic) => (
            <article key={topic.nodeId} style={topicCardStyle}>
              <h3 style={{ margin: 0, fontSize: 18, letterSpacing: 0 }}>
                {topic.title}
              </h3>

              <div style={topicLabelStyle}>AIの見立て</div>
              <p style={topicTextStyle}>{topic.aiView}</p>

              <div style={topicLabelStyle}>議論のまとめ</div>
              <p style={topicTextStyle}>{topic.discussion}</p>

              <Link
                href={`/${tenant}/forum?node=${topic.nodeId}`}
                style={detailLinkStyle}
              >
                詳しく見る
              </Link>
            </article>
          ))}
        </div>
      </section>

      <ForumGuideTree tenant={tenant} />
    </main>
  );
}
