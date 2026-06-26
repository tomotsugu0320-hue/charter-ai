// src/app/[tenant]/forum/thread/[id]/page.tsx


"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SectionCard from "@/components/forum/SectionCard";
import SectionTitle from "@/components/forum/SectionTitle";
import PostCard from "@/components/forum/PostCard";
import PrimaryButton from "@/components/forum/PrimaryButton";
import SelectableCardButton from "@/components/forum/SelectableCardButton";
import LinkButton from "@/components/forum/LinkButton";
import OpinionView from "@/components/forum/OpinionView";
import DiscussionTree from "@/components/forum/DiscussionTree";



type ThreadRow = {
  id: string;
  title: string;
  slug: string;
  original_post: string;
  category?: string;
  created_at?: string;
  ai_premises?: string[];
  ai_reasons?: string[];
  ai_conflicts?: { opinion: string; rebuttal: string }[];
};


type StanceLabel = "support" | "oppose" | "neutral" | "other" | "unknown";

type PostRow = {
  id: string;
  thread_id: string;
  source_type: string;
  post_role: string;
  stance_label?: StanceLabel | null;
  content: string;
  can_delete?: boolean;
  trust_status: string;
  created_at?: string;
  logic_score?: number;
  logic_score_reason?: string;
  logic_break_type?: string;
  logic_break_note?: string;
  prediction_flag?: boolean;
  prediction_target?: string | null;
  prediction_deadline?: string | null;
  parent_opinion_id?: string | null;
  prediction_result?: string | null;
  ai_conclusion_explanation?: string | null;
  ai_conclusion_explained_at?: string | null;
  ai_counterargument_explanation?: string | null;
  ai_counterargument_explained_at?: string | null;
  ai_classification?: {
    classification: string;
    confidence: number | null;
    reason: string | null;
    extracted_premise?: string | null;
    extracted_evidence?: string | null;
    suggested_metrics?: string[];
  } | null;
  feedback_counts?: {
    term_unknown?: number;
    premise_unknown?: number;
    conclusion_unknown?: number;
    evidence_unknown?: number;
    counterargument_unknown?: number;
  };
};

type SourceItem = {
  text: string;
  source_type: "extracted" | "inferred";
  quality_score: number;
};

type ConflictItem = {
  opinion: string;
  rebuttal: string;
  source_type?: "extracted" | "inferred";
  quality_score?: number;
};

type ThreadSummary = {
  counts: {
    total: number;
    issue_raise: number;
    opinion: number;
    rebuttal: number;
    supplement: number;
    explanation: number;
  };
  summary_type?: string | null;
  summary_text: string;
  easy_summary_text?: string;
  provisional_answer?: string | null;
  key_points: {
    issues: string[];
    opinions: string[];
    rebuttals: string[];
    supplements: string[];
    explanations: string[];
    premises?: SourceItem[];
    reasons?: SourceItem[];
    counterpoints?: SourceItem[];
    discussion_position?: string[];
    added_premises?: string[];
    added_evidence?: string[];
    main_agreements?: string[];
    main_rebuttals?: string[];
    verification_metrics?: string[];
    needs_review?: string[];
    changes_from_initial_answer?: string[];
    current_tentative_conclusion?: string[];
  };
};

function postCreatedTime(post?: PostRow | null) {
  const time = new Date(post?.created_at ?? "").getTime();
  return Number.isFinite(time) ? time : 0;
}

function postLogicScore(post?: PostRow | null) {
  const score = post?.logic_score;
  return typeof score === "number" && Number.isFinite(score) ? score : null;
}

function hasEvaluatedLogicScore(post?: PostRow | null) {
  return Boolean(String(post?.logic_score_reason ?? "").trim());
}

function postEvaluatedLogicScore(post?: PostRow | null) {
  if (!hasEvaluatedLogicScore(post)) return null;
  return postLogicScore(post);
}

function comparePostsByNew(a?: PostRow | null, b?: PostRow | null) {
  return postCreatedTime(b) - postCreatedTime(a);
}

function comparePostsByLogicScore(a?: PostRow | null, b?: PostRow | null) {
  const aEvaluatedScore = postEvaluatedLogicScore(a);
  const bEvaluatedScore = postEvaluatedLogicScore(b);

  if (aEvaluatedScore !== null || bEvaluatedScore !== null) {
    if (aEvaluatedScore === null) return 1;
    if (bEvaluatedScore === null) return -1;
    if (bEvaluatedScore !== aEvaluatedScore) {
      return bEvaluatedScore - aEvaluatedScore;
    }

    return comparePostsByNew(a, b);
  }

  const aScore = postLogicScore(a);
  const bScore = postLogicScore(b);

  if (aScore === null && bScore === null) {
    return comparePostsByNew(a, b);
  }

  if (aScore === null) return 1;
  if (bScore === null) return -1;
  if (bScore !== aScore) return bScore - aScore;

  return comparePostsByNew(a, b);
}


type PageProps = {
  params: Promise<{
    tenant: string;
    id: string;
  }>;
};

type PostRoleOption = {
  value: "issue_raise" | "opinion" | "rebuttal" | "supplement" | "explanation";
  label: string;
};

const POST_ROLE_OPTIONS: PostRoleOption[] = [
  { value: "issue_raise", label: "論点提起" },
  { value: "opinion", label: "意見" },
  { value: "rebuttal", label: "反論" },
  { value: "supplement", label: "補足" },
  { value: "explanation", label: "解説" },
];

type StanceLabelOption = {
  value: StanceLabel;
  label: string;
};

const STANCE_LABEL_OPTIONS: StanceLabelOption[] = [
  { value: "unknown", label: "まだ決めない" },
  { value: "support", label: "賛成" },
  { value: "oppose", label: "反対" },
  { value: "neutral", label: "中立" },
  { value: "other", label: "その他" },
];

type ReplyDraftGuide = {
  type: "論点" | "前提" | "根拠";
  text: string;
};

type ReplyDraft = {
  text?: string;
  selectedGuide?: ReplyDraftGuide | null;
  replyToOpinionId?: string | null;
  postRole?: PostRoleOption["value"];
  stanceLabel?: StanceLabel;
  predictionFlag?: boolean;
  predictionTarget?: string;
  predictionDeadline?: string;
  rebuttalClaim?: string;
  rebuttalPremise?: string;
  rebuttalReason?: string;
};

function isPostRoleValue(value: unknown): value is PostRoleOption["value"] {
  return POST_ROLE_OPTIONS.some((option) => option.value === value);
}

function isStanceLabelValue(value: unknown): value is StanceLabel {
  return STANCE_LABEL_OPTIONS.some((option) => option.value === value);
}

function isReplyDraftGuide(value: unknown): value is ReplyDraftGuide {
  if (!value || typeof value !== "object") return false;

  const guide = value as { type?: unknown; text?: unknown };

  return (
    (guide.type === "論点" || guide.type === "前提" || guide.type === "根拠") &&
    typeof guide.text === "string"
  );
}

const DISCUSSION_CARD_TEXT_LIMIT = 120;

type LocationMapNode = {
  id: string;
  label: string;
  baseLabel?: string;
  nodeId?: string;
  isCurrent?: boolean;
  isBranch?: boolean;
  isMuted?: boolean;
  relatedKeywords?: string[];
  sourceThreadIds?: string[];
  children?: LocationMapNode[];
};

const currentPath: LocationMapNode[] = [
  { id: "organize-problems", label: "問題を整理する" },
  {
    id: "tax-social-insurance",
    label: "税金・社会保険料",
    nodeId: "tax-social-insurance",
  },
  { id: "consumption-tax", label: "消費税", nodeId: "consumption-tax", isCurrent: true },
];

const mapRoot: LocationMapNode = {
  id: "tax-social-insurance",
  label: "税金・社会保険料",
  nodeId: "tax-social-insurance",
};

const mapBranches: LocationMapNode[] = [
  {
    id: "consumption-tax",
    label: "消費税",
    nodeId: "consumption-tax",
    isCurrent: true,
    children: [
      {
        id: "organize-problems",
        label: "問題を整理する",
        children: [{ id: "consumption-impact", label: "消費への影響" }],
      },
      {
        id: "consider-causes",
        label: "原因を考える",
        children: [{ id: "demand-shortage", label: "需要不足", nodeId: "demand-shortage" }],
      },
      {
        id: "propose-solutions",
        label: "解決策を出す",
        children: [{ id: "tax-cuts", label: "減税", nodeId: "tax-cuts" }],
      },
      {
        id: "check-risks",
        label: "反論・リスクを確認する",
        children: [{ id: "funding-inflation", label: "財源・インフレ" }],
      },
    ],
  },
];

const wholeDiscussionMapRoot: LocationMapNode = {
  id: "japan-economy",
  label: "日本経済",
};

const wholeDiscussionMapBranches: LocationMapNode[] = [
  {
    id: "economic-policy",
    label: "経済政策",
    children: [
      {
        id: "tax-social-insurance",
        label: "税金・社会保険料",
        nodeId: "tax-social-insurance",
        children: [
          {
            id: "consumption-tax",
            label: "消費税",
            nodeId: "consumption-tax",
            isCurrent: true,
            children: [
              { id: "demand-shortage", label: "需要不足", nodeId: "demand-shortage" },
              { id: "tax-cuts", label: "減税", nodeId: "tax-cuts" },
              { id: "funding-inflation", label: "財源・インフレ" },
              { id: "employment-wages-impact", label: "雇用・賃金への影響" },
            ],
          },
        ],
      },
      { id: "employment-wages", label: "雇用・賃金" },
      { id: "fiscal-policy", label: "財政政策", nodeId: "fiscal-policy" },
      { id: "prices-inflation", label: "物価・インフレ", nodeId: "inflation" },
    ],
  },
];

function renderLocationNode(node: LocationMapNode, tenant: string) {
  const color = node.isCurrent
    ? "#166534"
    : node.isBranch
    ? "#1d4ed8"
    : node.isMuted
    ? "#94a3b8"
    : "#0d47a1";
  const fontWeight = node.isCurrent ? 900 : node.isBranch ? 800 : node.isMuted ? 600 : 700;
  const content = node.nodeId ? (
    <Link
      href={`/${tenant}/forum?node=${node.nodeId}`}
      style={{
        color,
        fontWeight,
        textDecoration: "underline",
        textUnderlineOffset: 2,
      }}
    >
      {node.label}
    </Link>
  ) : (
    <span style={{ color: node.isMuted ? "#94a3b8" : "inherit", fontWeight }}>
      {node.label}
    </span>
  );

  if (node.isBranch && !node.isCurrent) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        {content}
        <span style={{ color: "#1d4ed8", fontSize: 12, fontWeight: 800 }}>
          この枝
        </span>
      </span>
    );
  }

  if (!node.isCurrent) return content;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 8px",
        borderRadius: 999,
        background: "#dcfce7",
        color: "#166534",
        border: "1px solid #22c55e",
        fontWeight: 900,
      }}
    >
      {content}
      <span style={{ color: "#166534", fontSize: 12, fontWeight: 800 }}>
        現在地
      </span>
    </span>
  );
}

function renderCurrentPath(path: LocationMapNode[], tenant: string) {
  return path.map((node, index) => (
    <span key={node.id}>
      {index > 0 ? " ＞ " : ""}
      {renderLocationNode(node, tenant)}
    </span>
  ));
}

