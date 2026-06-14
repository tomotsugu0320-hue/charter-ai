"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

type LogicScorePost = {
  id?: string;
  logic_score?: number | null;
  logic_score_reason?: string | null;
  logic_break_type?: string | null;
  logic_break_note?: string | null;
};

type ReEvaluateResponse = {
  success?: boolean;
  error?: string;
  post?: LogicScorePost | null;
  objectionPostId?: string | null;
};

type AdminThreadRef = {
  title?: string | null;
};

type AdminPostRow = {
  id: string;
  thread_id?: string | null;
  post_role?: string | null;
  parent_opinion_id?: string | null;
  content?: string | null;
  created_at?: string | null;
  logic_score?: number | string | null;
  logic_score_reason?: string | null;
  logic_break_type?: string | null;
  logic_break_note?: string | null;
  forum_threads?: AdminThreadRef | AdminThreadRef[] | null;
};

type AdminPostsResponse = {
  error?: string;
  posts?: AdminPostRow[];
};

type PostFilter =
  | "all"
  | "fallback"
  | "ai"
  | "no_reason"
  | "low_score"
  | "score_objection"
  | "high_score_objection";
type PostSort = "new" | "score_low" | "score_high" | "no_reason_first";

const postFilters: { value: PostFilter; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "fallback", label: "簡易判定" },
  { value: "ai", label: "AI詳細評価済み" },
  { value: "no_reason", label: "理由なし" },
  { value: "low_score", label: "低スコア" },
  { value: "score_objection", label: "AI評価への反論" },
  { value: "high_score_objection", label: "高スコア反論" },
];

const postSorts: { value: PostSort; label: string }[] = [
  { value: "new", label: "新しい順" },
  { value: "score_low", label: "低スコア順" },
  { value: "score_high", label: "高スコア順" },
  { value: "no_reason_first", label: "理由なし優先" },
];

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("ja-JP");
}

