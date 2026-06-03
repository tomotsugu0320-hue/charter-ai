"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type CSSProperties } from "react";

type AdminUserSummary = {
  author_key: string;
  post_count: number;
  hidden_post_count: number;
  latest_post_at: string | null;
};

type ThreadInfo = {
  title?: string | null;
  is_deleted?: boolean | null;
};

type AdminUserPost = {
  id: string;
  thread_id: string | null;
  content: string | null;
  post_role: string | null;
  logic_score: number | null;
  is_deleted: boolean | null;
  created_at: string | null;
  forum_threads?: ThreadInfo | ThreadInfo[] | null;
};

const pageStyle = {
  maxWidth: 1080,
  margin: "0 auto",
  padding: 24,
  color: "#111827",
} satisfies CSSProperties;

const cardStyle = {
  border: "1px solid #dbe3ef",
  borderRadius: 8,
  background: "#ffffff",
  color: "#111827",
  padding: 16,
} satisfies CSSProperties;

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#ffffff",
  color: "#111827",
} satisfies CSSProperties;

const buttonStyle = {
  border: "1px solid #111827",
  borderRadius: 8,
  background: "#111827",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 800,
  padding: "10px 14px",
} satisfies CSSProperties;

const secondaryButtonStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#ffffff",
  color: "#111827",
  cursor: "pointer",
  fontWeight: 800,
  padding: "8px 12px",
} satisfies CSSProperties;

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP");
}

function threadInfoOf(post: AdminUserPost) {
  const thread = Array.isArray(post.forum_threads)
    ? post.forum_threads[0]
    : post.forum_threads;

  return {
    title: thread?.title?.trim() || "無題のスレッド",
    isDeleted: thread?.is_deleted === true,
  };
}

