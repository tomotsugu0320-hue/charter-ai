"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { CSSProperties } from "react";

type CheckPoint = {
  title: string;
  description: string;
};

type NewsExample = {
  title: string;
  checks: string[];
};

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

const checkPoints: CheckPoint[] = [
  {
    title: "景気局面を確認しているか",
    description: "需要不足なのか、需要超過なのかで政策判断は変わります。",
  },
  {
    title: "物価上昇の原因を分けているか",
    description: "需要過熱なのか、輸入コスト上昇なのかを区別する必要があります。",
  },
  {
    title: "賃金と雇用を見ているか",
    description: "名目賃金だけでなく、実質賃金や求人倍率も確認します。",
  },
  {
    title: "政府債務だけを見ていないか",
    description: "政府資産、日銀保有国債、対外純資産なども合わせて確認します。",
  },
  {
    title: "海外比較があるか",
    description: "同じ局面で海外が何を優先したのかを見ることで、日本の政策判断を相対化できます。",
  },
  {
    title: "あとで確認する指標があるか",
    description: "主張が正しかったかを、物価・賃金・雇用・消費・倒産件数などで検証します。",
  },
];

const newsExamples: NewsExample[] = [
  {
    title: "財政赤字だから増税が必要、という記事",
    checks: [
      "景気が需要不足ではないか",
      "政府資産や対外純資産を見ているか",
      "増税が消費・雇用・賃金に与える影響を見ているか",
    ],
  },
  {
    title: "物価上昇だから利上げが必要、という記事",
    checks: [
      "物価上昇が需要過熱なのか輸入コスト主導なのか",
      "実質賃金が上がっているか",
      "利上げが中小企業や家計に与える影響を見ているか",
    ],
  },
  {
    title: "円安だから日本経済は弱い、という記事",
    checks: [
      "円安の原因が金利差なのか、貿易構造なのか",
      "輸出企業・輸入企業・家計への影響を分けているか",
      "円安対策として金融引き締めが妥当か",
    ],
  },
  {
    title: "賃金が上がらないのは生産性が低いから、という記事",
    checks: [
      "需要不足で企業が価格転嫁できていない可能性",
      "労働者の交渉力や雇用環境",
      "海外では賃金上昇がどの順番で起きたか",
    ],
  },
];

const aiCheckSteps = [
  "記事の主張を抜き出す",
  "前提を確認する",
  "景気局面を判定する",
  "反論・リスクを整理する",
  "海外比較につなげる",
  "あとで確認する指標を決める",
];

function getParam(value: string | string[] | undefined, fallback = "") {
  return Array.isArray(value) ? value[0] ?? fallback : value ?? fallback;
}

export default function NewsCheckPage() {
  const params = useParams<{ tenant?: string | string[] }>();
  const tenant = getParam(params.tenant, "dev");

  return (
    <main style={pageStyle}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <Link href={`/${tenant}/forum`} style={{ color: "#334155", fontWeight: 700 }}>
          ← Forumトップへ戻る
        </Link>
        <Link
          href={`/${tenant}/forum/economic-policy-comparison`}
          style={{ color: "#075985", fontWeight: 900 }}
        >
          日本と海外の経済政策比較を見る
        </Link>
      </div>

      <header style={{ margin: "22px 0 18px" }}>
        <p style={{ margin: 0, color: "#64748b", fontSize: 13, fontWeight: 900 }}>
          最新ニュースの読み解き
        </p>
        <h1 style={{ margin: "6px 0 0", fontSize: 30, lineHeight: 1.4, letterSpacing: 0 }}>
          最新ニュースをAIで読み解く
        </h1>
        <p style={{ margin: "10px 0 0", color: "#475569", lineHeight: 1.8 }}>
          新聞記事や経済ニュースを、全文転載ではなく、短い要約・主張・前提・反論・海外比較・検証指標に分けて整理します。
        </p>
      </header>

      <section style={{ ...noteStyle, marginBottom: 18 }}>
        記事を信じるか、信じないかを決めるためのページではありません。財政赤字、物価、円安、金利、賃金などの話題を、
        景気局面や前提、反論、あとで確認する指標に分けて読み解くための入口です。
      </section>

      <section style={{ ...sectionStyle, marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>このページの目的</h2>
        <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.8 }}>
          経済ニュースでは、財政赤字、物価上昇、円安、金利、賃金などが単独で語られることがあります。
          しかし、政策判断は景気局面や原因によって変わります。このページでは、記事の主張をそのまま受け取るのではなく、
          短い要約・前提・反論・海外比較・検証指標に分けて整理します。
        </p>
      </section>

      <section style={{ ...sectionStyle, marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>経済記事を見るときの確認ポイント</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
            gap: 12,
            marginTop: 14,
          }}
        >
          {checkPoints.map((point) => (
            <article
              key={point.title}
              style={{
                border: "1px solid #dbe3ef",
                borderRadius: 8,
                background: "#f8fafc",
                padding: 14,
                minWidth: 0,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 17, lineHeight: 1.5 }}>{point.title}</h3>
              <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.7 }}>
                {point.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section style={{ ...sectionStyle, marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>よくある経済ニュースの見方</h2>
        <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
          {newsExamples.map((example) => (
            <article
              key={example.title}
              style={{
                border: "1px solid #dbe3ef",
                borderRadius: 8,
                background: "#ffffff",
                padding: 14,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 18, lineHeight: 1.5 }}>{example.title}</h3>
              <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 13, fontWeight: 900 }}>
                確認すること
              </p>
              <ul style={{ margin: "8px 0 0", paddingLeft: 22, lineHeight: 1.8 }}>
                {example.checks.map((check) => (
                  <li key={`${example.title}-${check}`}>{check}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section style={{ ...sectionStyle, marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>AIでニュースを読み解く流れ</h2>
        <ol style={{ margin: "10px 0 0", paddingLeft: 22, lineHeight: 1.8 }}>
          {aiCheckSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p style={{ margin: "10px 0 0", color: "#475569", lineHeight: 1.8 }}>
          AIの回答は結論ではなく、整理と検証のためのたたき台です。記事の主張と現実の指標を照合しながら、
          あとで見直せる形で残します。
        </p>
      </section>

      <section style={{ ...sectionStyle, marginBottom: 18, background: "#f8fafc" }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>入力文の出所と正確性について</h2>
        <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.8 }}>
          このページの分析は、ユーザーが入力した文章・要約・URL情報をもとにした論点整理です。
          元記事の存在、媒体名、本文の正確性、全文一致を保証するものではありません。
          AIは、入力された文章に含まれる主張・前提・反論・検証指標を整理します。
        </p>
        <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.8 }}>
          この掲示板は、入力された文章の出所や正確性を保証するものではなく、
          そこに含まれる主張を経済理論・前提・反論・検証指標に分解して整理するための場です。
          必要に応じて、媒体公式ページ、政府統計、日銀資料、企業決算、国会資料などの一次情報を確認してください。
        </p>
      </section>

      <section style={{ ...sectionStyle, background: "#f8fafc" }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>記事本文の扱いについて</h2>
        <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.8 }}>
          公開投稿では、新聞記事や有料記事の本文をそのまま全文転載しないでください。記事タイトル、媒体名、公開日、URL、
          短い要約、確認したい前提を中心に整理してください。必要な引用は最小限にし、引用部分を明確に区別して出所を示してください。
        </p>
        <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.8 }}>
          非公開ログでは、自分用の検討材料として記事内容を整理する運用を想定します。公開する場合は、記事本文の再掲ではなく、
          論点整理・問題提起・反論・検証指標を中心にしてください。
        </p>
      </section>
    </main>
  );
}
