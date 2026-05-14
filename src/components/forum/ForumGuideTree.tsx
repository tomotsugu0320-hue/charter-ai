import type { CSSProperties } from "react";

type GuideTreeNode = {
  id: string;
  label: string;
  children?: GuideTreeNode[];
};

const guideTreeRoot: GuideTreeNode = {
  id: "japanese-economy",
  label: "日本経済を良くするには？",
  children: [
    {
      id: "organize-problems",
      label: "① 問題を整理する",
      children: [
        { id: "economy", label: "景気" },
        { id: "wages", label: "賃金" },
        { id: "tax-social-insurance", label: "税金・社会保険料" },
        { id: "working-generation-burden", label: "現役世代の負担" },
      ],
    },
    {
      id: "consider-causes",
      label: "② 原因を考える",
      children: [
        { id: "demand-shortage", label: "需要不足" },
        { id: "fiscal-policy", label: "財政政策" },
        { id: "consumption-tax", label: "消費税" },
        { id: "social-security-system", label: "社会保障制度" },
      ],
    },
    {
      id: "propose-solutions",
      label: "③ 解決策を出す",
      children: [
        { id: "tax-cuts", label: "減税" },
        { id: "fiscal-spending", label: "財政出動" },
        { id: "small-business-support", label: "中小企業支援" },
        { id: "system-reform", label: "制度改革" },
      ],
    },
    {
      id: "check-risks",
      label: "④ 反論・リスクを確認する",
      children: [
        { id: "funding-source", label: "財源" },
        { id: "inflation", label: "インフレ" },
        { id: "future-burden", label: "将来負担" },
        { id: "effectiveness", label: "実効性" },
      ],
    },
    {
      id: "connect-discussions",
      label: "⑤ 議論をつなげる",
      children: [
        { id: "similar-opinions", label: "似た意見" },
        { id: "opposing-opinions", label: "反対意見" },
        { id: "supplemental-opinions", label: "補足意見" },
        { id: "related-threads", label: "関連スレッド" },
      ],
    },
  ],
};

function renderGuideTree(root: GuideTreeNode) {
  const lines = [root.label, "│"];
  const children = root.children ?? [];

  children.forEach((node, index) => {
    const isLastNode = index === children.length - 1;
    const branch = isLastNode ? "└─" : "├─";
    const childPrefix = isLastNode ? "    " : "│   ";
    const nodeChildren = node.children ?? [];

    lines.push(`${branch} ${node.label}`);

    nodeChildren.forEach((child, childIndex) => {
      const isLastChild = childIndex === nodeChildren.length - 1;
      lines.push(`${childPrefix}${isLastChild ? "└─" : "├─"} ${child.label}`);
    });

    if (!isLastNode) {
      lines.push("│");
    }
  });

  return lines.join("\n");
}

const guideTree = renderGuideTree(guideTreeRoot);

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
