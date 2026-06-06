// src/app/[tenant]/forum/page.tsx

"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import ExternalAiImportModal from "@/components/forum/ExternalAiImportModal";
import ForumGuideTree from "@/components/forum/ForumGuideTree";
import PrimaryButton from "@/components/forum/PrimaryButton";

type ThreadRow = {
  id: string;
  title: string;
  category?: string;
  summary?: string;
  original_post?: string;
  posts_content?: string;
  post_count?: number;
  avg_logic_score?: number;
  created_at?: string;
};

type RelatedThread = {
  id: string;
  title: string;
  category?: string;
  summary?: string;
  reason?: string;
  stance?: "pro" | "con" | "neutral";
};

type Conflict = {
  opinion: string;
  rebuttal: string;
};

type GeneratedIssue = {
  mode: "expand" | "split";
  claim: string;
  premises: string[];
  reasons: string[];
  conflicts: Conflict[];
  easySummary?: string;
};

type OrganizedResult = {
  summary: string;
  postText: string;
};

type RankingMode = "recent" | "score" | "posts";

const RANKING_TABS: { value: RankingMode; label: string }[] = [
  { value: "score", label: "AI論理スコア順" },
  { value: "recent", label: "新着順" },
  { value: "posts", label: "投稿数順" },
];

type DiscussionMapNode = {
  id: string;
  label: string;
  nodeId?: string;
  children?: DiscussionMapNode[];
};

const ALL_CATEGORIES = "すべて";
const TOP_CARD_LIMIT = 9;
const SEARCH_RESULTS_PER_PAGE = 9;
const draftStorageKey = "forum_thread_draft_input";
const NODE_INFO: Record<string, { label: string; path?: string[] }> = {
  "consumption-tax": {
    label: "消費税",
    path: ["問題を整理する", "税金・社会保険料", "消費税"],
  },
  "tax-social-insurance": {
    label: "税金・社会保険料",
    path: ["問題を整理する", "税金・社会保険料"],
  },
  "demand-shortage": {
    label: "需要不足",
    path: ["原因を考える", "需要不足"],
  },
  "tax-cuts": {
    label: "減税",
    path: ["解決策を出す", "減税"],
  },
  "fiscal-policy": {
    label: "財政政策",
    path: ["原因を考える", "財政政策"],
  },
  "inflation": {
    label: "インフレ",
    path: ["反論・リスクを確認する", "インフレ"],
  },
  "funding-source": {
    label: "財源",
    path: ["反論・リスクを確認する", "財源"],
  },
  "funding-inflation": {
    label: "財源・インフレ",
    path: ["反論・リスクを確認する", "財源・インフレ"],
  },
  "employment-wages-impact": {
    label: "雇用・賃金への影響",
    path: ["消費税", "雇用・賃金への影響"],
  },
  abenomics: {
    label: "アベノミクス",
    path: ["政策を検証する", "アベノミクス"],
  },
};

const discussionMapRoot: DiscussionMapNode = {
  id: "japan-economy",
  label: "日本経済",
};

const discussionMapBranches: DiscussionMapNode[] = [
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
            children: [
              { id: "demand-shortage", label: "需要不足", nodeId: "demand-shortage" },
              { id: "tax-cuts", label: "減税", nodeId: "tax-cuts" },
              {
                id: "funding-inflation",
                label: "財源・インフレ",
                nodeId: "funding-inflation",
              },
              {
                id: "employment-wages-impact",
                label: "雇用・賃金への影響",
                nodeId: "employment-wages-impact",
              },
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

const pageStyle: CSSProperties = {
  maxWidth: 1080,
  margin: "0 auto",
  padding: 24,
  color: "#111827",
};

const panelStyle: CSSProperties = {
  border: "1px solid #d7dde8",
  borderRadius: 8,
  padding: 18,
  background: "#ffffff",
};

const darkPanelStyle: CSSProperties = {
  border: "1px solid #2f3747",
  borderRadius: 8,
  padding: 18,
  background: "#141923",
  color: "#f9fafb",
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontSize: 13,
  fontWeight: 700,
  color: "#4b5563",
};

const inputStyle: CSSProperties = {
  width: "100%",
  borderRadius: 8,
  padding: "11px 12px",
  fontSize: 16,
  background: "#ffffff",
  color: "#111827",
  border: "1px solid #cbd5e1",
  outline: "none",
};

const darkInputStyle: CSSProperties = {
  ...inputStyle,
  background: "#10141d",
  color: "#ffffff",
  border: "1px solid #3d4657",
};

const ghostButtonStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "9px 12px",
  background: "#ffffff",
  color: "#111827",
  cursor: "pointer",
  fontWeight: 700,
};

const smallMetaStyle: CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
  lineHeight: 1.6,
};

const sectionLinkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid #cbd5e1",
  borderRadius: 999,
  padding: "5px 11px",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 900,
  textDecoration: "none",
  whiteSpace: "nowrap",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toText(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, 5);
}

function toConflicts(value: unknown): Conflict[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!isRecord(item)) return null;

      const opinion = toText(item.opinion, toText(item.a)).trim();
      const rebuttal = toText(item.rebuttal, toText(item.b)).trim();

      if (!opinion && !rebuttal) return null;

      return { opinion, rebuttal };
    })
    .filter((item): item is Conflict => item !== null)
    .slice(0, 5);
}

function normalizeGeneratedIssue(value: unknown, fallbackClaim: string): GeneratedIssue {
  const record = isRecord(value) ? value : {};
  const mode = record.mode === "split" ? "split" : "expand";
  const claim = toText(record.claim, fallbackClaim).trim() || fallbackClaim;

  return {
    mode,
    claim,
    premises: toStringArray(record.premises),
    reasons: toStringArray(record.reasons),
    conflicts: toConflicts(record.conflicts),
    easySummary: toText(record.easySummary).trim() || undefined,
  };
}

function makeDraftTitle(value: string) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 120) return trimmed;
  return `${trimmed.slice(0, 119)}…`;
}

function normalizeThreadRow(value: unknown): ThreadRow | null {
  if (!isRecord(value)) return null;

  const id = toText(value.id).trim();
  if (!id) return null;

  return {
    id,
    title: toText(value.title, "無題スレ").trim() || "無題スレ",
    category: toText(value.category).trim() || undefined,
    summary: toText(value.summary, toText(value.ai_summary)).trim() || undefined,
    original_post: toText(value.original_post).trim() || undefined,
    posts_content: toText(value.posts_content).trim() || undefined,
    post_count: toNumber(value.post_count),
    avg_logic_score: toNumber(value.avg_logic_score),
    created_at: toText(value.created_at).trim() || undefined,
  };
}

function normalizeThreadRows(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map(normalizeThreadRow)
    .filter((thread): thread is ThreadRow => thread !== null);
}

function detectStance(title: string, summary = ""): RelatedThread["stance"] {
  const text = `${title} ${summary}`.toLowerCase();

  if (
    text.includes("問題") ||
    text.includes("危険") ||
    text.includes("不要") ||
    text.includes("反対") ||
    text.includes("懸念")
  ) {
    return "con";
  }

  if (
    text.includes("必要") ||
    text.includes("有効") ||
    text.includes("賛成") ||
    text.includes("推進")
  ) {
    return "pro";
  }

  return "neutral";
}

function normalizeRelatedThreads(value: unknown): RelatedThread[] {
  const source = isRecord(value)
    ? Array.isArray(value.threads)
      ? value.threads
      : Array.isArray(value.results)
      ? value.results
      : []
    : Array.isArray(value)
    ? value
    : [];

  return source
    .map((item): RelatedThread | null => {
      if (!isRecord(item)) return null;

      const id = toText(item.id).trim();
      const title = toText(item.title, "無題スレ").trim() || "無題スレ";
      const summary =
        toText(item.summary, toText(item.ai_summary, toText(item.ai_ai_summary))).trim() ||
        undefined;

      if (!id) return null;

      return {
        id,
        title,
        category: toText(item.category, "未分類").trim() || "未分類",
        summary,
        reason:
          toText(item.reason).trim() ||
          "似たテーマや言葉が含まれる既存スレッドです",
        stance: detectStance(title, summary),
      };
    })
    .filter((thread): thread is RelatedThread => thread !== null)
    .slice(0, TOP_CARD_LIMIT);
}

