// src/app/[tenant]/forum/page.tsx

"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
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

const ALL_CATEGORIES = "すべて";
const draftStorageKey = "forum_thread_draft_input";

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
          "入力内容と近い言葉を含む既存の議論です",
        stance: detectStance(title, summary),
      };
    })
    .filter((thread): thread is RelatedThread => thread !== null)
    .slice(0, 5);
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

function threadCardStyle(isFeatured: boolean): CSSProperties {
  return {
    border: isFeatured ? "1px solid #2563eb" : "1px solid #d7dde8",
    borderRadius: 8,
    padding: 14,
    background: isFeatured ? "#eff6ff" : "#ffffff",
    minHeight: 148,
  };
}

function ThreadCard({
  thread,
  tenant,
  currentFontSize,
  isFeatured = false,
}: {
  thread: ThreadRow;
  tenant: string;
  currentFontSize: number;
  isFeatured?: boolean;
}) {
  const preview =
    thread.summary || thread.original_post || thread.posts_content || "";

  return (
    <article style={threadCardStyle(isFeatured)}>
      <Link
        href={`/${tenant}/forum/thread/${thread.id}`}
        style={{ color: "inherit", textDecoration: "none" }}
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

        <h3
          style={{
            margin: 0,
            fontSize: currentFontSize + 2,
            lineHeight: 1.45,
            fontWeight: 800,
          }}
        >
          {thread.title}
        </h3>

        {preview && (
          <p
            style={{
              margin: "8px 0 0",
              color: "#4b5563",
              fontSize: currentFontSize - 2,
              lineHeight: 1.7,
            }}
          >
            {truncate(preview)}
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
          <span>投稿 {thread.post_count ?? 0}</span>
          <span>平均スコア {formatScore(thread.avg_logic_score)}</span>
        </div>
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
  const searchParams = useSearchParams();

  const tenantParam = params?.tenant;
  const tenant = Array.isArray(tenantParam)
    ? tenantParam[0]
    : String(tenantParam ?? "dev");

  const keyword = searchParams.get("keyword") || "";
  const goal = searchParams.get("goal") || "";

  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [organizing, setOrganizing] = useState(false);
  const [creatingThread, setCreatingThread] = useState(false);
  const [organizedResult, setOrganizedResult] = useState<OrganizedResult | null>(null);
  const [actionError, setActionError] = useState("");
  const [topError, setTopError] = useState("");

  const [popularThreads, setPopularThreads] = useState<ThreadRow[]>([]);
  const [activeThreads, setActiveThreads] = useState<ThreadRow[]>([]);
  const [defaultMode, setDefaultMode] = useState<"normal" | "easy">("normal");
  const [fontSizeMode, setFontSizeMode] =
    useState<"small" | "medium" | "large">("medium");

  const currentFontSize =
    fontSizeMode === "small" ? 14 : fontSizeMode === "large" ? 18 : 16;

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES);
  const [searchQuery, setSearchQuery] = useState("");
  const [analyzeScrollKey, setAnalyzeScrollKey] = useState(0);
  const [relatedThreads, setRelatedThreads] = useState<RelatedThread[]>([]);
  const [generatedIssue, setGeneratedIssue] = useState<GeneratedIssue | null>(null);

  const hasFilter = searchQuery.trim() !== "" || categoryFilter !== ALL_CATEGORIES;

  const allThreads = useMemo(() => {
    const map = new Map<string, ThreadRow>();

    for (const thread of [...popularThreads, ...activeThreads]) {
      map.set(thread.id, thread);
    }

    return Array.from(map.values());
  }, [activeThreads, popularThreads]);

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

  const visiblePopularThreads = hasFilter
    ? filteredPopularThreads
    : filteredPopularThreads.slice(0, 8);
  const visibleActiveThreads = hasFilter
    ? filteredActiveThreads
    : filteredActiveThreads.slice(0, 8);

  const totalPostCount = allThreads.reduce(
    (total, thread) => total + (thread.post_count ?? 0),
    0
  );

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

  async function analyzeText(sourceText: string) {
    const trimmed = sourceText.trim();
    if (!trimmed) {
      setActionError("整理したい内容を入力してください。");
      return;
    }

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

    const finalClaim =
      generatedIssue.claim.trim() || text.trim() || "新しい議論";

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
          title: finalClaim,
          claim: finalClaim,
          premises: generatedIssue.premises,
          reasons: generatedIssue.reasons,
          conflicts: generatedIssue.conflicts,
          postType: "auto",
        }),
      });

      const result: unknown = await res.json();

      if (!res.ok || !isRecord(result)) {
        throw new Error("スレッド作成に失敗しました");
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

  const renderedPremises = generatedIssue?.premises ?? [];
  const renderedReasons = generatedIssue?.reasons ?? [];
  const renderedConflicts = generatedIssue?.conflicts ?? [];

  return (
    <main style={pageStyle}>
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
              前提と根拠をそろえて議論する
            </h1>
            <p
              style={{
                margin: "10px 0 0",
                color: "#d1d5db",
                lineHeight: 1.8,
                fontSize: currentFontSize,
              }}
            >
              投稿前に主張、前提、根拠、反論を分けて、近い既存スレッドも確認できます。
            </p>
          </div>

          <Link
            href={`/${tenant}/macro`}
            style={{
              display: "inline-block",
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #64748b",
              color: "#f9fafb",
              textDecoration: "none",
              fontWeight: 800,
              background: "#1f2937",
            }}
          >
            マクロで整理
          </Link>
        </div>

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
      </header>

      <ForumGuideTree />

      <section style={{ ...panelStyle, marginBottom: 18 }}>
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

      {(goal || keyword) && (
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
        </section>
      )}

      <section
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          gap: 18,
          marginBottom: 22,
        }}
      >
        <div>
          <h2 style={{ margin: "0 0 10px", fontSize: 20 }}>人気スレッド</h2>
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
              <div style={panelStyle}>一致する人気スレッドはありません。</div>
            )}
          </div>
        </div>

        <div>
          <h2 style={{ margin: "0 0 10px", fontSize: 20 }}>活発スレッド</h2>
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
              <div style={panelStyle}>一致する活発スレッドはありません。</div>
            )}
          </div>
        </div>
      </section>

      <section style={{ ...darkPanelStyle, marginBottom: 18 }}>
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
            <h2 style={{ margin: 0, fontSize: 22 }}>新しい論点を整理</h2>
            <p
              style={{
                margin: "8px 0 0",
                color: "#cbd5e1",
                fontSize: currentFontSize - 1,
                lineHeight: 1.7,
              }}
            >
              書きかけの考えを、投稿しやすい議論の形に整えます。
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => selectMode("normal")}
              style={{
                ...ghostButtonStyle,
                background: defaultMode === "normal" ? "#ffffff" : "#1f2937",
                color: defaultMode === "normal" ? "#111827" : "#e5e7eb",
                borderColor: defaultMode === "normal" ? "#ffffff" : "#475569",
              }}
            >
              標準
            </button>
            <button
              type="button"
              onClick={() => selectMode("easy")}
              style={{
                ...ghostButtonStyle,
                background: defaultMode === "easy" ? "#ffffff" : "#1f2937",
                color: defaultMode === "easy" ? "#111827" : "#e5e7eb",
                borderColor: defaultMode === "easy" ? "#ffffff" : "#475569",
              }}
            >
              やさしい表示
            </button>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginTop: 14,
          }}
        >
          {(["small", "medium", "large"] as const).map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => selectFontSize(size)}
              style={{
                ...ghostButtonStyle,
                padding: "7px 10px",
                background: fontSizeMode === size ? "#ffffff" : "#1f2937",
                color: fontSizeMode === size ? "#111827" : "#e5e7eb",
                borderColor: fontSizeMode === size ? "#ffffff" : "#475569",
              }}
            >
              {size === "small" ? "小" : size === "medium" ? "中" : "大"}
            </button>
          ))}
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
              marginTop: 12,
              background: "#10141d",
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 8 }}>AIが読み取った要点</div>
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
                入力欄に反映
              </button>
              <PrimaryButton onClick={handleUseOrganizedAndAnalyze} disabled={loading}>
                {loading ? "整理中..." : "この内容で分析"}
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

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
          <PrimaryButton onClick={handleOrganizePost} disabled={organizing || loading}>
            {organizing ? "整えています..." : "読みやすく整える"}
          </PrimaryButton>
          <PrimaryButton
            onClick={() => analyzeText(text)}
            disabled={loading || organizing}
            variant="secondary"
          >
            {loading ? "整理中..." : "論点を整理"}
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
            <h2 style={{ margin: 0, fontSize: 22 }}>整理結果</h2>
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
                    <li style={{ color: "#6b7280" }}>まだ整理されていません。</li>
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
                    <li style={{ color: "#6b7280" }}>まだ整理されていません。</li>
                  )}
                </ul>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={labelStyle}>対立しそうな見方</div>
              <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
                {renderedConflicts.length > 0 ? (
                  renderedConflicts.map((conflict, index) => (
                    <li key={`${conflict.opinion}-${index}`}>
                      {conflict.opinion}
                      {conflict.rebuttal ? ` / ${conflict.rebuttal}` : ""}
                    </li>
                  ))
                ) : (
                  <li style={{ color: "#6b7280" }}>まだ抽出されていません。</li>
                )}
              </ul>
            </div>
          </div>

          <aside style={panelStyle}>
            <h2 style={{ margin: 0, fontSize: 20 }}>既存スレッド</h2>
            <p style={{ ...smallMetaStyle, marginTop: 6 }}>
              近い議論がある場合は、そちらに参加できます。
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
                      <StanceLabel stance={thread.stance} />
                    </div>
                    <div
                      style={{
                        fontWeight: 800,
                        lineHeight: 1.5,
                        fontSize: currentFontSize,
                      }}
                    >
                      {thread.title}
                    </div>
                    {thread.summary && (
                      <div style={{ ...smallMetaStyle, marginTop: 6 }}>
                        {truncate(thread.summary, 90)}
                      </div>
                    )}
                    {thread.reason && (
                      <div style={{ ...smallMetaStyle, marginTop: 6 }}>
                        {thread.reason}
                      </div>
                    )}
                  </button>
                ))
              ) : (
                <div style={{ ...smallMetaStyle, marginTop: 8 }}>
                  関連する既存スレッドはまだ見つかっていません。
                </div>
              )}
            </div>

            <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
              {selectedThreadId ? (
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
                  選んだスレッドに参加
                </Link>
              ) : (
                <PrimaryButton
                  onClick={handleCreateThread}
                  disabled={creatingThread || Boolean(selectedThreadId)}
                  style={{
                    width: "100%",
                    background: "#047857",
                  }}
                >
                  {creatingThread ? "作成中..." : "新しいスレッドを作成"}
                </PrimaryButton>
              )}
            </div>
          </aside>
        </section>
      )}
    </main>
  );
}