function createdAtTime(value?: string | null) {
  if (!value) return 0;

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function threadTitle(post: AdminPostRow) {
  const thread = Array.isArray(post.forum_threads)
    ? post.forum_threads[0]
    : post.forum_threads;

  return thread?.title || "無題のスレッド";
}

function evaluationLabel(reason?: string | null) {
  const normalizedReason = String(reason ?? "").trim();

  if (!normalizedReason) return "理由なし";
  if (normalizedReason.includes("fallback")) return "簡易判定";

  return "AI詳細評価済み";
}

function evaluationBadgeStyle(reason?: string | null) {
  const label = evaluationLabel(reason);
  const base = {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    border: "1px solid #cbd5e1",
    padding: "3px 8px",
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1.4,
    whiteSpace: "nowrap" as const,
  };

  if (label === "簡易判定") {
    return {
      ...base,
      border: "1px solid #fde68a",
      background: "#fffbeb",
      color: "#92400e",
    };
  }

  if (label === "AI詳細評価済み") {
    return {
      ...base,
      border: "1px solid #bbf7d0",
      background: "#f0fdf4",
      color: "#166534",
    };
  }

  return {
    ...base,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    color: "#475569",
  };
}

function numericLogicScore(score?: number | string | null) {
  if (typeof score === "number") {
    return Number.isFinite(score) ? score : null;
  }

  if (typeof score === "string" && score.trim() !== "") {
    const parsedScore = Number(score);
    return Number.isFinite(parsedScore) ? parsedScore : null;
  }

  return null;
}

function isScoreObjectionPost(post: AdminPostRow) {
  return (
    post.post_role === "supplement" &&
    Boolean(post.parent_opinion_id) &&
    String(post.content ?? "").includes("AI評価への反論:")
  );
}

function isHighScoreObjectionPost(post: AdminPostRow) {
  const score = numericLogicScore(post.logic_score);
  return isScoreObjectionPost(post) && score !== null && score >= 60;
}

function scoreBadgeStyle(score?: number | string | null) {
  const numericScore = numericLogicScore(score);
  const base = {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "3px 9px",
    fontSize: 12,
    fontWeight: 900,
    lineHeight: 1.4,
    whiteSpace: "nowrap" as const,
  };

  if (numericScore === null) {
    return {
      ...base,
      border: "1px solid #e2e8f0",
      background: "#f8fafc",
      color: "#475569",
    };
  }

  if (numericScore >= 80) {
    return {
      ...base,
      border: "1px solid #86efac",
      background: "#dcfce7",
      color: "#166534",
    };
  }

  if (numericScore >= 50) {
    return {
      ...base,
      border: "1px solid #bfdbfe",
      background: "#eff6ff",
      color: "#1d4ed8",
    };
  }

  return {
    ...base,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#991b1b",
  };
}

function scoreObjectionBadgeStyle(highScore: boolean) {
  return {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    border: highScore ? "1px solid #86efac" : "1px solid #fed7aa",
    background: highScore ? "#dcfce7" : "#fff7ed",
    color: highScore ? "#166534" : "#9a3412",
    padding: "3px 8px",
    fontSize: 12,
    fontWeight: 900,
    lineHeight: 1.4,
    whiteSpace: "nowrap" as const,
  };
}

export default function ReEvaluateLogicScorePage() {
  const params = useParams();
  const tenantParam = params?.tenant;
  const tenant = Array.isArray(tenantParam)
    ? tenantParam[0] ?? "dev"
    : tenantParam ?? "dev";
  const [adminKey, setAdminKey] = useState("");
  const [postId, setPostId] = useState("");
  const [loading, setLoading] = useState(false);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsLoaded, setPostsLoaded] = useState(false);
  const [reEvaluatingPostId, setReEvaluatingPostId] = useState<string | null>(
    null
  );
  const [status, setStatus] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReEvaluateResponse | null>(null);
  const [recentPosts, setRecentPosts] = useState<AdminPostRow[]>([]);
  const [postFilter, setPostFilter] = useState<PostFilter>("all");
  const [postSort, setPostSort] = useState<PostSort>("new");

  const filteredPosts = recentPosts.filter((post) => {
    const label = evaluationLabel(post.logic_score_reason);

    switch (postFilter) {
      case "fallback":
        return label === "簡易判定";
      case "ai":
        return label === "AI詳細評価済み";
      case "no_reason":
        return label === "理由なし";
      case "low_score":
        return (
          numericLogicScore(post.logic_score) !== null &&
          numericLogicScore(post.logic_score)! < 50
        );
      case "score_objection":
        return isScoreObjectionPost(post);
      case "high_score_objection":
        return isHighScoreObjectionPost(post);
      default:
        return true;
    }
  });

  const sortedPosts = [...filteredPosts].sort((a, b) => {
    const newestFirst = createdAtTime(b.created_at) - createdAtTime(a.created_at);
    const aScore = numericLogicScore(a.logic_score);
    const bScore = numericLogicScore(b.logic_score);

    switch (postSort) {
      case "score_low":
        if (aScore === null && bScore === null) return newestFirst;
        if (aScore === null) return 1;
        if (bScore === null) return -1;
        return aScore - bScore || newestFirst;
      case "score_high":
        if (aScore === null && bScore === null) return newestFirst;
        if (aScore === null) return 1;
        if (bScore === null) return -1;
        return bScore - aScore || newestFirst;
      case "no_reason_first": {
        const aHasNoReason = !String(a.logic_score_reason ?? "").trim();
        const bHasNoReason = !String(b.logic_score_reason ?? "").trim();

        if (aHasNoReason !== bHasNoReason) {
          return aHasNoReason ? -1 : 1;
        }

        return newestFirst;
      }
      default:
        return newestFirst;
    }
  });

  function updateRecentPost(updatedPost?: LogicScorePost | null) {
    if (!updatedPost?.id) return;

    setRecentPosts((current) =>
      current.map((post) =>
        post.id === updatedPost.id
          ? {
              ...post,
              logic_score: updatedPost.logic_score,
              logic_score_reason: updatedPost.logic_score_reason,
              logic_break_type: updatedPost.logic_break_type,
              logic_break_note: updatedPost.logic_break_note,
            }
          : post
      )
    );
  }

  async function reEvaluatePost(targetPostId: string, objectionPostId?: string) {
    const requestAdminKey = adminKey.trim();
    const res = await fetch("/api/forum/re-evaluate-logic-score", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(requestAdminKey ? { "x-admin-key": requestAdminKey } : {}),
      },
      body: JSON.stringify({
        postId: targetPostId,
        ...(objectionPostId ? { objectionPostId } : {}),
      }),
    });

    const raw = await res.text();
    let json: ReEvaluateResponse = {};

    try {
      json = raw ? (JSON.parse(raw) as ReEvaluateResponse) : {};
    } catch {
      json = { success: false, error: raw || "レスポンスの読込に失敗しました" };
    }

    setStatus(res.status);

    if (!res.ok) {
      throw new Error(json.error || `再評価に失敗しました（HTTP ${res.status}）`);
    }

    return json;
  }

  async function handleReEvaluate() {
    const trimmedPostId = postId.trim();

    if (!trimmedPostId) {
      setStatus(null);
      setResult(null);
      setError("postIdを入力してください。");
      return;
    }

    if (
      !confirm(
        "この投稿をAI再評価します。OpenAI API費用が発生します。実行しますか？"
      )
    ) {
      return;
    }

    setLoading(true);
    setStatus(null);
    setError(null);
    setResult(null);

    try {
      const json = await reEvaluatePost(trimmedPostId);
      setResult(json);
      updateRecentPost(json.post);
    } catch (e: any) {
      setError(e?.message || "再評価リクエストに失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  async function loadRecentPosts() {
    if (false && !adminKey.trim()) {
      setStatus(null);
      setError("最近の投稿を読むには管理者キーを入力してください。");
      return;
    }

    const requestAdminKey = adminKey.trim();

    setPostsLoading(true);
    setStatus(null);
    setError(null);

    try {
      const res = await fetch("/api/forum/admin-posts", {
        headers: requestAdminKey ? { "x-admin-key": requestAdminKey } : undefined,
      });

      const raw = await res.text();
      let json: AdminPostsResponse = {};

      try {
        json = raw ? (JSON.parse(raw) as AdminPostsResponse) : {};
      } catch {
        json = { error: raw || "投稿一覧レスポンスの読込に失敗しました" };
      }

      setStatus(res.status);

      if (!res.ok) {
        throw new Error(json.error || `投稿一覧の取得に失敗しました（HTTP ${res.status}）`);
      }

      setRecentPosts(Array.isArray(json.posts) ? json.posts : []);
      setPostsLoaded(true);
    } catch (e: any) {
      setError(e?.message || "最近の投稿一覧の取得に失敗しました。");
    } finally {
      setPostsLoading(false);
    }
  }

  async function handleRecentPostReEvaluate(
    targetPostId: string,
    confirmMessage = "この投稿をAI再評価します。OpenAI API費用が発生します。実行しますか？",
    objectionPostId?: string
  ) {
    if (!confirm(confirmMessage)) {
      return;
    }

    setReEvaluatingPostId(targetPostId);
    setStatus(null);
    setError(null);
    setResult(null);

    try {
      const json = await reEvaluatePost(targetPostId, objectionPostId);
      setResult(json);
      updateRecentPost(json.post);
    } catch (e: any) {
      setError(e?.message || "再評価リクエストに失敗しました。");
    } finally {
      setReEvaluatingPostId(null);
    }
  }

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: 20,
        color: "#111827",
      }}
    >
      <Link
        href={`/${tenant}/forum/admin`}
        style={{
          display: "inline-block",
          color: "#1d4ed8",
          fontWeight: 800,
          marginBottom: 14,
          padding: "6px 0",
          textDecoration: "underline",
        }}
      >
        ← forum管理トップへ戻る
      </Link>

      <h1 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 800 }}>
        単一投稿AI論理スコア再評価
      </h1>

      <p style={{ margin: "0 0 16px", color: "#475569", lineHeight: 1.6 }}>
        管理者が指定した投稿1件だけをAIで再評価します。
      </p>

      <div
        style={{
          marginBottom: 18,
          border: "1px solid #fed7aa",
          borderRadius: 8,
          background: "#fff7ed",
          color: "#9a3412",
          padding: "10px 12px",
          lineHeight: 1.6,
          fontWeight: 700,
        }}
      >
        実行時にOpenAI API費用が発生します。postIdを確認してから実行してください。
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>
            管理者キー
          </span>
          <input
            type="password"
            value={adminKey}
            onChange={(event) => setAdminKey(event.target.value)}
            placeholder="ADMIN_KEY"
            style={{
              width: "100%",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              background: "#fff",
              color: "#111827",
              padding: "9px 10px",
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>
            postId
          </span>
          <input
            type="text"
            value={postId}
            onChange={(event) => setPostId(event.target.value)}
            placeholder="投稿ID（UUID）"
            style={{
              width: "100%",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              background: "#fff",
              color: "#111827",
              padding: "9px 10px",
            }}
          />
        </label>

        <button
          type="button"
          onClick={() => void handleReEvaluate()}
          disabled={loading}
          style={{
            width: "fit-content",
            border: "1px solid #111827",
            borderRadius: 8,
            background: loading ? "#cbd5e1" : "#111827",
            color: loading ? "#334155" : "#fff",
            cursor: loading ? "wait" : "pointer",
            fontWeight: 800,
            padding: "10px 14px",
          }}
        >
          {loading ? "再評価中..." : "単一投稿をAI再評価"}
        </button>
      </div>

      {error && (
        <section
          style={{
            marginTop: 18,
            border: "1px solid #fecaca",
            borderRadius: 8,
            background: "#fef2f2",
            color: "#991b1b",
            padding: "12px 14px",
            lineHeight: 1.6,
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 4 }}>再評価エラー</div>
          {status !== null && <div>status: {status}</div>}
          <div>{error}</div>
        </section>
      )}

      {result && (
        <section
          style={{
            marginTop: 18,
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            background: "#f8fafc",
            color: "#111827",
            padding: "14px",
            lineHeight: 1.7,
          }}
        >
          <h2 style={{ margin: "0 0 10px", fontSize: 18, fontWeight: 800 }}>
            再評価結果
          </h2>

          <div style={{ display: "grid", gap: 6 }}>
            <div>success: {String(result.success === true)}</div>
            <div>post.id: {result.post?.id || "-"}</div>
            <div>
              post.logic_score:{" "}
              {result.post?.logic_score === null ||
              result.post?.logic_score === undefined
                ? "-"
                : result.post.logic_score}
            </div>
            <div>post.logic_score_reason: {result.post?.logic_score_reason || "-"}</div>
            <div>post.logic_break_type: {result.post?.logic_break_type || "-"}</div>
            <div>post.logic_break_note: {result.post?.logic_break_note || "-"}</div>
          </div>
        </section>
      )}

      <section
        style={{
          marginTop: 28,
          borderTop: "1px solid #e2e8f0",
          paddingTop: 20,
        }}
      >
        <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 800 }}>
          最近の投稿
        </h2>

        <p style={{ margin: "0 0 12px", color: "#475569", lineHeight: 1.6 }}>
          管理者キーで最近の投稿を読み込み、必要な投稿だけ1件ずつAI再評価できます。
        </p>

        <button
          type="button"
          onClick={() => void loadRecentPosts()}
          disabled={postsLoading}
          style={{
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            background: postsLoading ? "#e2e8f0" : "#fff",
            color: "#111827",
            cursor: postsLoading ? "wait" : "pointer",
            fontWeight: 800,
            padding: "9px 12px",
          }}
        >
          {postsLoading ? "読み込み中..." : "最近の投稿を読み込む"}
        </button>

        {postsLoaded && recentPosts.length === 0 && (
          <p style={{ marginTop: 14, color: "#475569" }}>
            最近の投稿がありません。
          </p>
        )}

        {recentPosts.length > 0 && (
          <>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 14,
              }}
            >
              {postFilters.map((filter) => {
                const selected = postFilter === filter.value;

                return (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setPostFilter(filter.value)}
                    style={{
                      border: selected
                        ? "1px solid #111827"
                        : "1px solid #cbd5e1",
                      borderRadius: 999,
                      background: selected ? "#111827" : "#fff",
                      color: selected ? "#fff" : "#111827",
                      cursor: "pointer",
                      fontWeight: 800,
                      padding: "6px 10px",
                    }}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>

            <div
              style={{
                marginTop: 8,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  color: "#475569",
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                並び替え
              </span>

              {postSorts.map((sort) => {
                const selected = postSort === sort.value;

                return (
                  <button
                    key={sort.value}
                    type="button"
                    onClick={() => setPostSort(sort.value)}
                    style={{
                      border: selected
                        ? "1px solid #1d4ed8"
                        : "1px solid #cbd5e1",
                      borderRadius: 999,
                      background: selected ? "#dbeafe" : "#fff",
                      color: selected ? "#1e3a8a" : "#111827",
                      cursor: "pointer",
                      fontWeight: 800,
                      padding: "6px 10px",
                    }}
                  >
                    {sort.label}
                  </button>
                );
              })}
            </div>

            <div
              style={{
                marginTop: 8,
                color: "#475569",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              表示中: {filteredPosts.length}件
            </div>
          </>
        )}

        {recentPosts.length > 0 && (
          <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
            {sortedPosts.map((post) => {
              const postLoading = reEvaluatingPostId === post.id;
              const numericScore = numericLogicScore(post.logic_score);
              const scoreObjection = isScoreObjectionPost(post);
              const highScoreObjection =
                scoreObjection && numericScore !== null && numericScore >= 60;
              const parentPostId = String(post.parent_opinion_id ?? "").trim();
              const parentPostLoading =
                parentPostId !== "" && reEvaluatingPostId === parentPostId;

              return (
                <article
                  key={post.id}
                  style={{
                    border: "1px solid #dbe3ee",
                    borderRadius: 8,
                    background: "#fff",
                    color: "#111827",
                    padding: "12px",
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gap: 8,
                      lineHeight: 1.6,
                      minWidth: 0,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 8,
                        }}
                      >
                        <span style={evaluationBadgeStyle(post.logic_score_reason)}>
                          {evaluationLabel(post.logic_score_reason)}
                        </span>
                        <span style={scoreBadgeStyle(post.logic_score)}>
                          {numericScore === null
                            ? "AI論理スコア 未評価"
                            : `AI論理スコア ${numericScore}`}
                        </span>
                        {scoreObjection && (
                          <span style={scoreObjectionBadgeStyle(false)}>
                            AI評価への反論
                          </span>
                        )}
                        {highScoreObjection && (
                          <span style={scoreObjectionBadgeStyle(true)}>
                            高スコア反論
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: "#475569",
                        }}
                      >
                        postId
                      </div>
                      <code
                        style={{
                          display: "block",
                          userSelect: "all",
                          whiteSpace: "pre-wrap",
                          overflowWrap: "anywhere",
                          border: "1px solid #e2e8f0",
                          borderRadius: 6,
                          background: "#f8fafc",
                          color: "#0f172a",
                          padding: "4px 6px",
                        }}
                      >
                        {post.id}
                      </code>
                    </div>

                    <div>
                      <strong>thread title:</strong> {threadTitle(post)}
                    </div>
                    <div>
                      <strong>post_role:</strong> {post.post_role || "-"}
                    </div>
                    <div>
                      <strong>parent_opinion_id:</strong>{" "}
                      {post.parent_opinion_id || "-"}
                    </div>
                    <div>
                      <strong>created_at:</strong> {formatDate(post.created_at)}
                    </div>
                    <div>
                      <strong>logic_score:</strong>{" "}
                      {numericScore === null
                        ? "-"
                        : numericScore}
                    </div>
                    <div>
                      <strong>logic_break_type:</strong>{" "}
                      {post.logic_break_type || "-"}
                    </div>
                    <div>
                      <strong>logic_break_note:</strong>{" "}
                      {post.logic_break_note || "-"}
                    </div>

                    <div>
                      <div style={{ fontWeight: 800, marginBottom: 4 }}>
                        content
                      </div>
                      <div
                        style={{
                          whiteSpace: "pre-wrap",
                          overflowWrap: "anywhere",
                          color: "#334155",
                        }}
                      >
                        {post.content || "-"}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontWeight: 800, marginBottom: 4 }}>
                        logic_score_reason
                      </div>
                      <div
                        style={{
                          whiteSpace: "pre-wrap",
                          overflowWrap: "anywhere",
                          color: "#334155",
                        }}
                      >
                        {post.logic_score_reason || "-"}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => void handleRecentPostReEvaluate(post.id)}
                        disabled={postLoading}
                        style={{
                          width: "fit-content",
                          border: "1px solid #111827",
                          borderRadius: 8,
                          background: postLoading ? "#cbd5e1" : "#111827",
                          color: postLoading ? "#334155" : "#fff",
                          cursor: postLoading ? "wait" : "pointer",
                          fontWeight: 800,
                          padding: "9px 12px",
                        }}
                      >
                        {postLoading ? "再評価中..." : "この投稿をAI再評価"}
                      </button>

                      {highScoreObjection && parentPostId && (
                        <button
                          type="button"
                          onClick={() =>
                            void handleRecentPostReEvaluate(
                              parentPostId,
                              "この高スコア反論を踏まえて、元投稿をAI再評価します。OpenAI API費用が発生します。実行しますか？",
                              post.id
                            )
                          }
                          disabled={parentPostLoading}
                          style={{
                            width: "fit-content",
                            border: "1px solid #166534",
                            borderRadius: 8,
                            background: parentPostLoading ? "#bbf7d0" : "#dcfce7",
                            color: parentPostLoading ? "#166534" : "#14532d",
                            cursor: parentPostLoading ? "wait" : "pointer",
                            fontWeight: 900,
                            padding: "9px 12px",
                          }}
                        >
                          {parentPostLoading
                            ? "元投稿を再評価中..."
                            : "この反論を踏まえて元投稿をAI再評価"}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
