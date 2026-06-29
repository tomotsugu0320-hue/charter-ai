"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { CSSProperties } from "react";
import {
  aiPromptExamples,
  japanQuestions,
  macroFrameworks,
  studySteps,
} from "@/lib/forum/macro-analysis-frameworks";

const pageStyle: CSSProperties = {
  maxWidth: 1040,
  margin: "0 auto",
  padding: 24,
  color: "#111827",
};

const sectionStyle: CSSProperties = {
  border: "1px solid #dbe3ef",
  borderRadius: 8,
  background: "#ffffff",
  padding: 16,
  minWidth: 0,
};

const noteStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#f8fafc",
  padding: 14,
  color: "#475569",
  lineHeight: 1.8,
};

const linkStyle: CSSProperties = {
  color: "#075985",
  fontWeight: 900,
  textDecoration: "none",
};

function getParam(value: string | string[] | undefined, fallback = "") {
  return Array.isArray(value) ? value[0] ?? fallback : value ?? fallback;
}

export default function MacroAnalysisFrameworkPage() {
  const params = useParams<{ tenant?: string | string[] }>();
  const tenant = getParam(params.tenant, "dev");

  return (
    <main style={pageStyle}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <Link href={`/${tenant}/forum`} style={{ color: "#334155", fontWeight: 700 }}>
          ← Forumトップへ戻る
        </Link>
        <Link href={`/${tenant}/forum/economic-policy-comparison`} style={linkStyle}>
          日本と海外の経済政策比較を見る
        </Link>
      </div>

      <header
        style={{
          margin: "22px 0 18px",
          border: "1px solid #dbe3ef",
          borderRadius: 10,
          background: "#ffffff",
          padding: 16,
        }}
      >
        <p style={{ margin: 0, color: "#334155", fontSize: 13, fontWeight: 900 }}>
          AIで学ぶマクロ経済分析
        </p>
        <h1 style={{ margin: "6px 0 0", color: "#0f172a", fontSize: 30, lineHeight: 1.4, letterSpacing: 0 }}>
          世界標準のマクロ経済分析フレームで見る日本経済
        </h1>
        <p style={{ margin: "10px 0 0", color: "#334155", lineHeight: 1.8 }}>
          AIを使って、経済学・経済理論・経済分析の基本フレームを学びながら、日本経済の論点を整理するページです。
        </p>
        <p
          style={{
            margin: "10px 0 0",
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
          このページは、AIを使って経済理論の見方を学び、日本経済の論点を整理するための入口です。特定の政策を断定するものではありません。
        </p>
      </header>

      <section style={{ ...noteStyle, marginBottom: 18 }}>
        経済停滞を気分や精神論だけで片づけず、需要、供給、物価、雇用、賃金、財政、為替の関係に分解して見ます。
        このページでは、よく使われる分析フレームをAIに質問しながら学べる形で整理します。
      </section>

      <section style={{ ...sectionStyle, marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>このページで学ぶこと</h2>
        <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.8 }}>
          IS-LM、AD-AS、フィリップス曲線、需給ギャップ、テイラー・ルール、財政乗数、
          債務持続可能性分析、国際収支・為替分析などを使い、世界では何を見るのか、
          日本経済にはどう当てはまるのかを確認します。
        </p>
      </section>

      <section style={{ ...sectionStyle, marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>分析フレームの地図</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
            gap: 12,
            marginTop: 14,
          }}
        >
          {macroFrameworks.map((card) => (
            <article
              key={card.slug}
              style={{
                border: "1px solid #dbe3ef",
                borderRadius: 8,
                background: "#f8fafc",
                padding: 14,
                minWidth: 0,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 18, lineHeight: 1.5 }}>{card.title}</h3>
              <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.7 }}>{card.purpose}</p>
              <p style={{ margin: "12px 0 0", color: "#334155", fontSize: 13, fontWeight: 900 }}>
                世界では何を見るか
              </p>
              <ul style={{ margin: "7px 0 0", paddingLeft: 20, color: "#334155", lineHeight: 1.7 }}>
                {card.lookAt.map((item) => (
                  <li key={`${card.slug}-${item}`}>{item}</li>
                ))}
              </ul>
              <p style={{ margin: "12px 0 0", color: "#0f766e", fontSize: 13, fontWeight: 900 }}>
                日本経済に当てはめると
              </p>
              <p style={{ margin: "5px 0 0", color: "#334155", lineHeight: 1.7 }}>
                {card.japanLens}
              </p>
              <Link
                href={`/${tenant}/forum/macro-analysis-framework/${card.slug}`}
                style={{ ...linkStyle, display: "inline-block", marginTop: 12 }}
              >
                この理論を詳しく見る
              </Link>
              <div
                style={{
                  borderTop: "1px solid #dbe3ef",
                  marginTop: 14,
                  paddingTop: 12,
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    border: "1px solid #bae6fd",
                    borderRadius: 999,
                    background: "#eff6ff",
                    color: "#1d4ed8",
                    fontSize: 12,
                    fontWeight: 900,
                    padding: "4px 9px",
                  }}
                >
                  関連議論あり
                </span>
                <p
                  style={{
                    margin: "8px 0 0",
                    color: "#475569",
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  AIの説明に反論・補足できます
                </p>
                <Link
                  href={`/${tenant}/forum/macro-analysis-framework/${card.slug}#related-discussions`}
                  style={{
                    ...linkStyle,
                    display: "inline-block",
                    marginTop: 8,
                    fontSize: 13,
                  }}
                >
                  この理論の議論を見る
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section style={{ ...sectionStyle, marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>日本経済を見るときの問い</h2>
        <ul style={{ margin: "10px 0 0", paddingLeft: 22, lineHeight: 1.8 }}>
          {japanQuestions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>
      </section>

      <section style={{ ...sectionStyle, marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>AIで学ぶ流れ</h2>
        <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
          {studySteps.map((step) => (
            <article
              key={step.title}
              style={{
                border: "1px solid #dbe3ef",
                borderRadius: 8,
                background: "#ffffff",
                padding: 14,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 18, lineHeight: 1.5 }}>{step.title}</h3>
              <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.75 }}>
                {step.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section style={{ ...sectionStyle, marginBottom: 18, background: "#f8fafc" }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>AIへの聞き方の例</h2>
        <ul style={{ margin: "10px 0 0", paddingLeft: 22, lineHeight: 1.8 }}>
          {aiPromptExamples.map((prompt) => (
            <li key={prompt}>{prompt}</li>
          ))}
        </ul>
      </section>

      <section style={{ ...sectionStyle, marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>最後に確認すること</h2>
        <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.8 }}>
          日本経済の停滞を一つの性格論や努力不足で説明するのではなく、需要不足、供給制約、賃金形成、財政余地、
          金融環境、国際収支、為替の経路に分解して見る必要があります。
          そのうえで、あとから確認できる指標を残し、議論を更新していきます。
        </p>
      </section>

      <section style={{ ...sectionStyle, background: "#f8fafc" }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>関連ページ</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
          <Link href={`/${tenant}/forum/economic-policy-comparison`} style={linkStyle}>
            日本と海外の経済政策比較を見る
          </Link>
          <Link href={`/${tenant}/forum/news-check`} style={linkStyle}>
            最新ニュースをAIで読み解く
          </Link>
          <Link href={`/${tenant}/forum/policies`} style={linkStyle}>
            公開済み政策提言を見る
          </Link>
        </div>
      </section>
    </main>
  );
}