function renderLocationMap(root: LocationMapNode, branches: LocationMapNode[], tenant: string) {
  const lines: ReactNode[] = [renderLocationNode(root, tenant)];

  const addNodes = (nodes: LocationMapNode[], prefix = "") => {
    nodes.forEach((node, index) => {
      const isLastNode = index === nodes.length - 1;
      const branchPrefix = isLastNode ? "└─" : "├─";
      const childPrefix = `${prefix}${isLastNode ? "   " : "│  "}`;

      lines.push(
        <>
          {prefix}
          {branchPrefix} {renderLocationNode(node, tenant)}
        </>
      );

      if (node.children?.length) {
        addNodes(node.children, childPrefix);
      }
    });
  };

  addNodes(branches);

  return lines.map((line, index) => <div key={index}>{line}</div>);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readMapText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLocationMapForDisplay(value: unknown): {
  root: LocationMapNode;
  branches: LocationMapNode[];
} | null {
  if (!isPlainRecord(value) || !isPlainRecord(value.root) || !Array.isArray(value.nodes)) {
    return null;
  }

  const rootId = readMapText(value.root.id);
  const rootLabel = readMapText(value.root.label);

  if (!rootId || !rootLabel || value.nodes.length === 0) return null;

  const nodeMap = new Map<string, LocationMapNode>();
  const parentByNodeId = new Map<string, string | null>();

  for (const item of value.nodes) {
    if (!isPlainRecord(item)) return null;

    const id = readMapText(item.id);
    const label = readMapText(item.label);
    const parentId = readMapText(item.parent_id) || null;

    if (!id || !label || id === rootId || nodeMap.has(id)) return null;

    const sourceThreadIds = Array.isArray(item.source_thread_ids)
      ? item.source_thread_ids.filter((threadId) => typeof threadId === "string" && threadId.trim())
      : [];
    const sourceThreadCount = sourceThreadIds.length;
    const relatedKeywords = Array.isArray(item.related_keywords)
      ? item.related_keywords.filter((keyword) => typeof keyword === "string" && keyword.trim())
      : [];

    nodeMap.set(id, {
      id,
      baseLabel: label,
      label: sourceThreadCount > 0 ? `${label}（参照${sourceThreadCount}件）` : label,
      nodeId: id,
      relatedKeywords,
      sourceThreadIds,
      children: [],
    });
    parentByNodeId.set(id, parentId);
  }

  for (const [id, parentId] of parentByNodeId) {
    if (parentId && parentId !== rootId && !nodeMap.has(parentId)) {
      return null;
    }

    const seen = new Set<string>([id]);
    let currentParentId = parentId;

    while (currentParentId && currentParentId !== rootId) {
      if (seen.has(currentParentId)) return null;
      seen.add(currentParentId);
      currentParentId = parentByNodeId.get(currentParentId) ?? null;
    }
  }

  const branches: LocationMapNode[] = [];

  for (const [id, node] of nodeMap) {
    const parentId = parentByNodeId.get(id);
    const parent = parentId && parentId !== rootId ? nodeMap.get(parentId) : null;

    if (parent) {
      parent.children = [...(parent.children ?? []), node];
    } else {
      branches.push(node);
    }
  }

  if (branches.length === 0) return null;

  return {
    root: {
      id: rootId,
      label: rootLabel,
      nodeId: rootId,
    },
    branches,
  };
}

function normalizeLocationMapResponse(value: unknown) {
  if (!isPlainRecord(value) || value.fallbackRequired === true) return null;

  return normalizeLocationMapForDisplay(value.map);
}

type ThreadLocationContext = {
  path: LocationMapNode[];
  root: LocationMapNode;
  branches: LocationMapNode[];
  relatedLabels: string[];
};

type LocationMapEntry = {
  node: LocationMapNode;
  parent: LocationMapNode | null;
  path: LocationMapNode[];
  depth: number;
  sourceThreadCount: number;
};

function getLocationLabel(node: LocationMapNode) {
  return node.baseLabel ?? node.label;
}

function flattenLocationMap(
  root: LocationMapNode,
  branches: LocationMapNode[]
): LocationMapEntry[] {
  const entries: LocationMapEntry[] = [];

  const visit = (
    nodes: LocationMapNode[],
    parent: LocationMapNode | null,
    parentPath: LocationMapNode[]
  ) => {
    for (const node of nodes) {
      const path = [...parentPath, node];
      entries.push({
        node,
        parent,
        path,
        depth: path.length - 1,
        sourceThreadCount: node.sourceThreadIds?.length ?? 0,
      });

      if (node.children?.length) {
        visit(node.children, node, path);
      }
    }
  };

  visit(branches, null, [root]);
  return entries;
}

function cloneNodeForCurrentLocation(
  node: LocationMapNode,
  pathIds: Set<string>,
  currentNodeId: string
): LocationMapNode {
  const isInPath = pathIds.has(node.id);
  const isCurrent = node.id === currentNodeId;

  return {
    ...node,
    isCurrent,
    isBranch: isInPath && !isCurrent,
    isMuted: !isInPath,
    children:
      isInPath && !isCurrent
        ? (node.children ?? []).map((child) =>
            cloneNodeForCurrentLocation(child, pathIds, currentNodeId)
          )
        : [],
  };
}

function buildRelatedLocationLabels(target: LocationMapEntry) {
  const labels = new Set<string>();
  const targetLabel = getLocationLabel(target.node);

  for (const keyword of target.node.relatedKeywords ?? []) {
    if (keyword && keyword !== targetLabel) labels.add(keyword);
  }

  for (const child of target.node.children ?? []) {
    const label = getLocationLabel(child);
    if (label && label !== targetLabel) labels.add(label);
  }

  for (const sibling of target.parent?.children ?? []) {
    const label = getLocationLabel(sibling);
    if (sibling.id !== target.node.id && label) labels.add(label);
  }

  return Array.from(labels).slice(0, 6);
}

function buildThreadLocationContext(
  root: LocationMapNode,
  branches: LocationMapNode[],
  threadId: string
): ThreadLocationContext | null {
  if (!threadId) return null;

  const entries = flattenLocationMap(root, branches);
  const matches = entries
    .filter((entry) => entry.node.sourceThreadIds?.includes(threadId))
    .sort((a, b) => {
      if (b.depth !== a.depth) return b.depth - a.depth;
      return (a.sourceThreadCount || Number.MAX_SAFE_INTEGER) - (b.sourceThreadCount || Number.MAX_SAFE_INTEGER);
    });

  const otherEntry = entries.find((entry) => {
    const id = entry.node.id.toLowerCase();
    return id === "other" || id === "others" || getLocationLabel(entry.node).includes("その他");
  });
  const target = matches[0] ?? otherEntry;

  if (!target) return null;

  const pathIds = new Set(target.path.map((node) => node.id));
  const currentRoot: LocationMapNode = {
    ...root,
    isBranch: false,
    isCurrent: false,
    isMuted: false,
  };

  return {
    path: target.path.map((node, index) => ({
      ...node,
      isCurrent: node.id === target.node.id,
      isBranch: index > 0 && node.id !== target.node.id,
      isMuted: false,
    })),
    root: currentRoot,
    branches: branches.map((node) =>
      cloneNodeForCurrentLocation(node, pathIds, target.node.id)
    ),
    relatedLabels: buildRelatedLocationLabels(target),
  };
}

function splitContent(content: string) {
  if (!content) {
    return {
      claim: "",
      premises: [] as string[],
      reasons: [] as string[],
    };
  }

  const sentences = content
    .split(/[。！？\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const claim = sentences[0] ?? "";
  const premises = sentences.slice(1, 3);
  const reasons = sentences.slice(3);

  return {
    claim,
    premises,
    reasons,
  };
}

function extractLabeledExternalAiSection(
  text: string,
  labels: string[],
  nextLabels: string[]
) {
  const matchedLabel = labels.find((label) => text.includes(label));
  if (!matchedLabel) return "";

  const afterLabel = text.slice(text.indexOf(matchedLabel) + matchedLabel.length).trim();
  if (!afterLabel) return "";

  const nextIndex = nextLabels.reduce<number | null>((current, label) => {
    const index = afterLabel.indexOf(label);
    if (index < 0) return current;
    return current === null ? index : Math.min(current, index);
  }, null);

  return (nextIndex === null ? afterLabel : afterLabel.slice(0, nextIndex)).trim();
}

function extractExternalAiAnswer(originalPost?: string | null) {
  const text = originalPost ?? "";
  const stopLabels = [
    "【誰でも分かる説明】",
    "【もう少し詳しい説明】",
    "【深層・専門的な補足】",
    "短く言うと:",
    "短く言うと：",
    "もう少し詳しく:",
    "もう少し詳しく：",
    "AI回答・整理:",
    "AI回答・整理：",
    "補足:",
    "補足：",
    "前提:",
    "前提：",
    "根拠:",
    "根拠：",
    "反論・リスク:",
    "反論・リスク：",
    "反論:",
    "反論：",
    "子論点候補:",
    "子論点候補：",
    "分割しなかった理由:",
    "分割しなかった理由：",
  ];

  const shortAnswer = extractLabeledExternalAiSection(
    text,
    ["【誰でも分かる説明】", "短く言うと:", "短く言うと："],
    stopLabels.filter(
      (label) => !["【誰でも分かる説明】", "短く言うと:", "短く言うと："].includes(label)
    )
  );
  const detailedAnswer = extractLabeledExternalAiSection(
    text,
    ["【もう少し詳しい説明】", "もう少し詳しく:", "もう少し詳しく："],
    stopLabels.filter(
      (label) =>
        !["【もう少し詳しい説明】", "もう少し詳しく:", "もう少し詳しく："].includes(label)
    )
  );
  const deepAnswer = extractLabeledExternalAiSection(
    text,
    ["【深層・専門的な補足】"],
    stopLabels.filter((label) => label !== "【深層・専門的な補足】")
  );

  if (shortAnswer || detailedAnswer || deepAnswer) {
    return [
      shortAnswer ? `【誰でも分かる説明】\n${shortAnswer}` : "",
      detailedAnswer ? `【もう少し詳しい説明】\n${detailedAnswer}` : "",
      deepAnswer ? `【深層・専門的な補足】\n${deepAnswer}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  const legacyAnswer = extractLabeledExternalAiSection(
    text,
    ["AI回答・整理:", "AI回答・整理："],
    stopLabels.filter((label) => !["AI回答・整理:", "AI回答・整理："].includes(label))
  );
  const legacySupplement = extractLabeledExternalAiSection(
    text,
    ["補足:", "補足："],
    stopLabels.filter((label) => !["補足:", "補足："].includes(label))
  );

  if (legacyAnswer || legacySupplement) {
    return [
      legacyAnswer ? `【誰でも分かる説明】\n${legacyAnswer}` : "",
      legacySupplement ? `【もう少し詳しい説明】\n${legacySupplement}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  return "";
}

function extractExternalAiAnswerFromTexts(values: Array<string | null | undefined>) {
  for (const value of values) {
    const answer = extractExternalAiAnswer(value);
    if (answer.trim()) return answer;
  }

  return "";
}

function stripExternalAiInternalSections(value?: string | null) {
  const text = value ?? "";
  const labels = [
    "【誰でも分かる説明】",
    "【もう少し詳しい説明】",
    "【深層・専門的な補足】",
    "短く言うと:",
    "短く言うと：",
    "もう少し詳しく:",
    "もう少し詳しく：",
    "AI回答・整理:",
    "AI回答・整理：",
    "補足:",
    "補足：",
    "前提:",
    "前提：",
    "根拠:",
    "根拠：",
    "反論・リスク:",
    "反論・リスク：",
    "反論:",
    "反論：",
    "子論点候補:",
    "子論点候補：",
    "分割しなかった理由:",
    "分割しなかった理由：",
  ];
  const firstLabelIndex = labels.reduce<number | null>((current, label) => {
    const index = text.indexOf(label);
    if (index < 0) return current;
    return current === null ? index : Math.min(current, index);
  }, null);

  return (firstLabelIndex === null ? text : text.slice(0, firstLabelIndex)).trim();
}

function containsSocialInsuranceCoreText(value?: string | null) {
  const text = String(value ?? "");
  return [
    "社会保険料",
    "社会保険",
    "保険料",
    "厚生年金",
    "健康保険",
    "介護保険",
    "年金保険",
    "給与天引き",
    "労使折半",
    "社会保障負担",
  ].some((keyword) => text.includes(keyword));
}

function shouldPreferExternalAiAnswer(
  summaryText: string,
  externalAiAnswer: string,
  title?: string | null,
  originalPost?: string | null,
  postContentText?: string | null
) {
  if (!summaryText.trim() || !externalAiAnswer.trim()) return false;

  const contextText = `${title ?? ""}\n${originalPost ?? ""}\n${postContentText ?? ""}`;

  return (
    containsSocialInsuranceCoreText(summaryText) &&
    !containsSocialInsuranceCoreText(contextText)
  );
}

function isTemplateProvisionalAnswer(value?: string | null) {
  const text = String(value ?? "").trim();
  return (
    text.startsWith("現時点では、") &&
    (text.includes("という全体整理をもとに") ||
      text.includes("をもとに確認できます"))
  );
}

const ANSWER_LAYER_LABELS = [
  "【誰でも分かる説明】",
  "【もう少し詳しい説明】",
  "【深層・専門的な補足】",
] as const;

function extractAnswerLayer(
  text: string,
  label: (typeof ANSWER_LAYER_LABELS)[number],
  nextLabels: readonly string[]
) {
  const startIndex = text.indexOf(label);
  if (startIndex < 0) return "";

  const afterLabel = text.slice(startIndex + label.length);
  const nextIndex = nextLabels.reduce<number | null>((current, nextLabel) => {
    const index = afterLabel.indexOf(nextLabel);
    if (index < 0) return current;
    return current === null ? index : Math.min(current, index);
  }, null);

  return (nextIndex === null ? afterLabel : afterLabel.slice(0, nextIndex))
    .replace(/^[:：\s\n]+/, "")
    .trim();
}

function parseLayeredProvisionalAnswer(value: string) {
  const text = value.replace(/\r\n/g, "\n").trim();
  const hasLayerHeading = ANSWER_LAYER_LABELS.some((label) =>
    text.includes(label)
  );

  if (!hasLayerHeading) {
    return {
      hasLayers: false,
      simple: text,
      detailed: "",
      deep: "",
    };
  }

  return {
    hasLayers: true,
    simple: extractAnswerLayer(text, ANSWER_LAYER_LABELS[0], [
      ANSWER_LAYER_LABELS[1],
      ANSWER_LAYER_LABELS[2],
    ]),
    detailed: extractAnswerLayer(text, ANSWER_LAYER_LABELS[1], [
      ANSWER_LAYER_LABELS[2],
    ]),
    deep: extractAnswerLayer(text, ANSWER_LAYER_LABELS[2], []),
  };
}

function normalizeSourceItems(values?: (string | SourceItem)[] | null): SourceItem[] {
  if (!Array.isArray(values)) return [];

  return values
    .map((value) => {
      if (typeof value === "string") {
        return {
          text: value,
          source_type: "extracted" as const,
          quality_score: 60,
        };
      }

      const sourceType =
        value?.source_type === "inferred" ? "inferred" as const : "extracted" as const;
      const qualityScore =
        typeof value?.quality_score === "number" && Number.isFinite(value.quality_score)
          ? Math.max(0, Math.min(100, Math.round(value.quality_score)))
          : sourceType === "extracted"
          ? 60
          : 45;

      return {
        text: String(value?.text ?? ""),
        source_type: sourceType,
        quality_score: qualityScore,
      };
    })
    .filter((item) => item.text.trim())
    .slice(0, 3);
}

function splitByQuality(items: SourceItem[]) {
  return {
    strong: items.filter((item) => item.quality_score >= 60).slice(0, 3),
    mid: items
      .filter((item) => item.quality_score >= 40 && item.quality_score < 60)
      .slice(0, 2),
    hide: items.filter((item) => item.quality_score < 40),
  };
}

function getSectionDisplay(
  items: SourceItem[],
  labels: { strong: string; mid: string },
  messages: string[]
) {
  const grouped = splitByQuality(items);

  if (grouped.strong.length > 0) {
    return {
      mode: "strong" as const,
      title: labels.strong,
      items: grouped.strong,
      messages: [] as string[],
    };
  }

  if (grouped.mid.length > 0) {
    return {
      mode: "mid" as const,
      title: labels.mid,
      items: grouped.mid,
      messages: [] as string[],
    };
  }

  return {
    mode: "empty" as const,
    title: labels.mid,
    items: [] as SourceItem[],
    messages,
  };
}

function normalizeConflictItems(values?: ConflictItem[] | null): ConflictItem[] {
  if (!Array.isArray(values)) return [];

  return values
    .map((value) => {
      const sourceType =
        value?.source_type === "inferred" ? "inferred" as const : "extracted" as const;
      const qualityScore =
        typeof value?.quality_score === "number" && Number.isFinite(value.quality_score)
          ? Math.max(0, Math.min(100, Math.round(value.quality_score)))
          : sourceType === "extracted"
          ? 60
          : 45;

      return {
        opinion: String(value?.opinion ?? ""),
        rebuttal: String(value?.rebuttal ?? ""),
        source_type: sourceType,
        quality_score: qualityScore,
      };
    })
    .filter((item) => item.opinion.trim() || item.rebuttal.trim())
    .slice(0, 3);
}

function getConflictDisplay(items: ConflictItem[]) {
  const normalized = normalizeConflictItems(items);
  const strong = normalized
    .filter((item) => (item.quality_score ?? 0) >= 60)
    .slice(0, 3);
  const mid = normalized
    .filter(
      (item) =>
        (item.quality_score ?? 0) >= 40 && (item.quality_score ?? 0) < 60
    )
    .slice(0, 2);

  if (strong.length > 0) {
    return {
      mode: "strong" as const,
      title: "主な対立",
      items: strong,
      messages: [] as string[],
    };
  }

  if (mid.length > 0) {
    return {
      mode: "mid" as const,
      title: "想定される対立（参考）",
      items: mid,
      messages: [] as string[],
    };
  }

  return {
    mode: "empty" as const,
    title: "想定される対立（参考）",
    items: [] as ConflictItem[],
    messages: [
      "対立はまだ十分に特定できません",
      "別の見方や反対意見があるかを書くと議論が深まります",
    ],
  };
}

function formatDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("ja-JP");
}

function roleColor(role: string) {
  switch (role) {
    case "issue_raise":
      return "#6a1b9a";
    case "opinion":
      return "#111";
    case "rebuttal":
      return "#b71c1c";
    case "supplement":
      return "#0d47a1";
    case "explanation":
      return "#2e7d32";
    default:
      return "#555";
  }
}

function scoreColor(score?: number) {
  if (!score) return "#777";
  if (score >= 80) return "#2e7d32";
  if (score >= 60) return "#1565c0";
  if (score >= 40) return "#ef6c00";
  return "#b71c1c";
}

function roleLabel(role: string) {
  switch (role) {
    case "issue_raise":
      return "論点提起";
    case "opinion":
      return "意見";
    case "rebuttal":
      return "反論";
    case "supplement":
      return "補足";
    case "explanation":
      return "解説";
    case "ai_analysis":
      return "AI分析";
    case "ai_reanalysis":
      return "AI再分析";
    default:
      return role;
  }
}

function postSubmitLabel(role: PostRoleOption["value"]) {
  switch (role) {
    case "issue_raise":
      return "論点を投稿する";
    case "opinion":
      return "意見を投稿する";
    case "rebuttal":
      return "反論を投稿する";
    case "supplement":
      return "補足を投稿する";
    case "explanation":
      return "解説を投稿する";
    default:
      return "投稿する";
  }
}

function trustBonus(label?: string) {
  if (label === "A") return 8;
  if (label === "B") return 3;
  return 0;
}

export default function ForumThreadPage({ params }: PageProps) {
  const router = useRouter();
  const [conflicts, setConflicts] = useState<
    ConflictItem[]
  >([]);

  const [fontSize, setFontSize] = useState<"small" | "medium" | "large">(
    "medium"
  );

  const [tenant, setTenant] = useState("");
  const [threadId, setThreadId] = useState("");


  const [sortType, setSortType] = useState<"score" | "new">("score");
  const [hideLowScore, setHideLowScore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postLoginRequired, setPostLoginRequired] = useState(false);
  const [postSuccessMessage, setPostSuccessMessage] = useState<string | null>(null);
  const [isThreadMenuOpen, setIsThreadMenuOpen] = useState(false);
  const [isForumBetaLoggedIn, setIsForumBetaLoggedIn] = useState<boolean | null>(
    null
  );
  const [isForumAdmin, setIsForumAdmin] = useState(false);
  const [classifyLoading, setClassifyLoading] = useState(false);
  const [classifyMessage, setClassifyMessage] = useState<string | null>(null);
  const [rebuildSummaryLoading, setRebuildSummaryLoading] = useState(false);
  const [rebuildSummaryMessage, setRebuildSummaryMessage] = useState<string | null>(null);

const [explanations, setExplanations] = useState<Record<string, string>>({});
const [feedbackLoadingPostId, setFeedbackLoadingPostId] = useState<string | null>(null);


const [summaryLoading, setSummaryLoading] = useState(false);
const [summaryNotice, setSummaryNotice] = useState<string | null>(null);

useEffect(() => {
  if (typeof window === "undefined") return;
  if (window.location.hash.startsWith("#post-")) {
    setSortType("new");
  }
}, []);


  const [thread, setThread] = useState<ThreadRow | null>(null);
  const [posts, setPosts] = useState<PostRow[]>([]);

  const [text, setText] = useState("");
  const [searchText, setSearchText] = useState("");
  const [copied, setCopied] = useState(false);
  const [bookmarkSaveState, setBookmarkSaveState] = useState({
    loading: false,
    saved: false,
    error: "",
  });

  const [selectedGuide, setSelectedGuide] = useState<{
    type: "論点" | "前提" | "根拠";
    text: string;
  } | null>(null);
  const [expandedDiscussionTextMap, setExpandedDiscussionTextMap] = useState<
    Record<string, boolean>
  >({});

  const [relatedPosts, setRelatedPosts] = useState<
    {
      id: string;
      content: string;
      post_role: string;
      created_at?: string;
      thread_id: string;
      thread_title?: string;
    }[]
  >([]);
  const [relatedSummary, setRelatedSummary] = useState<string | null>(null);
  const [loadingRelated, setLoadingRelated] = useState(false);

  const [rebuttalClaim, setRebuttalClaim] = useState("");
  const [rebuttalPremise, setRebuttalPremise] = useState("");
  const [rebuttalReason, setRebuttalReason] = useState("");

  const [summary, setSummary] = useState<ThreadSummary | null>(null);
  const [activeDiscussionMap, setActiveDiscussionMap] = useState<{
    root: LocationMapNode;
    branches: LocationMapNode[];
  } | null>(null);
const keywords = useMemo(() => {
const postText = posts
  .slice(0, 30)
  .map(p => p.content)
  .join(" ");
const sourceText = [
  (thread?.title ?? "") + " ".repeat(5),
  thread?.original_post ?? "",
  summary?.summary_text ?? "",
  summary?.easy_summary_text ?? "",
  postText,
].join(" ");
const stopWords = new Set([
  "こと","これ","それ","ため","よう","もの",
  "ここ","みたい","感じ","議論","主張","前提",
  "根拠","意見","反論","補足","解説","投稿",
  "内容","整理","AI","スレ","スレッド",
  "自分","相手","日本",
  "ある","ない","する","できる","なる","いる",
  "思う","考える","言う","見る","使う"
]);


  const matches =
    sourceText.match(/[一-龠ぁ-んァ-ヶA-Za-z0-9ー]{2,12}/g) ?? [];

  const counts: Record<string, number> = {};

for (const word of matches) {
  const w = word.trim();
  if (!w) continue;
  if (w.length <= 1) continue;
  if (stopWords.has(w)) continue;
  if (/^\d+$/.test(w)) continue;

  counts[w] = (counts[w] ?? 0) + 1;
}

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .slice(0, 5);
   }, [posts, thread?.title, thread?.original_post, summary?.summary_text, summary?.easy_summary_text]);

  const [replyToOpinionId, setReplyToOpinionId] = useState<string | null>(null);

  const [postRole, setPostRole] =
    useState<PostRoleOption["value"]>("opinion");
  const [stanceLabel, setStanceLabel] = useState<StanceLabel>("unknown");

const [treeVariant] = useState<"A" | "C">("A");

  const [predictionFlag, setPredictionFlag] = useState(false);
  const [predictionTarget, setPredictionTarget] = useState("");
  const [predictionDeadline, setPredictionDeadline] = useState("");

  const replyDraftKey = threadId ? `forum_reply_draft_${threadId}` : "";
  const replyDraftRestoreKey = thread?.id ? replyDraftKey : "";

  function saveReplyDraft() {
    if (!replyDraftKey) return;

    const draft: ReplyDraft = {
      text,
      selectedGuide,
      replyToOpinionId,
      postRole,
      stanceLabel,
      predictionFlag,
      predictionTarget,
      predictionDeadline,
      rebuttalClaim,
      rebuttalPremise,
      rebuttalReason,
    };

    window.sessionStorage.setItem(replyDraftKey, JSON.stringify(draft));
  }

  function clearReplyDraft() {
    if (!replyDraftKey) return;
    window.sessionStorage.removeItem(replyDraftKey);
  }


  async function fetchThreadBookmarkSaved(targetThreadId: string) {
    if (!tenant || !targetThreadId) return false;

    const response = await fetch(
      `/api/forum/private-import-logs?tenantSlug=${encodeURIComponent(
        tenant
      )}&sourceType=thread_bookmark&relatedThreadId=${encodeURIComponent(
        targetThreadId
      )}`,
      { cache: "no-store" }
    );
    const result = (await response.json().catch(() => null)) as {
      success?: boolean;
      error?: string;
      logs?: unknown[];
    } | null;

    if (!response.ok || result?.success === false) {
      throw new Error(result?.error || "保存状態を確認できませんでした。");
    }

    return Array.isArray(result?.logs) && result.logs.length > 0;
  }

  async function loadThreadBookmarkState(targetThreadId: string) {
    const saved = await fetchThreadBookmarkSaved(targetThreadId);

    setBookmarkSaveState({
      loading: false,
      saved,
      error: "",
    });

    return saved;
  }


  useEffect(() => {
    (async () => {
      const resolved = await params;
      setTenant(resolved.tenant);
      setThreadId(resolved.id);
    })();
  }, [params]);

  useEffect(() => {
    let cancelled = false;

    async function loadDiscussionMap() {
      try {
        const res = await fetch("/api/forum/discussion-map", {
          cache: "no-store",
        });
        const result: unknown = await res.json().catch(() => null);
        const normalized = res.ok ? normalizeLocationMapResponse(result) : null;

        if (!cancelled) setActiveDiscussionMap(normalized);
      } catch {
        if (!cancelled) setActiveDiscussionMap(null);
      }
    }

    void loadDiscussionMap();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadLoginStatus() {
      try {
        const res = await fetch("/api/forum/login/status", {
          cache: "no-store",
        });
        const result = (await res.json().catch(() => null)) as {
          loggedIn?: unknown;
        } | null;
        const loggedIn = res.ok && result?.loggedIn === true;

        if (!cancelled) setIsForumBetaLoggedIn(loggedIn);
      } catch {
        if (!cancelled) setIsForumBetaLoggedIn(false);
      }
    }

    void loadLoginStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAdminStatus() {
      try {
        const res = await fetch("/api/forum/admin/users", {
          cache: "no-store",
        });

        if (!cancelled) setIsForumAdmin(res.ok);
      } catch {
        if (!cancelled) setIsForumAdmin(false);
      }
    }

    void loadAdminStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!threadId) return;
    loadThread();
  }, [threadId]);

  useEffect(() => {
    if (!tenant || !thread?.id) {
      setBookmarkSaveState((current) => ({
        ...current,
        saved: false,
        error: "",
      }));
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const saved = await fetchThreadBookmarkSaved(thread.id);

        if (!cancelled) {
          setBookmarkSaveState((current) => ({
            ...current,
            saved,
            error: "",
          }));
        }
      } catch {
        if (!cancelled) {
          setBookmarkSaveState((current) => ({
            ...current,
            saved: false,
          }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tenant, thread?.id]);






useEffect(() => {
  if (!replyDraftRestoreKey) return;

  const rawDraft = window.sessionStorage.getItem(replyDraftRestoreKey);
  if (!rawDraft) return;

  try {
    const parsedDraft = JSON.parse(rawDraft);

    if (!parsedDraft || typeof parsedDraft !== "object") {
      window.sessionStorage.removeItem(replyDraftRestoreKey);
      return;
    }

    const draft = parsedDraft as Partial<ReplyDraft>;

    if (typeof draft.text === "string") setText(draft.text);
    if (isReplyDraftGuide(draft.selectedGuide)) {
      setSelectedGuide(draft.selectedGuide);
    } else if (draft.selectedGuide === null) {
      setSelectedGuide(null);
    }
    if (
      typeof draft.replyToOpinionId === "string" ||
      draft.replyToOpinionId === null
    ) {
      setReplyToOpinionId(draft.replyToOpinionId);
    }
    if (isPostRoleValue(draft.postRole)) setPostRole(draft.postRole);
    if (isStanceLabelValue(draft.stanceLabel)) setStanceLabel(draft.stanceLabel);
    if (typeof draft.predictionFlag === "boolean") {
      setPredictionFlag(draft.predictionFlag);
    }
    if (typeof draft.predictionTarget === "string") {
      setPredictionTarget(draft.predictionTarget);
    }
    if (typeof draft.predictionDeadline === "string") {
      setPredictionDeadline(draft.predictionDeadline);
    }
    if (typeof draft.rebuttalClaim === "string") {
      setRebuttalClaim(draft.rebuttalClaim);
    }
    if (typeof draft.rebuttalPremise === "string") {
      setRebuttalPremise(draft.rebuttalPremise);
    }
    if (typeof draft.rebuttalReason === "string") {
      setRebuttalReason(draft.rebuttalReason);
    }

    setPostLoginRequired(false);

    setTimeout(() => {
      const el = document.getElementById("post-form");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  } catch {
    window.sessionStorage.removeItem(replyDraftRestoreKey);
  }
}, [replyDraftRestoreKey]);



useEffect(() => {
  const handler = () => {
    setTimeout(() => {
      const el = document.getElementById("post-form");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  window.addEventListener("scroll-to-post-form", handler);
  return () => window.removeEventListener("scroll-to-post-form", handler);
}, []);

async function handleLogout() {
  await fetch("/api/forum/logout", { method: "POST" }).catch(() => null);
  setIsForumBetaLoggedIn(false);
  setIsThreadMenuOpen(false);
  router.push(`/${tenant}/forum/login`);
}


  const fontSizeMap = {
    small: {
      base: 14,
      title: 20,
    },
    medium: {
      base: 16,
      title: 22,
    },
    large: {
      base: 19,
      title: 26,
    },
  };

  const currentFont = fontSizeMap[fontSize];
  const threadTitleFontSize = currentFont.title * 0.9;
  const currentUrl =
    typeof window !== "undefined" ? window.location.href : "";
  const discussionMapForDisplay = activeDiscussionMap ?? {
    root: wholeDiscussionMapRoot,
    branches: wholeDiscussionMapBranches,
  };
  const threadLocationContext = useMemo(
    () =>
      buildThreadLocationContext(
        discussionMapForDisplay.root,
        discussionMapForDisplay.branches,
        threadId
      ),
    [discussionMapForDisplay.branches, discussionMapForDisplay.root, threadId]
  );
  const currentLocationPath = threadLocationContext?.path ?? currentPath;
  const currentLocationMap = threadLocationContext
    ? {
        root: threadLocationContext.root,
        branches: threadLocationContext.branches,
      }
    : {
        root: mapRoot,
        branches: mapBranches,
      };
  const currentRelatedLabels = threadLocationContext?.relatedLabels ?? [];

  const visiblePosts = useMemo(() => {
    return posts.filter((post) => {
      const matchRole =
        post.post_role === "issue_raise" ||
        post.post_role === "opinion" ||
        post.post_role === "rebuttal" ||
        post.post_role === "supplement" ||
        post.post_role === "explanation";

      const matchSearch = searchText
        ? post.content.toLowerCase().includes(searchText.toLowerCase())
        : true;

      return matchRole && matchSearch;
    });
  }, [posts, searchText]);

  const mainDeletablePost = useMemo(() => {
    return (
      posts.find(
        (post) => post.post_role === "issue_raise" && post.can_delete === true
      ) ?? null
    );
  }, [posts]);

const handleGenerateSummary = async () => {
  try {
    setSummaryLoading(true);
    setSummaryNotice(null);

    const res = await fetch(
      `/api/forum/thread-summary?threadId=${threadId}`,
      {
        method: "GET",
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || "AIまとめ生成失敗");
    }

    if (data && typeof data === "object" && "saved" in data && data.saved === false) {
      console.error("[thread-summary save failed]", data.save_error);
    }

    if (
      data &&
      typeof data === "object" &&
      "skipped_generation" in data &&
      data.skipped_generation === true
    ) {
      setSummaryNotice(
        "保存済みのAIまとめを表示しています。AI再生成は週1回を目安にしています。"
      );
    }

    setSummary(data?.summary || null);
    setConflicts(Array.isArray(data?.conflict_pairs) ? data.conflict_pairs : []);
  } catch (e) {
    console.error(e);
    setSummary(null);
    setSummaryNotice(null);
  } finally {
    setSummaryLoading(false);
  }
};


const treeSourcePosts = useMemo(() => {
  return visiblePosts
    .filter((post) => post.content.trim().length > 0)
    .sort((a, b) => {
      const at = new Date(a.created_at ?? "").getTime();
      const bt = new Date(b.created_at ?? "").getTime();
      return at - bt;
    });
}, [visiblePosts]);


  const sortedVisiblePosts = useMemo(() => {
    const arr = [...visiblePosts];

    if (sortType === "score") {
      return arr.sort((a, b) => {
        const as = a.logic_score ?? 0;
        const bs = b.logic_score ?? 0;
        if (bs !== as) return bs - as;

        const at = new Date(a.created_at ?? "").getTime();
        const bt = new Date(b.created_at ?? "").getTime();
        return bt - at;
      });
    }

    return arr.sort((a, b) => {
      const at = new Date(a.created_at ?? "").getTime();
      const bt = new Date(b.created_at ?? "").getTime();
      return bt - at;
    });
  }, [visiblePosts, sortType]);


const groupedByIssue = useMemo(() => {
  const groups: {
    issue: PostRow | null;
    items: PostRow[];
  }[] = [];

  let currentGroup: { issue: PostRow | null; items: PostRow[] } | null = null;

  for (const post of treeSourcePosts) {
    if (post.post_role === "issue_raise") {
      currentGroup = {
        issue: post,
        items: [],
      };
      groups.push(currentGroup);
      continue;
    }

    if (!currentGroup) {
      currentGroup = {
        issue: null,
        items: [],
      };
      groups.push(currentGroup);
    }

    currentGroup.items.push(post);
  }

  return groups;
}, [treeSourcePosts]);


const groupedByOpinion = useMemo(() => {
  const sortOpinionGroups = (
    opinionGroups: {
      opinion: PostRow;
      children: PostRow[];
    }[]
  ) => {
    return [...opinionGroups].sort((a, b) => {
      return sortType === "score"
        ? comparePostsByLogicScore(a.opinion, b.opinion)
        : comparePostsByNew(a.opinion, b.opinion);
    });
  };

  const groups = groupedByIssue.map((group) => {
    const opinionPosts = group.items.filter((p) => p.post_role === "opinion");
    const childPosts = group.items.filter(
      (p) =>
        p.post_role === "rebuttal" ||
        p.post_role === "supplement" ||
        p.post_role === "explanation"
    );

    const opinionGroups: {
      opinion: PostRow;
      children: PostRow[];
    }[] = [];

    if (opinionPosts.length === 0 && group.issue) {
      opinionGroups.push({
        opinion: {
          ...group.issue,
          id: group.issue.id,
          post_role: "opinion",
          content: group.issue.content,
          logic_score: 50,
        },
        children: childPosts,
      });

      return {
        issue: group.issue,
        opinions: sortOpinionGroups(opinionGroups),
      };
    }

    const opinionMap = new Map<
      string,
      {
        opinion: PostRow;
        children: PostRow[];
      }
    >();

    for (const opinion of opinionPosts) {
      const groupItem = {
        opinion,
        children: [] as PostRow[],
      };
      opinionGroups.push(groupItem);
      opinionMap.set(opinion.id, groupItem);
    }

    for (const child of childPosts) {
      if (child.parent_opinion_id && opinionMap.has(child.parent_opinion_id)) {
        opinionMap.get(child.parent_opinion_id)!.children.push(child);
        continue;
      }

      if (opinionGroups.length > 0) {
        opinionGroups[opinionGroups.length - 1].children.push(child);
      }
    }

    return {
      issue: group.issue,
      opinions: sortOpinionGroups(opinionGroups),
    };
  });

  return [...groups].sort((a, b) => {
    const aTopPost = a.opinions[0]?.opinion ?? a.issue;
    const bTopPost = b.opinions[0]?.opinion ?? b.issue;

    return sortType === "score"
      ? comparePostsByLogicScore(aTopPost, bTopPost)
      : comparePostsByNew(aTopPost, bTopPost);
  });
}, [groupedByIssue, sortType]);

  const bestOpinionsByIssue = useMemo(() => {
    return groupedByOpinion.map((group) => {
      const scored = group.opinions.flatMap((op) => {
        const base = postEvaluatedLogicScore(op.opinion);
        if (base === null) return [];

        const rebuttalCount = op.children.filter(
          (c) => c.post_role === "rebuttal"
        ).length;

        const effectiveScore = base - rebuttalCount * 5;

        return {
          ...op,
          effectiveScore,
          rebuttalCount,
          trustLabel: "-",
        };
      });

      const sorted = [...scored].sort(
        (a, b) => b.effectiveScore - a.effectiveScore
      );

      return {
        issue: group.issue,
        best: sorted[0] ?? null,
      };
    });
  }, [groupedByOpinion]);

  const averageLogicScore = useMemo(() => {
    const evaluatedScores = visiblePosts
      .map((post) => postEvaluatedLogicScore(post))
      .filter((score): score is number => score !== null && score > 0);

    if (evaluatedScores.length === 0) return 0;

    const total = evaluatedScores.reduce((sum, score) => {
      return sum + score;
    }, 0);

    return Math.round(total / evaluatedScores.length);
  }, [visiblePosts]);

  const maxLogicScore = useMemo(() => {
    const evaluatedScores = visiblePosts
      .map((post) => postEvaluatedLogicScore(post))
      .filter((score): score is number => score !== null && score > 0);
    if (evaluatedScores.length === 0) return null;
    return Math.max(...evaluatedScores);
  }, [visiblePosts]);

  const originalStructure = useMemo(() => {
    return splitContent(thread?.original_post ?? "");
  }, [thread?.original_post]);

const externalAiAnswerFromThreadContent = extractExternalAiAnswerFromTexts([
  thread?.original_post,
  ...posts.map((post) => post.content),
]);
const postContentTextForThemeCheck = posts.map((post) => post.content).join("\n");
const postPremiseFallbackItems = normalizeSourceItems(
  posts
    .filter((post) => post.post_role === "supplement")
    .map((post) => post.content)
);
const postReasonFallbackItems = normalizeSourceItems(
  posts
    .filter((post) => post.post_role === "explanation")
    .map((post) => post.content)
);
const postConflictFallbackItems: ConflictItem[] = posts
  .filter((post) => post.post_role === "rebuttal")
  .map((post) => post.content.trim())
  .filter(Boolean)
  .slice(0, 3)
  .map((rebuttal) => ({
    opinion: thread?.title || "この主張",
    rebuttal,
    source_type: "extracted" as const,
    quality_score: 60,
  }));






{summary && (
  <div style={{ marginTop: 16, padding: 12, background: "#111", borderRadius: 8 }}>
    <div style={{ fontWeight: 700, marginBottom: 8 }}>AI要約</div>
    <div>{summary.easy_summary_text}</div>
  </div>
)}










const displayPremiseItemsBase = normalizeSourceItems(
  summary?.key_points?.premises?.length
    ? summary.key_points.premises
    : thread?.ai_premises?.length
    ? thread.ai_premises
    : postPremiseFallbackItems
);
const displayPremiseItems =
  displayPremiseItemsBase.length > 0
    ? displayPremiseItemsBase
    : [
        {
          text: `${thread?.title || "この主張"}が成り立つための前提を確認する`,
          source_type: "inferred" as const,
          quality_score: 45,
        },
      ];
const displayPremises = displayPremiseItems.map((item) => item.text);

const displayReasonItemsBase = normalizeSourceItems(
  summary?.key_points?.reasons?.length
    ? summary.key_points.reasons
    : thread?.ai_reasons?.length
    ? thread.ai_reasons
    : postReasonFallbackItems
);
const displayReasonItems =
  displayReasonItemsBase.length > 0
    ? displayReasonItemsBase
    : [
        {
          text: `${thread?.title || "この主張"}を支える根拠を確認する`,
          source_type: "inferred" as const,
          quality_score: 45,
        },
      ];
const displayReasons = displayReasonItems.map((item) => item.text);

const displayConflictBase: ConflictItem[] =
  conflicts.length > 0
    ? conflicts
    : summary?.key_points?.counterpoints?.length
    ? summary.key_points.counterpoints.map((item) => ({
        opinion: thread?.title || "この主張",
        rebuttal: item.text,
        source_type: item.source_type,
        quality_score: item.quality_score,
      }))
    : thread?.ai_conflicts?.length
    ? thread.ai_conflicts.map((conflict) => ({
        ...conflict,
        source_type: "extracted" as const,
        quality_score: 60,
      }))
    : postConflictFallbackItems;
const displayConflicts: ConflictItem[] =
  displayConflictBase.length > 0
    ? displayConflictBase
    : [
        {
          opinion: thread?.title || "この主張",
          rebuttal: "別の見方や反対意見もあり得る",
          source_type: "inferred" as const,
          quality_score: 45,
        },
      ];

const premiseQualityDisplay = getSectionDisplay(
  displayPremiseItems,
  {
    strong: "主な前提",
    mid: "考えられる前提（仮説）",
  },
  [
    "前提は入力が抽象的なため特定できません",
    "前提を1つ追加すると整理しやすくなります",
  ]
);
const reasonQualityDisplay = getSectionDisplay(
  displayReasonItems,
  {
    strong: "主な根拠",
    mid: "考えられる根拠（仮説）",
  },
  [
    "根拠は具体的な理由が不足しています",
    "なぜそう思うかを1つ追加すると表示しやすくなります",
  ]
);
const conflictQualityDisplay = getConflictDisplay(displayConflicts);

const premiseSectionTitle = premiseQualityDisplay.title;
const reasonSectionTitle = reasonQualityDisplay.title;
const conflictSectionTitle = conflictQualityDisplay.title;
const visiblePremises =
  premiseQualityDisplay.mode === "empty"
    ? []
    : premiseQualityDisplay.items.map((item) => item.text);
const visibleReasons =
  reasonQualityDisplay.mode === "empty"
    ? []
    : reasonQualityDisplay.items.map((item) => item.text);
const visibleConflicts =
  conflictQualityDisplay.mode === "empty"
    ? []
    : conflictQualityDisplay.items;
const initialPremises = visiblePremises.slice(0, 2);
const initialReasons = visibleReasons.slice(0, 2);
const initialConflicts = visibleConflicts.slice(0, 2);
const overviewPremises = visiblePremises.slice(0, 3);
const overviewReasons = visibleReasons.slice(0, 3);
const overviewConflicts = visibleConflicts.slice(0, 3);
const compactText = (value: string, max = 120) =>
  value.length > max ? `${value.slice(0, max)}...` : value;
const groupedByOpinionForDisplay = useMemo(
  () =>
    groupedByOpinion.map((group) => ({
      ...group,
      issue: group.issue
        ? {
            ...group.issue,
            content: compactText(group.issue.content, 50),
          }
        : group.issue,
    })),
  [groupedByOpinion]
);
const normalizeQuestionText = (value?: string | null) =>
  (value ?? "").replace(/[。、．.！？!?「」『』【】（）()[\]\s]/g, "");
const questionCardText = stripExternalAiInternalSections(thread?.original_post);
const originalIssueText = stripExternalAiInternalSections(thread?.original_post);
const normalizedOriginalIssueText = normalizeQuestionText(originalIssueText);
const normalizedQuestionCardText = normalizeQuestionText(questionCardText);
const isDuplicateQuestionCard =
  Boolean(originalIssueText) &&
  normalizedOriginalIssueText === normalizedQuestionCardText;
const shouldShowQuestionCard = Boolean(questionCardText) && !isDuplicateQuestionCard;
const shouldShowMacroEconomyGuide =
  String(thread?.category ?? "").trim() === "経済・政策";
const initialPostCount = summary?.counts?.total ?? posts.length;
const showInitialDiscussionNote = initialPostCount <= 3;
const storedSummaryText = summary?.summary_text?.trim() ?? "";
const useExternalAiAnswerFallback = shouldPreferExternalAiAnswer(
  storedSummaryText,
  externalAiAnswerFromThreadContent,
  thread?.title,
  thread?.original_post,
  postContentTextForThemeCheck
);
const displaySummaryText = useExternalAiAnswerFallback
  ? externalAiAnswerFromThreadContent
  : storedSummaryText;
const summaryProvisionalAnswer = useExternalAiAnswerFallback
  ? externalAiAnswerFromThreadContent
  : summary?.provisional_answer?.trim() ?? "";
const naturalSummaryAnswer = isTemplateProvisionalAnswer(summaryProvisionalAnswer)
  ? displaySummaryText || externalAiAnswerFromThreadContent
  : summaryProvisionalAnswer;
const provisionalAnswerText =
  naturalSummaryAnswer ||
  externalAiAnswerFromThreadContent ||
  "まだAIの暫定回答はありません。AIまとめを確認・更新すると表示されます。";
const layeredProvisionalAnswer =
  parseLayeredProvisionalAnswer(provisionalAnswerText);
const classifiedSummaryKeyPoints = summary?.key_points;
const normalizeClassifiedSummaryItems = (items?: string[], limit = 3) =>
  Array.isArray(items)
    ? Array.from(
        new Set(items.map((item) => item.trim()).filter(Boolean))
      ).slice(0, limit)
    : [];
const classifiedSummaryConclusions = normalizeClassifiedSummaryItems(
  classifiedSummaryKeyPoints?.current_tentative_conclusion,
  3
);
const isClassificationBasedSummary =
  summary?.summary_type === "thread_summary_from_classifications";
const storedSummaryLayers = parseLayeredProvisionalAnswer(storedSummaryText);
const classifiedConclusionText = (
  classifiedSummaryConclusions[0] ||
  summary?.provisional_answer?.trim() ||
  storedSummaryLayers.simple ||
  storedSummaryText ||
  provisionalAnswerText
)
  .replace(/\s+/g, " ")
  .trim();
const classifiedSummaryHighlights = Array.from(
  new Set(
    [
      ...normalizeClassifiedSummaryItems(
        classifiedSummaryKeyPoints?.changes_from_initial_answer,
        3
      ),
      ...normalizeClassifiedSummaryItems(
        classifiedSummaryKeyPoints?.discussion_position,
        3
      ),
      ...normalizeClassifiedSummaryItems(classifiedSummaryKeyPoints?.needs_review, 3),
    ].filter(Boolean)
  )
).slice(0, 3);
const classifiedSummaryEasyText = summary?.easy_summary_text?.trim() ?? "";
const classifiedSummaryDetailFallbackText =
  classifiedSummaryConclusions.length > 0 ? "" : summary?.summary_text?.trim() ?? "";
const classifiedSummarySections = [
  {
    key: "discussion-position",
    title: "議論後の現在地",
    items: classifiedSummaryKeyPoints?.discussion_position,
  },
  {
    key: "added-premises",
    title: "追加された前提",
    items: classifiedSummaryKeyPoints?.added_premises,
  },
  {
    key: "added-evidence",
    title: "追加された根拠",
    items: classifiedSummaryKeyPoints?.added_evidence,
  },
  {
    key: "main-rebuttals",
    title: "主な反論",
    items: classifiedSummaryKeyPoints?.main_rebuttals,
  },
  {
    key: "verification-metrics",
    title: "検証すべき指標",
    items: classifiedSummaryKeyPoints?.verification_metrics,
  },
  {
    key: "needs-review",
    title: "要確認",
    items: classifiedSummaryKeyPoints?.needs_review,
  },
  {
    key: "changes-from-initial-answer",
    title: "初期回答からの変化",
    items: classifiedSummaryKeyPoints?.changes_from_initial_answer,
  },
]
  .map((section) => ({
    ...section,
    items: normalizeClassifiedSummaryItems(section.items, 3),
  }))
  .filter((section) => section.items.length > 0);
const overviewVerificationMetrics = normalizeClassifiedSummaryItems(
  classifiedSummaryKeyPoints?.verification_metrics,
  3
);
const shouldShowClassifiedSummary =
  isClassificationBasedSummary ||
  Boolean(classifiedSummaryEasyText) ||
  Boolean(classifiedSummaryDetailFallbackText) ||
  classifiedSummaryConclusions.length > 0 ||
  classifiedSummaryHighlights.length > 0 ||
  classifiedSummarySections.length > 0;
const shouldShowClassifiedSummaryDetails =
  classifiedSummaryHighlights.length > 0 || classifiedSummarySections.length > 0;

/*
const oldPremiseSectionTitle = hasInferred(displayPremiseItems)
  ? "考えられる前提"
  : "主な前提";
const reasonSectionTitle = hasInferred(displayReasonItems)
  ? "考えられる根拠"
  : "主な根拠";
const conflictSectionTitle = displayConflicts.some(
  (conflict) => conflict.source_type === "inferred"
)
  ? "想定される対立"
  : "主な対立";
*/

  async function handleSaveThreadBookmark() {
    if (!thread || !tenant) return;

    setBookmarkSaveState({
      loading: true,
      saved: false,
      error: "",
    });

    try {
      const response = await fetch("/api/forum/save-private-log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenantSlug: tenant,
          sourceType: "thread_bookmark",
          candidate: {
            title: thread.title,
            question: thread.original_post || "",
            ai_answer:
              summary?.provisional_answer || summary?.summary_text || "",
            category: thread.category || "",
            node: "",
          },
          relatedThread: {
            id: thread.id,
            title: thread.title,
            category: thread.category || "",
            ai_summary:
              summary?.summary_text || summary?.provisional_answer || "",
            reason: "スレッド詳細ページからあとで読むに保存",
          },
          relatedThreadUrl: `/${tenant}/forum/thread/${thread.id}`,
          memo: "",
        }),
      });

      const result = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;

      if (!response.ok || result?.success === false) {
        throw new Error(result?.error || "保存できませんでした。");
      }

      const saved = await loadThreadBookmarkState(thread.id);

      if (!saved) {
        throw new Error("保存状態を確認できませんでした。");
      }
    } catch (bookmarkError) {
      setBookmarkSaveState({
        loading: false,
        saved: false,
        error:
          bookmarkError instanceof Error
            ? bookmarkError.message
            : "保存できませんでした。",
      });
    }
  }

  async function handleShare() {
    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title: thread?.title,
          text: thread?.original_post?.slice(0, 80),
          url,
        });
        return;
      }

      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleNodeClick(type: "論点" | "前提" | "根拠", text: string) {
    setSelectedGuide({
      type,
      text,
    });
    setPostRole("opinion");
    setReplyToOpinionId(null);

    setLoadingRelated(true);
    setRelatedPosts([]);
    setRelatedSummary(null);

    try {
      const res = await fetch("/api/forum/search-related", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          threadId,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result?.error || "関連検索失敗");
      }

      setRelatedPosts(result.posts || []);
      setRelatedSummary(result.summary || null);

setTimeout(() => {
  const el = document.getElementById("related-section");
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}, 100);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "関連検索失敗");
    } finally {
      setLoadingRelated(false);
    }
  }



  async function loadThread() {
    setLoading(true);
    setError(null);


    try {
      const res = await fetch(`/api/forum/thread-detail?threadId=${threadId}`, {
        method: "GET",
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result?.error || "読込失敗");
      }

      setThread(result.thread ?? null);
      setPosts(result.posts ?? []);
      setSummary(result.summary ?? null);
      setConflicts(
        Array.isArray(result.conflict_pairs) ? result.conflict_pairs : []
      );
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "読込失敗");
    } finally {
      setLoading(false);
    }
  }

  async function handleClassifyPosts() {
    if (classifyLoading || !threadId) return;

    setClassifyLoading(true);
    setClassifyMessage(null);

    try {
      const res = await fetch("/api/forum/admin/classify-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thread_id: threadId,
          max_items: 5,
          force_reclassify: false,
        }),
      });
      const result = await res.json().catch(() => null);

      if (!res.ok || result?.ok === false) {
        if (res.status === 401 || res.status === 403) {
          setIsForumAdmin(false);
          throw new Error(
            "管理セッションが切れました。管理トップで再認証してください。"
          );
        }

        throw new Error(result?.error || "コメントのAI分類に失敗しました。");
      }

      const processed = Number(result?.processed_count ?? 0);
      const success = Number(result?.success_count ?? 0);
      const skipped = Number(result?.skipped_count ?? 0);
      const failed = Number(result?.failed_count ?? 0);
      const failedNote = failed > 0 ? " 一部失敗があります。" : "";

      setClassifyMessage(
        `AI分類完了: 処理 ${processed}件 / 成功 ${success}件 / skip ${skipped}件 / 失敗 ${failed}件。${failedNote}`
      );
      await loadThread();
    } catch (e: any) {
      console.error(e);
      setClassifyMessage(e?.message || "コメントのAI分類に失敗しました。");
    } finally {
      setClassifyLoading(false);
    }
  }

  async function handleRebuildSummaryFromClassifications() {
    if (rebuildSummaryLoading || !threadId) return;

    setRebuildSummaryLoading(true);
    setRebuildSummaryMessage(null);

    try {
      const res = await fetch(
        "/api/forum/admin/thread-summary/rebuild-from-classifications",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            thread_id: threadId,
          }),
        }
      );
      const result = await res.json().catch(() => null);

      if (!res.ok || result?.ok === false) {
        if (res.status === 401 || res.status === 403) {
          setIsForumAdmin(false);
          throw new Error(
            "管理セッションが切れました。管理トップで再認証してください。"
          );
        }

        throw new Error(result?.error || "AI再総括に失敗しました。");
      }

      const classifiedCount = Number(result?.classified_count ?? 0);
      const usedCount = Number(result?.used_count ?? 0);
      setRebuildSummaryMessage(
        `AI再総括しました（分類済みコメント ${classifiedCount}件 / 使用 ${usedCount}件）。`
      );
      await loadThread();
    } catch (e: any) {
      console.error(e);
      setRebuildSummaryMessage(e?.message || "AI再総括に失敗しました。");
    } finally {
      setRebuildSummaryLoading(false);
    }
  }

  async function handlePost() {
    let contentToPost = "";

    if (postRole === "rebuttal") {
      const claim = rebuttalClaim.trim();
      const premise = rebuttalPremise.trim();
      const reason = rebuttalReason.trim();

      if (!claim || !premise || !reason) {
        alert("反論は『主張・前提・根拠』を全部入れて。");
        return;
      }

      contentToPost = `主張: ${claim}\n前提: ${premise}\n根拠: ${reason}`;
    } else {
      const trimmed = text.trim();

      if (!trimmed) {
        alert("投稿内容を入れて。");
        return;
      }

      contentToPost = selectedGuide
        ? `${selectedGuide.type}: ${selectedGuide.text}\n${trimmed}`
        : trimmed;
    }

    if (!threadId) {
      alert("threadIdがない。");
      return;
    }

if (postRole === "rebuttal" && !replyToOpinionId) {
  alert("反論は、先に『この意見への反論』を選んでから投稿して。");
  return;
}

    setPosting(true);
    setError(null);
    setPostLoginRequired(false);
    setPostSuccessMessage(null);

    try {
      const res = await fetch("/api/forum/add-post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          threadId,
          content: contentToPost,
          postRole,
          stance_label: stanceLabel,
          parentOpinionId: replyToOpinionId,
          prediction_flag: predictionFlag,
          prediction_target: predictionFlag ? predictionTarget : null,
          prediction_deadline:
            predictionFlag && predictionDeadline ? predictionDeadline : null,
          prediction_result: predictionFlag ? "pending" : null,
        }),
      });

      const result = await res.json();

      if (res.status === 401 || result?.error === "Login required.") {
        saveReplyDraft();
        setPostLoginRequired(true);
        return;
      }

      if (!res.ok) {
        throw new Error(result?.error || "投稿失敗");
      }

      const createdPostId =
        typeof result?.postId === "string" ? result.postId : "";

      setReplyToOpinionId(null);
      setText("");
      setPostRole("opinion");
      setStanceLabel("unknown");
      setPredictionFlag(false);
      setPredictionTarget("");
      setPredictionDeadline("");
      setSelectedGuide(null);
      setSearchText("");
      setSortType("new");
      setPostSuccessMessage("投稿しました。新着投稿として表示しています。");
      setPostLoginRequired(false);
      clearReplyDraft();
      await loadThread();

      if (createdPostId && typeof window !== "undefined") {
        window.setTimeout(() => {
          const elementId = `post-${createdPostId}`;
          const el = document.getElementById(elementId);
          if (!el) return;

          window.history.replaceState(null, "", `#${elementId}`);
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 200);
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "投稿失敗");
      alert(e?.message || "投稿失敗");
    } finally {
      setPosting(false);
    }
  }

  async function handleFeedback(postId: string, feedbackType: string) {
    if (!threadId) {
      alert("threadIdがない。");
      return;
    }

    setFeedbackLoadingPostId(postId);
    setError(null);

    try {
      const res = await fetch("/api/forum/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          postId,
          feedbackType,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result?.error || "feedback保存失敗");
      }

      if (result.explanation) {
        setExplanations((prev) => ({
          ...prev,
          [String(postId)]: result.explanation,
        }));
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "feedback保存失敗");
      alert(e?.message || "feedback保存失敗");
    } finally {
      setFeedbackLoadingPostId(null);
    }
  }

  async function handleHidePost(postId: string, options?: { hideThread?: boolean }) {
    if (
      !confirm(
        "この投稿を非表示にしますか？\n※ 後から復元機能を追加予定です"
      )
    ) {
      return;
    }

    const hideThread = options?.hideThread === true;
    const res = await fetch(`/api/forum/posts/${postId}/delete`, {
      method: "PATCH",
      ...(hideThread
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ hideThread: true }),
          }
        : {}),
    });

    const result = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(result?.error || "投稿の非表示に失敗しました");
      return;
    }

    if (hideThread) {
      router.push(`/${tenant}/forum`);
      return;
    }

    await loadThread();
  }