function previewText(value: string | null, maxLength = 240) {
  const text = String(value ?? "").trim();
  if (!text) return "-";
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

export default function AdminUsersPage() {
  const params = useParams();
  const tenantParam = params?.tenant;
  const tenant = Array.isArray(tenantParam)
    ? tenantParam[0] ?? "dev"
    : tenantParam ?? "dev";

  const [adminKey, setAdminKey] = useState("");
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [posts, setPosts] = useState<AdminUserPost[]>([]);
  const [selectedAuthorKey, setSelectedAuthorKey] = useState<string | null>(
    null
  );
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestAdminKey = adminKey.trim();

  function requireAdminKey() {
    if (requestAdminKey) return true;
    setError("管理者キーを入力してください。");
    return false;
  }

  async function loadUsers() {
    if (!requireAdminKey()) return;

    setLoadingUsers(true);
    setError(null);

    try {
      const res = await fetch("/api/forum/admin-users", {
        headers: { "x-admin-key": requestAdminKey },
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(json?.error || "利用者一覧の取得に失敗しました。");
        return;
      }

      setUsers(Array.isArray(json.users) ? json.users : []);
      setPosts([]);
      setSelectedAuthorKey(null);
    } finally {
      setLoadingUsers(false);
    }
  }

  async function loadPosts(authorKey: string) {
    if (!requireAdminKey()) return;

    setLoadingPosts(true);
    setError(null);
    setSelectedAuthorKey(authorKey);

    try {
      const res = await fetch(
        `/api/forum/admin-users?authorKey=${encodeURIComponent(authorKey)}`,
        {
          headers: { "x-admin-key": requestAdminKey },
        }
      );
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(json?.error || "投稿一覧の取得に失敗しました。");
        return;
      }

      setPosts(Array.isArray(json.posts) ? json.posts : []);
    } finally {
      setLoadingPosts(false);
    }
  }

  return (
    <main style={pageStyle}>
      <Link
        href={`/${tenant}/forum/admin`}
        style={{
          display: "inline-block",
          marginBottom: 14,
          color: "#2563eb",
          fontWeight: 800,
          textDecoration: "none",
        }}
      >
        ← forum管理トップへ戻る
      </Link>

      <h1 style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 900 }}>
        利用者別投稿管理
      </h1>
      <p style={{ margin: "0 0 18px", color: "#475569", lineHeight: 1.7 }}>
        author_key ごとに投稿数や投稿内容を確認します。公開画面には
        author_key は表示されません。
      </p>

      <section style={{ ...cardStyle, marginBottom: 18 }}>
        <label
          htmlFor="admin-key"
          style={{ display: "block", marginBottom: 8, fontWeight: 800 }}
        >
          管理者キー
        </label>
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <input
            id="admin-key"
            type="password"
            value={adminKey}
            onChange={(event) => setAdminKey(event.target.value)}
            placeholder="ADMIN_KEY"
            style={{ ...inputStyle, flex: "1 1 260px" }}
          />
          <button
            type="button"
            onClick={() => void loadUsers()}
            disabled={loadingUsers}
            style={{
              ...buttonStyle,
              opacity: loadingUsers ? 0.65 : 1,
            }}
          >
            {loadingUsers ? "読み込み中..." : "利用者一覧を読み込む"}
          </button>
        </div>
      </section>

      {error && (
        <div
          style={{
            ...cardStyle,
            marginBottom: 18,
            borderColor: "#fca5a5",
            background: "#fef2f2",
            color: "#991b1b",
          }}
        >
          {error}
        </div>
      )}

      <section style={{ ...cardStyle, marginBottom: 18 }}>
        <h2 style={{ margin: "0 0 12px", fontSize: 22 }}>
          author_key ごとの一覧
        </h2>

        {users.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>
            まだ一覧は読み込まれていません。
          </p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {users.map((user) => (
              <article
                key={user.author_key}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: 12,
                  background:
                    selectedAuthorKey === user.author_key
                      ? "#eff6ff"
                      : "#ffffff",
                  color: "#111827",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 900,
                        wordBreak: "break-all",
                        marginBottom: 6,
                      }}
                    >
                      {user.author_key}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        flexWrap: "wrap",
                        color: "#475569",
                        fontSize: 13,
                      }}
                    >
                      <span>投稿数: {user.post_count}</span>
                      <span>非表示投稿数: {user.hidden_post_count}</span>
                      <span>最新投稿: {formatDate(user.latest_post_at)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadPosts(user.author_key)}
                    disabled={loadingPosts && selectedAuthorKey === user.author_key}
                    style={{
                      ...secondaryButtonStyle,
                      opacity:
                        loadingPosts && selectedAuthorKey === user.author_key
                          ? 0.65
                          : 1,
                    }}
                  >
                    {loadingPosts && selectedAuthorKey === user.author_key
                      ? "読み込み中..."
                      : "投稿を見る"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {selectedAuthorKey && (
        <section style={cardStyle}>
          <h2 style={{ margin: "0 0 8px", fontSize: 22 }}>投稿一覧</h2>
          <p
            style={{
              margin: "0 0 12px",
              color: "#475569",
              wordBreak: "break-all",
            }}
          >
            author_key: {selectedAuthorKey}
          </p>

          {posts.length === 0 ? (
            <p style={{ margin: 0, color: "#64748b" }}>
              この利用者の投稿は見つかりませんでした。
            </p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {posts.map((post) => {
                const thread = threadInfoOf(post);
                const threadHref = post.thread_id
                  ? `/${tenant}/forum/thread/${post.thread_id}`
                  : "";

                return (
                  <article
                    key={post.id}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      padding: 12,
                      background: post.is_deleted ? "#f8fafc" : "#ffffff",
                      color: "#111827",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        marginBottom: 8,
                        color: "#475569",
                        fontSize: 13,
                      }}
                    >
                      <span>post_role: {post.post_role || "-"}</span>
                      <span>logic_score: {post.logic_score ?? "-"}</span>
                      <span>
                        投稿状態: {post.is_deleted ? "非表示" : "表示中"}
                      </span>
                      <span>
                        スレッド状態: {thread.isDeleted ? "非表示" : "表示中"}
                      </span>
                      <span>作成: {formatDate(post.created_at)}</span>
                    </div>
                    <h3 style={{ margin: "0 0 8px", fontSize: 18 }}>
                      {thread.title}
                    </h3>
                    <p
                      style={{
                        margin: "0 0 10px",
                        lineHeight: 1.7,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {previewText(post.content)}
                    </p>
                    {threadHref && (
                      <Link
                        href={threadHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: "#2563eb",
                          fontWeight: 800,
                          textDecoration: "none",
                        }}
                      >
                        スレッド詳細を開く
                      </Link>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
