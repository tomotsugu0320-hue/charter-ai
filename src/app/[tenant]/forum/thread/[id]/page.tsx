// src/app/[tenant]/forum/thread/[id]/page.tsx


"use client";

import { useEffect, useMemo, useState } from "react";
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


type PostRow = {
  id: string;
  thread_id: string;
  source_type: string;
  post_role: string;
  content: string;
  author_key?: string;
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
  feedback_counts?: {
    term_unknown?: number;
    premise_unknown?: number;
    conclusion_unknown?: number;
    evidence_unknown?: number;
    counterargument_unknown?: number;
  };
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
  key_points: {
    issues: string[];
    opinions: string[];
    rebuttals: string[];
    supplements: string[];
    explanations: string[];
  };
};


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

function formatDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("ja-JP");
}

function getCookieValue(name: string) {
  if (typeof document === "undefined") return "";

  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));

  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : "";
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

function trustBonus(label?: string) {
  if (label === "A") return 8;
  if (label === "B") return 3;
  return 0;
}

export default function ForumThreadPage({ params }: PageProps) {
  const [conflicts, setConflicts] = useState<
    { opinion: string; rebuttal: string }[]
  >([]);

  const [fontSize, setFontSize] = useState<"small" | "medium" | "large">(
    "medium"
  );

  const [tenant, setTenant] = useState("");
  const [threadId, setThreadId] = useState("");
  const [currentAuthorKey, setCurrentAuthorKey] = useState("");


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

  setCurrentAuthorKey(getCookieValue("author_key"));
}, []);


const [summaryLoading, setSummaryLoading] = useState(false);


  const [thread, setThread] = useState<ThreadRow | null>(null);
  const [posts, setPosts] = useState<PostRow[]>([]);

  const [text, setText] = useState("");
  const [searchText, setSearchText] = useState("");
  const [copied, setCopied] = useState(false);

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

setSummary(data?.summary || null);
  } catch (e) {
    console.error(e);
  } finally {
    setSummaryLoading(false);
  }
};


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

    for (const post of sortedVisiblePosts) {
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
  }, [sortedVisiblePosts]);