function jumpToMainIssues() {
  const details = document.getElementById("main-issues-section") as HTMLDetailsElement | null;
  if (details) details.open = true;
  const el = document.getElementById("main-issues");
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function jumpToPostForm() {
  setPostRole("opinion");
  setReplyToOpinionId(null);
  setSelectedGuide(null);
  setStanceLabel("unknown");
  setPredictionFlag(false);
  setPredictionTarget("");
  setPredictionDeadline("");
  setRebuttalClaim("");
  setRebuttalPremise("");
  setRebuttalReason("");
  setPostLoginRequired(false);
  setPostSuccessMessage(null);
  const el = document.getElementById("post-form");
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function jumpToReplies() {
  const el = document.getElementById("thread-replies");
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function discussionCardHint(text: string) {
  const isSelected = selectedGuide?.text.trim() === text.trim();
  const hasReadableTarget =
    isSelected && (relatedPosts.length > 0 || Boolean(relatedSummary?.trim()));

  return hasReadableTarget ? "読む / 投稿する" : "投稿する";
}

function renderDiscussionCard({
  keyId,
  text,
  guideType,
  titlePrefix = "",
  style,
  variant,
}: {
  keyId: string;
  text: string;
  guideType: "論点" | "前提" | "根拠";
  titlePrefix?: string;
  style?: CSSProperties;
  variant?: "default" | "danger" | "info";
}) {
  const trimmedText = text.trim();
  const isLong = trimmedText.length > DISCUSSION_CARD_TEXT_LIMIT;
  const isExpanded = expandedDiscussionTextMap[keyId] === true;
  const displayText =
    isLong && !isExpanded
      ? compactText(trimmedText, DISCUSSION_CARD_TEXT_LIMIT)
      : trimmedText;

  return (
    <div key={keyId} style={{ display: "grid", gap: 6 }}>
      <SelectableCardButton
        title={`${titlePrefix}${displayText}`}
        hint={discussionCardHint(text)}
        variant={variant}
        onClick={() => handleNodeClick(guideType, text)}
        style={style}
      />

      {isLong && (
        <button
          type="button"
          onClick={() =>
            setExpandedDiscussionTextMap((current) => ({
              ...current,
              [keyId]: !current[keyId],
            }))
          }
          style={{
            justifySelf: "start",
            border: "1px solid #cbd5e1",
            borderRadius: 999,
            background: "#fff",
            color: "#0f4aa1",
            cursor: "pointer",
            fontSize: currentFont.base * 0.9,
            fontWeight: 800,
            padding: "5px 10px",
          }}
        >
          {isExpanded ? "短く表示" : "全文を見る"}
        </button>
      )}
    </div>
  );
}


  return (
    <main
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: "24px 16px 80px",
        fontSize: currentFont.base,
        lineHeight: 1.7,
      }}
    >

<a
  href="#"
  style={{
    display: "none",
    marginBottom: 12,
    color: "#0d47a1",
    fontWeight: 700,
    textDecoration: "none",
  }}
>
  管理画面
</a>




      <div
        style={{
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <LinkButton href={`/${tenant}/forum`} variant="subtle">
            ← 掲示板トップに戻る
          </LinkButton>
          <LinkButton href={`/${tenant}/forum/guide`} variant="subtle">
            使い方
          </LinkButton>
        </div>
        <div style={{ position: "relative" }}>
          <button
            type="button"
            aria-label="メニューを開く"
            aria-expanded={isThreadMenuOpen}
            onClick={() => setIsThreadMenuOpen((open) => !open)}
            style={{
              minWidth: 44,
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "8px 12px",
              background: isThreadMenuOpen ? "#111827" : "#ffffff",
              color: isThreadMenuOpen ? "#ffffff" : "#111827",
              cursor: "pointer",
              fontSize: 18,
              fontWeight: 800,
              lineHeight: 1,
            }}
          >
            ☰
          </button>
          {isThreadMenuOpen && (
            <nav
              aria-label="スレッド詳細メニュー"
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                zIndex: 20,
                minWidth: 220,
                maxWidth: "calc(100vw - 32px)",
                display: "grid",
                gap: 6,
                padding: 10,
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#111827",
                boxShadow: "0 12px 30px rgba(15, 23, 42, 0.18)",
              }}
            >
              {[
                { href: `/${tenant}/forum/guide`, label: "使い方" },
                { href: `/${tenant}/forum`, label: "掲示板トップ" },
                { href: `/${tenant}/forum/private-logs`, label: "あとで読む管理" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsThreadMenuOpen(false)}
                  style={{
                    display: "block",
                    padding: "9px 10px",
                    borderRadius: 8,
                    color: "#111827",
                    textDecoration: "none",
                    fontWeight: 800,
                  }}
                >
                  {item.label}
                </Link>
              ))}
              {isForumBetaLoggedIn ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "9px 10px",
                    border: 0,
                    borderRadius: 8,
                    background: "#fef2f2",
                    color: "#991b1b",
                    cursor: "pointer",
                    font: "inherit",
                    fontWeight: 800,
                    textAlign: "left",
                  }}
                >
                  ログアウト
                </button>
              ) : (
                <Link
                  href={`/${tenant}/forum/login?next=${encodeURIComponent(
                    `/${tenant}/forum/thread/${threadId}`
                  )}`}
                  onClick={() => setIsThreadMenuOpen(false)}
                  style={{
                    display: "block",
                    padding: "9px 10px",
                    borderRadius: 8,
                    color: "#111827",
                    textDecoration: "none",
                    fontWeight: 800,
                  }}
                >
                  ログイン
                </Link>
              )}
            </nav>
          )}
        </div>
      </div>

      <div
        style={{
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <span style={{ marginRight: 4 }}>文字サイズ：</span>

        <PrimaryButton
          variant={fontSize === "small" ? "primary" : "secondary"}
          onClick={() => setFontSize("small")}
          style={{ padding: "6px 10px" }}
        >
          小
        </PrimaryButton>

        <PrimaryButton
          variant={fontSize === "medium" ? "primary" : "secondary"}
          onClick={() => setFontSize("medium")}
          style={{ padding: "6px 10px" }}
        >
          中
        </PrimaryButton>

        <PrimaryButton
          variant={fontSize === "large" ? "primary" : "secondary"}
          onClick={() => setFontSize("large")}
          style={{ padding: "6px 10px" }}
        >
          大
        </PrimaryButton>
      </div>

      {loading ? (
        <div>読み込み中...</div>
      ) : error ? (
        <div style={{ color: "#b00020", fontWeight: 700 }}>{error}</div>
      ) : !thread ? (
        <div style={{ color: "#b00020", fontWeight: 700 }}>
          スレッドが見つからない
        </div>
      ) : (
        <>


<SectionCard variant="info">
<div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  }}
>
            <h1
              style={{
                margin: 0,
                fontSize: threadTitleFontSize,
                fontWeight: 800,
                lineHeight: 1.4,
                color: "#111",
                flex: "1 1 280px",
              }}
            >
              {thread.title}
            </h1>
  {mainDeletablePost && (
    <div
      style={{
        display: "grid",
        justifyItems: "end",
        gap: 4,
        flex: "0 1 260px",
      }}
    >
    <PrimaryButton
      onClick={(e) => {
        e.stopPropagation();
        void handleHidePost(mainDeletablePost.id, { hideThread: true });
      }}
      style={{
        padding: "8px 12px",
        background: "#fef2f2",
        color: "#991b1b",
        border: "1px solid #fecaca",
      }}
    >
      このスレッドを非表示にする
    </PrimaryButton>
      <span
        style={{
          color: "#64748b",
          fontSize: currentFont.base * 0.82,
          lineHeight: 1.5,
          textAlign: "right",
        }}
      >
        この操作ではスレッドを非表示にします。完全削除は管理者のみ、管理画面から行えます。
      </span>
    </div>
  )}
</div>
<div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
  <PrimaryButton
    onClick={(e) => {
      e.stopPropagation();
      handleShare();
    }}
    style={{ padding: "8px 12px" }}
  >
    共有
  </PrimaryButton>

<LinkButton
  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
    `${thread.title} ${currentUrl}`
  )}`}
  target="_blank"
  rel="noopener noreferrer"
>
  X
</LinkButton>

  <PrimaryButton
    onClick={(e) => {
      e.stopPropagation();
      handleSaveThreadBookmark();
    }}
    disabled={bookmarkSaveState.loading || bookmarkSaveState.saved}
    style={{ padding: "8px 12px" }}
  >
    {bookmarkSaveState.loading
      ? "保存中..."
      : bookmarkSaveState.saved
      ? "保存済み"
      : "あとで読むに保存"}
  </PrimaryButton>

  {bookmarkSaveState.error && (
    <span style={{ color: "#991b1b", fontWeight: 700 }}>
      保存できませんでした：{bookmarkSaveState.error}
    </span>
  )}

  {copied && <span style={{ color: "#2e7d32" }}>コピーした</span>}
</div>

<div
  style={{
    marginTop: 14,
    padding: "12px 14px",
    border: "1px solid #dbeafe",
    borderRadius: 10,
    background: "#eff6ff",
    color: "#1e3a8a",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
    lineHeight: 1.7,
  }}
>
  <div style={{ flex: "1 1 280px", fontSize: currentFont.base }}>
    まず投稿者の問題提起を読み、必要ならAI整理を参考にしてください。他の人の意見を読んだり、自分の意見を書いたりできます。
  </div>
  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
    <PrimaryButton
      variant="secondary"
      onClick={jumpToReplies}
      style={{
        padding: "8px 12px",
        border: "1px solid #bfdbfe",
        color: "#1d4ed8",
        background: "#ffffff",
      }}
    >
      投稿・返信を見る
    </PrimaryButton>
    <PrimaryButton
      onClick={jumpToPostForm}
      style={{
        padding: "8px 12px",
        background: "#1d4ed8",
        color: "#ffffff",
        border: "1px solid #1d4ed8",
      }}
    >
      意見を書く
    </PrimaryButton>
  </div>
</div>

<div style={{ marginTop: 8, fontSize: currentFont.base * 0.9, color: "#666" }}>
  作成日時: {formatDate(thread.created_at)}
</div>

<div style={{ marginTop: 4, fontSize: currentFont.base * 0.9, color: "#666" }}>
  カテゴリ：{thread.category ?? "未設定"}
</div>

<div
  style={{
    marginTop: 8,
    fontSize: currentFont.base,
    fontWeight: 700,
    color: "#0d47a1",
  }}
>
  {averageLogicScore > 0 ? (
    <>
      議論全体の論理性: {averageLogicScore}
      <span
        style={{
          marginLeft: 8,
          fontSize: currentFont.base * 0.9,
          fontWeight: 500,
          color: "#666",
        }}
      >
        {averageLogicScore >= 80
          ? "（高品質）"
          : averageLogicScore >= 60
          ? "（標準）"
          : "（要改善）"}
      </span>
    </>
  ) : (
    <>議論全体の論理性: AI再評価前</>
  )}
</div>

<div
  style={{
    marginTop: 4,
    fontSize: currentFont.base * 0.95,
    color: maxLogicScore && maxLogicScore >= 80 ? "#2e7d32" : "#555",
    fontWeight: maxLogicScore && maxLogicScore >= 80 ? 700 : 500,
  }}
>
  最高評価の投稿: {maxLogicScore ?? "AI再評価前"}
</div>

  <div>

{originalIssueText && (
  <div
    style={{
      marginTop: 16,
      padding: 14,
      border: "1px solid #cbd5e1",
      borderRadius: 10,
      background: "#ffffff",
      color: "#111",
    }}
  >
    <div
      style={{
        margin: 0,
        fontSize: currentFont.title,
        fontWeight: 800,
        lineHeight: 1.4,
        color: "#111",
      }}
    >
      投稿者の問題提起
    </div>
    <div
      style={{
        marginTop: 8,
        color: "#334155",
        fontSize: currentFont.base,
        lineHeight: 1.7,
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
      }}
    >
      {compactText(originalIssueText, 360)}
    </div>
    <div
      style={{
        marginTop: 8,
        color: "#64748b",
        fontSize: currentFont.base * 0.85,
        lineHeight: 1.6,
      }}
    >
      投稿者が最初に出した問題意識です。AI整理の前に、議論の出発点として確認できます。
    </div>
  </div>
)}

{shouldShowQuestionCard && (
  <div
    style={{
      marginTop: 16,
      padding: 14,
      border: "1px solid #dbe3ef",
      borderRadius: 10,
      background: "#f8fafc",
      color: "#111",
    }}
  >
    <div
      style={{
        margin: 0,
        fontSize: currentFont.title,
        fontWeight: 800,
        lineHeight: 1.4,
        color: "#111",
      }}
    >
      AIが整理した問い
    </div>
    <div
      style={{
        color: "#334155",
        fontSize: currentFont.base,
        lineHeight: 1.7,
      }}
    >
      {compactText(questionCardText, 280)}
    </div>
    <div
      style={{
        marginTop: 8,
        color: "#64748b",
        fontSize: currentFont.base * 0.85,
        lineHeight: 1.6,
      }}
    >
      投稿者の問題提起を、AIが読みやすい問いとして整理したものです。
    </div>
  </div>
)}

<div
  style={{
    marginTop: 16,
    padding: 16,
    border: "1px solid #fb923c",
    borderRadius: 12,
    background: "#fff7ed",
    color: "#111",
  }}
>
  <h2
    style={{
      margin: 0,
      fontSize: currentFont.title,
      fontWeight: 900,
      lineHeight: 1.4,
      color: "#9a3412",
    }}
  >
    AIの暫定整理
  </h2>

  <div
    style={{
      marginTop: 8,
      color: "#7c2d12",
      fontSize: currentFont.base * 0.9,
      lineHeight: 1.6,
      fontWeight: 700,
    }}
  >
    投稿内容とAI整理をもとにした暫定的な整理です。今後の反論や補足で更新される可能性があります。
  </div>

  {isClassificationBasedSummary ? (
    <p
      style={{
        margin: "10px 0 0",
        color: "#333",
        fontSize: currentFont.base,
        lineHeight: 1.7,
      }}
    >
      {compactText(classifiedConclusionText, 260)}
    </p>
  ) : layeredProvisionalAnswer.hasLayers ? (
    <div
      style={{
        display: "grid",
        gap: 12,
        marginTop: 10,
        color: "#333",
        fontSize: currentFont.base,
        lineHeight: 1.7,
      }}
    >
      {layeredProvisionalAnswer.simple && (
        <section>
          <div
            style={{
              color: "#9a3412",
              fontWeight: 900,
              marginBottom: 4,
            }}
          >
            【誰でも分かる説明】
          </div>
          <div style={{ whiteSpace: "pre-line" }}>
            {layeredProvisionalAnswer.simple}
          </div>
        </section>
      )}

      {layeredProvisionalAnswer.detailed && (
        <section>
          <div
            style={{
              color: "#9a3412",
              fontWeight: 900,
              marginBottom: 4,
            }}
          >
            【もう少し詳しい説明】
          </div>
          <div style={{ whiteSpace: "pre-line" }}>
            {layeredProvisionalAnswer.detailed}
          </div>
        </section>
      )}

      {layeredProvisionalAnswer.deep && (
        <details
          style={{
            borderTop: "1px solid #fed7aa",
            paddingTop: 10,
          }}
        >
          <summary
            style={{
              color: "#9a3412",
              cursor: "pointer",
              fontWeight: 900,
            }}
          >
            もっと詳しく見る
          </summary>
          <div style={{ marginTop: 10 }}>
            <div
              style={{
                color: "#9a3412",
                fontWeight: 900,
                marginBottom: 4,
              }}
            >
              【深層・専門的な補足】
            </div>
            <div style={{ whiteSpace: "pre-line" }}>
              {layeredProvisionalAnswer.deep}
            </div>
          </div>
        </details>
      )}
    </div>
  ) : (
    <p
      style={{
        margin: "8px 0 10px",
        color: "#333",
        fontSize: currentFont.base,
        lineHeight: 1.7,
        whiteSpace: "pre-line",
      }}
    >
      {provisionalAnswerText}
    </p>
  )}

</div>

{(overviewPremises.length > 0 || overviewReasons.length > 0) && (
  <div
    style={{
      marginTop: 16,
      padding: 14,
      border: "1px solid #dbe3ef",
      borderRadius: 10,
      background: "#fff",
      color: "#111",
    }}
  >
    <h2
      style={{
        margin: 0,
        fontSize: currentFont.title,
        fontWeight: 800,
        lineHeight: 1.4,
        color: "#111",
      }}
    >
      確認すべき前提・根拠
    </h2>
    <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
      {overviewPremises.length > 0 && (
        <div>
          <div style={{ fontWeight: 800, marginBottom: 4, color: "#334155" }}>
            確認すべき前提
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, color: "#333", fontSize: currentFont.base, lineHeight: 1.7 }}>
            {overviewPremises.map((premise, index) => (
              <li key={`overview-premise-${index}`}>{compactText(premise, 160)}</li>
            ))}
          </ul>
        </div>
      )}
      {overviewReasons.length > 0 && (
        <div>
          <div style={{ fontWeight: 800, marginBottom: 4, color: "#334155" }}>
            主な理由・根拠
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, color: "#333", fontSize: currentFont.base, lineHeight: 1.7 }}>
            {overviewReasons.map((reason, index) => (
              <li key={`overview-reason-${index}`}>{compactText(reason, 160)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  </div>
)}

{overviewConflicts.length > 0 && (
  <div
    style={{
      marginTop: 16,
      padding: 14,
      border: "1px solid #fee2e2",
      borderRadius: 10,
      background: "#fff7f7",
      color: "#111",
    }}
  >
    <h2
      style={{
        margin: 0,
        fontSize: currentFont.title,
        fontWeight: 800,
        lineHeight: 1.4,
        color: "#7f1d1d",
      }}
    >
      反論・リスク
    </h2>
    <ul style={{ margin: "10px 0 0", paddingLeft: 20, color: "#333", fontSize: currentFont.base, lineHeight: 1.7 }}>
      {overviewConflicts.map((conflict, index) => (
        <li key={`overview-conflict-${index}`}>
          {compactText(conflict.rebuttal || conflict.opinion, 160)}
        </li>
      ))}
    </ul>
  </div>
)}

{overviewVerificationMetrics.length > 0 && (
  <div
    style={{
      marginTop: 16,
      padding: 14,
      border: "1px solid #fde68a",
      borderRadius: 10,
      background: "#fffbeb",
      color: "#111",
    }}
  >
    <h2
      style={{
        margin: 0,
        fontSize: currentFont.title,
        fontWeight: 800,
        lineHeight: 1.4,
        color: "#78350f",
      }}
    >
      検証ポイント
    </h2>
    <ul style={{ margin: "10px 0 0", paddingLeft: 20, color: "#333", fontSize: currentFont.base, lineHeight: 1.7 }}>
      {overviewVerificationMetrics.map((metric, index) => (
        <li key={`overview-verification-metric-${index}`}>
          {compactText(metric, 160)}
        </li>
      ))}
    </ul>
  </div>
)}

{shouldShowClassifiedSummary && (
  <div
    style={{
      marginTop: 16,
      padding: 14,
      border: "1px solid #bfdbfe",
      borderRadius: 10,
      background: "#f8fbff",
      color: "#111",
    }}
  >
    <h2
      style={{
        margin: 0,
        fontSize: currentFont.title,
        fontWeight: 900,
        lineHeight: 1.4,
        color: "#1e3a8a",
      }}
    >
      AI再総括（分類済みコメント反映）
    </h2>
    <div
      style={{
        marginTop: 6,
        color: "#475569",
        fontSize: currentFont.base * 0.9,
        lineHeight: 1.6,
      }}
    >
      追加コメントや分類済み意見を踏まえて、AIが議論後の変化を再整理した内容です。分類は補助判断であり、確定判定ではありません。
    </div>

    {classifiedSummaryEasyText && (
      <div
        style={{
          marginTop: 12,
          border: "1px solid #bfdbfe",
          borderRadius: 10,
          background: "#eff6ff",
          padding: 12,
        }}
      >
        <div
          style={{
            color: "#1e3a8a",
            fontSize: currentFont.base,
            fontWeight: 900,
            lineHeight: 1.4,
            marginBottom: 6,
          }}
        >
          誰でも分かりやすい説明
        </div>
        <div
          style={{
            color: "#1e293b",
            fontSize: currentFont.base * 0.95,
            lineHeight: 1.7,
            whiteSpace: "pre-line",
          }}
        >
          {compactText(classifiedSummaryEasyText, 180)}
        </div>
      </div>
    )}

    {(classifiedSummaryConclusions.length > 0 ||
      classifiedSummaryDetailFallbackText) && (
      <div
        style={{
          marginTop: 10,
          border: "1px solid #dbeafe",
          borderRadius: 10,
          background: "#ffffff",
          padding: 12,
        }}
      >
        <div
          style={{
            color: "#1e40af",
            fontSize: currentFont.base * 0.95,
            fontWeight: 900,
            lineHeight: 1.4,
            marginBottom: 6,
          }}
        >
          もう少し詳しい説明
        </div>
        {classifiedSummaryConclusions.length > 0 ? (
        <ul
          style={{
            margin: 0,
            paddingLeft: 18,
            color: "#1e293b",
            fontSize: currentFont.base * 0.95,
            lineHeight: 1.7,
          }}
        >
          {classifiedSummaryConclusions.map((item, index) => (
            <li key={`classified-conclusion-${index}`}>
              {compactText(item, 150)}
            </li>
          ))}
        </ul>
        ) : (
          <div
            style={{
              color: "#1e293b",
              fontSize: currentFont.base * 0.95,
              lineHeight: 1.7,
              whiteSpace: "pre-line",
            }}
          >
            {compactText(classifiedSummaryDetailFallbackText, 260)}
          </div>
        )}
      </div>
    )}

    {shouldShowClassifiedSummaryDetails && (
      <details
        style={{
          marginTop: 10,
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          background: "#ffffff",
          padding: 12,
        }}
      >
        <summary
          style={{
            color: "#334155",
            fontSize: currentFont.base * 0.95,
            fontWeight: 900,
            lineHeight: 1.4,
            cursor: "pointer",
          }}
        >
          もっと詳しく見る
        </summary>

        {classifiedSummaryHighlights.length > 0 && (
          <div
          style={{
              marginTop: 10,
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              background: "#f8fafc",
              padding: 10,
          }}
        >
          <div
            style={{
                color: "#334155",
                fontSize: currentFont.base * 0.92,
              fontWeight: 900,
              lineHeight: 1.4,
              marginBottom: 6,
            }}
          >
              今回の重要ポイント
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
                color: "#475569",
              fontSize: currentFont.base * 0.92,
              lineHeight: 1.65,
            }}
          >
              {classifiedSummaryHighlights.map((item, index) => (
                <li key={`classified-highlight-${index}`}>
                  {compactText(item, 130)}
                </li>
            ))}
          </ul>
          </div>
        )}

        {classifiedSummarySections.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
              gap: 10,
              marginTop: 12,
            }}
          >
            {classifiedSummarySections.map((section) => (
              <section
                key={section.key}
                style={{
                  border: "1px solid #dbeafe",
                  borderRadius: 8,
                  background: "#ffffff",
                  padding: 10,
                }}
              >
                <div
                  style={{
                    color: "#1e40af",
                    fontSize: currentFont.base * 0.9,
                    fontWeight: 900,
                    lineHeight: 1.4,
                    marginBottom: 6,
                  }}
                >
                  {section.title}
                </div>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 18,
                    color: "#334155",
                    fontSize: currentFont.base * 0.92,
                    lineHeight: 1.65,
                  }}
                >
                  {section.items.map((item, index) => (
                    <li key={`${section.key}-${index}`}>{compactText(item, 130)}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </details>
    )}
  </div>
)}

</div>

</SectionCard>
{/* ←ここで完全に閉じる */}

{shouldShowMacroEconomyGuide && (
  <SectionCard variant="white" style={{ marginTop: 24 }}>
    <SectionTitle style={{ fontSize: currentFont.title, color: "#111827" }}>
      マクロ経済で見るための確認ポイント
    </SectionTitle>

    <p
      style={{
        margin: "0 0 14px",
        color: "#475569",
        fontSize: currentFont.base,
        lineHeight: 1.7,
      }}
    >
      経済・政策カテゴリの議論を、理論・前提・指標・反論リスクに分けて読むための固定フレームです。AIによる結論ではありません。
    </p>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
        gap: 12,
      }}
    >
      <div
        style={{
          border: "1px solid #bfdbfe",
          borderRadius: 8,
          background: "#eff6ff",
          color: "#1e3a8a",
          padding: 12,
        }}
      >
        <div style={{ fontWeight: 900, marginBottom: 8 }}>関連する理論</div>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>有効需要 / 需給ギャップ</li>
          <li>財政乗数 / 可処分所得 / 消費性向</li>
          <li>IS-LM / AD-AS / フィリップス曲線</li>
          <li>クラウディングアウト / リカードの等価定理</li>
        </ul>
      </div>

      <div
        style={{
          border: "1px solid #bbf7d0",
          borderRadius: 8,
          background: "#f0fdf4",
          color: "#14532d",
          padding: 12,
        }}
      >
        <div style={{ fontWeight: 900, marginBottom: 8 }}>前提として見ること</div>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>需要不足なのか、供給制約なのか</li>
          <li>低金利・デフレ圧力が残っているか</li>
          <li>家計、企業、政府のどこに効果が出るか</li>
          <li>理論上の効果と制度上の実行可能性を分ける</li>
        </ul>
      </div>

      <div
        style={{
          border: "1px solid #fde68a",
          borderRadius: 8,
          background: "#fffbeb",
          color: "#78350f",
          padding: 12,
        }}
      >
        <div style={{ fontWeight: 900, marginBottom: 8 }}>検証ポイント</div>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>現在の需給ギャップはマイナスか</li>
          <li>減税・給付分は消費や投資に回るか</li>
          <li>雇用、賃金、物価にどう波及するか</li>
          <li>短期効果と長期副作用を分けているか</li>
        </ul>
      </div>

      <div
        style={{
          border: "1px solid #fecaca",
          borderRadius: 8,
          background: "#fef2f2",
          color: "#7f1d1d",
          padding: 12,
        }}
      >
        <div style={{ fontWeight: 900, marginBottom: 8 }}>反論・リスク</div>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>財政赤字や将来負担への懸念</li>
          <li>供給制約下では物価上昇に回る可能性</li>
          <li>金融政策との組み合わせが弱い場合の限界</li>
          <li>分配、対象漏れ、行政コストの問題</li>
        </ul>
      </div>
    </div>
  </SectionCard>
)}


<div id="thread-replies" style={{ scrollMarginTop: 120 }}>
<SectionCard variant="white" style={{ marginTop: 24 }}>
            <SectionTitle style={{ fontSize: currentFont.title, color: "#111" }}>
              みんなの投稿・返信
            </SectionTitle>

            <p
              style={{
                marginTop: 0,
                marginBottom: 12,
                color: "#475569",
                fontSize: currentFont.base,
                lineHeight: 1.6,
              }}
            >
              他の人の意見や返信を読み、必要なら返信できます。
            </p>

            <div
              style={{
                marginBottom: 16,
                padding: "12px 14px",
                border: "1px solid #d7dde8",
                borderRadius: 10,
                background: "#f8fafc",
                color: "#111",
              }}
            >
              <div
                style={{
                  marginBottom: 10,
                  fontSize: currentFont.base,
                  fontWeight: 800,
                  color: "#111",
                }}
              >
                投稿の表示設定
              </div>

              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                  fontSize: currentFont.base,
                  color: "#444",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={hideLowScore}
                  onChange={(e) => setHideLowScore(e.target.checked)}
                />
                AI論理スコアが低い投稿を薄く表示する
              </label>

              <div style={{ marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <PrimaryButton
                  onClick={() => setSortType("score")}
                  style={{
                    background: sortType === "score" ? "#111" : "#eee",
                    color: sortType === "score" ? "#fff" : "#333",
                  }}
                >
                  AI論理スコア順
                </PrimaryButton>

                <PrimaryButton
                  onClick={() => setSortType("new")}
                  style={{
                    background: sortType === "new" ? "#111" : "#eee",
                    color: sortType === "new" ? "#fff" : "#333",
                  }}
                >
                  新着順
                </PrimaryButton>
              </div>

              <div
                style={{
                  marginTop: 4,
                  color: "#475569",
                  fontSize: currentFont.base - 2,
                  lineHeight: 1.6,
                }}
              >
                AI論理スコアは正解判定ではなく、前提・根拠・因果関係・反論耐性を見るための目安です。
              </div>
            </div>

            {visiblePosts.length === 0 ? (
              <div style={{ color: "#666" }}>まだ投稿がない。</div>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>

{isForumAdmin && (
  <div
    style={{
      border: "1px solid #d7dde8",
      borderRadius: 10,
      background: "#f8fafc",
      padding: "10px 12px",
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      color: "#334155",
      fontSize: currentFont.base * 0.9,
      lineHeight: 1.5,
    }}
  >
    <div>
      <div style={{ fontWeight: 800, color: "#0f172a" }}>管理者操作</div>
      <div>未分類コメントのAI分類と、分類済みコメントを使ったAI再総括を実行できます。</div>
      {classifyMessage && (
        <div
          style={{
            marginTop: 4,
            color:
              classifyMessage.includes("一部失敗") ||
              classifyMessage.includes("失敗しました") ||
              classifyMessage.includes("切れました")
                ? "#92400e"
                : "#475569",
            fontWeight: 700,
          }}
        >
          {classifyMessage}
        </div>
      )}
      {rebuildSummaryMessage && (
        <div
          style={{
            marginTop: 4,
            color:
              rebuildSummaryMessage.includes("失敗しました") ||
              rebuildSummaryMessage.includes("切れました") ||
              rebuildSummaryMessage.includes("not found")
                ? "#92400e"
                : "#475569",
            fontWeight: 700,
          }}
        >
          {rebuildSummaryMessage}
        </div>
      )}
    </div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      <button
        type="button"
        onClick={() => void handleClassifyPosts()}
        disabled={classifyLoading}
        style={{
          border: "1px solid #cbd5e1",
          borderRadius: 999,
          background: classifyLoading ? "#e5e7eb" : "#ffffff",
          color: classifyLoading ? "#64748b" : "#0f172a",
          cursor: classifyLoading ? "not-allowed" : "pointer",
          fontSize: currentFont.base * 0.9,
          fontWeight: 800,
          padding: "7px 12px",
          whiteSpace: "nowrap",
        }}
      >
        {classifyLoading ? "AI分類中..." : "コメントをAI分類"}
      </button>
      <button
        type="button"
        onClick={() => void handleRebuildSummaryFromClassifications()}
        disabled={rebuildSummaryLoading}
        style={{
          border: "1px solid #cbd5e1",
          borderRadius: 999,
          background: rebuildSummaryLoading ? "#e5e7eb" : "#ffffff",
          color: rebuildSummaryLoading ? "#64748b" : "#0f172a",
          cursor: rebuildSummaryLoading ? "not-allowed" : "pointer",
          fontSize: currentFont.base * 0.9,
          fontWeight: 800,
          padding: "7px 12px",
          whiteSpace: "nowrap",
        }}
      >
        {rebuildSummaryLoading ? "AI再総括中..." : "AI再総括"}
      </button>
    </div>
  </div>
)}


<OpinionView
  groupedByOpinion={groupedByOpinionForDisplay}
  bestOpinionsByIssue={bestOpinionsByIssue}
  hideLowScore={hideLowScore}
  currentFont={currentFont}
  thread={thread}
  setSelectedGuide={setSelectedGuide}
  setPostRole={setPostRole}
  setReplyToOpinionId={setReplyToOpinionId}
  explanations={explanations}
  feedbackLoadingPostId={feedbackLoadingPostId}
  handleFeedback={handleFeedback}
  onHidePost={handleHidePost}
/>

</div>
            )}

            <details style={{ marginTop: 14 }}>
              <summary
                style={{
                  cursor: "pointer",
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  border: "1px solid #d7dde8",
                  borderRadius: 8,
                  background: "#f8fafc",
                  color: "#111",
                  fontSize: currentFont.base,
                  fontWeight: 800,
                  lineHeight: 1.4,
                }}
              >
                <span>投稿を検索する</span>
                <span
                  style={{
                    fontSize: currentFont.base * 0.85,
                    color: "#64748b",
                    fontWeight: 700,
                    whiteSpace: "normal",
                  }}
                >
                  タップして開く
                </span>
              </summary>

            <div style={{ marginTop: 12 }}>

            <div>
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="投稿を検索"
                style={{
                  width: "100%",
                  border: "1px solid #ccc",
                  borderRadius: 10,
                  padding: "12px 14px",
                  fontSize: currentFont.base,
                  background: "#fff",
                  color: "#000",
                }}
              />
            </div>
            </div>
            </details>
          </SectionCard>
</div>


<SectionCard variant="white" style={{ marginTop: 24 }}>
  <div>

<details style={{ marginTop: 16 }}>
  <summary
    style={{
      cursor: "pointer",
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      padding: "12px 14px",
      border: "1px solid #d7dde8",
      borderRadius: 8,
      background: "#f8fafc",
      color: "#111",
      fontSize: currentFont.title,
      fontWeight: 800,
      lineHeight: 1.4,
      minHeight: 44,
    }}
  >
    <span>質問者の原文を見る</span>
    <span
      style={{
        fontSize: currentFont.base * 0.85,
        color: "#64748b",
        fontWeight: 700,
        whiteSpace: "normal",
      }}
    >
      AI整理前の投稿内容です
    </span>
  </summary>

  <div
    style={{
      marginTop: 10,
      padding: 14,
      border: "1px solid #dbe3ef",
      borderRadius: 10,
      background: "#fff",
      color: "#111",
    }}
  >
    <p
      style={{
        margin: "0 0 10px",
        color: "#475569",
        fontSize: currentFont.base,
        lineHeight: 1.7,
      }}
    >
      質問者が最初に投稿した内容です。AI整理前の原文です。
    </p>
    <div
      style={{
        whiteSpace: "pre-wrap",
        color: "#333",
        fontSize: currentFont.base,
        lineHeight: 1.7,
      }}
    >
      {thread.original_post}
    </div>
  </div>
</details>

<details style={{ marginTop: 16 }}>
  <summary
    style={{
      cursor: "pointer",
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      padding: "12px 14px",
      border: "1px solid #d7dde8",
      borderRadius: 8,
      background: "#f8fafc",
      color: "#111",
      fontSize: currentFont.title,
      fontWeight: 800,
      lineHeight: 1.4,
      minHeight: 44,
    }}
  >
    <span>参考：AIが最初に整理した内容を見る</span>
    <span
      style={{
        fontSize: currentFont.base * 0.85,
        color: "#64748b",
        fontWeight: 700,
        whiteSpace: "normal",
      }}
    >
      前提・根拠・反論リスクを確認できます
    </span>
  </summary>

<div
  style={{
    marginTop: 10,
    padding: 14,
    border: "1px solid #dbe3ef",
    borderRadius: 10,
    background: "#f8fafc",
    color: "#111",
  }}
>
  <h2
    style={{
      margin: 0,
      fontSize: currentFont.title,
      fontWeight: 800,
      lineHeight: 1.4,
      color: "#111",
    }}
  >
    AIが最初に整理した内容
  </h2>

  <p
    style={{
      margin: "8px 0 12px",
      color: "#555",
      fontSize: currentFont.base,
      lineHeight: 1.7,
    }}
  >
    投稿が少ない段階でAIが作った仮の整理です。現在の結論ではありません。
  </p>

  {showInitialDiscussionNote && (
    <div
      style={{
        marginBottom: 12,
        color: "#6b4e00",
        background: "#fffbeb",
        border: "1px solid #fde68a",
        borderRadius: 8,
        padding: "8px 10px",
        fontSize: currentFont.base * 0.9,
        lineHeight: 1.6,
      }}
    >
      議論のまとめはまだ十分ではありません。まずはAIの初期整理を叩き台にできます。
    </div>
  )}

  <div style={{ display: "grid", gap: 10 }}>
    <div>
      <div style={{ fontWeight: 800, marginBottom: 4 }}>主張</div>
      <div
        style={{
          color: "#333",
          lineHeight: 1.7,
          fontSize: currentFont.base,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          overflowWrap: "anywhere",
        }}
      >
        {thread.original_post}
      </div>
    </div>

    <div>
      <div style={{ fontWeight: 800, marginBottom: 4 }}>前提</div>
      {initialPremises.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: 20, color: "#333", fontSize: currentFont.base, lineHeight: 1.7, overflowWrap: "anywhere" }}>
          {initialPremises.map((premise, index) => (
            <li key={`initial-premise-${index}`}>{premise}</li>
          ))}
        </ul>
      ) : (
        <div style={{ color: "#666", fontSize: currentFont.base }}>
          まだ前提は十分に整理されていません。
        </div>
      )}
    </div>

    <div>
      <div style={{ fontWeight: 800, marginBottom: 4 }}>根拠</div>
      {initialReasons.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: 20, color: "#333", fontSize: currentFont.base, lineHeight: 1.7, overflowWrap: "anywhere" }}>
          {initialReasons.map((reason, index) => (
            <li key={`initial-reason-${index}`}>{reason}</li>
          ))}
        </ul>
      ) : (
        <div style={{ color: "#666", fontSize: currentFont.base }}>
          まだ根拠は十分に整理されていません。
        </div>
      )}
    </div>

    <div>
      <div style={{ fontWeight: 800, marginBottom: 4 }}>反論・リスク</div>
      {initialConflicts.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: 20, color: "#333", fontSize: currentFont.base, lineHeight: 1.7, overflowWrap: "anywhere" }}>
          {initialConflicts.map((conflict, index) => (
            <li key={`initial-conflict-${index}`}>
              {conflict.rebuttal || conflict.opinion}
            </li>
          ))}
        </ul>
      ) : (
        <div style={{ color: "#666", fontSize: currentFont.base }}>
          まだ反論・リスクは十分に整理されていません。
        </div>
      )}
    </div>
  </div>
</div>
</details>

  </div>

<details style={{ marginTop: 16 }}>
  <summary
    style={{
      cursor: "pointer",
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      padding: "12px 14px",
      border: "1px solid #d7dde8",
      borderRadius: 8,
      background: "#f8fafc",
      color: "#111",
      fontSize: currentFont.title,
      fontWeight: 800,
      lineHeight: 1.4,
      minHeight: 44,
    }}
  >
    <span>この議論の要約を見る</span>
    <span
      style={{
        fontSize: currentFont.base * 0.85,
        color: "#64748b",
        fontWeight: 700,
        whiteSpace: "normal",
      }}
    >
      タップして開く
    </span>
  </summary>

<div style={{ marginTop: 12 }}>

<div
  style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 16,
    marginBottom: 8,
    flexWrap: "wrap",
  }}
>
  <h2
    style={{
      margin: 0,
      fontSize: currentFont.title,
      fontWeight: 800,
      lineHeight: 1.4,
      color: "#111",
    }}
  >
この議論の要約
  </h2>
<PrimaryButton
  onClick={jumpToMainIssues}
  style={{
    padding: "8px 14px",
    fontSize: currentFont.base * 0.95,
    whiteSpace: "nowrap",
    background: "#111",
    color: "#fff",
    fontWeight: 700,
  }}
>
  👇 主な論点を見る
</PrimaryButton>

</div>

    {!summaryLoading && (

<PrimaryButton
  onClick={(e) => {
    e.stopPropagation();
    handleGenerateSummary();
  }}
>
            {displaySummaryText
              ? "AIまとめを確認・更新する"
              : "AIまとめを作成する"}
          </PrimaryButton>
        )}

        <div style={{ color: "#666", marginTop: 8, fontSize: currentFont.base * 0.9 }}>
          AI再生成は週1回を目安にしています。通常は保存済みのAIまとめを表示します。
        </div>

        {summaryLoading && (
          <div style={{ color: "#666", marginTop: 8 }}>
            AIが議論を分析中...
          </div>
        )}

        {summaryNotice && (
          <div style={{ color: "#666", marginTop: 8, fontSize: currentFont.base * 0.9 }}>
            {summaryNotice}
          </div>
        )}

        <div
          style={{
            marginTop: 10,
            fontSize: currentFont.base,
            lineHeight: 1.8,
          }}
        >
{displaySummaryText ? (
  displaySummaryText
) : (
  <div style={{ color: "#999" }}>
    まだAIまとめはありません。「AIでこの議論をまとめる」を押してください。
  </div>
)}
        </div>
  </div>


<div style={{ marginTop: 14 }}>
  <div
    style={{
      fontSize: currentFont.base * 0.85,
      color: "#666",
      marginBottom: 6,
    }}
  >
    🔍 調べるキーワード
  </div>

  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
    {keywords.length > 0 ? (
      keywords.map((k) => (
        <button
          key={k}
          onClick={(e) => {
            e.stopPropagation();
            window.open(
              `https://www.google.com/search?q=${encodeURIComponent(k)}`,
              "_blank"
            );
          }}
          style={{
            padding: "5px 8px",
            borderRadius: 999,
            border: "1px solid #ddd",
            background: "#f5f5f5",
            fontSize: currentFont.base * 0.85,
            color: "#111",
            cursor: "pointer",
          }}
        >
          {k}
        </button>
      ))
    ) : (
      <div style={{ fontSize: currentFont.base * 0.85, color: "#999" }}>
        関連キーワードはまだありません
      </div>
    )}
  </div>