function formatScore(value?: number) {
  if (typeof value !== "number") return "0";
  return String(Math.round(value));
}

function formatDate(value?: string) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function truncate(value = "", max = 120) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function renderDiscussionMapNode(
  node: DiscussionMapNode,
  tenant: string,
  selectedNodeId: string
) {
  const isSelected = Boolean(node.nodeId && node.nodeId === selectedNodeId);
  const content = node.nodeId ? (
    <Link
      href={`/${tenant}/forum?node=${node.nodeId}`}
      style={{
        color: isSelected ? "#166534" : "#0d47a1",
        fontWeight: 800,
        textDecoration: "underline",
        textUnderlineOffset: 2,
      }}
    >
      {node.label}
    </Link>
  ) : (
    node.label
  );

  if (!isSelected) return content;

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
        選択中
      </span>
    </span>
  );
}

function renderDiscussionMap(
  root: DiscussionMapNode,
  branches: DiscussionMapNode[],
  tenant: string,
  selectedNodeId: string
) {
  const lines = [
    <div key={root.id}>{renderDiscussionMapNode(root, tenant, selectedNodeId)}</div>,
  ];

  const addNodes = (nodes: DiscussionMapNode[], prefix = "") => {
    nodes.forEach((node, index) => {
      const isLastNode = index === nodes.length - 1;
      const branchPrefix = isLastNode ? "└" : "├";
      const childPrefix = `${prefix}${isLastNode ? "   " : "│  "}`;

      lines.push(
        <div key={node.id}>
          {prefix}
          {branchPrefix} {renderDiscussionMapNode(node, tenant, selectedNodeId)}
        </div>
      );

      if (node.children?.length) {
        addNodes(node.children, childPrefix);
      }
    });
  };

  addNodes(branches);

  return lines;
}

function matchesThread(thread: ThreadRow, query: string, category: string) {
  const q = query.trim().toLowerCase();
  const searchable = [
    thread.title,
    thread.summary,
    thread.original_post,
    thread.posts_content,
    thread.category,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const matchesSearch = q ? searchable.includes(q) : true;
  const matchesCategory =
    category === ALL_CATEGORIES ? true : thread.category === category;

  return matchesSearch && matchesCategory;
}

function threadCardStyle(isFeatured: boolean, compact = false): CSSProperties {
  return {
    border: isFeatured ? "1px solid #2563eb" : "1px solid #d7dde8",
    borderRadius: 8,
    padding: compact ? 12 : 14,
    background: isFeatured ? "#eff6ff" : "#ffffff",
    minHeight: compact ? 118 : 148,
  };
}

function ThreadCard({
  thread,
  tenant,
  currentFontSize,
  isFeatured = false,
  compact = false,
}: {
  thread: ThreadRow;
  tenant: string;
  currentFontSize: number;
  isFeatured?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [isActive, setIsActive] = useState(false);
  const preview =
    thread.summary || thread.original_post || thread.posts_content || "";
  const threadHref = `/${tenant}/forum/thread/${thread.id}`;

  return (
    <article
      role="link"
      tabIndex={0}
      aria-label={`${thread.title}の詳細を見る`}
      onClick={() => router.push(threadHref)}
      onKeyDown={(event) => {
        if (event.currentTarget !== event.target) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          router.push(threadHref);
        }
      }}
      onMouseEnter={() => setIsActive(true)}
      onMouseLeave={() => setIsActive(false)}
      onFocus={() => setIsActive(true)}
      onBlur={() => setIsActive(false)}
      style={{
        ...threadCardStyle(isFeatured, compact),
        border: isActive
          ? "1px solid #2563eb"
          : threadCardStyle(isFeatured, compact).border,
        cursor: "pointer",
        boxShadow: isActive ? "0 8px 18px rgba(37, 99, 235, 0.14)" : "none",
        outline: isActive ? "2px solid rgba(37, 99, 235, 0.18)" : "none",
        outlineOffset: 2,
      }}
    >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            alignItems: "flex-start",
            marginBottom: 8,
          }}
        >
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span
              style={{
                border: "1px solid #d1d5db",
                borderRadius: 8,
                padding: "3px 8px",
                fontSize: 12,
                color: "#374151",
                background: "#f9fafb",
              }}
            >
              {thread.category ?? "未設定"}
            </span>
            {isFeatured && (
              <span
                style={{
                  border: "1px solid #2563eb",
                  borderRadius: 8,
                  padding: "3px 8px",
                  fontSize: 12,
                  color: "#1d4ed8",
                  background: "#dbeafe",
                  fontWeight: 800,
                }}
              >
                まず読む
              </span>
            )}
          </div>

          {thread.created_at && (
            <span style={{ ...smallMetaStyle, whiteSpace: "nowrap" }}>
              {formatDate(thread.created_at)}
            </span>
          )}
        </div>

        <h3
          style={{
            margin: 0,
            fontSize: compact ? currentFontSize : currentFontSize + 2,
            lineHeight: 1.45,
            fontWeight: 800,
          }}
        >
            {truncate(thread.title, compact ? 30 : 36)}
        </h3>

        {preview && (
          <p
            style={{
              margin: "8px 0 0",
              color: "#4b5563",
              fontSize: currentFontSize - 2,
              lineHeight: compact ? 1.55 : 1.7,
            }}
          >
            {truncate(preview, 50)}
          </p>
        )}

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginTop: 12,
            ...smallMetaStyle,
          }}
        >
          <span>投稿数 {thread.post_count ?? 0}</span>
          <span>読みやすさ {formatScore(thread.avg_logic_score)}</span>
        </div>
      <Link
        href={threadHref}
        onClick={(event) => event.stopPropagation()}
        style={{
          display: "inline-flex",
          marginTop: 12,
          color: "#0d47a1",
          fontWeight: 800,
          textDecoration: "underline",
          textUnderlineOffset: 3,
        }}
      >
        詳しく見る
      </Link>
    </article>
  );
}