const groupedByOpinion = useMemo(() => {
  return groupedByIssue.map((group) => {
    const opinionGroups: {
      opinion: PostRow;
      children: PostRow[];
    }[] = [];

    const hasOpinion = group.items.some((p) => p.post_role === "opinion");


if (!hasOpinion && group.issue) {
  opinionGroups.push({
    opinion: {
      ...group.issue,
      id: `virtual-${group.issue.id}`,
      post_role: "opinion",
      content: group.issue.content,
      logic_score: 50,
    },
    children: group.items.filter(
      (p) =>
        p.post_role === "rebuttal" ||
        p.post_role === "supplement" ||
        p.post_role === "explanation"
    ),
  });

  return {
    issue: group.issue,
    opinions: opinionGroups,
  };
}

    let currentOpinion:
      | {
          opinion: PostRow;
          children: PostRow[];
        }
      | null = null;

    for (const post of group.items) {
      if (post.post_role === "opinion") {
        currentOpinion = {
          opinion: post,
          children: [],
        };
        opinionGroups.push(currentOpinion);
        continue;
      }

      if (
        post.post_role === "rebuttal" ||
        post.post_role === "supplement" ||
        post.post_role === "explanation"
      ) {
        if (currentOpinion) {
          currentOpinion.children.push(post);
        }
      }
    }

    return {
      issue: group.issue,
      opinions: opinionGroups,
    };
  });
}, [groupedByIssue]);


  const authorTrustMap = useMemo(() => {
    const map: Record<
      string,
      {
        total: number;
        count: number;
        breaks: number;
      }
    > = {};

    posts.forEach((p) => {
      if (!p.author_key) return;

      if (!map[p.author_key]) {
        map[p.author_key] = {
          total: 0,
          count: 0,
          breaks: 0,
        };
      }

      if ((p.logic_score ?? 0) > 0) {
        map[p.author_key].total += p.logic_score ?? 0;
        map[p.author_key].count += 1;
      }

      if (p.logic_break_type && p.logic_break_type !== "none") {
        map[p.author_key].breaks += 1;
      }
    });

    const result: Record<string, { score: number; label: string }> = {};

    Object.entries(map).forEach(([key, v]) => {
      if (v.count === 0) return;

      const avg = v.total / v.count;
      const score = Math.round(avg - v.breaks * 5);

      result[key] = {
        score,
        label: score >= 80 ? "A" : score >= 60 ? "B" : "C",
      };
    });

    return result;
  }, [posts]);

  const bestOpinionsByIssue = useMemo(() => {
    return groupedByOpinion.map((group) => {
      const scored = group.opinions.map((op) => {
        const base = op.opinion.logic_score ?? 0;

        const rebuttalCount = op.children.filter(
          (c) => c.post_role === "rebuttal"
        ).length;

        const trustLabel = authorTrustMap[op.opinion.author_key ?? ""]?.label;
        const bonus = trustBonus(trustLabel);
        const effectiveScore = base - rebuttalCount * 5 + bonus;

        return {
          ...op,
          effectiveScore,
          rebuttalCount,
          trustLabel: trustLabel ?? "-",
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
  }, [groupedByOpinion, authorTrustMap]);

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




const displayPremises =
  summary?.key_points?.opinions?.length
    ? summary.key_points.opinions
    : thread?.ai_premises ?? [];

const displayReasons =
  summary?.key_points?.explanations?.length
    ? summary.key_points.explanations
    : thread?.ai_reasons ?? [];

const displayConflicts =
  conflicts.length > 0
    ? conflicts
    : thread?.ai_conflicts ?? [];





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

      const summaryRes = await fetch(
        `/api/forum/thread-summary?threadId=${threadId}`,
        {
          method: "GET",
        }
      );

      const summaryResult = await summaryRes.json();

      if (!summaryRes.ok) {
        throw new Error(summaryResult?.error || "要約読込失敗");
      }

      setConflicts(summaryResult.conflict_pairs || []);
      setThread(result.thread ?? null);
      setPosts(result.posts ?? []);
      setSummary(null);
      setSummary(summaryResult.summary ?? null);
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
      setPredictionFlag(false);
      setPredictionTarget("");
      setPredictionDeadline("");
      setSelectedGuide(null);
      setCurrentAuthorKey(getCookieValue("author_key"));
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
  href={`/${tenant}/forum/admin/delete`}
  style={{
    display: "inline-block",
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
    この議論を共有
  </PrimaryButton>

<LinkButton
  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
    `${thread.title} ${currentUrl}`
  )}`}
  target="_blank"
  rel="noopener noreferrer"
>
  Xで共有
</LinkButton>

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
      平均スコア: {averageLogicScore}
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
    <>平均スコア: 未評価</>
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
  最高スコア: {maxLogicScore ?? "未評価"}
</div>

  <div>

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

{mode === "normal" ? "🧠 全体理解（AIまとめ）" : "🐵 全体理解（やさしい要約）"}
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
              ? "AIまとめを更新する"
              : "AIでこの議論をまとめる"}
          </PrimaryButton>
        )}

        {summaryLoading && (
          <div style={{ color: "#666", marginTop: 8 }}>
            AIが議論を分析中...
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
    🔍 関連キーワード
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

<div
  style={{
    fontSize: currentFont.base * 0.9,
    color: "#666",
    marginBottom: 6,
  }}
>
  {thread.title}
</div>

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
    気になる項目を押すと、関連する議論を下で確認できます。
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
            title={item}
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
{displayPremises.length ? (
  displayPremises.map((item, index) => (
          <SelectableCardButton
            key={`premise-${item}-${index}`}
            title={item}
            onClick={() => handleNodeClick("前提", item)}
            style={{ fontSize: currentFont.base }}
          />
        ))
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
{displayReasons.length ? (
  displayReasons.map((item, index) => (
          <SelectableCardButton
            key={`reason-${item}-${index}`}
            title={item}
            onClick={() => handleNodeClick("根拠", item)}
            style={{ fontSize: currentFont.base }}
          />
        ))
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
      主な対立
    </div>
{displayConflicts.length > 0 ? (
  <div style={{ display: "grid", gap: 10 }}>
    {displayConflicts.map((c, i) => (
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
              title={`🔴 A：${c.opinion}`}
              variant="danger"
              onClick={() => handleNodeClick("論点", c.opinion)}
              style={{ fontSize: currentFont.base }}
            />

            <SelectableCardButton
              title={`🔵 B：${c.rebuttal}`}
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


          <SectionCard variant="white" style={{ marginTop: 24 }}>
            <SectionTitle style={{ fontSize: currentFont.title, color: "#111" }}>
              📊 投稿一覧
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
              低スコア投稿を薄く表示する
            </label>

            <div style={{ marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <PrimaryButton
                onClick={() => setSortType("score")}
                style={{
                  background: sortType === "score" ? "#111" : "#eee",
                  color: sortType === "score" ? "#fff" : "#333",
                }}
              >
                スコア順
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

            {sortedVisiblePosts.length === 0 ? (
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
  currentAuthorKey={currentAuthorKey}
/>

</div>
            )}
          </SectionCard>



<div style={{ marginTop: 24 }}>
  <SectionTitle style={{ fontSize: currentFont.title, color: "#111" }}>
    🌳 深掘り（議論ツリー）
  </SectionTitle>

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
                ? "選択した意見に対する投稿です。"
                : "このスレの問いに対して投稿します。"}
            </p>

{selectedGuide && (
  <SectionCard>
    <div style={{ fontWeight: 800, marginBottom: 6 }}>
      「{selectedGuide.text.length > 60
        ? selectedGuide.text.slice(0, 60) + "..."
        : selectedGuide.text}」
      に対して意見を書いています
    </div>
                <div style={{ fontWeight: 700 }}>{selectedGuide.text}</div>
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
                    過去に投稿された関連内容
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
                            {post.content}
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
                      この論点を深める
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

{postRole === "rebuttal" ? (
  <div style={{ display: "grid", gap: 10 }}>
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
                {posting ? "投稿中..." : "この内容について意見を書く"}
              </PrimaryButton>

              <PrimaryButton
                variant="secondary"
                onClick={() => {
                  setText("");
                  setSelectedGuide(null);
                  setPostRole("opinion");
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
        </>
      )}
    </main>
  );
}
