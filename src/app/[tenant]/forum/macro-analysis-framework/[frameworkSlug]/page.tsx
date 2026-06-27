import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import {
  findMacroFramework,
  macroFrameworks,
  type MacroFramework,
} from "@/lib/forum/macro-analysis-frameworks";

type PageProps = {
  params: Promise<{
    tenant: string;
    frameworkSlug: string;
  }>;
};

const pageStyle: CSSProperties = {
  maxWidth: 980,
  margin: "0 auto",
  padding: "24px 16px 42px",
  color: "#111827",
};

const sectionStyle: CSSProperties = {
  border: "1px solid #dbe3ef",
  borderRadius: 8,
  background: "#ffffff",
  padding: 16,
  marginBottom: 16,
  minWidth: 0,
};

const noteStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#f8fafc",
  padding: 14,
  color: "#475569",
  lineHeight: 1.8,
  marginBottom: 16,
};

const linkStyle: CSSProperties = {
  color: "#075985",
  fontWeight: 900,
  textDecoration: "none",
};

const textStyle: CSSProperties = {
  margin: "8px 0 0",
  color: "#475569",
  lineHeight: 1.8,
};

const listStyle: CSSProperties = {
  margin: "10px 0 0",
  paddingLeft: 22,
  color: "#334155",
  lineHeight: 1.8,
};

function ListSection({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <section style={sectionStyle}>
      <h2 style={{ margin: 0, fontSize: 22 }}>{title}</h2>
      <ul style={listStyle}>
        {items.map((item) => (
          <li key={`${title}-${item}`}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function MetricChips({ framework }: { framework: MacroFramework }) {
  return (
    <section style={sectionStyle}>
      <h2 style={{ margin: 0, fontSize: 22 }}>確認すべき指標</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        {framework.metrics.map((metric) => (
          <span
            key={`${framework.slug}-${metric}`}
            style={{
              border: "1px solid #bae6fd",
              borderRadius: 999,
              background: "#f0f9ff",
              color: "#0369a1",
              fontSize: 13,
              fontWeight: 800,
              padding: "6px 10px",
            }}
          >
            {metric}
          </span>
        ))}
      </div>
    </section>
  );
}

export default async function MacroFrameworkDetailPage({ params }: PageProps) {
  const { tenant, frameworkSlug } = await params;
  const framework = findMacroFramework(frameworkSlug);

  if (!framework) {
    notFound();
  }

  const relatedFrameworks = macroFrameworks.filter((item) => item.slug !== framework.slug);

  return (
    <main style={pageStyle}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <Link href={`/${tenant}/forum`} style={{ color: "#334155", fontWeight: 700 }}>
          ← Forumトップへ戻る
        </Link>
        <Link href={`/${tenant}/forum/macro-analysis-framework`} style={linkStyle}>
          分析フレーム一覧へ戻る
        </Link>
      </div>

      <header style={{ marginBottom: 18 }}>
        <p style={{ margin: 0, color: "#64748b", fontSize: 13, fontWeight: 900 }}>
          AIで学ぶマクロ経済分析
        </p>
        <h1 style={{ margin: "6px 0 0", fontSize: 30, lineHeight: 1.35, letterSpacing: 0 }}>
          {framework.title}
        </h1>
        <p style={{ ...textStyle, fontSize: 16 }}>{framework.purpose}</p>
      </header>

      <section style={noteStyle}>
        このページでは、{framework.title}
        を使って日本経済を分析するときに、何を見ればよいかを整理します。
        経済停滞を精神論で片づけず、観察する指標と因果関係に分けて考えるための学習ページです。
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: 0, fontSize: 22 }}>この理論は何を見るものか</h2>
        <p style={textStyle}>{framework.whatItSees}</p>
      </section>

      <ListSection title="基本の考え方" items={framework.basics} />
      <ListSection title="日本経済を見るときの使い方" items={framework.japanUse} />
      <ListSection title="世界標準では何を確認するか" items={framework.globalChecks} />
      <ListSection title="日本で見落とされやすい点" items={framework.overlookedInJapan} />
      <MetricChips framework={framework} />
      <ListSection title="誤用リスク" items={framework.misuseRisks} />
      <ListSection title="AIで日本経済を分析すると何が見えるか" items={framework.aiAnalysis} />

      <section style={{ ...sectionStyle, background: "#f8fafc" }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>ほかの分析フレームも見る</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
            gap: 10,
            marginTop: 12,
          }}
        >
          {relatedFrameworks.map((item) => (
            <Link
              key={item.slug}
              href={`/${tenant}/forum/macro-analysis-framework/${item.slug}`}
              style={{
                border: "1px solid #dbe3ef",
                borderRadius: 8,
                background: "#ffffff",
                color: "#111827",
                textDecoration: "none",
                padding: 12,
                minWidth: 0,
              }}
            >
              <span style={{ display: "block", fontWeight: 900 }}>{item.title}</span>
              <span style={{ display: "block", marginTop: 4, color: "#64748b", lineHeight: 1.6 }}>
                {item.purpose}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
