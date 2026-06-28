"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import ForumHamburgerMenu from "@/components/forum/ForumHamburgerMenu";

type ReportStatus = "pending" | "reviewing" | "resolved" | "dismissed" | "all";

type ReportRow = {
  id: string;
  thread_id: string | null;
  post_id: string;
  reason_type: string;
  reason_detail: string | null;
  status: string;
  admin_note: string | null;
  resolved_at: string | null;
  created_at: string | null;
  post: {
    id: string;
    thread_id: string;
    post_role: string | null;
    content: string | null;
    is_sensitive: boolean;
    is_deleted: boolean;
    created_at: string | null;
  } | null;
  thread: {
    id: string;
    title: string | null;
    is_deleted: boolean;
  } | null;
};

const statusLabels: Record<string, string> = {
  pending: "未対応",
  reviewing: "確認中",
  resolved: "対応済み",
  dismissed: "却下",
  all: "すべて",
};

const reasonLabels: Record<string, string> = {
  personal_info: "個人情報",
  harassment: "攻撃的・嫌がらせ",
  spam: "スパム・宣伝",
  illegal_or_dangerous: "危険・不適切",
  wrong_publication: "誤公開",
  other: "その他",
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

function compactText(value: string | null | undefined, max = 260) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

export default function ForumAdminReportsPage() {
  const params = useParams();
  const tenantParam = params?.tenant;
  const tenant = Array.isArray(tenantParam)
    ? tenantParam[0] ?? "dev"
    : tenantParam ?? "dev";
  const [status, setStatus] = useState<ReportStatus>("pending");
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadReports() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/forum/admin/reports?status=${status}`, {
        cache: "no-store",
      });
      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        setReports([]);
        setError(json?.error || "通報一覧を読み込めませんでした。");
        return;
      }

      const loadedReports = (json.reports ?? []) as ReportRow[];
      setReports(loadedReports);
      setNotes(
        Object.fromEntries(
          loadedReports.map((report) => [report.id, report.admin_note ?? ""])
        )
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReports();
  }, [status]);

  async function updateReport(reportId: string, nextStatus: "resolved" | "dismissed") {
    setSavingId(reportId);
    setError(null);

    try {
      const response = await fetch(`/api/forum/admin/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          admin_note: notes[reportId] ?? "",
        }),
      });
      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(json?.error || "通報ステータスを更新できませんでした。");
        return;
      }

      setReports((current) =>
        status === "all"
          ? current.map((report) =>
              report.id === reportId
                ? {
                    ...report,
                    status: json.report?.status ?? nextStatus,
                    resolved_at: json.report?.resolved_at ?? report.resolved_at,
                    admin_note: json.report?.admin_note ?? notes[reportId] ?? "",
                  }
                : report
            )
          : current.filter((report) => report.id !== reportId)
      );
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main
      style={{
        maxWidth: 1040,
        margin: "0 auto",
        padding: "24px 16px 48px",
        color: "#111827",
      }}
    >
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
          style={{ color: "#2563eb", fontWeight: 800, textDecoration: "none" }}
        >
          ← 管理トップ
        </Link>
        <ForumHamburgerMenu tenant={tenant} />
      </header>

      <section style={{ marginBottom: 18 }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 900 }}>
          通報一覧
        </h1>
        <p style={{ margin: 0, color: "#475569", lineHeight: 1.7 }}>
          投稿・返信に寄せられた通報を確認します。この画面では対応済み・却下の記録だけを行い、
          削除や非表示は既存の管理画面で行います。
        </p>
      </section>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 18,
        }}
      >
        {(["pending", "reviewing", "resolved", "dismissed", "all"] as const).map(
          (item) => (
            <button
              key={item}
              type="button"
              onClick={() => setStatus(item)}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 999,
                background: status === item ? "#111827" : "#fff",
                color: status === item ? "#fff" : "#111827",
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

      {error && (
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
          通報一覧を読み込んでいます...
        </div>
      ) : reports.length === 0 ? (
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            background: "#fff",
            padding: 18,
            color: "#64748b",
            fontWeight: 800,
          }}
        >
          表示する通報はありません。
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {reports.map((report) => {
            const threadId = report.thread_id || report.post?.thread_id || "";
            const threadTitle =
              report.thread?.title?.trim() || "対象スレッド";
            const threadHref = threadId
              ? `/${tenant}/forum/thread/${threadId}#post-${report.post_id}`
              : `/${tenant}/forum`;

            return (
              <article
                key={report.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  background: "#fff",
                  padding: 14,
                  display: "grid",
                  gap: 10,
                  boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
                }}
              >
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
                      {reasonLabels[report.reason_type] ?? report.reason_type}
                    </div>
                    <div style={{ color: "#64748b", fontSize: 13 }}>
                      {formatDate(report.created_at)} ・ {statusLabels[report.status] ?? report.status}
                    </div>
                  </div>
                  <Link
                    href={threadHref}
                    style={{
                      color: "#2563eb",
                      fontWeight: 800,
                      textDecoration: "none",
                    }}
                  >
                    対象投稿を見る
                  </Link>
                </div>

                <div
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    background: "#f8fafc",
                    padding: 10,
                    lineHeight: 1.7,
                  }}
                >
                  <div style={{ fontWeight: 900, marginBottom: 4 }}>
                    {threadTitle}
                    {report.thread?.is_deleted ? "（非表示中）" : ""}
                  </div>
                  <div style={{ color: "#334155", overflowWrap: "anywhere" }}>
                    {compactText(report.post?.content || "対象本文を取得できませんでした。")}
                  </div>
                  {report.post?.is_deleted && (
                    <div style={{ marginTop: 6, color: "#92400e", fontWeight: 800 }}>
                      この投稿は非表示中です。
                    </div>
                  )}
                </div>

                {report.reason_detail && (
                  <div style={{ lineHeight: 1.7 }}>
                    <div style={{ fontWeight: 900, marginBottom: 4 }}>
                      通報者の補足
                    </div>
                    <div style={{ overflowWrap: "anywhere" }}>
                      {report.reason_detail}
                    </div>
                  </div>
                )}

                <label
                  style={{
                    display: "grid",
                    gap: 4,
                    fontWeight: 800,
                    fontSize: 13,
                  }}
                >
                  管理メモ
                  <textarea
                    value={notes[report.id] ?? ""}
                    onChange={(event) =>
                      setNotes((current) => ({
                        ...current,
                        [report.id]: event.target.value.slice(0, 1000),
                      }))
                    }
                    rows={2}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      border: "1px solid #cbd5e1",
                      borderRadius: 8,
                      padding: 8,
                      lineHeight: 1.5,
                    }}
                  />
                </label>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    disabled={savingId === report.id}
                    onClick={() => void updateReport(report.id, "resolved")}
                    style={{
                      border: "1px solid #16a34a",
                      borderRadius: 999,
                      background: "#16a34a",
                      color: "#fff",
                      cursor: savingId === report.id ? "wait" : "pointer",
                      fontWeight: 900,
                      padding: "7px 12px",
                    }}
                  >
                    対応済み
                  </button>
                  <button
                    type="button"
                    disabled={savingId === report.id}
                    onClick={() => void updateReport(report.id, "dismissed")}
                    style={{
                      border: "1px solid #cbd5e1",
                      borderRadius: 999,
                      background: "#fff",
                      color: "#374151",
                      cursor: savingId === report.id ? "wait" : "pointer",
                      fontWeight: 900,
                      padding: "7px 12px",
                    }}
                  >
                    却下
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
