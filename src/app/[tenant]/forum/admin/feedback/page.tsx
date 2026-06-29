"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import ForumHamburgerMenu from "@/components/forum/ForumHamburgerMenu";

type FeedbackStatus = "new" | "reviewing" | "resolved" | "ignored" | "all";
type UpdateStatus = Exclude<FeedbackStatus, "all">;

type FeedbackRow = {
  id: string;
  tenant_id: string;
  page_url: string | null;
  report_type: string;
  device_type: string | null;
  message: string;
  contact: string | null;
  user_agent: string | null;
  status: UpdateStatus;
  admin_note: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const pageStyle: CSSProperties = {
  maxWidth: 1080,
  margin: "0 auto",
  padding: "24px 16px 56px",
  color: "#111827",
};

const cardStyle: CSSProperties = {
  border: "1px solid #dbe3ef",
  borderRadius: 10,
  background: "#ffffff",
  boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
  padding: 16,
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#ffffff",
  color: "#111827",
  font: "inherit",
  padding: "9px 10px",
};

const statusLabels: Record<FeedbackStatus, string> = {
  new: "新規",
  reviewing: "確認中",
  resolved: "対応済み",
  ignored: "対応しない",
  all: "すべて",
};

const reportTypeLabels: Record<string, string> = {
  bug: "不具合",
  display: "表示が見づらい",
  unclear: "内容が分かりにくい",
  link: "リンク切れ",
  ai_output: "AI整理への改善要望",
  request: "改善要望",
  other: "その他",
};

const deviceLabels: Record<string, string> = {
  pc: "PC",
  smartphone: "スマホ",
  tablet: "タブレット",
  unknown: "不明",
};

function formatDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function compactText(value: string | null | undefined, max = 700) {
  const text = String(value ?? "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

export default function ForumAdminFeedbackPage() {
  const params = useParams();
  const tenantParam = params?.tenant;
  const tenant = Array.isArray(tenantParam)
    ? tenantParam[0] ?? "dev"
    : tenantParam ?? "dev";

  const [status, setStatus] = useState<FeedbackStatus>("new");
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [nextStatuses, setNextStatuses] = useState<Record<string, UpdateStatus>>(
    {}
  );
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);

  async function loadFeedback() {
    setLoading(true);
    setError(null);
    setAuthRequired(false);

    try {
      const response = await fetch(`/api/forum/admin/feedback?status=${status}`, {
        cache: "no-store",
      });
      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFeedback([]);
        if (response.status === 401 || response.status === 403) {
          setAuthRequired(true);
          return;
        }
        setError(
          json?.error || "不具合・改善報告の一覧を読み込めませんでした。"
        );
        return;
      }

      const loadedFeedback = (json.feedback ?? []) as FeedbackRow[];
      setFeedback(loadedFeedback);
      setAuthRequired(false);
      setNotes(
        Object.fromEntries(
          loadedFeedback.map((item) => [item.id, item.admin_note ?? ""])
        )
      );
      setNextStatuses(
        Object.fromEntries(loadedFeedback.map((item) => [item.id, item.status]))
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFeedback();
  }, [status]);

  async function updateFeedback(feedbackId: string) {
    const nextStatus = nextStatuses[feedbackId] ?? "reviewing";
    setSavingId(feedbackId);
    setError(null);

    try {
      const response = await fetch(`/api/forum/admin/feedback/${feedbackId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          admin_note: notes[feedbackId] ?? "",
        }),
      });
      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(
          json?.error || "不具合・改善報告のステータスを更新できませんでした。"
        );
        return;
      }

      setFeedback((current) =>
        status === "all"
          ? current.map((item) =>
              item.id === feedbackId
                ? {
                    ...item,
                    status: json.feedback?.status ?? nextStatus,
                    admin_note:
                      json.feedback?.admin_note ?? notes[feedbackId] ?? "",
                    updated_at: json.feedback?.updated_at ?? item.updated_at,
                  }
                : item
            )
          : current.filter((item) => item.id !== feedbackId)
      );
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main style={pageStyle}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <Link
          href={`/${tenant}/forum/admin`}
          style={{ color: "#2563eb", fontWeight: 900, textDecoration: "none" }}
        >
          管理トップ
        </Link>
        <ForumHamburgerMenu tenant={tenant} />
      </header>

      <section style={{ marginBottom: 18 }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 900 }}>
          不具合・改善報告
        </h1>
        <p style={{ margin: 0, color: "#475569", lineHeight: 1.7 }}>
          Forumの表示崩れ、リンク切れ、AI整理への改善要望などを確認します。
          ここでは削除や非表示は行わず、状態と管理メモだけを記録します。
        </p>
      </section>

      {!authRequired && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 18,
          }}
        >
          {(["new", "reviewing", "resolved", "ignored", "all"] as const).map(
            (item) => (
              <button
                key={item}
                type="button"
                onClick={() => setStatus(item)}
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 999,
                  background: status === item ? "#111827" : "#ffffff",
                  color: status === item ? "#ffffff" : "#111827",
                  cursor: "pointer",
                  fontWeight: 800,
                  padding: "7px 12px",
                }}
              >
                {statusLabels[item]}
              </button>
            )
          )}
        </div>
      )}

      {error && !authRequired && (
        <div
          style={{
            marginBottom: 14,
            padding: 12,
            border: "1px solid #fecaca",
            borderRadius: 8,
            background: "#fef2f2",
            color: "#991b1b",
            fontWeight: 800,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ color: "#64748b", fontWeight: 800 }}>
          不具合・改善報告を読み込んでいます...
        </div>
      ) : authRequired ? (
        <div
          style={{
            border: "1px solid #bfdbfe",
            borderRadius: 10,
            background: "#eff6ff",
            padding: 18,
            color: "#1e3a8a",
            lineHeight: 1.7,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 6 }}>
            管理者ログインが必要です。
          </div>
          <p style={{ margin: "0 0 12px" }}>
            不具合・改善報告を見るには、先に管理画面で管理者認証を行ってください。
          </p>
          <Link
            href={`/${tenant}/forum/admin`}
            style={{
              display: "inline-flex",
              border: "1px solid #2563eb",
              borderRadius: 999,
              background: "#2563eb",
              color: "#ffffff",
              fontWeight: 900,
              padding: "8px 12px",
              textDecoration: "none",
            }}
          >
            管理トップへ戻る
          </Link>
        </div>
      ) : feedback.length === 0 ? (
        <div
          style={{
            ...cardStyle,
            color: "#64748b",
            fontWeight: 800,
          }}
        >
          表示する報告はありません。
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {feedback.map((item) => (
            <article key={item.id} style={{ ...cardStyle, display: "grid", gap: 12 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontWeight: 900, marginBottom: 4 }}>
                    {reportTypeLabels[item.report_type] ?? item.report_type}
                  </div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    {formatDate(item.created_at)} /{" "}
                    {statusLabels[item.status] ?? item.status} /{" "}
                    {deviceLabels[item.device_type ?? "unknown"] ??
                      item.device_type ??
                      "不明"}
                  </div>
                </div>
                {item.page_url ? (
                  <a
                    href={item.page_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "#2563eb",
                      fontWeight: 800,
                      overflowWrap: "anywhere",
                    }}
                  >
                    対象ページを開く
                  </a>
                ) : null}
              </div>

              {item.page_url && (
                <div
                  style={{
                    color: "#475569",
                    fontSize: 13,
                    overflowWrap: "anywhere",
                  }}
                >
                  {item.page_url}
                </div>
              )}

              <div style={{ lineHeight: 1.8, overflowWrap: "anywhere" }}>
                {compactText(item.message)}
              </div>

              {item.contact && (
                <div
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    background: "#f8fafc",
                    color: "#334155",
                    fontSize: 13,
                    overflowWrap: "anywhere",
                    padding: 10,
                  }}
                >
                  <strong>連絡先:</strong> {item.contact}
                </div>
              )}

              {item.user_agent && (
                <details
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    background: "#f8fafc",
                    color: "#475569",
                    fontSize: 13,
                    padding: 10,
                  }}
                >
                  <summary style={{ cursor: "pointer", fontWeight: 800 }}>
                    user_agent
                  </summary>
                  <div style={{ marginTop: 8, overflowWrap: "anywhere" }}>
                    {item.user_agent}
                  </div>
                </details>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
                  gap: 10,
                }}
              >
                <label style={{ display: "grid", gap: 5, fontWeight: 800 }}>
                  状態
                  <select
                    value={nextStatuses[item.id] ?? item.status}
                    onChange={(event) =>
                      setNextStatuses((current) => ({
                        ...current,
                        [item.id]: event.target.value as UpdateStatus,
                      }))
                    }
                    style={inputStyle}
                  >
                    {(["new", "reviewing", "resolved", "ignored"] as const).map(
                      (nextStatus) => (
                        <option key={nextStatus} value={nextStatus}>
                          {statusLabels[nextStatus]}
                        </option>
                      )
                    )}
                  </select>
                </label>
                <label style={{ display: "grid", gap: 5, fontWeight: 800 }}>
                  管理メモ
                  <textarea
                    value={notes[item.id] ?? ""}
                    onChange={(event) =>
                      setNotes((current) => ({
                        ...current,
                        [item.id]: event.target.value.slice(0, 1000),
                      }))
                    }
                    rows={3}
                    style={{ ...inputStyle, lineHeight: 1.6, resize: "vertical" }}
                  />
                </label>
              </div>

              <div>
                <button
                  type="button"
                  disabled={savingId === item.id}
                  onClick={() => void updateFeedback(item.id)}
                  style={{
                    border: "1px solid #2563eb",
                    borderRadius: 999,
                    background: "#2563eb",
                    color: "#ffffff",
                    cursor: savingId === item.id ? "wait" : "pointer",
                    fontWeight: 900,
                    padding: "8px 12px",
                  }}
                >
                  {savingId === item.id ? "保存中..." : "状態とメモを保存"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