</div>
</details>

</SectionCard>
{/* ←ここで完全に閉じる */}

<details id="main-issues-section" style={{ marginTop: 24 }}>
  <summary
    style={{
      cursor: "pointer",
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      padding: "12px 14px",
      border: "1px solid #d7dde8",
      borderRadius: 8,
      background: "#f8fafc",
      color: "#111",
      fontSize: currentFont.title,
      fontWeight: 800,
      lineHeight: 1.4,
      minHeight: 44,
    }}
  >
    <span>論点整理を見る</span>
    <span
      style={{
        fontSize: currentFont.base * 0.85,
        color: "#64748b",
        fontWeight: 700,
        whiteSpace: "normal",
      }}
    >
      タップして開く
    </span>
  </summary>

<SectionCard variant="white" style={{ marginTop: 12 }}>
  <div id="main-issues" style={{ scrollMarginTop: 80 }} />

  <SectionTitle style={{ fontSize: currentFont.title, color: "#111" }}>
    🧩 論点整理
  </SectionTitle>

  <p
    style={{
      marginTop: 0,
      marginBottom: 16,
      fontSize: currentFont.base,
      color: "#666",
    }}
  >
    気になる論点から、関連する意見へ移動できます。
  </p>

  <div
    style={{
      borderTop: "1px solid #e5e5e5",
      paddingTop: 16,
    }}
  >
    <div
      style={{
        fontSize: currentFont.base,
        fontWeight: 800,
        color: "#111",
        marginBottom: 10,
      }}
    >
      主な論点
    </div>

    <div style={{ display: "grid", gap: 10 }}>
      {summary?.key_points?.issues?.length ? (
        summary.key_points.issues.map((item, index) =>
          renderDiscussionCard({
            keyId: `issue-${item}-${index}`,
            text: item,
            guideType: "論点",
            style: {
              fontSize: currentFont.base,
              background: "#f5f0ff",
              border: "1px solid #ddd6fe",
              color: "#111827",
            },
          })
        )
      ) : (
        <div style={{ color: "#666" }}>論点の見出しはまだ生成されていません。前提・根拠・反論から確認できます。</div>
      )}
    </div>
  </div>

  <div
    style={{
      borderTop: "1px solid #e5e5e5",
      marginTop: 20,
      paddingTop: 16,
    }}
  >
    <div
      style={{
        fontSize: currentFont.base,
        fontWeight: 800,
        color: "#111",
        marginBottom: 10,
      }}
    >
      主な前提
    </div>

    <div style={{ display: "grid", gap: 10 }}>
      {premiseSectionTitle !== "主な前提" && (
        <div style={{ color: "#666", fontSize: currentFont.base * 0.9 }}>
          {premiseSectionTitle}
        </div>
      )}
{visiblePremises.length ? (
  visiblePremises.map((item, index) =>
          renderDiscussionCard({
            keyId: `premise-${item}-${index}`,
            text: item,
            guideType: "前提",
            style: {
              fontSize: currentFont.base,
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              color: "#111827",
            },
          })
        )
      ) : premiseQualityDisplay.mode === "empty" ? (
        <div style={{ display: "grid", gap: 8 }}>
          {premiseQualityDisplay.messages.map((msg, i) => (
            <div
              key={i}
              style={{
                color: "#666",
                fontSize: currentFont.base * 0.95,
              }}
            >
              {msg}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: "#666" }}>まだ前提は整理されていない。</div>
      )}
    </div>
  </div>

  <div
    style={{
      borderTop: "1px solid #e5e5e5",
      marginTop: 20,
      paddingTop: 16,
    }}
  >
    <div
      style={{
        fontSize: currentFont.base,
        fontWeight: 800,
        color: "#111",
        marginBottom: 10,
      }}
    >
      主な根拠
    </div>

    <div style={{ display: "grid", gap: 10 }}>
      {reasonSectionTitle !== "主な根拠" && (
        <div style={{ color: "#666", fontSize: currentFont.base * 0.9 }}>
          {reasonSectionTitle}
        </div>
      )}
{visibleReasons.length ? (
  visibleReasons.map((item, index) =>
          renderDiscussionCard({
            keyId: `reason-${item}-${index}`,
            text: item,
            guideType: "根拠",
            style: {
              fontSize: currentFont.base,
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              color: "#111827",
            },
          })
        )
      ) : reasonQualityDisplay.mode === "empty" ? (
        <div style={{ display: "grid", gap: 8 }}>
          {reasonQualityDisplay.messages.map((msg, i) => (
            <div
              key={i}
              style={{
                color: "#666",
                fontSize: currentFont.base * 0.95,
              }}
            >
              {msg}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: "#666" }}>まだ根拠は整理されていない。</div>
      )}
    </div>
  </div>

  <div
    style={{
      borderTop: "1px solid #e5e5e5",
      marginTop: 20,
      paddingTop: 16,
    }}
  >
    <div
      style={{
        fontSize: currentFont.base,
        fontWeight: 800,
        color: "#111",
        marginBottom: 10,
      }}
    >
      反論・リスク
    </div>
{conflictSectionTitle !== "主な対立" && (
  <div style={{ color: "#666", fontSize: currentFont.base * 0.9, marginBottom: 10 }}>
    {conflictSectionTitle}
  </div>
)}
{conflictQualityDisplay.mode === "empty" ? (
  <div style={{ display: "grid", gap: 8 }}>
    {conflictQualityDisplay.messages.map((msg, i) => (
      <div
        key={i}
        style={{
          color: "#666",
          fontSize: currentFont.base * 0.95,
        }}
      >
        {msg}
      </div>
    ))}
  </div>
) : visibleConflicts.length > 0 ? (
  <div style={{ display: "grid", gap: 10 }}>
    {visibleConflicts.map((c, i) => {
      const shouldShowOriginalOpinion =
        i === 0 || c.opinion !== visibleConflicts[i - 1]?.opinion;

      return (
          <SectionCard
            key={i}
            variant="soft"
            style={{
              padding: 10,
              borderRadius: 8,
              display: "grid",
              gap: 8,
              color: "#111",
              background: "#fff1f2",
              border: "1px solid #fecdd3",
              marginBottom: 0,
            }}
          >
            {shouldShowOriginalOpinion &&
              renderDiscussionCard({
                keyId: `conflict-opinion-${c.opinion}-${i}`,
                text: c.opinion,
                guideType: "論点",
                titlePrefix: "元の意見：",
                style: {
                  fontSize: currentFont.base,
                  background: "#fff",
                  border: "1px solid #fecdd3",
                  color: "#111827",
                },
              })}

            {renderDiscussionCard({
              keyId: `conflict-rebuttal-${c.rebuttal}-${i}`,
              text: c.rebuttal,
              guideType: "論点",
              titlePrefix: "反論・リスク：",
              variant: "danger",
              style: { fontSize: currentFont.base },
            })}
          </SectionCard>
        );
      })}
      </div>
    ) : (
      <div style={{ color: "#666" }}>対立はまだ抽出されていない。</div>
    )}
  </div>
</SectionCard>
</details>


<details style={{ marginTop: 24 }}>
  <summary
    style={{
      cursor: "pointer",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      padding: "12px 14px",
      border: "1px solid #d7dde8",
      borderRadius: 8,
      background: "#f8fafc",
      color: "#111",
      fontSize: currentFont.title,
      fontWeight: 800,
      lineHeight: 1.4,
      minHeight: 44,
    }}
  >
    <span>議論ツリーを見る</span>
    <span
      style={{
        fontSize: currentFont.base * 0.85,
        color: "#64748b",
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      タップして開く
    </span>
  </summary>

<div style={{ marginTop: 12 }}>

  <div
    style={{
      fontSize: currentFont.base,
      color: "#666",
      marginBottom: 12,
    }}
  >
    主張 → 意見 → 反論 / 補足 の流れを見られます
  </div>

<DiscussionTree
  tenant={tenant}
  threadId={threadId}
  groupedByOpinion={groupedByOpinion}
  currentFont={currentFont}
  variant={treeVariant}
  onSelectNode={(node) => {
    setSelectedGuide({
      type:
        node.type === "論点"
          ? "論点"
          : node.type === "意見"
          ? "根拠"
          : node.type === "反論"
          ? "根拠"
          : "前提",
      text: node.text,
    });
    setPostRole("opinion");
    setReplyToOpinionId(null);

    setTimeout(() => {
      const el = document.getElementById("post-form");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }}
/>
</div>
</details>

<details style={{ marginTop: 24 }}>
  <summary
    style={{
      cursor: "pointer",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      padding: "12px 14px",
      border: "1px solid #d7dde8",
      borderRadius: 8,
      background: "#f8fafc",
      color: "#111",
      fontSize: currentFont.title,
      fontWeight: 800,
      lineHeight: 1.4,
      minHeight: 44,
    }}
  >
    <span>この議論の現在地</span>
    <span
      style={{
        fontSize: currentFont.base * 0.85,
        color: "#64748b",
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      タップして開く
    </span>
  </summary>

<SectionCard variant="white" style={{ marginTop: 12, color: "#111" }}>

  <p
    style={{
      marginTop: 0,
      color: "#666",
      fontSize: currentFont.base,
      lineHeight: 1.7,
    }}
  >
    このスレッドは、議論全体の中でどの位置にあるかを確認できます。
  </p>

  <div
    style={{
      fontSize: currentFont.base,
      fontWeight: 800,
      color: "#111",
      marginBottom: 6,
    }}
  >
    現在地：
  </div>
  <div
    style={{
      fontSize: currentFont.base,
      color: "#111",
      marginBottom: 14,
      lineHeight: 1.7,
    }}
  >
    {renderCurrentPath(currentLocationPath, tenant)}
  </div>

  <div
    style={{
      fontSize: currentFont.base,
      fontWeight: 800,
      color: "#111",
      marginBottom: 6,
    }}
  >
    この議論に近い論点：
  </div>
  {currentRelatedLabels.length > 0 ? (
    <ul
      style={{
        margin: "0 0 14px",
        paddingLeft: 20,
        color: "#111",
        fontSize: currentFont.base,
        lineHeight: 1.8,
      }}
    >
      {currentRelatedLabels.map((label) => (
        <li key={label}>{label}</li>
      ))}
    </ul>
  ) : (
    <p
      style={{
        margin: "0 0 14px",
        color: "#64748b",
        fontSize: currentFont.base,
        lineHeight: 1.7,
      }}
    >
      近い論点は、今後の議論マップ再編でさらに整理されます。
    </p>
  )}

  <div
    style={{
      fontSize: currentFont.base,
      fontWeight: 800,
      color: "#111",
      marginBottom: 6,
    }}
  >
    全体マップ：
  </div>
  <div
    style={{
      margin: 0,
      whiteSpace: "pre-wrap",
      overflowX: "auto",
      background: "#f7f7f7",
      color: "#111",
      border: "1px solid #e0e0e0",
      borderRadius: 8,
      padding: 12,
      fontSize: currentFont.base,
      lineHeight: 1.7,
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    }}
  >
{renderLocationMap(currentLocationMap.root, currentLocationMap.branches, tenant)}
  </div>
</SectionCard>
</details>

          <SectionCard variant="white" style={{ marginTop: 24 }}>
           <div id="post-form" style={{ scrollMarginTop: 120 }} />

            <SectionTitle style={{ fontSize: currentFont.title, color: "#111" }}>
              {replyToOpinionId
                ? `この意見への${
                    postRole === "rebuttal"
                      ? "反論"
                      : postRole === "supplement"
                      ? "補足"
                      : "投稿"
                  }`
                : "✍️ 新しい投稿"}
            </SectionTitle>

            <p
              style={{
                marginTop: 0,
                color: "#666",
                fontSize: currentFont.base,
              }}
            >
              {replyToOpinionId
                ? postRole === "rebuttal"
                  ? "この投稿は、選んだ意見への反論として「この意見への返信」に表示されます。"
                  : postRole === "supplement"
                  ? "この投稿は、選んだ意見への補足として「この意見への返信」に表示されます。"
                  : "この投稿は、選んだ意見への返信として「この意見への返信」に表示されます。"
                : "このスレッド全体に対する意見として投稿されます。"}
            </p>

{selectedGuide && (
  <SectionCard>
    <div style={{ fontWeight: 800, marginBottom: 6 }}>
      返信先
    </div>
                <div
                  style={{
                    fontWeight: 700,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    overflowWrap: "anywhere",
                  }}
                >
      「{selectedGuide.text}」
                </div>
              </SectionCard>
            )}

            {selectedGuide && (
              <SectionCard
                variant="soft"
                style={{ marginBottom: 12 }}
              >
<div id="related-section" style={{ scrollMarginTop: 80 }}>
                <details>
                  <summary
                    style={{
                      cursor: "pointer",
                      display: "flex",
                      flexWrap: "wrap",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                      color: "#111827",
                      fontSize: currentFont.base,
                      fontWeight: 800,
                    }}
                  >
                    <span>投稿前に近い議論を確認する</span>
                    <span
                      style={{
                        color: "#64748b",
                        fontSize: currentFont.base * 0.85,
                        fontWeight: 700,
                      }}
                    >
                      必要な時だけ開く
                    </span>
                  </summary>

                  <div style={{ marginTop: 12 }}>
                  <div
                    style={{
                      fontSize: currentFont.base,
                      fontWeight: 800,
                      marginBottom: 8,
                      color: "#444",
                    }}
                  >
                    参考になる過去の投稿
                  </div>

                  {loadingRelated ? (
                    <div style={{ color: "#666", fontSize: currentFont.base }}>
                      検索中...
                    </div>
                  ) : relatedPosts.length > 0 ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      {relatedPosts.map((post) => (
                        <PostCard
                          key={post.id}
                          style={{
                            background: "#fff",
                            color: "#111",
                            border: "1px solid #ddd",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                              gap: 12,
                              marginBottom: 4,
                            }}
                          >
                            <div
                              style={{
                                fontSize: currentFont.base,
                                fontWeight: 700,
                                color: "#666",
                              }}
                            >
                              {roleLabel(post.post_role)} / {formatDate(post.created_at)}
                            </div>

                          </div>
                          <div style={{ fontSize: currentFont.base, lineHeight: 1.6 }}>
                            <div
                              style={{
                                fontSize: currentFont.base,
                                fontWeight: 800,
                                color: "#111",
                                marginBottom: 4,
                              }}
                            >
                              {post.thread_title || "関連スレ"}
                            </div>
                            {post.content.length > 120
                              ? `${post.content.slice(0, 120)}...`
                              : post.content}
                          </div>

                        </PostCard>
                      ))}







                    </div>
                  ) : (
                    <div style={{ color: "#666", fontSize: currentFont.base }}>
                      まだ投稿はありません。この内容について最初の意見を書いてみよう。
                    </div>
                  )}

                  {relatedSummary && (
                    <SectionCard
                      variant="info"
                      style={{
                        marginTop: 10,
                        fontSize: currentFont.base,
                        lineHeight: 1.6,
                        color: "#111",
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>関連要約</div>
                      <div>{relatedSummary}</div>
                    </SectionCard>
                  )}

                  <div
                    style={{
                      marginTop: 16,
                      paddingTop: 10,
                      borderTop: "1px solid #ddd",
                    }}
                  >
                    <div
                      style={{
                        fontSize: currentFont.base,
                        fontWeight: 800,
                        marginBottom: 6,
                        color: "#444",
                      }}
                    >
                      近いスレッドを見る
                    </div>

                    <div style={{ display: "grid", gap: 8 }}>
                      {Array.from(
                        new Map(
                          relatedPosts
                            .filter((post) => String(post.thread_id) !== String(threadId))
                            .map((post) => [post.thread_id, post])
                        ).values()
                      )
                        .slice(0, 3)
                        .map((post) => (
                          <LinkButton
                            key={`jump-${post.thread_id}`}
                            href={`/${tenant}/forum/thread/${post.thread_id}`}
                            variant="card"
                          >
                            <div
                              style={{
                                fontSize: currentFont.base,
                                color: "#999",
                                marginBottom: 4,
                              }}
                            >
                              他スレの関連投稿
                            </div>

                            <div
                              style={{
                                fontSize: currentFont.base,
                                color: "#0d47a1",
                                fontWeight: 800,
                                lineHeight: 1.6,
                                marginBottom: 4,
                              }}
                            >
                              👉{" "}
                              {post.content.length > 40
                                ? `${post.content.slice(0, 40)}...`
                                : post.content}
                            </div>

                            <div
                              style={{
                                fontSize: currentFont.base,
                                color: "#666",
                                marginBottom: 4,
                                fontWeight: 700,
                              }}
                            >
                              {roleLabel(post.post_role)}
                            </div>

                            <div
                              style={{
                                marginTop: 4,
                                fontSize: currentFont.base,
                                color: "#666",
                              }}
                            >
                              → この話題の別スレを見る
                            </div>
                          </LinkButton>
                      ))}
                    </div>
                  </div>
                  </div>
                </details>
                </div>
              </SectionCard>
            )}

            <div style={{ marginBottom: 14 }}>
              <label
                htmlFor="stance-label"
                style={{
                  display: "block",
                  marginBottom: 8,
                  fontSize: currentFont.base,
                  fontWeight: 700,
                  color: "#111",
                }}
              >
                この投稿の立場
              </label>

              <select
                id="stance-label"
                value={stanceLabel}
                onChange={(e) => setStanceLabel(e.target.value as StanceLabel)}
                disabled={posting}
                style={{
                  width: "100%",
                  maxWidth: 260,
                  border: "1px solid #ccc",
                  borderRadius: 10,
                  padding: "10px 12px",
                  fontSize: currentFont.base,
                  background: "#fff",
                  color: "#111",
                }}
              >
                {STANCE_LABEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <details style={{ marginBottom: 14 }}>
              <summary
                style={{
                  cursor: "pointer",
                  color: "#555",
                  fontSize: currentFont.base * 0.9,
                  fontWeight: 700,
                  lineHeight: 1.6,
                }}
              >
                詳細設定：投稿分類
              </summary>

              <div style={{ marginTop: 10 }}>
                <label
                  htmlFor="post-role"
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontSize: currentFont.base,
                    fontWeight: 700,
                    color: "#111",
                  }}
                >
                  投稿分類
                </label>

                <div
                  style={{
                    marginBottom: 8,
                    color: "#666",
                    fontSize: currentFont.base * 0.85,
                    lineHeight: 1.6,
                  }}
                >
                  迷ったら「意見」のままでOKです。必要に応じてあとで整理できます。
                </div>

                <select
                  id="post-role"
                  value={postRole}
                  onChange={(e) =>
                    setPostRole(e.target.value as PostRoleOption["value"])
                  }
                  disabled={posting}
                  style={{
                    width: "100%",
                    maxWidth: 260,
                    border: "1px solid #ccc",
                    borderRadius: 10,
                    padding: "10px 12px",
                    fontSize: currentFont.base,
                    background: "#fff",
                    color: "#111",
                  }}
                >
                  {POST_ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </details>

{postRole === "rebuttal" ? (
  <div style={{ display: "grid", gap: 10 }}>
    <div
      style={{
        marginBottom: 2,
        fontSize: currentFont.base * 0.9,
        color: "#475569",
        lineHeight: 1.6,
      }}
    >
      反論は、相手の主張・前提・根拠を分けて書くと伝わりやすくなります。
    </div>

    <textarea
      className="forum-textarea"
      value={rebuttalClaim}
      onChange={(e) => setRebuttalClaim(e.target.value)}
      placeholder="主張を書く"
      style={{
        width: "100%",
        border: "1px solid #cbd5e1",
        borderRadius: 10,
        padding: 10,
        fontSize: currentFont.base,
        background: "#fff",
        color: "#111827",
        caretColor: "#111827",
      }}
    ></textarea>

    <input
      value={rebuttalPremise}
      onChange={(e) => setRebuttalPremise(e.target.value)}
      placeholder="前提を書く"
      style={{
        width: "100%",
        border: "1px solid #ccc",
        borderRadius: 10,
        padding: 10,
        fontSize: currentFont.base,
      }}
    />

    <textarea
      className="forum-textarea"
      value={rebuttalReason}
      onChange={(e) => setRebuttalReason(e.target.value)}
      placeholder="根拠を書く"
      style={{
        width: "100%",
        border: "1px solid #cbd5e1",
        borderRadius: 10,
        padding: 10,
        fontSize: currentFont.base,
        background: "#fff",
        color: "#111827",
        caretColor: "#111827",
      }}
    ></textarea>
  </div>
) : (
  <>
    <textarea
      className="forum-textarea"
      value={text}
      onChange={(e) => setText(e.target.value)}
      placeholder="あなたの考えを書く（主張・前提・根拠でもOK）"
      rows={5}
      style={{
        width: "100%",
        border: "1px solid #cbd5e1",
        borderRadius: 10,
        padding: 12,
        fontSize: currentFont.base,
        resize: "vertical",
        outline: "none",
        background: "#fff",
        color: "#111827",
        caretColor: "#111827",
      }}
></textarea>

    <div
      style={{
        marginTop: 8,
        fontSize: currentFont.base * 0.85,
        color: "#666",
        lineHeight: 1.6,
      }}
    >
      ※ 個人情報や攻撃的表現は自動で調整されます
    </div>
  </>
)}

            {postLoginRequired && (
              <div
                role="alert"
                style={{
                  marginTop: 12,
                  border: "1px solid #bfdbfe",
                  borderRadius: 10,
                  padding: 12,
                  background: "#eff6ff",
                  color: "#1e3a8a",
                  fontSize: currentFont.base,
                  lineHeight: 1.7,
                }}
              >
                <div style={{ fontWeight: 900 }}>
                  投稿するにはログインが必要です。
                </div>
                <div style={{ marginTop: 4 }}>
                  限定ベータ用の共通ID・パスワードでログインしてください。
                </div>
                <Link
                  href={`/${tenant}/forum/login?next=${encodeURIComponent(
                    `/${tenant}/forum/thread/${threadId}#post-form`
                  )}`}
                  style={{
                    display: "inline-block",
                    marginTop: 8,
                    color: "#1d4ed8",
                    fontWeight: 900,
                    textDecoration: "underline",
                    textUnderlineOffset: 3,
                  }}
                >
                  ログイン画面へ
                </Link>
              </div>
            )}

            {postSuccessMessage && (
              <div
                role="status"
                style={{
                  marginTop: 12,
                  border: "1px solid #bbf7d0",
                  borderRadius: 10,
                  padding: 12,
                  background: "#f0fdf4",
                  color: "#166534",
                  fontSize: currentFont.base,
                  fontWeight: 800,
                  lineHeight: 1.7,
                }}
              >
                {postSuccessMessage}
              </div>
            )}

            <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <PrimaryButton onClick={handlePost} disabled={posting}>
                {posting ? "投稿中..." : postSubmitLabel(postRole)}
              </PrimaryButton>

              <PrimaryButton
                variant="secondary"
                onClick={() => {
                  clearReplyDraft();
                  setText("");
                  setSelectedGuide(null);
                  setPostRole("opinion");
                  setStanceLabel("unknown");
                  setPredictionFlag(false);
                  setPredictionTarget("");
                  setPredictionDeadline("");
                  setRebuttalClaim("");
                  setRebuttalPremise("");
                  setRebuttalReason("");
                  setReplyToOpinionId(null);
                  setRelatedPosts([]);
                  setRelatedSummary(null);
                  setLoadingRelated(false);
                  setPostLoginRequired(false);
                  setPostSuccessMessage(null);
                }}
                disabled={posting}
              >
                クリア
              </PrimaryButton>
            </div>
          </SectionCard>

          <details style={{ marginTop: 24 }}>
            <summary
              style={{
                cursor: "pointer",
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                border: "1px solid #d7dde8",
                borderRadius: 8,
                background: "#f8fafc",
                color: "#111",
                fontSize: currentFont.title,
                fontWeight: 800,
                lineHeight: 1.4,
                minHeight: 44,
              }}
            >
              <span>議論の全体マップを見る</span>
              <span
                style={{
                  fontSize: currentFont.base * 0.85,
                  color: "#64748b",
                  fontWeight: 700,
                  whiteSpace: "normal",
                }}
              >
                タップして開く
              </span>
            </summary>

          <SectionCard variant="white" style={{ marginTop: 12 }}>
            <SectionTitle style={{ fontSize: currentFont.title, color: "#111" }}>
              議論の全体マップ
            </SectionTitle>

            <p
              style={{
                marginTop: 0,
                color: "#475569",
                fontSize: currentFont.base,
                lineHeight: 1.6,
              }}
            >
              この問題が、他の経済論点とどうつながるかを整理した地図です。
            </p>

            <div
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                overflowX: "auto",
                background: "#f7f7f7",
                color: "#111",
                border: "1px solid #e0e0e0",
                borderRadius: 8,
                padding: 12,
                fontSize: currentFont.base,
                lineHeight: 1.7,
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              }}
            >
              {renderLocationMap(discussionMapForDisplay.root, discussionMapForDisplay.branches, tenant)}
            </div>

            <div
              style={{
                marginTop: 14,
                padding: "12px 14px",
                borderRadius: 8,
                border: "1px solid #dbeafe",
                background: "#eff6ff",
                color: "#1e3a8a",
                fontSize: currentFont.base,
                lineHeight: 1.7,
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: 6, color: "#1e3a8a" }}>
                AIによるつながり整理：
              </div>
              <div>
                消費税の議論は、単なる税率の問題ではなく、需要不足・家計負担・物価・雇用に広がる論点です。
                減税を選ぶ場合は需要回復の効果を見つつ、インフレや財源への反論も同時に検討する必要があります。
              </div>
            </div>
          </SectionCard>
          </details>
        </>
      )}
    </main>
  );
}
