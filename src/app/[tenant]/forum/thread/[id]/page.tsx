// src/app/[tenant]/forum/thread/[id]/page.tsx

"use client";

import { useEffect, useMemo, useState } from "react";


type ThreadRow = {
  id: string;
  title: string;
  slug: string;
  original_post: string;
  category?: string;
  created_at?: string;
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
  key_points: {
    issues: string[];
    opinions: string[];
    rebuttals: string[];
    supplements: string[];
    explanations: string[];
  };
};

type FeedbackSummary = {
  term_unknown: number;
  premise_unknown: number;
  conclusion_unknown: number;
  evidence_unknown: number;
  counterargument_unknown: number;
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
      premises: [],
      reasons: [],
    };
  }

  // 超シンプル分解（あとでAIに置換）
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
  if (score >= 80) return "#2e7d32"; // 緑（強い）
  if (score >= 60) return "#1565c0"; // 青（普通）
  if (score >= 40) return "#ef6c00"; // オレンジ（弱い）
  return "#b71c1c"; // 赤（危険）
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
  const [structureType, setStructureType] = useState("");
  const [conflicts, setConflicts] = useState<
    { opinion: string; rebuttal: string }[]
  >([]);
const [explanations, setExplanations] = useState<Record<string, string>>({});
const [fontSize, setFontSize] = useState<"small" | "medium" | "large">("medium");

  const [tenant, setTenant] = useState("");
  const [threadId, setThreadId] = useState("");

  const [sortType, setSortType] = useState<"score" | "new">("score");
  const [hideLowScore, setHideLowScore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [thread, setThread] = useState<ThreadRow | null>(null);
  const [posts, setPosts] = useState<PostRow[]>([]);

  const [text, setText] = useState("");
const [searchText, setSearchText] = useState("");

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
  const [feedbackSummary, setFeedbackSummary] =
    useState<FeedbackSummary | null>(null);

const [replyToOpinionId, setReplyToOpinionId] = useState<string | null>(null);

  const [postRole, setPostRole] =
    useState<PostRoleOption["value"]>("opinion");
  const [predictionFlag, setPredictionFlag] = useState(false);
  const [predictionTarget, setPredictionTarget] = useState("");
  const [predictionDeadline, setPredictionDeadline] = useState("");
  const [feedbackLoadingPostId, setFeedbackLoadingPostId] = useState<
    string | null
  >(null);

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

  const unresolvedIssues = useMemo(() => {
    return groupedByOpinion
      .map((group) => {
        const ranked = [...group.opinions]
          .map((op) => {
            const base = op.opinion.logic_score ?? 0;
            const rebuttalCount = op.children.filter(
              (c) => c.post_role === "rebuttal"
            ).length;

            const trustLabel = authorTrustMap[op.opinion.author_key ?? ""]?.label;

            const bonus = trustBonus(trustLabel);

            const score = base - rebuttalCount * 5 + bonus;

            return {
              content: op.opinion.content,
              score,
              trustLabel: trustLabel ?? "-",
            };
          })
          .sort((a, b) => b.score - a.score);

        if (ranked.length < 2) return null;

        const first = ranked[0];
        const second = ranked[1];
        const diff = first.score - second.score;

        if (diff < 10) {
          return {
            issue: group.issue?.content ?? "（論点なし）",
            first,
            second,
            diff,
          };
        }

        return null;
      })
      .filter(
        (
          item
        ): item is {
          issue: string;
          first: { content: string; score: number; trustLabel: string };
          second: { content: string; score: number; trustLabel: string };
          diff: number;
        } => item !== null
      );
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

    console.log("clicked:", text);
    console.log("threadId:", threadId);
    console.log("result:", result);

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

      setStructureType(summaryResult.structure_type || "");
      setConflicts(summaryResult.conflict_pairs || []);

      setThread(result.thread ?? null);
      setPosts(result.posts ?? []);
      setFeedbackSummary(result.feedback_summary ?? null);
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

      console.log("[add-post result]", result);

      setText("");
      setPostRole("opinion");
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

console.log("clicked", postId, feedbackType);

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


console.log("explanation:", result.explanation);


if (!res.ok) {
  throw new Error(result?.error || "feedback保存失敗");
}


if (result.explanation) {
  setExplanations((prev) => ({
    ...prev,
    [String(postId)]: result.explanation,
  }));
}


// await loadThread(); ← 消す


    } catch (e: any) {
      console.error(e);
      setError(e?.message || "feedback保存失敗");
      alert(e?.message || "feedback保存失敗");
    } finally {
      setFeedbackLoadingPostId(null);
    }
  }

  return (
    <main
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: "24px 16px 80px",
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <a
          href={`/${tenant}/forum`}
          style={{
            color: "#0d47a1",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          ← 掲示板トップに戻る
        </a>
      </div>


<div style={{ marginBottom: 12 }}>
  <span style={{ marginRight: 8 }}>文字サイズ：</span>

  <button onClick={() => setFontSize("small")}>小</button>
  <button onClick={() => setFontSize("medium")} style={{ marginLeft: 6 }}>中</button>
  <button onClick={() => setFontSize("large")} style={{ marginLeft: 6 }}>大</button>
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
          <section
            style={{
              border: "1px solid #ddd",
              borderRadius: 16,
              padding: 20,
              background: "#fff",
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: currentFont.title,
                fontWeight: 800,
                lineHeight: 1.4,
              }}
            >
              {thread.title}
            </h1>

            <div
              style={{
                marginTop: 10,
                fontSize: currentFont.base,
                color: "#666",
              }}
            >
              作成日時: {formatDate(thread.created_at)}
            </div>

<div
  style={{
    marginTop: 6,
    fontSize: currentFont.base,
    color: "#666",
  }}
>
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
                      fontSize: currentFont.base,
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
                fontSize: currentFont.base,
                color: maxLogicScore && maxLogicScore >= 80 ? "#2e7d32" : "#555",
                fontWeight: maxLogicScore && maxLogicScore >= 80 ? 700 : 500,
              }}
            >
              最高スコア: {maxLogicScore ?? "未評価"}
            </div>

            <div
              style={{
                marginTop: 18,
                padding: 16,
                borderRadius: 12,
                background: "#f6f6f6",
                border: "1px solid #e5e5e5",
              }}
            >
              <div
                style={{
                  fontSize: currentFont.base,
                  fontWeight: 700,
                  color: "#555",
                  marginBottom: 8,
                }}
              >
                元投稿
              </div>
<div
  style={{
    whiteSpace: "pre-wrap",
    lineHeight: 1.8,
    fontSize: currentFont.base,
  }}
>
  {thread.original_post}
</div>
            </div>
          </section>

          <section
            style={{
              marginTop: 24,
              border: "1px solid #ddd",
              borderRadius: 16,
              padding: 20,
              background: "#fff",
            }}
          >
            <h2
              style={{
                margin: 0,
                marginBottom: 16,
                fontSize: currentFont.title,
                fontWeight: 800,
              }}
            >
              やさしい要約
            </h2>

            {!summary ? (
              <p style={{ margin: 0, color: "#666" }}>要約を読み込み中...</p>
            ) : (
<div
  style={{
    color: "#444",
    lineHeight: 1.8,
    fontSize: currentFont.base,
  }}
>
                {summary.summary_text}
              </div>
            )}
          </section>

<section
  style={{
    marginTop: 24,
    border: "1px solid #ddd",
    borderRadius: 16,
    padding: 20,
    background: "#fff",
  }}
>
  <h2
    style={{
      margin: 0,
      marginBottom: 12,
      fontSize: currentFont.title,
      fontWeight: 800,
    }}
  >
    主な論点
  </h2>

<p
  style={{
    marginTop: 0,
    marginBottom: 12,
    fontSize: currentFont.base,
    color: "#666",
  }}
>
  気になる項目を押すと、関連する議論を下で確認できます。
</p>

<div style={{ display: "grid", gap: 10 }}>
  {summary?.key_points?.issues?.length ? (
    summary.key_points.issues.map((item, index) => (
      <button
        key={`${item}-${index}`}

onClick={() => handleNodeClick("論点", item)}

  style={{
    width: "100%",
    display: "grid",
    gap: 8,
    textAlign: "left",
    border: "1px solid #ddd",
    borderRadius: 10,
    padding: "12px 14px",
    background: "#fff",
    fontSize: currentFont.base,
    cursor: "pointer",
  }}
>
  <span style={{ lineHeight: 1.6 }}>{item}</span>

  <span
    style={{
      fontSize: currentFont.base,
      color: "#0d47a1",
      fontWeight: 700,
      lineHeight: 1.4,
    }}
  >
    議論を見る・ここから意見を書く →
  </span>
</button>
    ))
  ) : (
    <div style={{ color: "#666" }}>まだ論点は整理されていない。</div>
  )}
</div>

</section>

<section
  style={{
    marginTop: 24,
    border: "1px solid #ddd",
    borderRadius: 16,
    padding: 20,
    background: "#fff",
  }}
>
  <h2
    style={{
      margin: 0,
      marginBottom: 12,
      fontSize: currentFont.title,
      fontWeight: 800,
    }}
  >
    主な前提
  </h2>

<p
  style={{
    marginTop: 0,
    marginBottom: 12,
    fontSize: currentFont.base,
    color: "#666",
  }}
>
  気になる項目を押すと、関連する議論を下で確認できます
</p>

  <div style={{ display: "grid", gap: 10 }}>
    {originalStructure.premises.length > 0 ? (
      originalStructure.premises.map((item, index) => (

<button
  key={`${item}-${index}`}
  onClick={() => handleNodeClick("前提", item)}
  style={{
    width: "100%",
    display: "grid",
    gap: 8,
    textAlign: "left",
    border: "1px solid #ddd",
    borderRadius: 10,
    padding: "12px 14px",
    background: "#fff",
    fontSize: currentFont.base,
    cursor: "pointer",
  }}
>
  <span style={{ lineHeight: 1.6 }}>{item}</span>

  <span
    style={{
      fontSize: currentFont.base,
      color: "#0d47a1",
      fontWeight: 700,
      lineHeight: 1.4,
    }}
  >
    議論を見る・ここから意見を書く →
  </span>
</button>
      ))
    ) : (
      <div style={{ color: "#666" }}>まだ前提は整理されていない。</div>
    )}
  </div>
</section>

<section
  style={{
    marginTop: 24,
    border: "1px solid #ddd",
    borderRadius: 16,
    padding: 20,
    background: "#fff",
  }}
>
  <h2
    style={{
      margin: 0,
      marginBottom: 12,
      fontSize: currentFont.title,
      fontWeight: 800,
    }}
  >
    主な根拠
  </h2>

<p
  style={{
    marginTop: 0,
    marginBottom: 12,
    fontSize: currentFont.base,
    color: "#666",
  }}
>
  気になる項目を押すと、関連する議論を下で確認できます。
</p>

  <div style={{ display: "grid", gap: 10 }}>
    {originalStructure.reasons.length > 0 ? (
      originalStructure.reasons.map((item, index) => (
        <button
          key={`${item}-${index}`}

onClick={() => handleNodeClick("根拠", item)}

  style={{
    width: "100%",
    display: "grid",
    gap: 8,
    textAlign: "left",
    border: "1px solid #ddd",
    borderRadius: 10,
    padding: "12px 14px",
    background: "#fff",
    fontSize: currentFont.base,
    cursor: "pointer",
  }}
>
  <span style={{ lineHeight: 1.6 }}>{item}</span>

  <span
    style={{
      fontSize: currentFont.base,
      color: "#0d47a1",
      fontWeight: 700,
      lineHeight: 1.4,
    }}
  >
    議論を見る・ここから意見を書く →
  </span>
</button>      ))
    ) : (
      <div style={{ color: "#666" }}>まだ根拠は整理されていない。</div>
    )}
  </div>
</section>

<section
  style={{
    marginTop: 24,
    border: "1px solid #ddd",
    borderRadius: 16,
    padding: 20,
    background: "#fff",
  }}
>
  <h2
    style={{
      margin: 0,
      marginBottom: 12,
      fontSize: currentFont.title,
      fontWeight: 800,
    }}
  >
    主な対立
  </h2>

  <p
    style={{
      marginTop: 0,
      marginBottom: 12,
      fontSize: currentFont.base,
      color: "#666",
    }}
  >
    気になる項目を押すと、関連する議論を下で確認できます。
  </p>

  {conflicts && conflicts.length > 0 ? (
    <div style={{ display: "grid", gap: 10 }}>
{conflicts.map((c, i) => (
  <div
    key={i}
    style={{
      padding: 10,
      borderRadius: 8,
      background: "#fafafa",
      border: "1px solid #eee",
      display: "grid",
      gap: 8,
    }}
  >
<button
  onClick={() => handleNodeClick("論点", c.opinion)}
  style={{
    width: "100%",
    display: "grid",
    gap: 8,
    textAlign: "left",
    border: "1px solid #f44336",
    borderRadius: 10,
    padding: "10px 12px",
    background: "#fff5f5",
    cursor: "pointer",
    fontWeight: 700,
  }}
>
  <span style={{ lineHeight: 1.6 }}>🔴 A：{c.opinion}</span>

  <span
    style={{
      fontSize: currentFont.base,
      color: "#b71c1c",
      fontWeight: 700,
      lineHeight: 1.4,
    }}
  >
    議論を見る・ここから意見を書く →
  </span>
</button>

<button
  onClick={() => handleNodeClick("論点", c.rebuttal)}
  style={{
    width: "100%",
    display: "grid",
    gap: 8,
    textAlign: "left",
    justifyContent: "space-between",
    alignItems: "center",
    border: "1px solid #2196f3",
    borderRadius: 10,
    padding: "10px 12px",
    background: "#f0f6ff",
    cursor: "pointer",
    fontWeight: 700,
  }}
>
  <span>🔵 B：{c.rebuttal}</span>

  <span
    style={{
      fontSize: currentFont.base,
      color: "#0d47a1",
      fontWeight: 700,
      whiteSpace: "nowrap",
    }}
  >
    議論を見る・ここから意見を書く →
  </span>
</button>






  </div>
))}
    </div>
  ) : (
    <div style={{ color: "#666" }}>対立はまだ抽出されていない。</div>
  )}
</section>


          <section
            style={{
              marginTop: 24,
              border: "1px solid #ddd",
              borderRadius: 16,
              padding: 20,
              background: "#fff",
            }}
          >
            <h2
              style={{
                margin: 0,
                marginBottom: 16,
                fontSize: currentFont.title,
                fontWeight: 800,
              }}
            >
              投稿一覧
            </h2>

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

            <div style={{ marginBottom: 12 }}>
              <button
                onClick={() => setSortType("score")}
                style={{
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 12px",
                  background: sortType === "score" ? "#111" : "#eee",
                  color: sortType === "score" ? "#fff" : "#333",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                スコア順
              </button>

              <button
                onClick={() => setSortType("new")}
                style={{
                  marginLeft: 8,
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 12px",
                  background: sortType === "new" ? "#111" : "#eee",
                  color: sortType === "new" ? "#fff" : "#333",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                新着順
              </button>
            </div>

            {sortedVisiblePosts.length === 0 ? (
              <div style={{ color: "#666" }}>まだ投稿がない。</div>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {groupedByOpinion.map((group, groupIndex) => (
                  <div
                    key={group.issue?.id ?? `group-${groupIndex}`}
                    style={{
                      border: "1px solid #e5e5e5",
                      borderRadius: 14,
                      padding: 16,
                      background: "#fafafa",
                    }}
                  >
                    <details open style={{ marginBottom: 12 }}>
                      <summary
                        style={{
                          fontSize: currentFont.base,
                          fontWeight: 800,
                          color: "#0d47a1",
                          cursor: "pointer",
                        }}
                      >
 {group.issue
  ? `問い: ${group.issue.content}`
  : `問い: ${thread?.title ?? thread?.original_post ?? "このスレのテーマ"}`}
                      </summary>

                      <div style={{ marginTop: 12 }}>
{bestOpinionsByIssue[groupIndex]?.best && (
  <div
    style={{
      marginBottom: 16,
      padding: 12,
      borderRadius: 12,
      border: "2px solid #2e7d32",
      background: "#f1f8f4",
    }}
  >
    <div
      style={{
        fontSize: currentFont.base,
        fontWeight: 800,
        color: "#2e7d32",
        marginBottom: 6,
      }}
    >
      🏆 ベスト意見
    </div>

    <div style={{ marginBottom: 6 }}>
      {bestOpinionsByIssue[groupIndex].best.opinion.content}
    </div>

    <div
      style={{
        fontSize: currentFont.base,
        color: "#555",
      }}
    >
      スコア：
      {bestOpinionsByIssue[groupIndex].best.effectiveScore}
    </div>
  </div>
)}

                        {group.opinions.length === 0 ? (
                          <div style={{ color: "#777", fontSize: currentFont.base }}>
                            まだ意見がない。
                          </div>
                        ) : (
                          group.opinions.map((op) => {
                            const opinionScore = op.opinion.logic_score ?? 0;
                            const isLowScore =
                              hideLowScore && opinionScore > 0 && opinionScore < 60;

                            return (
                              <div
                                key={op.opinion.id}
                                style={{
                                  marginBottom: 16,
                                  padding: 12,
                                  borderRadius: 10,
                                  border: "1px solid #ddd",
                                  background: "#fff",

opacity: (() => {
  const score = op.opinion.logic_score ?? 0;

if (hideLowScore && score > 0 && score < 60) {
  return 0.65;
}

if (score >= 80) return 1;
if (score >= 60) return 0.95;
if (score >= 40) return 0.85;
return 0.75;
})(),
}}
                              >

<div
  style={{
    fontWeight: 700,
    marginBottom: 6,
    color: roleColor(op.opinion.post_role),
  }}
>
  💬 {roleLabel(op.opinion.post_role)}

<span
  style={{
    marginLeft: 8,
    fontSize: currentFont.base,
    color: scoreColor(op.opinion.logic_score),
  }}
>
  {op.opinion.logic_score ?? "未評価"}｜
  {(op.opinion.logic_score ?? 0) >= 80
    ? "🔥 強い"
    : (op.opinion.logic_score ?? 0) >= 60
    ? "👍 普通"
    : "⚠️ 弱い"}
</span>
                                </div>
<div style={{ display: "flex", gap: 8, marginTop: 8, marginBottom: 8 }}>

<button
  onClick={() => {
    setSelectedGuide(null);
    setPostRole("rebuttal");
    setReplyToOpinionId(op.opinion.id);
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }}
  style={{
    padding: "6px 10px",
    borderRadius: 6,
    border: "1px solid #ccc",
    background: "#fff",
    fontSize: currentFont.base,
    cursor: "pointer",
  }}
>
  この意見に反論する
</button>

<button
  onClick={() => {
    setSelectedGuide(null);
    setPostRole("supplement");
    setReplyToOpinionId(op.opinion.id);
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }}
  style={{
    padding: "6px 10px",
    borderRadius: 6,
    border: "1px solid #ccc",
    background: "#fff",
    fontSize: currentFont.base,
    cursor: "pointer",
  }}
>
  この意見を補足する
</button>

</div>
                                <div style={{ marginBottom: 8 }}>
                                 {(() => {
  const { claim, premises, reasons } = splitContent(op.opinion.content);

  return (
    <div>
      {/* 主張 */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontWeight: 800 }}>主張</div>
        <div>{claim}</div>
      </div>

      {/* 前提 */}
      {premises.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontWeight: 800 }}>前提</div>
          <ul style={{ paddingLeft: 20 }}>
            {premises.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 根拠 */}
      {reasons.length > 0 && (
        <div>
          <div style={{ fontWeight: 800 }}>根拠</div>
          <ul style={{ paddingLeft: 20 }}>
            {reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
})()}
                                </div>

<div
  style={{
    marginBottom: 10,
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  }}
>
  <button
    onClick={() => handleFeedback(op.opinion.id, "term_unknown")}
    disabled={feedbackLoadingPostId === op.opinion.id}
    style={{
      border: "1px solid #ccc",
      borderRadius: 999,
      padding: "6px 10px",
      background: "#fff",
      fontSize: currentFont.base,
      cursor:
        feedbackLoadingPostId === op.opinion.id ? "default" : "pointer",
    }}
  >
    ❓ 言葉がわからん ({op.opinion.feedback_counts?.term_unknown ?? 0})
  </button>

  <button
    onClick={() => handleFeedback(op.opinion.id, "premise_unknown")}
    disabled={feedbackLoadingPostId === op.opinion.id}
    style={{
      border: "1px solid #ccc",
      borderRadius: 999,
      padding: "6px 10px",
      background: "#fff",
      fontSize: currentFont.base,
      cursor:
        feedbackLoadingPostId === op.opinion.id ? "default" : "pointer",
    }}
  >
    ❓ 前提がわからん ({op.opinion.feedback_counts?.premise_unknown ?? 0})
  </button>

  <button
    onClick={() => handleFeedback(op.opinion.id, "conclusion_unknown")}
    disabled={feedbackLoadingPostId === op.opinion.id}
    style={{
      border: "1px solid #ccc",
      borderRadius: 999,
      padding: "6px 10px",
      background: "#fff",
      fontSize: currentFont.base,
      cursor:
        feedbackLoadingPostId === op.opinion.id ? "default" : "pointer",
    }}
  >
    ❓ 結論がわからん ({op.opinion.feedback_counts?.conclusion_unknown ?? 0})
  </button>

  <button
    onClick={() => handleFeedback(op.opinion.id, "evidence_unknown")}
    disabled={feedbackLoadingPostId === op.opinion.id}
    style={{
      border: "1px solid #ccc",
      borderRadius: 999,
      padding: "6px 10px",
      background: "#fff",
      fontSize: currentFont.base,
      cursor:
        feedbackLoadingPostId === op.opinion.id ? "default" : "pointer",
    }}
  >
    ❓ 根拠がわからん ({op.opinion.feedback_counts?.evidence_unknown ?? 0})
  </button>

  <button
    onClick={() => handleFeedback(op.opinion.id, "counterargument_unknown")}
    disabled={feedbackLoadingPostId === op.opinion.id}
    style={{
      border: "1px solid #ccc",
      borderRadius: 999,
      padding: "6px 10px",
      background: "#fff",
      fontSize: currentFont.base,
      cursor:
        feedbackLoadingPostId === op.opinion.id ? "default" : "pointer",
    }}
  >
    ❓ 反対意見がわからん ({op.opinion.feedback_counts?.counterargument_unknown ?? 0})
  </button>
</div>

{feedbackLoadingPostId === op.opinion.id && !explanations[op.opinion.id] && (
  <div
    style={{
      marginTop: 8,
      fontSize: currentFont.base,
      color: "#666",
    }}
  >
    説明を生成中...
  </div>
)}

{explanations[op.opinion.id] && (
  <div
    style={{
      marginTop: 8,
      padding: 10,
      borderRadius: 8,
      background: "#f0f4ff",
      border: "1px solid #ccd",
      fontSize: currentFont.base,
      lineHeight: 1.6,
    }}
  >
    <div style={{ fontWeight: 700, marginBottom: 4 }}>
      AI解説
    </div>
    <div>{explanations[op.opinion.id]}</div>
  </div>
)}


                                {op.children.length > 0 && (
                                  <details style={{ marginTop: 10 }}>
                                    <summary
                                      style={{
                                        cursor: "pointer",
                                        fontSize: currentFont.base,
                                        fontWeight: 700,
                                        color: "#555",
                                      }}
                                    >
                                      返信を見る（{op.children.length}件）
                                    </summary>

                                    <div
                                      style={{
                                        marginTop: 10,
                                        paddingLeft: 12,
                                        borderLeft: "3px solid #ddd",
                                        display: "grid",
                                        gap: 8,
                                      }}
                                    >

{op.children
  .filter((child) => child.parent_opinion_id === op.opinion.id)
  .map((child) => {
  return (
    <div
      key={child.id}
      style={{
        opacity: (() => {
          const score = child.logic_score ?? 0;

if (hideLowScore && score > 0 && score < 60) {
  return 0.65;
}

if (score >= 80) return 1;
if (score >= 60) return 0.95;
if (score >= 40) return 0.85;
return 0.75;
        })(),
      }}
    >
      {child.post_role === "rebuttal" ? (
        <div
          style={{
            display: "grid",
gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 12,
            alignItems: "start",
          }}
        >
          {/* 左：元の意見 */}
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 10,
              padding: 10,
              background: "#f5f5f5",
            }}
          >
            <div
              style={{
                fontSize: currentFont.base,
                fontWeight: 700,
                color: roleColor(op.opinion.post_role),
                marginBottom: 8,
              }}
            >
              意見
            </div>

            {(() => {
              const { claim, premises, reasons } = splitContent(op.opinion.content);

              return (
                <div>
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ fontWeight: 800 }}>主張</div>
                    <div>{claim}</div>
                  </div>

                  {premises.length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ fontWeight: 800 }}>前提</div>
                      <ul style={{ paddingLeft: 20 }}>
                        {premises.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {reasons.length > 0 && (
                    <div>
                      <div style={{ fontWeight: 800 }}>根拠</div>
                      <ul style={{ paddingLeft: 20 }}>
                        {reasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* 右：反論 */}

<div
  style={{
    border: "1px solid #ddd",
    borderRadius: 10,
    padding: 10,
    background:
      (child.logic_score ?? 0) >= 80
        ? "#e8f5e9"   // 強い（緑）
        : (child.logic_score ?? 0) >= 60
        ? "#e3f2fd"   // 普通（青）
        : "#ffebee",  // 弱い（赤）
  }}
>
            <div
              style={{
                fontSize: currentFont.base,
                fontWeight: 700,
                color: roleColor(child.post_role),
                marginBottom: 8,
              }}
            >
              反論（
              <span
                style={{
                  marginLeft: 4,
                  color: scoreColor(child.logic_score),
                }}
              >
                {child.logic_score ?? "未評価"}
              </span>
              ）
              <span style={{ marginLeft: 6 }}>
                {(child.logic_score ?? 0) >= 80
                  ? "🔥 強い"
                  : (child.logic_score ?? 0) >= 60
                  ? "👍 普通"
                  : "⚠️ 弱い"}
              </span>
            </div>

            {(() => {
              const { claim, premises, reasons } = splitContent(child.content);

              return (
                <div>
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ fontWeight: 800 }}>主張</div>
                    <div>{claim}</div>
                  </div>

                  {premises.length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ fontWeight: 800 }}>前提</div>
                      <ul style={{ paddingLeft: 20 }}>
                        {premises.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {reasons.length > 0 && (
                    <div>
                      <div style={{ fontWeight: 800 }}>根拠</div>
                      <ul style={{ paddingLeft: 20 }}>
                        {reasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      ) : (
        <div>
          <div
            style={{
              fontSize: currentFont.base,
              fontWeight: 700,
              color: roleColor(child.post_role),
            }}
          >
            {roleLabel(child.post_role)}（
            <span
              style={{
                marginLeft: 6,
                color: scoreColor(child.logic_score),
              }}
            >
              {child.logic_score ?? "未評価"}
            </span>
            ）
            <span style={{ marginLeft: 6 }}>
              {(child.logic_score ?? 0) >= 80
                ? "🔥 強い"
                : (child.logic_score ?? 0) >= 60
                ? "👍 普通"
                : "⚠️ 弱い"}
            </span>
          </div>

          {(() => {
            const { claim, premises, reasons } = splitContent(child.content);

            return (
              <div>
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 800 }}>主張</div>
                  <div>{claim}</div>
                </div>

                {premises.length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ fontWeight: 800 }}>前提</div>
                    <ul style={{ paddingLeft: 20 }}>
                      {premises.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {reasons.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 800 }}>根拠</div>
                    <ul style={{ paddingLeft: 20 }}>
                      {reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
})}

                                    </div>
                                  </details>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section
            style={{
              marginTop: 24,
              border: "1px solid #ddd",
              borderRadius: 16,
              padding: 20,
              background: "#fff",
            }}
          >

<div style={{ marginTop: 16, marginBottom: 16 }}>
  <button
    onClick={() => {
      setSelectedGuide(null);
      setPostRole("opinion");
      setReplyToOpinionId(null);

      setTimeout(() => {
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: "smooth",
        });
      }, 100);
    }}
    style={{
      width: "100%",
      border: "none",
      borderRadius: 12,
      padding: "14px 16px",
      background: "#111",
      color: "#fff",
      fontSize: currentFont.base,
      fontWeight: 800,
      cursor: "pointer",
    }}
  >
    まだ誰も書いていない。このテーマの最初の意見を書く
  </button>
</div>

<h2
  style={{
    margin: 0,
    marginBottom: 12,
    fontSize: currentFont.title,
    fontWeight: 800,
  }}
>
  {replyToOpinionId
    ? `この意見への${
        postRole === "rebuttal"
          ? "反論"
          : postRole === "supplement"
          ? "補足"
          : "投稿"
      }`
    : "新しい投稿"}
</h2>
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
  <div
    style={{
      marginBottom: 12,
      padding: "12px 14px",
      borderRadius: 10,
      background: "#eef4ff",
      border: "1px solid #c9d8ff",
      color: "#0d47a1",
      fontSize: currentFont.base,
      lineHeight: 1.7,
    }}
  >
    <div
      style={{
        fontWeight: 800,
        marginBottom: 6,
      }}
    >
      この{selectedGuide.type}について意見できます
    </div>

    <div style={{ fontWeight: 700 }}>
      {selectedGuide.text}
    </div>
  </div>
)}


{selectedGuide && (




  <div
    id="related-section"
    style={{
      marginBottom: 12,
      padding: "12px 14px",
      borderRadius: 10,
      background: "#fafafa",
      border: "1px solid #e5e5e5",
    }}
  >
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
      <div style={{ color: "#666", fontSize: currentFont.base }}>検索中...</div>
    ) : relatedPosts.length > 0 ? (

      <div style={{ display: "grid", gap: 8 }}>
        {relatedPosts.map((post) => (
          <div
            key={post.id}
            style={{
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: "10px 12px",
              background: "#fff",
            }}
          >
            <div
              style={{
                fontSize: currentFont.base,
                fontWeight: 700,
                color: "#666",
                marginBottom: 4,
              }}
            >
              {roleLabel(post.post_role)} / {formatDate(post.created_at)}
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
          </div>
        ))}
      </div>
    ) : (
      <div style={{ color: "#666", fontSize: currentFont.base }}>
        まだ投稿はありません。この内容について最初の意見を書けます。
      </div>
    )}

    {relatedSummary && (
      <div
        style={{
          marginTop: 10,
          padding: "10px 12px",
          borderRadius: 8,
          background: "#f0f4ff",
          border: "1px solid #ccd",
          fontSize: currentFont.base,
          lineHeight: 1.6,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4 }}>関連要約</div>
        <div>{relatedSummary}</div>
      </div>
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
    <a
      key={`jump-${post.thread_id}`}
      href={`/${tenant}/forum/thread/${post.thread_id}`}
      style={{
        display: "block",
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: "10px 12px",
        background: "#fff",
        textDecoration: "none",
      }}
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
        👉 {post.content.length > 40
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
    </a>
  ))}
  </div>
</div>
  </div>
)}

            <div style={{ marginBottom: 14 }}>
              <label
                htmlFor="post-role"
                style={{
                  display: "block",
                  marginBottom: 8,
                  fontSize: currentFont.base,
                  fontWeight: 700,
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
  placeholder="反論の主張（何が間違っているか・どう考えるべきか）"
  rows={3}
  style={{
    width: "100%",
    border: "1px solid #ccc",
    borderRadius: 10,
    padding: 12,
    fontSize: currentFont.base,
    resize: "vertical",
    outline: "none",
  }}
/>

    <input
      value={rebuttalPremise}
      onChange={(e) => setRebuttalPremise(e.target.value)}
      placeholder="反論の前提"
      style={{
        width: "100%",
        border: "1px solid #ccc",
        borderRadius: 10,
        padding: 12,
        fontSize: currentFont.base,
        outline: "none",
      }}
    />

    <textarea
      value={rebuttalReason}
      onChange={(e) => setRebuttalReason(e.target.value)}
      placeholder="反論の根拠"
      rows={4}
      style={{
        width: "100%",
        border: "1px solid #ccc",
        borderRadius: 10,
        padding: 12,
        fontSize: currentFont.base,
        resize: "vertical",
        outline: "none",
      }}
    />
  </div>
) : (
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
    }}
  />
)}

            <div style={{ marginTop: 12, display: "flex", gap: 12 }}>
              <button
                onClick={handlePost}
                disabled={posting}
                style={{
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 16px",
                  background: posting ? "#999" : "#111",
                  color: "#fff",
                  cursor: posting ? "default" : "pointer",
                  fontWeight: 700,
                }}
              >
                {posting ? "投稿中..." : "この内容について意見を書く"}
              </button>

              <button
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
                style={{
                  border: "1px solid #ccc",
                  borderRadius: 10,
                  padding: "10px 16px",
                  background: "#fff",
                  cursor: posting ? "default" : "pointer",
                  fontWeight: 700,
                }}
              >
                クリア
              </button>
            </div>
          </section>
        </>
      )}
    </main>
  );
}