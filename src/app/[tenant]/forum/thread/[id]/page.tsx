// src/app/[tenant]/forum/thread/[id]/page.tsx

"use client";

import { useEffect, useMemo, useState } from "react";

type ThreadRow = {
  id: string;
  title: string;
  slug: string;
  original_post: string;
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

function formatDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("ja-JP");
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
  const [summary, setSummary] = useState<ThreadSummary | null>(null);
  const [feedbackSummary, setFeedbackSummary] =
    useState<FeedbackSummary | null>(null);

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

  const visiblePosts = useMemo(() => {
    return posts.filter((post) => {
      return (
        post.post_role === "issue_raise" ||
        post.post_role === "opinion" ||
        post.post_role === "rebuttal" ||
        post.post_role === "supplement" ||
        post.post_role === "explanation"
      );
    });
  }, [posts]);

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
    const trimmed = text.trim();

    if (!trimmed) {
      alert("投稿内容を入れて。");
      return;
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
          content: trimmed,
          postRole,
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

      console.log("[add-post result]", result);

      setText("");
      setPostRole("opinion");
      setPredictionFlag(false);
      setPredictionTarget("");
      setPredictionDeadline("");
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
        headers: {
          "Content-Type": "application/json",
        },
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

      await loadThread();
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
            color: "#111",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          ← 掲示板トップに戻る
        </a>
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
                fontSize: 32,
                fontWeight: 800,
                lineHeight: 1.4,
              }}
            >
              {thread.title}
            </h1>

            <div
              style={{
                marginTop: 10,
                fontSize: 14,
                color: "#666",
              }}
            >
              作成日時: {formatDate(thread.created_at)}
            </div>

            <div
              style={{
                marginTop: 8,
                fontSize: 14,
                fontWeight: 700,
                color: "#111",
              }}
            >
              {averageLogicScore > 0 ? (
                <>
                  平均スコア: {averageLogicScore}
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 12,
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
                fontSize: 13,
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
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#555",
                  marginBottom: 8,
                }}
              >
                元投稿
              </div>
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>
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
                fontSize: 24,
                fontWeight: 800,
              }}
            >
              やさしい要約
            </h2>

            {!summary ? (
              <p style={{ margin: 0, color: "#666" }}>要約を読み込み中...</p>
            ) : (
              <div style={{ color: "#444", lineHeight: 1.8 }}>
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
                marginBottom: 16,
                fontSize: 24,
                fontWeight: 800,
              }}
            >
              投稿一覧
            </h2>

            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
                fontSize: 14,
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
                          fontSize: 14,
                          fontWeight: 800,
                          color: "#0d47a1",
                          cursor: "pointer",
                        }}
                      >
                        {group.issue ? `論点: ${group.issue.content}` : "（論点なし）"}
                      </summary>

                      <div style={{ marginTop: 12 }}>
                        {group.opinions.length === 0 ? (
                          <div style={{ color: "#777", fontSize: 14 }}>
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
                                  opacity: isLowScore ? 0.45 : 1,
                                }}
                              >
                                <div style={{ fontWeight: 700, marginBottom: 6 }}>
                                  💬 意見
                                  <span
                                    style={{
                                      marginLeft: 8,
                                      fontSize: 12,
                                      color: "#2e7d32",
                                    }}
                                  >
                                    {op.opinion.logic_score ?? "未評価"}
                                  </span>
                                </div>

                                <div style={{ marginBottom: 8 }}>
                                  {op.opinion.content}
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
                                    onClick={() =>
                                      handleFeedback(op.opinion.id, "term_unknown")
                                    }
                                    disabled={feedbackLoadingPostId === op.opinion.id}
                                    style={{
                                      border: "1px solid #ccc",
                                      borderRadius: 999,
                                      padding: "6px 10px",
                                      background: "#fff",
                                      fontSize: 12,
                                      cursor:
                                        feedbackLoadingPostId === op.opinion.id
                                          ? "default"
                                          : "pointer",
                                    }}
                                  >
                                    ❓ 言葉がわからん (
                                    {op.opinion.feedback_counts?.term_unknown ?? 0})
                                  </button>

                                  <button
                                    onClick={() =>
                                      handleFeedback(op.opinion.id, "premise_unknown")
                                    }
                                    disabled={feedbackLoadingPostId === op.opinion.id}
                                    style={{
                                      border: "1px solid #ccc",
                                      borderRadius: 999,
                                      padding: "6px 10px",
                                      background: "#fff",
                                      fontSize: 12,
                                      cursor:
                                        feedbackLoadingPostId === op.opinion.id
                                          ? "default"
                                          : "pointer",
                                    }}
                                  >
                                    ❓ 前提がわからん (
                                    {op.opinion.feedback_counts?.premise_unknown ?? 0})
                                  </button>

                                  <button
                                    onClick={() =>
                                      handleFeedback(
                                        op.opinion.id,
                                        "conclusion_unknown"
                                      )
                                    }
                                    disabled={feedbackLoadingPostId === op.opinion.id}
                                    style={{
                                      border: "1px solid #ccc",
                                      borderRadius: 999,
                                      padding: "6px 10px",
                                      background: "#fff",
                                      fontSize: 12,
                                      cursor:
                                        feedbackLoadingPostId === op.opinion.id
                                          ? "default"
                                          : "pointer",
                                    }}
                                  >
                                    ❓ 結論がわからん (
                                    {op.opinion.feedback_counts?.conclusion_unknown ?? 0})
                                  </button>

                                  <button
                                    onClick={() =>
                                      handleFeedback(op.opinion.id, "evidence_unknown")
                                    }
                                    disabled={feedbackLoadingPostId === op.opinion.id}
                                    style={{
                                      border: "1px solid #ccc",
                                      borderRadius: 999,
                                      padding: "6px 10px",
                                      background: "#fff",
                                      fontSize: 12,
                                      cursor:
                                        feedbackLoadingPostId === op.opinion.id
                                          ? "default"
                                          : "pointer",
                                    }}
                                  >
                                    ❓ 根拠がわからん (
                                    {op.opinion.feedback_counts?.evidence_unknown ?? 0})
                                  </button>

                                  <button
                                    onClick={() =>
                                      handleFeedback(
                                        op.opinion.id,
                                        "counterargument_unknown"
                                      )
                                    }
                                    disabled={feedbackLoadingPostId === op.opinion.id}
                                    style={{
                                      border: "1px solid #ccc",
                                      borderRadius: 999,
                                      padding: "6px 10px",
                                      background: "#fff",
                                      fontSize: 12,
                                      cursor:
                                        feedbackLoadingPostId === op.opinion.id
                                          ? "default"
                                          : "pointer",
                                    }}
                                  >
                                    ❓ 反対意見がわからん (
                                    {op.opinion.feedback_counts?.counterargument_unknown ??
                                      0}
                                    )
                                  </button>
                                </div>

                                {op.children.length > 0 && (
                                  <details style={{ marginTop: 10 }}>
                                    <summary
                                      style={{
                                        cursor: "pointer",
                                        fontSize: 13,
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
                                      {op.children.map((child) => {
                                        const childScore = child.logic_score ?? 0;
                                        const childLowScore =
                                          hideLowScore &&
                                          childScore > 0 &&
                                          childScore < 60;

                                        return (
                                          <div
                                            key={child.id}
                                            style={{
                                              opacity: childLowScore ? 0.45 : 1,
                                            }}
                                          >
                                            <div
                                              style={{
                                                fontSize: 12,
                                                fontWeight: 700,
                                                color:
                                                  child.post_role === "rebuttal"
                                                    ? "#b71c1c"
                                                    : "#555",
                                              }}
                                            >
                                              {roleLabel(child.post_role)}（
                                              {child.logic_score ?? "未評価"}）
                                            </div>
                                            <div>{child.content}</div>
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
            <h2
              style={{
                margin: 0,
                marginBottom: 12,
                fontSize: 24,
                fontWeight: 800,
              }}
            >
              追加入力
            </h2>

            <p
              style={{
                marginTop: 0,
                color: "#666",
              }}
            >
              投稿の種類を選んでから書き込めるようにした。
            </p>

            <div style={{ marginBottom: 14 }}>
              <label
                htmlFor="post-role"
                style={{
                  display: "block",
                  marginBottom: 8,
                  fontSize: 14,
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
                  fontSize: 15,
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

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="追記したい内容を書く"
              rows={5}
              style={{
                width: "100%",
                border: "1px solid #ccc",
                borderRadius: 10,
                padding: 12,
                fontSize: 16,
                resize: "vertical",
                outline: "none",
              }}
            />

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
                {posting ? "投稿中..." : "投稿する"}
              </button>

              <button
                onClick={() => {
                  setText("");
                  setPostRole("opinion");
                  setPredictionFlag(false);
                  setPredictionTarget("");
                  setPredictionDeadline("");
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