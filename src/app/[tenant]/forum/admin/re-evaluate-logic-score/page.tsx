"use client";

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
};

type AdminThreadRef = {
  title?: string | null;
};

type AdminPostRow = {
  id: string;
  thread_id?: string | null;
  post_role?: string | null;
  content?: string | null;
  created_at?: string | null;
  logic_score?: number | null;
  logic_score_reason?: string | null;
  logic_break_type?: string | null;
  logic_break_note?: string | null;
  forum_threads?: AdminThreadRef | AdminThreadRef[] | null;
};

type AdminPostsResponse = {
  error?: string;
  posts?: AdminPostRow[];
};

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("ja-JP");
}

function threadTitle(post: AdminPostRow) {
  const thread = Array.isArray(post.forum_threads)
    ? post.forum_threads[0]
    : post.forum_threads;

  return thread?.title || "無題のスレッド";
}

export default function ReEvaluateLogicScorePage() {
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

  async function reEvaluatePost(targetPostId: string) {
    const res = await fetch("/api/forum/re-evaluate-logic-score", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": adminKey,
      },
      body: JSON.stringify({ postId: targetPostId }),
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
    if (!adminKey.trim()) {
      setStatus(null);
      setError("最近の投稿を読むには管理者キーを入力してください。");
      return;
    }

    setPostsLoading(true);
    setStatus(null);
    setError(null);

    try {
      const res = await fetch("/api/forum/admin-posts", {
        headers: {
          "x-admin-key": adminKey,
        },
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

  async function handleRecentPostReEvaluate(targetPostId: string) {
    if (
      !confirm(
        "この投稿をAI再評価します。OpenAI API費用が発生します。実行しますか？"
      )
    ) {
      return;
    }

    setReEvaluatingPostId(targetPostId);
    setStatus(null);
    setError(null);
    setResult(null);

    try {
      const json = await reEvaluatePost(targetPostId);
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
          <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
            {recentPosts.map((post) => {
              const postLoading = reEvaluatingPostId === post.id;

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
                      <strong>created_at:</strong> {formatDate(post.created_at)}
                    </div>
                    <div>
                      <strong>logic_score:</strong>{" "}
                      {post.logic_score === null || post.logic_score === undefined
                        ? "-"
                        : post.logic_score}
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