function StanceLabel({ stance }: { stance?: RelatedThread["stance"] }) {
  const label =
    stance === "pro" ? "賛成寄り" : stance === "con" ? "反対意見あり" : "中立";
  const color =
    stance === "pro" ? "#047857" : stance === "con" ? "#1d4ed8" : "#4b5563";

  return (
    <span
      style={{
        border: `1px solid ${color}`,
        borderRadius: 8,
        color,
        padding: "2px 7px",
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {label}
    </span>
  );
}

export default function ForumPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const tenantParam = params?.tenant;
  const tenant = Array.isArray(tenantParam)
    ? tenantParam[0]
    : String(tenantParam ?? "dev");

  const keyword = searchParams.get("keyword") || "";
  const goal = searchParams.get("goal") || "";
  const node = searchParams.get("node") || "";
  const shouldOpenExternalAiImport =
    searchParams.get("externalAiImport") === "1";
  const selectedNodeInfo = NODE_INFO[node];
  const selectedNodeLabel = selectedNodeInfo?.label;
  const selectedNodePathText =
    selectedNodeInfo?.path?.length ? selectedNodeInfo.path.join(" ＞ ") : selectedNodeLabel;
  const initialSearchQuery = keyword || selectedNodeLabel || "";

  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [organizing, setOrganizing] = useState(false);
  const [creatingThread, setCreatingThread] = useState(false);
  const [organizedResult, setOrganizedResult] = useState<OrganizedResult | null>(null);
  const [actionError, setActionError] = useState("");
  const [topError, setTopError] = useState("");
  const [isExternalAiImportOpen, setIsExternalAiImportOpen] = useState(false);
  const [isTopMenuOpen, setIsTopMenuOpen] = useState(false);
  const [isForumBetaLoggedIn, setIsForumBetaLoggedIn] = useState<boolean | null>(
    null
  );

  const [popularThreads, setPopularThreads] = useState<ThreadRow[]>([]);
  const [activeThreads, setActiveThreads] = useState<ThreadRow[]>([]);
  const [recentThreads, setRecentThreads] = useState<ThreadRow[]>([]);
  const [rankingMode, setRankingMode] = useState<RankingMode>("score");
  const [defaultMode, setDefaultMode] = useState<"normal" | "easy">("normal");
  const [fontSizeMode, setFontSizeMode] =
    useState<"small" | "medium" | "large">("medium");

  const currentFontSize =
    fontSizeMode === "small" ? 14 : fontSizeMode === "large" ? 18 : 16;

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [activeAiSummaryThreadId, setActiveAiSummaryThreadId] = useState<
    string | null
  >(null);
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [searchResultPage, setSearchResultPage] = useState(1);
  const [analyzeScrollKey, setAnalyzeScrollKey] = useState(0);
  const [relatedThreads, setRelatedThreads] = useState<RelatedThread[]>([]);
  const [generatedIssue, setGeneratedIssue] = useState<GeneratedIssue | null>(null);

  const hasFilter = searchQuery.trim() !== "" || categoryFilter !== ALL_CATEGORIES;
  const hasSearchResultContext = searchQuery.trim() !== "" || Boolean(selectedNodeLabel);

  const allThreads = useMemo(() => {
    const map = new Map<string, ThreadRow>();

    for (const thread of [...popularThreads, ...activeThreads, ...recentThreads]) {
      map.set(thread.id, thread);
    }

    return Array.from(map.values());
  }, [activeThreads, popularThreads, recentThreads]);

  const searchResultThreads = useMemo(
    () =>
      allThreads.filter((thread) =>
        matchesThread(thread, searchQuery, categoryFilter)
      ),
    [allThreads, categoryFilter, searchQuery]
  );

  const searchResultTotalPages = Math.max(
    1,
    Math.ceil(searchResultThreads.length / SEARCH_RESULTS_PER_PAGE)
  );
  const currentSearchResultPage = Math.min(
    searchResultPage,
    searchResultTotalPages
  );
  const searchResultStartIndex =
    searchResultThreads.length === 0
      ? 0
      : (currentSearchResultPage - 1) * SEARCH_RESULTS_PER_PAGE;
  const visibleSearchResultThreads = searchResultThreads.slice(
    searchResultStartIndex,
    searchResultStartIndex + SEARCH_RESULTS_PER_PAGE
  );
  const searchResultEndIndex =
    searchResultThreads.length === 0
      ? 0
      : searchResultStartIndex + visibleSearchResultThreads.length;
  const searchResultDisplayStart =
    searchResultThreads.length === 0 ? 0 : searchResultStartIndex + 1;
  const searchResultTerm = searchQuery.trim() || selectedNodeLabel || "";
  const searchResultTitle =
    selectedNodeLabel && searchQuery.trim() === selectedNodeLabel
      ? `論点「${selectedNodeLabel}」の関連スレッド`
      : `「${searchResultTerm}」の検索結果`;

  const categoryOptions = useMemo(() => {
    const categories = allThreads
      .map((thread) => thread.category)
      .filter((category): category is string => Boolean(category));

    return [ALL_CATEGORIES, ...Array.from(new Set(categories)).sort()];
  }, [allThreads]);

  const filteredPopularThreads = useMemo(
    () =>
      popularThreads.filter((thread) =>
        matchesThread(thread, searchQuery, categoryFilter)
      ),
    [categoryFilter, popularThreads, searchQuery]
  );

  const filteredActiveThreads = useMemo(
    () =>
      activeThreads.filter((thread) =>
        matchesThread(thread, searchQuery, categoryFilter)
      ),
    [activeThreads, categoryFilter, searchQuery]
  );

  const filteredRecentThreads = useMemo(
    () =>
      recentThreads.filter((thread) =>
        matchesThread(thread, searchQuery, categoryFilter)
      ),
    [categoryFilter, recentThreads, searchQuery]
  );

  const visiblePopularThreads = filteredPopularThreads.slice(0, TOP_CARD_LIMIT);
  const visibleActiveThreads = filteredActiveThreads.slice(0, TOP_CARD_LIMIT);
  const visibleRecentThreads = filteredRecentThreads.slice(0, TOP_CARD_LIMIT);
  const rankingThreads = useMemo(() => {
    if (rankingMode === "score") {
      return [...filteredPopularThreads].sort((a, b) => {
        const scoreA =
          typeof a.avg_logic_score === "number"
            ? a.avg_logic_score
            : Number.NEGATIVE_INFINITY;
        const scoreB =
          typeof b.avg_logic_score === "number"
            ? b.avg_logic_score
            : Number.NEGATIVE_INFINITY;

        if (scoreA !== scoreB) return scoreB - scoreA;
        return (b.post_count ?? 0) - (a.post_count ?? 0);
      });
    }
    if (rankingMode === "posts") return filteredActiveThreads;
    return filteredRecentThreads;
  }, [
    filteredActiveThreads,
    filteredPopularThreads,
    filteredRecentThreads,
    rankingMode,
  ]);
  const rankingListType =
    rankingMode === "posts" ? "posts" : rankingMode === "recent" ? "latest" : "logic";
  const visibleRankingThreads = rankingThreads.slice(0, TOP_CARD_LIMIT);
  const aiSummaryThreads = useMemo(
    () =>
      filteredPopularThreads
        .filter((thread) => thread.summary?.trim())
        .slice(0, TOP_CARD_LIMIT),
    [filteredPopularThreads]
  );

  const totalPostCount = allThreads.reduce(
    (total, thread) => total + (thread.post_count ?? 0),
    0
  );

  useEffect(() => {
    if (initialSearchQuery) {
      setSearchQuery(initialSearchQuery);
    }
  }, [initialSearchQuery]);

  useEffect(() => {
    setSearchResultPage(1);
  }, [categoryFilter, node, searchQuery]);

  useEffect(() => {
    const saved = localStorage.getItem("forum_default_mode");
    if (saved === "easy" || saved === "normal") {
      setDefaultMode(saved);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("forum_font_size");
    if (saved === "small" || saved === "medium" || saved === "large") {
      setFontSizeMode(saved);
    }
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem(draftStorageKey);
    if (saved) {
      setText(saved);
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem(draftStorageKey, text);
  }, [text]);

  useEffect(() => {
    if (!shouldOpenExternalAiImport) return;

    setIsExternalAiImportOpen(true);
    requestAnimationFrame(() => {
      document
        .getElementById("create")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [shouldOpenExternalAiImport]);

  useEffect(() => {
    let cancelled = false;

    async function loadLoginStatus() {
      try {
        const res = await fetch("/api/forum/login/status", {
          cache: "no-store",
        });
        const result: unknown = await res.json().catch(() => null);
        const loggedIn = res.ok && isRecord(result) && result.loggedIn === true;

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

    async function loadTopSummary() {
      if (!tenant) return;

      try {
        setTopError("");
        const res = await fetch("/api/forum/top-summary", {
          cache: "no-store",
        });

        const result: unknown = await res.json();

        if (!res.ok) {
          const message = isRecord(result)
            ? toText(result.error, "掲示板の読み込みに失敗しました")
            : "掲示板の読み込みに失敗しました";
          throw new Error(message);
        }

        if (cancelled || !isRecord(result)) return;

        setPopularThreads(normalizeThreadRows(result.popularThreads));
        setActiveThreads(normalizeThreadRows(result.activeThreads));
        setRecentThreads(normalizeThreadRows(result.recentThreads));
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        setTopError(
          error instanceof Error
            ? error.message
            : "掲示板の読み込みに失敗しました"
        );
      }
    }

    void loadTopSummary();

    return () => {
      cancelled = true;
    };
  }, [tenant]);

  useEffect(() => {
    if (!analyzeScrollKey) return;

    requestAnimationFrame(() => {
      const el = document.getElementById("forum-analysis-result");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [analyzeScrollKey]);

  async function ensureForumBetaLoggedIn() {
    try {
      const res = await fetch("/api/forum/login/status", {
        cache: "no-store",
      });
      const result: unknown = await res.json().catch(() => null);
      const loggedIn = isRecord(result) && result.loggedIn === true;

      if (!res.ok || !loggedIn) {
        setIsForumBetaLoggedIn(false);
        setActionError("投稿・整理にはログインが必要です。");
        router.push(
          `/${tenant}/forum/login?next=${encodeURIComponent(
            `/${tenant}/forum#create`
          )}`
        );
        return false;
      }

      setIsForumBetaLoggedIn(true);
      return true;
    } catch (error) {
      console.error(error);
      setIsForumBetaLoggedIn(false);
      setActionError(
        "ログイン状態を確認できませんでした。時間をおいてもう一度お試しください。"
      );
      return false;
    }
  }

  async function analyzeText(sourceText: string) {
    const trimmed = sourceText.trim();
    if (!trimmed) {
      setActionError("整理したい内容を入力してください。");
      return;
    }

    if (!(await ensureForumBetaLoggedIn())) return;

    setLoading(true);
    setActionError("");
    setSelectedThreadId(null);
    setRelatedThreads([]);

    try {
      const res = await fetch("/api/forum/generate-issue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: trimmed,
        }),
      });

      const data: unknown = await res.json();

      if (!res.ok) {
        const message = isRecord(data)
          ? toText(data.error, "AI整理に失敗しました")
          : "AI整理に失敗しました";
        throw new Error(message);
      }

      const issue = normalizeGeneratedIssue(data, trimmed);
      setGeneratedIssue(issue);
      setAnalyzeScrollKey((prev) => prev + 1);

      const relatedRes = await fetch("/api/forum/search-related", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: trimmed,
          claim: issue.claim,
          premises: issue.premises,
          reasons: issue.reasons,
        }),
      });

      if (!relatedRes.ok) {
        setRelatedThreads([]);
        return;
      }

      const related: unknown = await relatedRes.json();
      setRelatedThreads(normalizeRelatedThreads(related));
    } catch (error) {
      console.error(error);
      setActionError(
        error instanceof Error ? error.message : "AI整理に失敗しました"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleOrganizePost() {
    const trimmed = text.trim();
    if (!trimmed) {
      setActionError("整えたい内容を入力してください。");
      return;
    }

    if (!(await ensureForumBetaLoggedIn())) return;

    setOrganizing(true);
    setActionError("");
    setOrganizedResult(null);

    try {
      const res = await fetch("/api/forum/organize-post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: trimmed }),
      });

      const data: unknown = await res.json();

      if (!res.ok || !isRecord(data)) {
        throw new Error("投稿文の整形に失敗しました");
      }

      setOrganizedResult({
        summary: toText(data.summary, "要点を整理できませんでした"),
        postText: toText(data.postText, trimmed),
      });
    } catch (error) {
      console.error(error);
      setActionError(
        error instanceof Error ? error.message : "投稿文の整形に失敗しました"
      );
    } finally {
      setOrganizing(false);
    }
  }

  async function handleUseOrganizedAndAnalyze() {
    if (!organizedResult?.postText?.trim()) return;

    const nextText = organizedResult.postText.trim();
    setText(nextText);
    await analyzeText(nextText);
  }

  async function handleCreateThread() {
    if (!generatedIssue || selectedThreadId) return;

    if (!(await ensureForumBetaLoggedIn())) return;

    const finalClaim =
      generatedIssue.claim.trim() || text.trim() || "新しい議論";
    const draftTitle = makeDraftTitle(finalClaim);

    setCreatingThread(true);
    setActionError("");

    try {
      const res = await fetch("/api/forum/create-thread-from-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenantSlug: tenant,
          title: draftTitle,
          claim: finalClaim,
          premises: generatedIssue.premises,
          reasons: generatedIssue.reasons,
          conflicts: generatedIssue.conflicts,
          postType: "auto",
        }),
      });

      const result: unknown = await res.json();

      if (!res.ok || !isRecord(result)) {
        const message = isRecord(result)
          ? toText(
              result.error || result.details || result.message,
              "スレッド作成に失敗しました"
            )
          : "スレッド作成に失敗しました";
        throw new Error(
          message === "スレッド作成に失敗しました"
            ? message
            : `スレッド作成に失敗しました：${message}`
        );
      }

      const threadId = toText(result.threadId).trim();
      if (!threadId) {
        throw new Error("作成したスレッドIDを取得できませんでした");
      }

      sessionStorage.removeItem(draftStorageKey);
      window.location.href = `/${tenant}/forum/thread/${threadId}`;
    } catch (error) {
      console.error(error);
      setActionError(
        error instanceof Error ? error.message : "スレッド作成に失敗しました"
      );
    } finally {
      setCreatingThread(false);
    }
  }

  function selectMode(mode: "normal" | "easy") {
    localStorage.setItem("forum_default_mode", mode);
    setDefaultMode(mode);
  }

  function selectFontSize(size: "small" | "medium" | "large") {
    localStorage.setItem("forum_font_size", size);
    setFontSizeMode(size);
  }

  async function handleLogout() {
    await fetch("/api/forum/logout", { method: "POST" }).catch(() => null);
    setIsForumBetaLoggedIn(false);
    setIsTopMenuOpen(false);
    router.push(`/${tenant}/forum/login`);
  }

  const renderedPremises = generatedIssue?.premises ?? [];
  const renderedReasons = generatedIssue?.reasons ?? [];
  const renderedConflicts = generatedIssue?.conflicts ?? [];

  return (
    <main style={pageStyle}>
      <ExternalAiImportModal
        isOpen={isExternalAiImportOpen}
        onClose={() => setIsExternalAiImportOpen(false)}
        tenant={tenant}
      />

      <section
        style={{
          ...panelStyle,
          marginBottom: 18,
          gap: 12,
          display: "grid",
          background: "#f8fafc",
          color: "#0f172a",
          border: "1px solid #cbd5e1",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ fontWeight: 900, fontSize: currentFontSize }}>
            表示設定
          </div>
          <div style={{ position: "relative" }}>
            <button
              type="button"
              aria-label="メニューを開く"
              aria-expanded={isTopMenuOpen}
              onClick={() => setIsTopMenuOpen((open) => !open)}
              style={{
                ...ghostButtonStyle,
                minWidth: 44,
                background: isTopMenuOpen ? "#111827" : "#ffffff",
                color: isTopMenuOpen ? "#ffffff" : "#111827",
                borderColor: isTopMenuOpen ? "#111827" : "#cbd5e1",
                fontSize: 18,
                lineHeight: 1,
              }}
            >
              ☰
            </button>
            {isTopMenuOpen && (
              <nav
                aria-label="Forumメニュー"
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  zIndex: 20,
                  minWidth: 240,
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
                  { href: `/${tenant}/forum/private-logs`, label: "あとで読む管理" },
                  {
                    href: `/${tenant}/forum/admin/delete-threads`,
                    label: "管理画面（会員）：非表示/復元",
                  },
                  {
                    href: `/${tenant}/forum/admin/re-evaluate-logic-score`,
                    label: "AI論理スコア再評価",
                  },
                  {
                    href: `/${tenant}/forum/admin/rebuild-discussion-map`,
                    label: "議論マップ再編案",
                  },
                  { href: `/${tenant}/forum/admin`, label: "管理者用画面" },
                  { href: `/${tenant}/forum`, label: "トップへ戻る" },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsTopMenuOpen(false)}
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
                      `/${tenant}/forum`
                    )}`}
                    onClick={() => setIsTopMenuOpen(false)}
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
            display: "flex",
            gap: 18,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              flex: "1 1 280px",
            }}
          >
            <div style={{ fontWeight: 800, minWidth: 92 }}>表示モード：</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => selectMode("normal")}
                style={{
                  ...ghostButtonStyle,
                  background: defaultMode === "normal" ? "#111827" : "#ffffff",
                  color: defaultMode === "normal" ? "#ffffff" : "#111827",
                  borderColor: defaultMode === "normal" ? "#111827" : "#cbd5e1",
                }}
              >
                標準
              </button>
              <button
                type="button"
                onClick={() => selectMode("easy")}
                style={{
                  ...ghostButtonStyle,
                  background: defaultMode === "easy" ? "#111827" : "#ffffff",
                  color: defaultMode === "easy" ? "#ffffff" : "#111827",
                  borderColor: defaultMode === "easy" ? "#111827" : "#cbd5e1",
                }}
              >
                やさしい表示
              </button>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              flex: "1 1 240px",
            }}
          >
            <div style={{ fontWeight: 800, minWidth: 92 }}>文字サイズ：</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(["small", "medium", "large"] as const).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => selectFontSize(size)}
                  style={{
                    ...ghostButtonStyle,
                    background: fontSizeMode === size ? "#111827" : "#ffffff",
                    color: fontSizeMode === size ? "#ffffff" : "#111827",
                    borderColor: fontSizeMode === size ? "#111827" : "#cbd5e1",
                  }}
                >
                  {size === "small" ? "小" : size === "medium" ? "中" : "大"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <header style={{ ...darkPanelStyle, marginBottom: 18 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            alignItems: "flex-start",
          }}
        >
          <div style={{ maxWidth: 680 }}>
            <div
              style={{
                color: "#9ca3af",
                fontSize: 13,
                fontWeight: 800,
                marginBottom: 6,
              }}
            >
              AI掲示板
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: 30,
                lineHeight: 1.25,
                letterSpacing: 0,
              }}
            >
              AIで整理して書き込める掲示板
            </h1>
            <p
              style={{
                margin: "10px 0 0",
                color: "#d1d5db",
                lineHeight: 1.8,
                fontSize: currentFontSize,
              }}
            >
              長くなった考えやChatGPTとの会話を、投稿しやすい形にまとめて共有できます。
            </p>
          </div>

        </div>

        {allThreads.length > 0 && totalPostCount > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 10,
              marginTop: 18,
            }}
          >
            <div>
              <div style={{ color: "#9ca3af", fontSize: 12 }}>表示中のスレッド</div>
              <div style={{ fontSize: 24, fontWeight: 900 }}>{allThreads.length}</div>
            </div>
            <div>
              <div style={{ color: "#9ca3af", fontSize: 12 }}>表示中の投稿数</div>
              <div style={{ fontSize: 24, fontWeight: 900 }}>{totalPostCount}</div>
            </div>
            <div>
              <div style={{ color: "#9ca3af", fontSize: 12 }}>カテゴリ</div>
              <div style={{ fontSize: 24, fontWeight: 900 }}>
                {Math.max(categoryOptions.length - 1, 0)}
              </div>
            </div>
          </div>
        ) : (
          <p
            style={{
              margin: "16px 0 0",
              color: "#d1d5db",
              lineHeight: 1.7,
              fontSize: currentFontSize - 1,
            }}
          >
            まずは過去の会話やメモから投稿候補を作ってみてください。
          </p>
        )}
      </header>

      <section
        style={{
          border: "1px solid #fde68a",
          borderRadius: 10,
          background: "#fffbeb",
          color: "#78350f",
          marginBottom: 18,
          padding: "12px 14px",
          lineHeight: 1.7,
        }}
      >
        <h2
          style={{
            margin: "0 0 6px",
            color: "#78350f",
            fontSize: 16,
            fontWeight: 900,
          }}
        >
          β版として試験公開中です
        </h2>
        <p style={{ margin: 0 }}>
          β版です。投稿内容は公開されます。個人情報・第三者情報は貼らないでください。
        </p>
      </section>

      <section style={{ ...panelStyle, marginBottom: 18 }}>
        <div style={{ marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 22 }}>投稿する・投稿候補を作る</h2>
          <p
            style={{
              margin: "8px 0 0",
              color: "#475569",
              fontSize: currentFontSize - 1,
              lineHeight: 1.7,
            }}
          >
            過去の会話やメモから投稿候補を作るか、自分の考えを直接書いて投稿できます。
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
            gap: 12,
          }}
        >
          <div
            style={{
              border: "1px solid #3d4657",
              borderRadius: 8,
              padding: 14,
              background: "#10141d",
              color: "#f9fafb",
            }}
          >
            <h3 style={{ margin: 0, fontSize: currentFontSize + 2 }}>
              過去の会話やメモを投稿に変換できます
            </h3>
            <div
              style={{
                marginTop: 12,
                display: "grid",
                gap: 8,
                color: "#e5e7eb",
                fontSize: currentFontSize - 1,
                lineHeight: 1.6,
              }}
            >
              <div>① ChatGPTとの会話・メモを用意</div>
              <div style={{ color: "#93c5fd", fontWeight: 900 }}>↓</div>
              <div>② AIで投稿用に整理</div>
              <div style={{ color: "#93c5fd", fontWeight: 900 }}>↓</div>
              <div>③ 投稿候補を選んで投稿</div>
            </div>
            <p
              style={{
                margin: "12px 0 0",
                color: "#cbd5e1",
                fontSize: currentFontSize - 2,
                lineHeight: 1.6,
              }}
            >
              読み取っただけでは投稿されません。投稿する内容は自分で選べます。
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                marginTop: 14,
                alignItems: "center",
              }}
            >
              <button
                type="button"
                onClick={() => setIsExternalAiImportOpen(true)}
                style={{
                  ...ghostButtonStyle,
                  background: "#2563eb",
                  color: "#ffffff",
                  borderColor: "#2563eb",
                  flexShrink: 0,
                }}
              >
                過去の会話・メモから投稿候補を作る
              </button>
              <Link
                href={`/${tenant}/forum/private-logs`}
                style={{
                  ...ghostButtonStyle,
                  display: "inline-flex",
                  alignItems: "center",
                  background: "#e0f2fe",
                  color: "#075985",
                  borderColor: "#7dd3fc",
                  flexShrink: 0,
                  textDecoration: "none",
                }}
              >
                保存済み参考投稿を見る
              </Link>
            </div>
          </div>

          <div
            style={{
              border: "1px solid #d7dde8",
              borderRadius: 8,
              padding: 14,
              background: "#f8fafc",
              color: "#0f172a",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 900, color: "#475569" }}>
              直接書く場合はこちら
            </div>
            <h3 style={{ margin: "8px 0 0", fontSize: currentFontSize + 2 }}>
              投稿したい考えを書く
            </h3>
            <p
              style={{
                margin: "10px 0 0",
                color: "#475569",
                fontSize: currentFontSize - 2,
                lineHeight: 1.7,
              }}
            >
              短い意見でも大丈夫です。必要ならAIで読みやすく整えてから投稿できます。
            </p>
            <button
              type="button"
              onClick={() =>
                document
                  .getElementById("thread-draft-input")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              style={{
                ...ghostButtonStyle,
                marginTop: 14,
                background: "#111827",
                color: "#ffffff",
                borderColor: "#111827",
              }}
            >
              投稿欄へ移動する
            </button>
          </div>
        </div>
      </section>

      <section style={{ ...panelStyle, marginBottom: 18 }}>
        <div style={{ marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 22 }}>投稿を検索して読む</h2>
          <p
            style={{
              margin: "8px 0 0",
              color: "#475569",
              fontSize: currentFontSize - 1,
              lineHeight: 1.7,
            }}
          >
            気になる言葉やカテゴリから、関連する投稿を探せます。
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
            gap: 12,
          }}
        >
          <div>
            <label htmlFor="forum-search" style={labelStyle}>
              検索
            </label>
            <input
              id="forum-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="タイトル、要約、投稿内容"
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="forum-category" style={labelStyle}>
              カテゴリ
            </label>
            <select
              id="forum-category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={inputStyle}
            >
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
            marginTop: 12,
          }}
        >
          <div style={smallMetaStyle}>
            人気 {filteredPopularThreads.length}件 / 活発{" "}
            {filteredActiveThreads.length}件
          </div>

          {hasFilter && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setCategoryFilter(ALL_CATEGORIES);
                setSearchResultPage(1);
                router.push(`/${tenant}/forum`);
              }}
              style={ghostButtonStyle}
            >
              条件をリセット
            </button>
          )}
        </div>
      </section>

      {topError && (
        <div
          style={{
            ...panelStyle,
            marginBottom: 18,
            borderColor: "#fca5a5",
            background: "#fef2f2",
            color: "#991b1b",
          }}
        >
          {topError}
        </div>
      )}

      {(goal || keyword || selectedNodeLabel) && (
        <section style={{ ...panelStyle, marginBottom: 18 }}>
          {goal && (
            <div style={{ marginBottom: keyword ? 12 : 0 }}>
              <div style={labelStyle}>マクロから渡されたゴール</div>
              <div style={{ fontWeight: 800, fontSize: currentFontSize }}>{goal}</div>
            </div>
          )}
          {keyword && (
            <div>
              <div style={labelStyle}>注目している論点</div>
              <div style={{ fontWeight: 800, fontSize: currentFontSize }}>
                {keyword}
              </div>
            </div>
          )}
          {selectedNodeLabel && (
            <div style={{ marginTop: goal || keyword ? 12 : 0 }}>
              <div style={labelStyle}>選択中の論点</div>
              <div style={{ fontWeight: 800, fontSize: currentFontSize }}>
                選択中の論点：{selectedNodeLabel}
              </div>
              {selectedNodePathText && (
                <div style={{ ...smallMetaStyle, marginTop: 6 }}>
                  位置：{selectedNodePathText}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {hasSearchResultContext && (
        <section
          style={{
            ...panelStyle,
            marginBottom: 22,
            background: "#ffffff",
            color: "#111827",
            border: "1px solid #cbd5e1",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "flex-start",
              marginBottom: 12,
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: 20 }}>{searchResultTitle}</h2>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  marginTop: 8,
                  color: "#475569",
                  fontSize: currentFontSize - 2,
                  lineHeight: 1.6,
                }}
              >
                <span>関連スレッド：{searchResultThreads.length}件</span>
                <span>
                  表示中：{searchResultDisplayStart}〜{searchResultEndIndex}件
                </span>
                <span>条件：カテゴリ {categoryFilter}</span>
              </div>
              {selectedNodeLabel && (
                <div style={{ ...smallMetaStyle, marginTop: 6 }}>
                  選択中の論点：{selectedNodeLabel}
                  {selectedNodePathText ? ` / 位置：${selectedNodePathText}` : ""}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setCategoryFilter(ALL_CATEGORIES);
                setSearchResultPage(1);
                router.push(`/${tenant}/forum`);
              }}
              style={ghostButtonStyle}
            >
              条件をリセット
            </button>
          </div>

          {visibleSearchResultThreads.length > 0 ? (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
                  gap: 12,
                }}
              >
                {visibleSearchResultThreads.map((thread, index) => (
                  <ThreadCard
                    key={`search-result-${thread.id}`}
                    thread={thread}
                    tenant={tenant}
                    currentFontSize={currentFontSize}
                    isFeatured={index === 0 && currentSearchResultPage === 1}
                    compact
                  />
                ))}
              </div>

              {searchResultTotalPages > 1 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    flexWrap: "wrap",
                    alignItems: "center",
                    marginTop: 14,
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setSearchResultPage((page) => Math.max(1, page - 1))
                    }
                    disabled={currentSearchResultPage <= 1}
                    style={{
                      ...ghostButtonStyle,
                      opacity: currentSearchResultPage <= 1 ? 0.55 : 1,
                      cursor:
                        currentSearchResultPage <= 1 ? "not-allowed" : "pointer",
                    }}
                  >
                    前へ
                  </button>
                  <div style={smallMetaStyle}>
                    {currentSearchResultPage} / {searchResultTotalPages}ページ
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setSearchResultPage((page) =>
                        Math.min(searchResultTotalPages, page + 1)
                      )
                    }
                    disabled={currentSearchResultPage >= searchResultTotalPages}
                    style={{
                      ...ghostButtonStyle,
                      opacity:
                        currentSearchResultPage >= searchResultTotalPages ? 0.55 : 1,
                      cursor:
                        currentSearchResultPage >= searchResultTotalPages
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    次へ
                  </button>
                </div>
              )}
            </>
          ) : (
            <div style={{ ...panelStyle, color: "#475569" }}>
              検索条件を変えるか、投稿候補を作って新しい議論を始められます。
            </div>
          )}
        </section>
      )}

      <section
        style={{
          ...panelStyle,
          marginBottom: 22,
          background: "#f8fafc",
          color: "#0f172a",
          border: "1px solid #cbd5e1",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 20 }}>議論の全体マップ</h2>
        <p
          style={{
            margin: "6px 0 12px",
            color: "#475569",
            fontSize: currentFontSize - 2,
            lineHeight: 1.6,
          }}
        >
          この掲示板では、個別の問題を大きな論点の中で整理していきます。
        </p>
        <div
          style={{
            margin: 0,
            whiteSpace: "pre-wrap",
            overflowX: "auto",
            background: "#ffffff",
            color: "#111827",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: 12,
            fontSize: currentFontSize - 1,
            lineHeight: 1.8,
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          }}
      >
        {renderDiscussionMap(discussionMapRoot, discussionMapBranches, tenant, node)}
      </div>
    </section>

      <section
        style={{
          ...panelStyle,
          marginBottom: 22,
          background: "#f8fafc",
          color: "#0f172a",
          border: "1px solid #cbd5e1",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "flex-start",
            marginBottom: 12,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 20 }}>ランキングで見る</h2>
            <p
              style={{
                margin: "6px 0 0",
                color: "#475569",
                fontSize: currentFontSize - 2,
                lineHeight: 1.6,
              }}
            >
              新着順、AI論理スコア順、投稿数順を切り替えて議論を探せます。
            </p>
          </div>
          <Link
            href={`/${tenant}/forum/list/${rankingListType}`}
            style={sectionLinkStyle}
          >
            全ての投稿を見る →
          </Link>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 12,
          }}
        >
          {RANKING_TABS.map((tab) => {
            const selected = rankingMode === tab.value;

            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setRankingMode(tab.value)}
                aria-pressed={selected}
                style={{
                  ...ghostButtonStyle,
                  background: selected ? "#111827" : "#ffffff",
                  color: selected ? "#ffffff" : "#111827",
                  borderColor: selected ? "#111827" : "#cbd5e1",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
            gap: 12,
          }}
        >
          {visibleRankingThreads.length > 0 ? (
            visibleRankingThreads.map((thread, index) => (
              <ThreadCard
                key={`ranking-${rankingMode}-${thread.id}`}
                thread={thread}
                tenant={tenant}
                currentFontSize={currentFontSize}
                isFeatured={index === 0 && !hasFilter}
              />
            ))
          ) : (
            <div style={{ ...panelStyle, color: "#475569" }}>
              投稿が増えるとランキングが表示されます。まず投稿候補を作ってみてください。
            </div>
          )}
        </div>
      </section>

      <section
        style={{
          ...panelStyle,
          marginBottom: 22,
          background: "#f0f9ff",
          color: "#0f172a",
          border: "1px solid #bae6fd",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "flex-start",
            marginBottom: 12,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 20 }}>新着スレッド</h2>
            <p
              style={{
                margin: "6px 0 0",
                color: "#075985",
                fontSize: currentFontSize - 2,
                lineHeight: 1.6,
                fontWeight: 700,
              }}
            >
              新しく作成された議論を、作成日の新しい順で表示します。
            </p>
          </div>
          <Link href={`/${tenant}/forum/list/latest`} style={sectionLinkStyle}>
            全ての投稿を見る →
          </Link>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
            gap: 12,
          }}
        >
          {visibleRecentThreads.length > 0 ? (
            visibleRecentThreads.map((thread, index) => (
              <ThreadCard
                key={`recent-${thread.id}`}
                thread={thread}
                tenant={tenant}
                currentFontSize={currentFontSize}
                isFeatured={index === 0 && !hasFilter}
              />
            ))
          ) : (
            <div style={{ ...panelStyle, color: "#475569" }}>
              新しい議論は、投稿候補を作るところから始められます。
            </div>
          )}
        </div>
      </section>

      <section
        style={{
          ...panelStyle,
          marginBottom: 22,
          background: "#eff6ff",
          color: "#0f172a",
          border: "1px solid #bfdbfe",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "flex-start",
            marginBottom: 12,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 20 }}>今読むべきAI総括</h2>
            <p
              style={{
                margin: "6px 0 0",
                color: "#475569",
                fontSize: currentFontSize - 2,
                lineHeight: 1.6,
              }}
            >
              投稿が集まっている議論から、AIの要約を先に読めます。
            </p>
          </div>
          <Link href={`/${tenant}/forum/list/ai-summary`} style={sectionLinkStyle}>
            全ての投稿を見る →
          </Link>
        </div>

        {aiSummaryThreads.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
              gap: 12,
            }}
          >
            {aiSummaryThreads.map((thread) => (
              <article
                key={`ai-summary-${thread.id}`}
                role="link"
                tabIndex={0}
                aria-label={`${thread.title}の詳細を見る`}
                onClick={() => router.push(`/${tenant}/forum/thread/${thread.id}`)}
                onKeyDown={(event) => {
                  if (event.currentTarget !== event.target) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    router.push(`/${tenant}/forum/thread/${thread.id}`);
                  }
                }}
                onMouseEnter={() => setActiveAiSummaryThreadId(thread.id)}
                onMouseLeave={() => setActiveAiSummaryThreadId(null)}
                onFocus={() => setActiveAiSummaryThreadId(thread.id)}
                onBlur={() => setActiveAiSummaryThreadId(null)}
                style={{
                  border:
                    activeAiSummaryThreadId === thread.id
                      ? "1px solid #2563eb"
                      : "1px solid #d7dde8",
                  borderRadius: 8,
                  padding: 14,
                  background: "#f8fafc",
                  color: "#111827",
                  cursor: "pointer",
                  boxShadow:
                    activeAiSummaryThreadId === thread.id
                      ? "0 8px 18px rgba(37, 99, 235, 0.14)"
                      : "none",
                  outline:
                    activeAiSummaryThreadId === thread.id
                      ? "2px solid rgba(37, 99, 235, 0.18)"
                      : "none",
                  outlineOffset: 2,
                }}
              >
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  <span
                    style={{
                      border: "1px solid #bfdbfe",
                      borderRadius: 8,
                      padding: "2px 7px",
                      background: "#dbeafe",
                      color: "#1d4ed8",
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    AI総括
                  </span>
                  {thread.category && (
                    <span
                      style={{
                        border: "1px solid #d1d5db",
                        borderRadius: 8,
                        padding: "2px 7px",
                        background: "#ffffff",
                        color: "#374151",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {thread.category}
                    </span>
                  )}
                </div>

                <div
                  style={{
                    marginTop: 4,
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      color: "#475569",
                      fontSize: 12,
                      fontWeight: 900,
                      marginBottom: 4,
                    }}
                  >
                    問題
                  </div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: currentFontSize + 1,
                      lineHeight: 1.45,
                      fontWeight: 900,
                    }}
                  >
                    {truncate(thread.title, 36)}
                  </h3>
                </div>

                <div>
                  <div
                    style={{
                      color: "#1d4ed8",
                      fontSize: 12,
                      fontWeight: 900,
                      marginBottom: 4,
                    }}
                  >
                    AI総括
                  </div>
                  <p
                    style={{
                      margin: 0,
                      color: "#334155",
                      fontSize: currentFontSize - 1,
                      lineHeight: 1.7,
                    }}
                  >
                    {truncate(thread.summary, 50)}
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    marginTop: 12,
                    ...smallMetaStyle,
                  }}
                >
                  <span>投稿数 {thread.post_count ?? 0}</span>
                  {typeof thread.avg_logic_score === "number" &&
                    thread.avg_logic_score > 0 && (
                      <span>AI論理スコア平均 {formatScore(thread.avg_logic_score)}</span>
                    )}
                </div>

                <Link
                  href={`/${tenant}/forum/thread/${thread.id}`}
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    display: "inline-flex",
                    marginTop: 12,
                    color: "#0d47a1",
                    fontWeight: 800,
                    textDecoration: "underline",
                    textUnderlineOffset: 3,
                  }}
                >
                  詳しく見る
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div style={{ ...smallMetaStyle, color: "#475569" }}>
            投稿が増えるとAI総括が表示されます。
          </div>
        )}
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          gap: 18,
          marginBottom: 22,
        }}
      >
        <div
          style={{
            ...panelStyle,
            background: "#f0fdf4",
            color: "#0f172a",
            border: "1px solid #bbf7d0",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "flex-start",
              marginBottom: 10,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 20 }}>評価が高いスレッド</h2>
            <Link href={`/${tenant}/forum/list/high-score`} style={sectionLinkStyle}>
              全ての投稿を見る →
            </Link>
          </div>
          <p
            style={{
              margin: "0 0 12px",
              color: "#166534",
              fontSize: currentFontSize - 2,
              lineHeight: 1.6,
              fontWeight: 700,
            }}
          >
            AI論理スコアが高く、根拠や反論が整理された議論です。
          </p>
          <div style={{ display: "grid", gap: 10 }}>
            {visiblePopularThreads.length > 0 ? (
              visiblePopularThreads.map((thread, index) => (
                <ThreadCard
                  key={thread.id}
                  thread={thread}
                  tenant={tenant}
                  currentFontSize={currentFontSize}
                  isFeatured={index === 0 && !hasFilter}
                />
              ))
            ) : (
              <div style={panelStyle}>
                評価対象が増えるとここに表示されます。
                {selectedNodeLabel && (
                  <div style={{ ...smallMetaStyle, marginTop: 6 }}>
                    この論点について、下の入力欄から新しく投稿できます。
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            ...panelStyle,
            background: "#fffbeb",
            color: "#0f172a",
            border: "1px solid #fde68a",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "flex-start",
              marginBottom: 10,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 20 }}>投稿が多いスレッド</h2>
            <Link href={`/${tenant}/forum/list/many-posts`} style={sectionLinkStyle}>
              全ての投稿を見る →
            </Link>
          </div>
          <p
            style={{
              margin: "0 0 12px",
              color: "#92400e",
              fontSize: currentFontSize - 2,
              lineHeight: 1.6,
              fontWeight: 700,
            }}
          >
            意見・反論・補足が多く集まっている議論です。
          </p>
          <div style={{ display: "grid", gap: 10 }}>
            {visibleActiveThreads.length > 0 ? (
              visibleActiveThreads.map((thread, index) => (
                <ThreadCard
                  key={thread.id}
                  thread={thread}
                  tenant={tenant}
                  currentFontSize={currentFontSize}
                  isFeatured={index === 0 && !hasFilter}
                />
              ))
            ) : (
              <div style={panelStyle}>意見・反論・補足が集まるとここに表示されます。</div>
            )}
          </div>
        </div>
      </section>

      <section id="create" style={{ ...darkPanelStyle, marginBottom: 18 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
            alignItems: "flex-start",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 22 }}>1. 投稿したい考えを書く</h2>
            <p
              style={{
                margin: "8px 0 0",
                color: "#cbd5e1",
                fontSize: currentFontSize - 1,
                lineHeight: 1.7,
              }}
            >
              まず考えを書きます。必要ならAIで読みやすく整えてから、論点整理へ進めます。
            </p>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <label htmlFor="thread-draft-input" style={{ ...labelStyle, color: "#d1d5db" }}>
            投稿の下書き
          </label>
          <textarea
            id="thread-draft-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`例：
消費税は減税すべきだと思う。
需要不足の状況では、消費税が消費を抑えてしまうため。
一方で財源をどうするかは別途議論が必要。`}
            rows={6}
            style={{
              ...darkInputStyle,
              resize: "vertical",
              minHeight: 150,
              lineHeight: 1.75,
              fontSize: currentFontSize,
            }}
          />
        </div>

        {organizedResult && (
          <div
            style={{
              border: "1px solid #3d4657",
              borderRadius: 8,
              padding: 14,
              marginTop: 20,
              paddingTop: 16,
              borderTop: "3px solid #60a5fa",
              background: "#10141d",
              color: "#f9fafb",
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 6 }}>
              STEP2：整えた内容を確認
            </div>
            <div
              style={{
                color: "#cbd5e1",
                fontSize: currentFontSize - 2,
                lineHeight: 1.6,
                marginBottom: 10,
              }}
            >
              内容を確認して、問題なければ論点整理へ進めます。
            </div>
            <div
              style={{
                whiteSpace: "pre-wrap",
                color: "#d1d5db",
                lineHeight: 1.7,
                fontSize: currentFontSize - 1,
              }}
            >
              {organizedResult.summary}
            </div>

            <div style={{ fontWeight: 800, marginTop: 14, marginBottom: 8 }}>
              整えた投稿文
            </div>
            <div
              style={{
                whiteSpace: "pre-wrap",
                color: "#f9fafb",
                lineHeight: 1.8,
                fontSize: currentFontSize,
              }}
            >
              {organizedResult.postText}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <button
                type="button"
                onClick={() => setText(organizedResult.postText)}
                style={{
                  ...ghostButtonStyle,
                  background: "#1f2937",
                  color: "#f9fafb",
                  borderColor: "#475569",
                }}
              >
                下書きに戻す
              </button>
              <PrimaryButton onClick={handleUseOrganizedAndAnalyze} disabled={loading}>
                {loading ? "整理中..." : "この内容で論点を整理"}
              </PrimaryButton>
            </div>
          </div>
        )}

        {actionError && (
          <div
            style={{
              border: "1px solid #fca5a5",
              borderRadius: 8,
              padding: 12,
              marginTop: 12,
              color: "#fecaca",
              background: "#3b1518",
            }}
          >
            {actionError}
          </div>
        )}

        <div
          style={{
            marginTop: 10,
            color: "#cbd5e1",
            fontSize: currentFontSize - 2,
            lineHeight: 1.6,
          }}
        >
          任意：文章を整えたい時だけ使えます。
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
          <PrimaryButton
            onClick={handleOrganizePost}
            disabled={organizing || loading}
            variant="secondary"
          >
            {organizing ? "整えています..." : "投稿文を読みやすく整える"}
          </PrimaryButton>
          <PrimaryButton
            onClick={() => analyzeText(text)}
            disabled={loading || organizing}
          >
            {loading ? "整理中..." : "論点を整理して次へ"}
          </PrimaryButton>
        </div>
      </section>

      {generatedIssue && (
        <section
          id="forum-analysis-result"
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
            gap: 18,
            alignItems: "start",
          }}
        >
          <div style={panelStyle}>
            <h2 style={{ margin: 0, fontSize: 22 }}>3. 論点の整理結果</h2>
            {generatedIssue.easySummary && defaultMode === "easy" && (
              <div
                style={{
                  marginTop: 12,
                  border: "1px solid #bbf7d0",
                  borderRadius: 8,
                  padding: 12,
                  background: "#f0fdf4",
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.9,
                  fontSize: currentFontSize,
                }}
              >
                {generatedIssue.easySummary}
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <div style={labelStyle}>
                {generatedIssue.mode === "split" ? "主張" : "問い"}
              </div>
              <div
                style={{
                  fontWeight: 800,
                  lineHeight: 1.7,
                  fontSize: currentFontSize + 1,
                }}
              >
                {generatedIssue.claim}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
                marginTop: 16,
              }}
            >
              <div>
                <div style={labelStyle}>前提</div>
                <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
                  {renderedPremises.length > 0 ? (
                    renderedPremises.map((premise, index) => (
                      <li key={`${premise}-${index}`}>{premise}</li>
                    ))
                  ) : (
                    <li style={{ color: "#6b7280" }}>AIで整理するとここに表示されます。</li>
                  )}
                </ul>
              </div>

              <div>
                <div style={labelStyle}>根拠</div>
                <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
                  {renderedReasons.length > 0 ? (
                    renderedReasons.map((reason, index) => (
                      <li key={`${reason}-${index}`}>{reason}</li>
                    ))
                  ) : (
                    <li style={{ color: "#6b7280" }}>AIで整理するとここに表示されます。</li>
                  )}
                </ul>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={labelStyle}>反論・リスク</div>
              <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
                {renderedConflicts.length > 0 ? (
                  renderedConflicts.map((conflict, index) => (
                    <li key={`${conflict.opinion}-${index}`}>
                      {conflict.opinion}
                      {conflict.rebuttal ? ` / ${conflict.rebuttal}` : ""}
                    </li>
                  ))
                ) : (
                  <li style={{ color: "#6b7280" }}>AIで整理するとここに表示されます。</li>
                )}
              </ul>
            </div>
          </div>

          <aside style={panelStyle}>
            <h2 style={{ margin: 0, fontSize: 20 }}>4. 近い議論に参加する</h2>
            <p style={{ ...smallMetaStyle, marginTop: 6 }}>
              近いスレッドがあれば、まずそこに参加できます。なければ新しく作成します。
            </p>

            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              {relatedThreads.length > 0 ? (
                relatedThreads.map((thread) => (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() =>
                      setSelectedThreadId((current) =>
                        current === thread.id ? null : thread.id
                      )
                    }
                    style={{
                      width: "100%",
                      textAlign: "left",
                      border:
                        selectedThreadId === thread.id
                          ? "2px solid #2563eb"
                          : "1px solid #d7dde8",
                      borderRadius: 8,
                      padding: 12,
                      background:
                        selectedThreadId === thread.id ? "#eff6ff" : "#ffffff",
                      color: "#111827",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                        alignItems: "center",
                        marginBottom: 8,
                      }}
                    >
                      <span style={smallMetaStyle}>{thread.category ?? "未分類"}</span>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {selectedThreadId === thread.id && (
                          <span
                            style={{
                              border: "1px solid #2563eb",
                              borderRadius: 8,
                              padding: "2px 7px",
                              background: "#dbeafe",
                              color: "#1d4ed8",
                              fontSize: 12,
                              fontWeight: 800,
                            }}
                          >
                            選択中
                          </span>
                        )}
                        <StanceLabel stance={thread.stance} />
                      </div>
                    </div>
                    <div
                      style={{
                        fontWeight: 800,
                        lineHeight: 1.5,
                        fontSize: currentFontSize,
                      }}
                    >
                      {truncate(thread.title, 36)}
                    </div>
                    {thread.summary && (
                      <div style={{ ...smallMetaStyle, marginTop: 6 }}>
                        {truncate(thread.summary, 50)}
                      </div>
                    )}
                    {selectedNodeLabel && (
                      <div style={{ ...smallMetaStyle, marginTop: 6 }}>
                        対応ツリー項目：{selectedNodePathText}
                      </div>
                    )}
                    {thread.reason && (
                      <div style={{ ...smallMetaStyle, marginTop: 6 }}>
                        {truncate(thread.reason, 50)}
                      </div>
                    )}
                    {selectedThreadId === thread.id && (
                      <div
                        style={{
                          marginTop: 8,
                          color: "#1d4ed8",
                          fontSize: currentFontSize - 2,
                          lineHeight: 1.6,
                          fontWeight: 700,
                        }}
                      >
                        このスレッドを選択中です。内容を確認してから参加できます。
                      </div>
                    )}
                  </button>
                ))
              ) : (
                <div style={{ ...smallMetaStyle, marginTop: 8 }}>
                  近いスレッドはまだありません。新しく作成できます。
                </div>
              )}
            </div>

            <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
              {selectedThreadId ? (
                <>
                  <div style={{ ...smallMetaStyle }}>
                    選択したスレッドの詳細画面へ移動します。
                  </div>
                  <Link
                    href={`/${tenant}/forum/thread/${selectedThreadId}`}
                    style={{
                      display: "block",
                      textAlign: "center",
                      padding: "12px 14px",
                      borderRadius: 8,
                      background: "#2563eb",
                      color: "#ffffff",
                      textDecoration: "none",
                      fontWeight: 900,
                    }}
                  >
                    このスレッドに参加する
                  </Link>
                </>
              ) : (
                <PrimaryButton
                  onClick={handleCreateThread}
                  disabled={creatingThread || Boolean(selectedThreadId)}
                  style={{
                    width: "100%",
                    background: "#047857",
                  }}
                >
                  {creatingThread ? "作成中..." : "近いスレッドがなければ新規作成"}
                </PrimaryButton>
              )}
            </div>
          </aside>
        </section>
      )}

      <ForumGuideTree tenant={tenant} />
    </main>
  );
}
