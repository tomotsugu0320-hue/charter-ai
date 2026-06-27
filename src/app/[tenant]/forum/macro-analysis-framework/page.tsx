"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { CSSProperties } from "react";

type FrameworkCard = {
  title: string;
  purpose: string;
  lookAt: string[];
  japanLens: string;
};

type StudyStep = {
  title: string;
  description: string;
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

const frameworkCards: FrameworkCard[] = [
  {
    title: "IS-LM",
    purpose: "財政政策、金利、所得、投資の関係を見る基本図です。",
    lookAt: [
      "需要不足のときに財政支出や減税が所得を押し上げるか。",
      "金利上昇が投資や消費をどれだけ抑えるか。",
      "金融政策と財政政策の組み合わせが同じ方向を向いているか。",
    ],
    japanLens: "日本では低金利でも需要が弱い局面があるため、金利だけでなく所得、投資、消費の反応を合わせて見ます。",
  },
  {
    title: "AD-AS",
    purpose: "総需要と総供給から、物価と生産量の動きを分けて見る枠組みです。",
    lookAt: [
      "物価上昇が需要超過なのか、供給制約や輸入コストなのか。",
      "需要を支える政策が生産や雇用に届く余地があるか。",
      "供給力が弱い分野では、需要追加が物価上昇に流れやすいか。",
    ],
    japanLens: "日本経済では、需要不足と輸入コスト上昇が同時に見える場合があるため、需要面と供給面を分けて確認します。",
  },
  {
    title: "フィリップス曲線",
    purpose: "失業率、賃金、物価上昇率の関係を見る枠組みです。",
    lookAt: [
      "雇用が改善しても賃金が十分に上がっているか。",
      "名目賃金と実質賃金のどちらが改善しているか。",
      "物価上昇が賃金上昇を伴っているか。",
    ],
    japanLens: "雇用が安定して見えても、実質賃金や中小企業への賃上げ波及が弱ければ、回復の定着度を慎重に見ます。",
  },
  {
    title: "需給ギャップ",
    purpose: "経済全体の需要が、供給能力に対して足りているかを見る指標です。",
    lookAt: [
      "需要不足なら、消費、投資、雇用を支える余地があるか。",
      "需要超過なら、物価上昇や供給制約が強まっていないか。",
      "産業ごとに不足しているのが需要か供給かを分ける。",
    ],
    japanLens: "日本の停滞を一つの原因で説明せず、需要不足、供給制約、人口動態、投資不足を分けて見ます。",
  },
  {
    title: "テイラー・ルール",
    purpose: "政策金利を、物価と景気の状態から考える目安です。",
    lookAt: [
      "インフレ率だけでなく、需給ギャップや雇用も見ているか。",
      "利上げが必要な物価上昇なのか、輸入コスト主導なのか。",
      "金融引き締めが賃金回復を途中で止めないか。",
    ],
    japanLens: "物価だけを見ず、実質賃金、消費、雇用、輸入物価、為替を合わせて、金融政策のタイミングを考えます。",
  },
  {
    title: "財政乗数",
    purpose: "政府支出や減税が、GDPや雇用をどれだけ押し上げるかを見る枠組みです。",
    lookAt: [
      "需要不足の局面では、支出や減税の効果が大きくなりやすいか。",
      "輸入に流れる分が大きいと、国内所得への波及が弱くならないか。",
      "公共投資、給付、減税、社会保険料負担の違いを見る。",
    ],
    japanLens: "政策の金額だけでなく、国内消費、企業売上、雇用、賃金へどの経路で届くかを確認します。",
  },
  {
    title: "債務持続可能性分析",
    purpose: "政府債務を、金利、成長率、税収、通貨条件と合わせて見る枠組みです。",
    lookAt: [
      "債務残高だけでなく、名目GDP、金利、成長率を見る。",
      "自国通貨建て債務か、外貨建て債務かを分ける。",
      "政府資産、中央銀行保有国債、対外純資産も補助情報として見る。",
    ],
    japanLens: "国の借金という単語だけで判断せず、支払い能力、通貨条件、成長率、資産側を合わせて確認します。",
  },
  {
    title: "国際収支・為替分析",
    purpose: "輸出入、所得収支、資本移動、為替が国内物価や所得に与える影響を見る枠組みです。",
    lookAt: [
      "円安や輸入物価上昇が家計と企業にどう分かれて効くか。",
      "貿易収支だけでなく、所得収支や対外純資産を見る。",
      "輸入依存度が高い分野では、物価上昇が賃金に届きにくいか。",
    ],
    japanLens: "為替の良し悪しを一語で決めず、輸出企業、輸入企業、家計、エネルギー価格への影響を分けます。",
  },
];

const japanQuestions = [
  "停滞しているのは需要、供給、分配、外部コストのどこか。",
  "賃金が上がらない原因は、生産性だけで説明できるか。",
  "物価上昇は需要過熱か、輸入コストか、供給制約か。",
  "財政支出や減税は、国内の消費、投資、雇用、賃金へ届くか。",
  "政府債務は、残高だけでなく金利、成長率、通貨条件、政府資産と合わせて見ているか。",
  "為替や国際収支は、家計、企業、物価、賃金にどう波及しているか。",
];

const studySteps: StudyStep[] = [
  {
    title: "1. 経済ニュースやForum投稿の主張を抜き出す",
    description: "まず、何が問題だと言っているのかを短く整理します。物価、賃金、財政、為替など、論点を一つずつ分けます。",
  },
  {
    title: "2. 使う分析フレームを選ぶ",
    description: "需要と金利ならIS-LM、物価と生産ならAD-AS、賃金と雇用ならフィリップス曲線のように、見る道具を選びます。",
  },
  {
    title: "3. 日本経済の条件に当てはめる",
    description: "低金利、輸入依存、実質賃金、国内供給力、対外純資産など、日本側の条件を確認します。",
  },
  {
    title: "4. あとで確認する指標を決める",
    description: "結論を急がず、実質賃金、個人消費、設備投資、失業率、輸入物価、名目GDPなどで見直せる形にします。",
  },
];

const aiPromptExamples = [
  "この主張をIS-LMで見ると、需要、金利、投資、所得のどこが論点になりますか。",
  "この物価上昇をAD-ASで分けると、需要超過と供給制約のどちらを確認すべきですか。",
  "賃金が上がらない理由を、フィリップス曲線、需給ギャップ、価格転嫁の観点で整理してください。",
  "政府債務について、債務残高、金利、名目GDP、自国通貨建て、政府資産、対外純資産を分けて整理してください。",
];

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
        <Link
          href={`/${tenant}/forum/economic-policy-comparison`}
          style={{ color: "#075985", fontWeight: 900 }}
        >
          日本と海外の経済政策比較を見る
        </Link>
      </div>

      <header style={{ margin: "22px 0 18px" }}>
        <p style={{ margin: 0, color: "#64748b", fontSize: 13, fontWeight: 900 }}>
          AIで学ぶマクロ経済分析
        </p>
        <h1 style={{ margin: "6px 0 0", fontSize: 30, lineHeight: 1.4, letterSpacing: 0 }}>
          世界標準のマクロ経済分析フレームで見る日本経済
        </h1>
        <p style={{ margin: "10px 0 0", color: "#475569", lineHeight: 1.8 }}>
          AIを使って、経済学・経済理論・経済分析の基本フレームを学びながら、日本経済の論点を整理するページです。
        </p>
      </header>

      <section style={{ ...noteStyle, marginBottom: 18 }}>
        経済停滞を気分や精神論だけで片づけず、需要、供給、物価、雇用、賃金、財政、為替の関係に分解して見ます。
        このページでは、よく使われる分析フレームを、AIに質問しながら学べる形で整理します。
      </section>

      <section style={{ ...sectionStyle, marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>このページで学ぶこと</h2>
        <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.8 }}>
          IS-LM、AD-AS、フィリップス曲線、需給ギャップ、テイラー・ルール、財政乗数、
          債務持続可能性分析、国際収支・為替分析などを使い、世界では何を見るのか、
          日本経済にはどう当てはめるのかを確認します。
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
          {frameworkCards.map((card) => (
            <article
              key={card.title}
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
                  <li key={`${card.title}-${item}`}>{item}</li>
                ))}
              </ul>
              <p style={{ margin: "12px 0 0", color: "#0f766e", fontSize: 13, fontWeight: 900 }}>
                日本経済に当てはめると
              </p>
              <p style={{ margin: "5px 0 0", color: "#334155", lineHeight: 1.7 }}>
                {card.japanLens}
              </p>
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
          日本経済の停滞を一つの性格論や努力不足で説明するのではなく、
          需要不足、供給制約、賃金形成、財政余地、金融環境、国際収支、為替の経路に分解して見る必要があります。
          そのうえで、あとから確認できる指標を残し、議論を更新していきます。
        </p>
      </section>

      <section style={{ ...sectionStyle, background: "#f8fafc" }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>関連ページ</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
          <Link href={`/${tenant}/forum/economic-policy-comparison`} style={{ color: "#075985", fontWeight: 900 }}>
            日本と海外の経済政策比較を見る
          </Link>
          <Link href={`/${tenant}/forum/news-check`} style={{ color: "#075985", fontWeight: 900 }}>
            最新ニュースをAIで読み解く
          </Link>
          <Link href={`/${tenant}/forum/policies`} style={{ color: "#075985", fontWeight: 900 }}>
            公開済み政策提言を見る
          </Link>
        </div>
      </section>
    </main>
  );
}
