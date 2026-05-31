// src/app/[tenant]/forum/thread/[id]/page.tsx


"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
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

function comparePostsByNew(a?: PostRow | null, b?: PostRow | null) {
  return postCreatedTime(b) - postCreatedTime(a);
}

function comparePostsByLogicScore(a?: PostRow | null, b?: PostRow | null) {
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
  { value: "unknown", label: "未分類：あとでAIが整理" },
  { value: "support", label: "賛成" },
  { value: "oppose", label: "反対" },
  { value: "neutral", label: "中立" },
  { value: "other", label: "その他" },
];

type LocationMapNode = {
  id: string;
  label: string;
  nodeId?: string;
  isCurrent?: boolean;
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
  const content = node.nodeId ? (
    <Link
      href={`/${tenant}/forum?node=${node.nodeId}`}
      style={{
        color: node.isCurrent ? "#166534" : "#0d47a1",
        fontWeight: 700,
        textDecoration: "underline",
        textUnderlineOffset: 2,
      }}
    >
      {node.label}
    </Link>
  ) : (
    node.label
  );

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

function extractExternalAiAnswer(originalPost?: string | null) {
  const text = originalPost ?? "";
  const labels = ["AI回答・整理:", "AI回答・整理："];
  const matchedLabel = labels.find((label) => text.includes(label));

  if (!matchedLabel) return "";

  const afterLabel = text.slice(text.indexOf(matchedLabel) + matchedLabel.length).trim();
  if (!afterLabel) return "";

  const nextHeading = afterLabel.search(
    /\n\s*(補足|前提|根拠|反論|反論・リスク)[:：]/
  );

  return (nextHeading >= 0 ? afterLabel.slice(0, nextHeading) : afterLabel).trim();
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

const [explanations, setExplanations] = useState<Record<string, string>>({});
const [feedbackLoadingPostId, setFeedbackLoadingPostId] = useState<string | null>(null);


const [mode, setMode] = useState<"normal" | "easy">("normal");
useEffect(() => {
  const saved = localStorage.getItem("forum_default_mode");
  if (saved === "easy" || saved === "normal") {
    setMode(saved);
  }
}, []);


const [summaryLoading, setSummaryLoading] = useState(false);
const [summaryNotice, setSummaryNotice] = useState<string | null>(null);


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

const [treeVariant, setTreeVariant] = useState<"A" | "C">("A");

  const [predictionFlag, setPredictionFlag] = useState(false);
  const [predictionTarget, setPredictionTarget] = useState("");
  const [predictionDeadline, setPredictionDeadline] = useState("");



  useEffect(() => {
    (async () => {
      const resolved = await params;
      setTenant(resolved.tenant);
      setThreadId(resolved.id);
    })();
  }, [params]);

  useEffect(() => {
    if (!threadId) return;
    loadThread();
  }, [threadId]);






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


  const fontSizeMap = {
    small: {
      base: 14,
      title: 24,
    },
    medium: {
      base: 16,
      title: 28,
    },
    large: {
      base: 20,
      title: 32,
    },
  };

  const currentFont = fontSizeMap[fontSize];
  const currentUrl =
    typeof window !== "undefined" ? window.location.href : "";

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
  return [...visiblePosts].sort((a, b) => {
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
      const scored = group.opinions.map((op) => {
        const base = op.opinion.logic_score ?? 0;

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
    const scoredPosts = visiblePosts.filter((post) => (post.logic_score ?? 0) > 0);

    if (scoredPosts.length === 0) return 0;

    const total = scoredPosts.reduce((sum, post) => {
      return sum + (post.logic_score ?? 0);
    }, 0);

    return Math.round(total / scoredPosts.length);
  }, [visiblePosts]);

  const maxLogicScore = useMemo(() => {
    const scoredPosts = visiblePosts.filter((post) => (post.logic_score ?? 0) > 0);
    if (scoredPosts.length === 0) return null;
    return Math.max(...scoredPosts.map((post) => post.logic_score ?? 0));
  }, [visiblePosts]);

  const originalStructure = useMemo(() => {
    return splitContent(thread?.original_post ?? "");
  }, [thread?.original_post]);

const externalAiAnswerFromOriginalPost = extractExternalAiAnswer(thread?.original_post);
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
const normalizeQuestionText = (value?: string | null) =>
  (value ?? "").replace(/[。、．.！？!?「」『』【】（）()[\]\s]/g, "");
const shouldShowQuestionCard =
  Boolean(thread?.original_post?.trim()) &&
  normalizeQuestionText(thread?.original_post) !== normalizeQuestionText(thread?.title);
const initialPostCount = summary?.counts?.total ?? posts.length;
const showInitialDiscussionNote = initialPostCount <= 3;
const provisionalAnswerText =
  summary?.provisional_answer?.trim() ||
  externalAiAnswerFromOriginalPost ||
  "まだAIの暫定回答はありません。AIまとめを確認・更新すると表示されます。";

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

      setBookmarkSaveState({
        loading: false,
        saved: true,
        error: "",
      });
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

      if (!res.ok) {
        throw new Error(result?.error || "投稿失敗");
      }

      setReplyToOpinionId(null);
      setText("");
      setPostRole("opinion");
      setStanceLabel("unknown");
      setPredictionFlag(false);
      setPredictionTarget("");
      setPredictionDeadline("");
      setSelectedGuide(null);
      await loadThread();
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

  async function handleHidePost(postId: string) {
    if (
      !confirm(
        "この投稿を非表示にしますか？\n※ 後から復元機能を追加予定です"
      )
    ) {
      return;
    }

    const res = await fetch(`/api/forum/posts/${postId}/delete`, {
      method: "PATCH",
    });

    const result = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(result?.error || "投稿の非表示に失敗しました");
      return;
    }

    await loadThread();
  }

function jumpToMainIssues() {
  const el = document.getElementById("main-issues");
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}


  return (
    <main
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: "24px 16px 80px",
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




      <div style={{ marginBottom: 16 }}>
        <LinkButton href={`/${tenant}/forum`} variant="subtle">
          ← 掲示板トップに戻る
        </LinkButton>
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


<div style={{ marginBottom: 12 }}>
  <PrimaryButton
    onClick={() => setMode(mode === "normal" ? "easy" : "normal")}
  >
    {mode === "normal"
      ? "🐵 やさしくする（小学生向け）"
      : "🧠 通常表示に戻す"}
  </PrimaryButton>
</div>


<SectionCard variant="info">
            <h1
              style={{
                margin: 0,
                fontSize: currentFont.title,
                fontWeight: 800,
                lineHeight: 1.4,
                color: "#111",
              }}
            >
              {thread.title}
            </h1>
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
      AI論理スコア平均: {averageLogicScore}
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
    <>AI論理スコア平均: 未評価</>
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
  最高AI論理スコア: {maxLogicScore ?? "未評価"}
</div>

  <div>

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
        fontSize: currentFont.base * 0.9,
        color: "#475569",
        fontWeight: 800,
        marginBottom: 6,
      }}
    >
      起：この議論の問い
    </div>
    <div
      style={{
        color: "#334155",
        fontSize: currentFont.base,
        lineHeight: 1.7,
      }}
    >
      {compactText(thread.original_post, 150)}
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
    結：現時点の答え
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
    投稿内容とAI整理をもとにした、現時点での答えです。今後の反論や補足で更新される可能性があります。
  </div>

  <p
    style={{
      margin: "8px 0 10px",
      color: "#333",
      fontSize: currentFont.base,
      lineHeight: 1.7,
    }}
  >
    {provisionalAnswerText}
  </p>

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
      承：主な理由・根拠
    </h2>
    <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
      {overviewPremises.length > 0 && (
        <div>
          <div style={{ fontWeight: 800, marginBottom: 4, color: "#334155" }}>
            前提
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, color: "#333", lineHeight: 1.7 }}>
            {overviewPremises.map((premise, index) => (
              <li key={`overview-premise-${index}`}>{compactText(premise, 110)}</li>
            ))}
          </ul>
        </div>
      )}
      {overviewReasons.length > 0 && (
        <div>
          <div style={{ fontWeight: 800, marginBottom: 4, color: "#334155" }}>
            根拠
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, color: "#333", lineHeight: 1.7 }}>
            {overviewReasons.map((reason, index) => (
              <li key={`overview-reason-${index}`}>{compactText(reason, 110)}</li>
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
      転：反論・リスク
    </h2>
    <ul style={{ margin: "10px 0 0", paddingLeft: 20, color: "#333", lineHeight: 1.7 }}>
      {overviewConflicts.map((conflict, index) => (
        <li key={`overview-conflict-${index}`}>
          {compactText(conflict.rebuttal || conflict.opinion, 110)}
        </li>
      ))}
    </ul>
  </div>
)}

</div>

</SectionCard>
{/* ←ここで完全に閉じる */}


<SectionCard variant="white" style={{ marginTop: 24 }}>
            <SectionTitle style={{ fontSize: currentFont.title, color: "#111" }}>
              まず意見を読む
            </SectionTitle>

            <div style={{ marginBottom: 12 }}>
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
                marginBottom: 12,
                color: "#475569",
                fontSize: currentFont.base - 2,
                lineHeight: 1.6,
              }}
            >
              AI論理スコアは正解判定ではなく、前提・根拠・因果関係・反論耐性を見るための目安です。
            </div>



            {visiblePosts.length === 0 ? (
              <div style={{ color: "#666" }}>まだ投稿がない。</div>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>



<OpinionView
  groupedByOpinion={groupedByOpinion}
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
          </SectionCard>


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
    <span>AIの初期整理を見る</span>
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
    AIの初期整理
  </h2>

  <p
    style={{
      margin: "8px 0 12px",
      color: "#555",
      fontSize: currentFont.base,
      lineHeight: 1.7,
    }}
  >
    議論が少ない段階では、AIの整理を叩き台として表示しています。
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
      <div style={{ color: "#333", lineHeight: 1.7, fontSize: currentFont.base }}>
        {thread.original_post.length > 160
          ? `${thread.original_post.slice(0, 160)}...`
          : thread.original_post}
      </div>
    </div>

    <div>
      <div style={{ fontWeight: 800, marginBottom: 4 }}>前提</div>
      {initialPremises.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: 20, color: "#333", lineHeight: 1.7 }}>
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
        <ul style={{ margin: 0, paddingLeft: 20, color: "#333", lineHeight: 1.7 }}>
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
        <ul style={{ margin: 0, paddingLeft: 20, color: "#333", lineHeight: 1.7 }}>
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

{mode === "normal" ? "この議論の要約" : "🐵 全体理解（やさしい要約）"}
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

    {mode === "normal" ? (
      <>
        {!summaryLoading && (

<PrimaryButton
  onClick={(e) => {
    e.stopPropagation();
    handleGenerateSummary();
  }}
>
            {summary?.summary_text
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
{summary?.summary_text ? (
  summary.summary_text
) : (
  <div style={{ color: "#999" }}>
    まだAIまとめはありません。「AIでこの議論をまとめる」を押してください。
  </div>
)}
        </div>
      </>
    ) : (
      <div
        style={{
          marginTop: 14,
          fontSize: currentFont.base,
          lineHeight: 1.8,
        }}
      >
{summary?.easy_summary_text ? (
  summary.easy_summary_text
) : (
  <div style={{ color: "#999" }}>
    まだやさしい要約はありません。
  </div>
)}
      </div>
    )}
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

</SectionCard>
{/* ←ここで完全に閉じる */}

<SectionCard variant="white" style={{ marginTop: 24 }}>
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
        summary.key_points.issues.map((item, index) => (
          <SelectableCardButton
            key={`issue-${item}-${index}`}
            title={compactText(item, 100)}
            onClick={() => handleNodeClick("論点", item)}
            style={{ fontSize: currentFont.base }}
          />
        ))
      ) : (
        <div style={{ color: "#666" }}>まだ論点は整理されていない。</div>
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
  visiblePremises.map((item, index) => (
          <SelectableCardButton
            key={`premise-${item}-${index}`}
            title={compactText(item, 100)}
            onClick={() => handleNodeClick("前提", item)}
            style={{ fontSize: currentFont.base }}
          />
        ))
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
  visibleReasons.map((item, index) => (
          <SelectableCardButton
            key={`reason-${item}-${index}`}
            title={compactText(item, 100)}
            onClick={() => handleNodeClick("根拠", item)}
            style={{ fontSize: currentFont.base }}
          />
        ))
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
    {visibleConflicts.map((c, i) => (
          <SectionCard
            key={i}
            variant="soft"
            style={{
              padding: 10,
              borderRadius: 8,
              display: "grid",
              gap: 8,
              color: "#111",
              marginBottom: 0,
            }}
          >
            <SelectableCardButton
              title={`🔴 A：${compactText(c.opinion, 90)}`}
              variant="danger"
              onClick={() => handleNodeClick("論点", c.opinion)}
              style={{ fontSize: currentFont.base }}
            />

            <SelectableCardButton
              title={`🔵 B：${compactText(c.rebuttal, 90)}`}
              variant="info"
              onClick={() => handleNodeClick("論点", c.rebuttal)}
              style={{ fontSize: currentFont.base }}
            />
          </SectionCard>
        ))}
      </div>
    ) : (
      <div style={{ color: "#666" }}>対立はまだ抽出されていない。</div>
    )}
  </div>
</SectionCard>


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
    <span>構造で見る</span>
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

<div style={{ marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
  <PrimaryButton
    variant={treeVariant === "A" ? "primary" : "secondary"}
    onClick={() => setTreeVariant("A")}
    style={{ padding: "6px 12px" }}
  >
    A表示（読みやすい）
  </PrimaryButton>

  <PrimaryButton
    variant={treeVariant === "C" ? "primary" : "secondary"}
    onClick={() => setTreeVariant("C")}
    style={{ padding: "6px 12px" }}
  >
    C表示（構造重視）
  </PrimaryButton>
</div>

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
    {renderCurrentPath(currentPath, tenant)}
  </div>

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
{renderLocationMap(mapRoot, mapBranches, tenant)}
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
                ? "返信先の意見に書いています。"
                : "このスレの問いに対して投稿します。"}
            </p>

{selectedGuide && (
  <SectionCard>
    <div style={{ fontWeight: 800, marginBottom: 6 }}>
      返信先
    </div>
                <div style={{ fontWeight: 700 }}>
      「{selectedGuide.text.length > 60
        ? selectedGuide.text.slice(0, 60) + "..."
        : selectedGuide.text}」
                </div>
              </SectionCard>
            )}

            {selectedGuide && (
              <SectionCard
                variant="soft"
                style={{ marginBottom: 12 }}
              >
<div id="related-section" style={{ scrollMarginTop: 80 }}>
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
                投稿の立場
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
                  迷ったら意見のままでOKです。あとでAIが整理できます。
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
      value={rebuttalClaim}
      onChange={(e) => setRebuttalClaim(e.target.value)}
      placeholder="主張を書く"
      style={{
        width: "100%",
        border: "1px solid #ccc",
        borderRadius: 10,
        padding: 10,
        fontSize: currentFont.base,
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
      value={rebuttalReason}
      onChange={(e) => setRebuttalReason(e.target.value)}
      placeholder="根拠を書く"
      style={{
        width: "100%",
        border: "1px solid #ccc",
        borderRadius: 10,
        padding: 10,
        fontSize: currentFont.base,
      }}
    ></textarea>
  </div>
) : (
  <>
    <textarea
      value={text}
      onChange={(e) => setText(e.target.value)}
      placeholder="あなたの考えを書く（主張・前提・根拠でもOK）"
      rows={5}
      style={{
        width: "100%",
        border: "1px solid #ccc",
        borderRadius: 10,
        padding: 12,
        fontSize: currentFont.base,
        resize: "vertical",
        outline: "none",
        color: "#111",
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

            <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <PrimaryButton onClick={handlePost} disabled={posting}>
                {posting ? "投稿中..." : postSubmitLabel(postRole)}
              </PrimaryButton>

              <PrimaryButton
                variant="secondary"
                onClick={() => {
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
                }}
                disabled={posting}
              >
                クリア
              </PrimaryButton>
            </div>
          </SectionCard>

          <SectionCard variant="white" style={{ marginTop: 24 }}>
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
              {renderLocationMap(wholeDiscussionMapRoot, wholeDiscussionMapBranches, tenant)}
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
        </>
      )}
    </main>
  );
}
