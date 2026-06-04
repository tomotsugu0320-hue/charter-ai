"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

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

type ListType =
  | "latest"
  | "logic"
  | "posts"
  | "high-score"
  | "many-posts"
  | "ai-summary";

const LIST_PAGE_SIZE = 10;

const LIST_CONFIG: Record<ListType, { title: string; description: string }> = {
  latest: {
    title: "新着スレッド",
    description: "新しく作成された議論を、作成日の新しい順で表示します。",
  },
  logic: {
    title: "AI論理スコア順",
    description: "AI論理スコアが高い議論から順に表示します。",
  },
  posts: {
    title: "投稿数順",
    description: "意見・反論・補足が多い議論から順に表示します。",
  },
  "high-score": {
    title: "評価が高いスレッド",
    description: "AI論理スコアが高く、根拠や反論が整理された議論です。",
  },
  "many-posts": {
    title: "投稿が多いスレッド",
    description: "投稿が多く集まっている議論です。",
  },
  "ai-summary": {
    title: "今読むべきAI総括",
    description: "AIの要約がある議論だけを一覧で表示します。",
  },
};

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toText(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeThreadRow(value: unknown): ThreadRow | null {
  if (!isRecord(value)) return null;

  const id = toText(value.id).trim();
  if (!id) return null;

  return {
    id,
    title: toText(value.title, "無題のスレッド").trim() || "無題のスレッド",
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

function truncate(value = "", max = 50) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function formatScore(value?: number) {
  if (typeof value !== "number") return "0";
  return String(Math.round(value));
}

function formatDate(value?: string) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function sortByScore(threads: ThreadRow[]) {
  return [...threads].sort((a, b) => {
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

function getParam(value: string | string[] | undefined, fallback = "") {
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

export default function ForumListPage() {
  const params = useParams<{
    tenant?: string | string[];
    type?: string | string[];
  }>();
  const tenant = getParam(params.tenant, "dev");
  const listType = getParam(params.type) as ListType;
  const config = LIST_CONFIG[listType];

  const [popularThreads, setPopularThreads] = useState<ThreadRow[]>([]);
  const [activeThreads, setActiveThreads] = useState<ThreadRow[]>([]);
  const [recentThreads, setRecentThreads] = useState<ThreadRow[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(Boolean(config));
  const [error, setError] = useState("");

  useEffect(() => {
    setPage(1);
  }, [listType]);

  useEffect(() => {
    if (!config) return;

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch("/api/forum/top-summary", {
          cache: "no-store",
        });
        const result: unknown = await res.json();

        if (!res.ok) {
          const message = isRecord(result)
            ? toText(result.error, "一覧の読み込みに失敗しました")
            : "一覧の読み込みに失敗しました";
          throw new Error(message);
        }

        if (cancelled || !isRecord(result)) return;

        setPopularThreads(normalizeThreadRows(result.popularThreads));
        setActiveThreads(normalizeThreadRows(result.activeThreads));
        setRecentThreads(normalizeThreadRows(result.recentThreads));
      } catch (loadError) {
        if (cancelled) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "一覧の読み込みに失敗しました"
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [config]);

  const listThreads = useMemo(() => {
    if (listType === "latest") return recentThreads;
    if (listType === "posts" || listType === "many-posts") return activeThreads;

    const scoreThreads = sortByScore(popularThreads);
    if (listType === "ai-summary") {
      return scoreThreads.filter((thread) => thread.summary?.trim());
    }

    return scoreThreads;
  }, [activeThreads, listType, popularThreads, recentThreads]);

  const totalPages = Math.max(1, Math.ceil(listThreads.length / LIST_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = listThreads.length === 0 ? 0 : (currentPage - 1) * LIST_PAGE_SIZE;
  const visibleThreads = listThreads.slice(startIndex, startIndex + LIST_PAGE_SIZE);
  const displayStart = listThreads.length === 0 ? 0 : startIndex + 1;
  const displayEnd = startIndex + visibleThreads.length;

  if (!config) {
    return (
      <main style={pageStyle}>
        <section style={panelStyle}>
          <h1 style={{ margin: 0, fontSize: 24 }}>一覧が見つかりません</h1>
          <p style={{ ...smallMetaStyle, marginTop: 8 }}>
            指定された一覧タイプは利用できません。
          </p>
          <Link
            href={`/${tenant}/forum`}
            style={{
              ...ghostButtonStyle,
              display: "inline-flex",
              marginTop: 14,
              textDecoration: "none",
            }}
          >
            Forumトップへ戻る
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <header
        style={{
          ...panelStyle,
          marginBottom: 18,
          background: "#f8fafc",
          color: "#0f172a",
          border: "1px solid #cbd5e1",
        }}
      >
        <Link
          href={`/${tenant}/forum`}
          style={{
            color: "#0d47a1",
            fontWeight: 800,
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          Forumトップへ戻る
        </Link>
        <h1 style={{ margin: "12px 0 0", fontSize: 28, lineHeight: 1.25 }}>
          {config.title}
        </h1>
        <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.7 }}>
          {config.description}
        </p>
        <div style={{ ...smallMetaStyle, marginTop: 10 }}>
          全{listThreads.length}件 / 表示中 {displayStart}〜{displayEnd}件
        </div>
      </header>

      {error && (
        <div
          style={{
            ...panelStyle,
            marginBottom: 18,
            borderColor: "#fca5a5",
            background: "#fef2f2",
            color: "#991b1b",
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <section style={{ ...panelStyle, color: "#475569" }}>読み込み中...</section>
      ) : visibleThreads.length > 0 ? (
        <>
          <section
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 430px), 1fr))",
              gap: 12,
              marginBottom: 16,
            }}
          >
            {visibleThreads.map((thread) => {
              const preview =
                thread.summary || thread.original_post || thread.posts_content || "";

              return (
                <Link
                  key={thread.id}
                  href={`/${tenant}/forum/thread/${thread.id}`}
                  style={{
                    ...panelStyle,
                    display: "block",
                    minHeight: 148,
                    color: "#111827",
                    textDecoration: "none",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                      flexWrap: "wrap",
                      alignItems: "flex-start",
                      marginBottom: 8,
                    }}
                  >
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
                    {thread.created_at && (
                      <span style={{ ...smallMetaStyle, whiteSpace: "nowrap" }}>
                        {formatDate(thread.created_at)}
                      </span>
                    )}
                  </div>

                  <h2
                    style={{
                      margin: 0,
                      fontSize: 18,
                      lineHeight: 1.45,
                      fontWeight: 900,
                    }}
                  >
                    {truncate(thread.title, 50)}
                  </h2>

                  {preview && (
                    <p
                      style={{
                        margin: "8px 0 0",
                        color: "#4b5563",
                        fontSize: 14,
                        lineHeight: 1.55,
                      }}
                    >
                      {truncate(preview, 100)}
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

                  <span
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
                  </span>
                </Link>
              );
            })}
          </section>

          <nav
            aria-label="ページ送り"
            style={{
              ...panelStyle,
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={currentPage <= 1}
              style={{
                ...ghostButtonStyle,
                opacity: currentPage <= 1 ? 0.55 : 1,
                cursor: currentPage <= 1 ? "not-allowed" : "pointer",
              }}
            >
              前へ
            </button>
            <div style={smallMetaStyle}>
              {currentPage} / {totalPages}ページ
            </div>
            <button
              type="button"
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={currentPage >= totalPages}
              style={{
                ...ghostButtonStyle,
                opacity: currentPage >= totalPages ? 0.55 : 1,
                cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
              }}
            >
              次へ
            </button>
          </nav>
        </>
      ) : (
        <section style={{ ...panelStyle, color: "#475569" }}>
          表示できる投稿はまだありません。
        </section>
      )}
    </main>
  );
}
