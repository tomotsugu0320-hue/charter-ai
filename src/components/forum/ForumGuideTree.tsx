import type { CSSProperties } from "react";

const guideTree = `日本経済を良くするには？
│
├─ ① 問題を整理する
│   ├─ 景気
│   ├─ 賃金
│   ├─ 税金・社会保険料
│   └─ 現役世代の負担
│
├─ ② 原因を考える
│   ├─ 需要不足
│   ├─ 財政政策
│   ├─ 消費税
│   └─ 社会保障制度
│
├─ ③ 解決策を出す
│   ├─ 減税
│   ├─ 財政出動
│   ├─ 中小企業支援
│   └─ 制度改革
│
├─ ④ 反論・リスクを確認する
│   ├─ 財源
│   ├─ インフレ
│   ├─ 将来負担
│   └─ 実効性
│
└─ ⑤ 議論をつなげる
    ├─ 似た意見
    ├─ 反対意見
    ├─ 補足意見
    └─ 関連スレッド`;

const cardStyle: CSSProperties = {
  border: "1px solid #d7dde8",
  borderRadius: 8,
  padding: 18,
  background: "#f8fafc",
  color: "#111827",
  marginBottom: 18,
};

const titleStyle: CSSProperties = {
  margin: "0 0 12px",
  color: "#111827",
  fontSize: 20,
  lineHeight: 1.4,
  letterSpacing: 0,
};

const treeStyle: CSSProperties = {
  margin: 0,
  padding: 14,
  border: "1px solid #dbe4f0",
  borderRadius: 8,
  background: "#ffffff",
  color: "#1f2937",
  overflowX: "auto",
  whiteSpace: "pre-wrap",
  lineHeight: 1.75,
  fontSize: 14,
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
};

export default function ForumGuideTree() {
  return (
    <section aria-labelledby="forum-guide-tree-title" style={cardStyle}>
      <h2 id="forum-guide-tree-title" style={titleStyle}>
        この掲示板でできること
      </h2>
      <pre style={treeStyle}>{guideTree}</pre>
    </section>
  );
}
