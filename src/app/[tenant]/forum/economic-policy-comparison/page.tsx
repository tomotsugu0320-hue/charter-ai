"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { CSSProperties } from "react";

type ComparisonSection = {
  title: string;
  lead: string;
  note?: string;
  points: string[];
};

type SituationComparisonCard = {
  situation: string;
  overseas: string;
  japan: string;
  metrics: string[];
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

const sectionNoteStyle: CSSProperties = {
  border: "1px solid #bfdbfe",
  borderRadius: 8,
  background: "#eff6ff",
  color: "#1e3a8a",
  padding: "8px 10px",
  fontSize: 14,
  fontWeight: 800,
  lineHeight: 1.7,
};

const comparisonSections: ComparisonSection[] = [
  {
    title: "財政政策の比較",
    lead: "政府のお金の取り方・使い方を比べる軸です。",
    note:
      "AIによる暫定整理です。景気局面・財源・インフレリスクを検証するためのたたき台です。",
    points: [
      "需要不足局面では、減税、給付、政府支出、公共投資などが有力な選択肢になり得るかを分けて見る。",
      "政府債務だけでなく、政府資産、中央銀行保有国債、自国通貨建て債務、対外純資産も確認する。",
      "ただし、需要超過、供給制約、円安再燃、財源設計、インフレリスクは合わせて検証する。",
      "財政政策の妥当性は、景気局面、雇用、実質賃金、物価、為替、財源設計を見て判断する。",
    ],
  },
  {
    title: "金融政策の比較",
    lead: "中央銀行が金利やお金の流れをどう調整するかを比べる軸です。",
    points: [
      "利上げ、利下げ、金融緩和、量的緩和、中央銀行の国債保有を分けて見る。",
      "物価上昇が需要主導なのか、輸入物価・為替・供給制約主導なのかを確認する。",
      "金融引き締めが、物価だけでなく雇用、賃金、投資、為替にどう波及するかを見る。",
    ],
  },
  {
    title: "その他の経済政策の比較",
    lead: "財政政策・金融政策だけでは説明しきれない制度面を、景気局面や副作用と合わせて比べる軸です。",
    note:
      "AIによる暫定整理です。産業政策・雇用・社会保障・規制などを検証するためのたたき台です。",
    points: [
      "雇用政策、賃金政策、産業政策、価格転嫁支援、社会保険料、エネルギー政策を、短期の需要対策と中長期の供給力強化に分けて扱う。",
      "産業政策や規制改革は、投資・雇用・生産性への効果と副作用を確認しながら検討する。",
      "社会保障や労働政策は、家計所得、消費、企業負担、賃金への影響を合わせて見る。",
      "政策の妥当性は、景気局面、雇用、実質賃金、物価、投資、社会保障負担を見て判断する。",
    ],
  },
  {
    title: "雇用・賃金回復の比較",
    lead: "需要回復が雇用と賃金に届いたかを見る軸です。",
    points: [
      "コロナ後に海外が需要、雇用、賃金をどう回復させたかを見る。",
      "日本は賃金上昇が広く波及する前に、財政・金融の正常化へ向かっていないかを確認する。",
      "実質賃金、中小企業への賃上げ波及、正社員求人倍率、個人消費を合わせて見る。",
    ],
  },
  {
    title: "インフレ対応の比較",
    lead: "同じ物価上昇でも、原因によって政策対応が変わることを確認する軸です。",
    points: [
      "需要超過型インフレと、輸入物価・エネルギー・為替によるコストプッシュ型インフレを分ける。",
      "需要超過なら金融引き締めが有効になりやすく、輸入物価主導なら家計・企業支援が必要になる場合がある。",
      "CPI、コアCPI、コアコアCPI、輸入物価、実質賃金、個人消費を合わせて見る。",
    ],
  },
  {
    title: "内需国・外需国の違い",
    lead: "需要増が国内の雇用・賃金に届きやすいかを見る軸です。",
    points: [
      "内需が強く国内供給力がある国では、需要増が企業売上、設備投資、雇用拡大、賃金上昇につながる可能性がある。",
      "輸入依存が強い国では、物価上昇が国内賃金ではなく、輸入コスト増、通貨安、実質所得低下に流れやすい。",
      "日本は輸入依存と国内供給力の両方を持つため、産業ごとに分けて見る必要がある。",
    ],
  },
  {
    title: "政府債務・政府資産・対外純資産の見方",
    lead: "国の財政余地を、借金だけで判断しないための軸です。",
    points: [
      "政府債務だけでなく、政府資産、日銀保有国債、純債務、自国通貨建て債務、対外純資産、名目GDPを含めて見る。",
      "政府資産や対外純資産があっても、すぐ使える財源とは限らない点に注意する。",
      "財政余地は、金利、物価、為替、成長率、税収、社会保障支出とセットで確認する。",
    ],
  },
];

const situationCards: SituationComparisonCard[] = [
  {
    situation: "需要不足で賃金が弱い場合",
    overseas: "財政支出や減税で需要を支え、雇用と賃金の回復を優先することがあります。",
    japan: "財政健全化や金融正常化を急ぎ、需要回復前に引き締め方向へ向かうことがあります。",
    metrics: ["実質賃金", "個人消費", "失業率", "正社員求人倍率", "中小企業賃上げ率"],
  },
  {
    situation: "物価上昇が輸入コスト主導の場合",
    overseas:
      "エネルギー補助、給付、減税などで家計負担を和らげつつ、需要過熱かどうかを確認することがあります。",
    japan: "物価上昇だけを見て、利上げや緊縮の議論に寄りやすくなることがあります。",
    metrics: ["輸入物価", "為替", "エネルギー価格", "実質賃金", "企業物価"],
  },
  {
    situation: "政府債務が大きいと言われる場合",
    overseas: "債務残高だけでなく、通貨建て、金利、名目GDP、中央銀行保有、政府資産も見ます。",
    japan:
      "国の借金だけが強調され、政府資産、日銀保有国債、対外純資産が見落とされやすいことがあります。",
    metrics: ["政府債務", "純債務", "政府資産", "日銀保有国債", "対外純資産", "名目GDP"],
  },
  {
    situation: "賃金上昇がまだ定着していない場合",
    overseas: "需要・雇用・賃金の回復を確認したうえで、必要な場合に限り金融引き締めを検討します。",
    japan:
      "実質賃金や中小企業賃上げが弱い段階でも、正常化や利上げが議論されやすいことがあります。",
    metrics: ["実質賃金", "名目賃金", "中小企業賃上げ率", "個人消費", "正社員求人倍率"],
  },
  {
    situation: "内需を強くしたい場合",
    overseas: "国内需要を企業売上、設備投資、雇用、賃金上昇につなげる政策を重視することがあります。",
    japan: "輸入物価や円安への警戒が先に立ち、内需拡大策が弱くなることがあります。",
    metrics: ["個人消費", "設備投資", "国内売上", "雇用者数", "賃金", "輸入依存度"],
  },
];

const checkItems = [
  "比較対象国の景気局面は同じか。",
  "需要不足か、需要超過か。",
  "インフレが需要主導か、輸入物価・為替・供給制約主導か。",
  "雇用、失業率、賃金、実質賃金の状態はどう違うか。",
  "財政支出と金融政策の組み合わせはどう違うか。",
  "自国通貨建て債務か、外貨建て債務か。",
  "政府債務だけでなく、政府資産、中央銀行、対外純資産を含めて見る必要があるか。",
  "日本にそのまま当てはめられる制度条件があるか。",
];

function getParam(value: string | string[] | undefined, fallback = "") {
  return Array.isArray(value) ? value[0] ?? fallback : value ?? fallback;
}

export default function EconomicPolicyComparisonPage() {
  const params = useParams<{ tenant?: string | string[] }>();
  const tenant = getParam(params.tenant, "dev");

  return (
    <main style={pageStyle}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <Link href={`/${tenant}/forum`} style={{ color: "#334155", fontWeight: 700 }}>
          ← Forumトップへ戻る
        </Link>
        <Link href={`/${tenant}/forum/policies`} style={{ color: "#075985", fontWeight: 900 }}>
          公開済み政策提言を見る
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
          政策判断の比較ページ
        </p>
        <h1 style={{ margin: "6px 0 0", color: "#0f172a", fontSize: 30, lineHeight: 1.4, letterSpacing: 0 }}>
          日本と海外の経済政策比較
        </h1>
        <p style={{ margin: "10px 0 0", color: "#334155", lineHeight: 1.8 }}>
          財政政策・金融政策・その他の経済政策を、海外事例と比べて検証するページです。
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
          AIによる暫定整理です。管理人の最終回答ではなく、議論と検証のためのたたき台として読んでください。
        </p>
      </header>

      <section style={{ ...noteStyle, marginBottom: 18 }}>
        このページは、海外政策をそのまま日本に当てはめるためのものではありません。
        景気局面、通貨条件、産業構造、雇用・賃金の状態を比較しながら、
        日本の政策判断を検証するための整理ページです。初期版は固定表示で、AI整理の見直しに応じて更新します。
      </section>

      <section style={{ ...sectionStyle, marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>このページの目的</h2>
        <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.8 }}>
          公開済み政策提言やForum投稿を読む前に、日本の政策判断が海外と比べて何を前提にしているのかを確認します。
          海外礼賛や日本批判ではなく、比較可能な条件をそろえるための親ページです。
        </p>
      </section>

      <section style={{ ...sectionStyle, marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>局面別に見る政策比較</h2>
        <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.8 }}>
          同じ経済状況でも、海外と日本では政策判断が違う場合があります。ここでは、よくある局面ごとに
          「海外では何を重視するか」「日本では何が起こりがちか」「確認すべき指標」を簡単に整理します。
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
            gap: 12,
            marginTop: 14,
          }}
        >
          {situationCards.map((card) => (
            <article
              key={card.situation}
              style={{
                border: "1px solid #dbe3ef",
                borderRadius: 8,
                background: "#f8fafc",
                padding: 14,
                minWidth: 0,
              }}
            >
              <p style={{ margin: 0, color: "#64748b", fontSize: 12, fontWeight: 900 }}>局面</p>
              <h3 style={{ margin: "4px 0 12px", fontSize: 18, lineHeight: 1.5 }}>{card.situation}</h3>
              <div style={{ display: "grid", gap: 10 }}>
                <div>
                  <p style={{ margin: 0, color: "#0f766e", fontSize: 13, fontWeight: 900 }}>海外では</p>
                  <p style={{ margin: "4px 0 0", color: "#334155", lineHeight: 1.75 }}>{card.overseas}</p>
                </div>
                <div>
                  <p style={{ margin: 0, color: "#b45309", fontSize: 13, fontWeight: 900 }}>日本では</p>
                  <p style={{ margin: "4px 0 0", color: "#334155", lineHeight: 1.75 }}>{card.japan}</p>
                </div>
                <div>
                  <p style={{ margin: 0, color: "#334155", fontSize: 13, fontWeight: 900 }}>
                    見るべき指標
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 7 }}>
                    {card.metrics.map((metric) => (
                      <span
                        key={`${card.situation}-${metric}`}
                        style={{
                          border: "1px solid #cbd5e1",
                          borderRadius: 999,
                          background: "#ffffff",
                          padding: "3px 8px",
                          color: "#475569",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {metric}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div style={{ display: "grid", gap: 14 }}>
        {comparisonSections.map((section) => (
          <section key={section.title} style={sectionStyle}>
            <h2 style={{ margin: 0, fontSize: 22 }}>{section.title}</h2>
            <p style={{ margin: "8px 0 0", color: "#334155", lineHeight: 1.8 }}>
              {section.lead}
            </p>
            {section.note && <p style={{ ...sectionNoteStyle, margin: "10px 0 0" }}>{section.note}</p>}
            <ul style={{ margin: "10px 0 0", paddingLeft: 22, lineHeight: 1.8 }}>
              {section.points.map((point) => (
                <li key={`${section.title}-${point}`}>{point}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section style={{ ...sectionStyle, marginTop: 18 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>日本の政策判断で確認すべきこと</h2>
        <ul style={{ margin: "10px 0 0", paddingLeft: 22, lineHeight: 1.8 }}>
          {checkItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section style={{ ...sectionStyle, marginTop: 18, background: "#f8fafc" }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>関連する政策提言への導線</h2>
        <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.8 }}>
          比較軸を確認したうえで、AI再総括をもとに作成・保存された公開済み政策提言を確認できます。
        </p>
        <Link
          href={`/${tenant}/forum/policies`}
          style={{
            display: "inline-block",
            marginTop: 12,
            color: "#075985",
            fontWeight: 900,
          }}
        >
          公開済み政策提言を見る
        </Link>
      </section>
    </main>
  );
}
