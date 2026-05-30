"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type PrivateImportLog = {
  id: string;
  tenant_slug?: string | null;
  author_key?: string | null;
  candidate?: unknown;
  related_thread?: unknown;
  related_thread_id?: string | null;
  related_thread_url?: string | null;
  memo?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type FetchState = {
  loading: boolean;
  error: string;
};

const pageStyle: CSSProperties = {
  maxWidth: 1040,
  margin: "0 auto",
  padding: 24,
  color: "#111827",
};

const headerStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  background: "#f8fafc",
  color: "#0f172a",
  padding: 18,
  marginBottom: 18,
};

const cardStyle: CSSProperties = {
  border: "1px solid #dbe3ef",
  borderRadius: 12,
  background: "#ffffff",
  color: "#111827",
  padding: 16,
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
};

const mutedStyle: CSSProperties = {
  color: "#64748b",
  lineHeight: 1.7,
};

const labelStyle: CSSProperties = {
  marginBottom: 4,
  color: "#475569",
  fontSize: 13,
  fontWeight: 900,
};

const pillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 999,
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1e3a8a",
  padding: "3px 8px",
  fontSize: 12,
  fontWeight: 800,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function compactText(value: unknown, limit = 180) {
  const text = toText(value).replace(/\s+/g, " ");
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}...`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "日時不明";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "日時不明";

  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function FieldBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      <div style={{ lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
        {children || <span style={mutedStyle}>-</span>}
      </div>
    </div>
  );
}

export default function PrivateLogsPage() {
  const params = useParams();
  const tenantParam = params?.tenant;
  const tenant = Array.isArray(tenantParam)
    ? tenantParam[0]
    : String(tenantParam ?? "dev");
  const [logs, setLogs] = useState<PrivateImportLog[]>([]);
  const [fetchState, setFetchState] = useState<FetchState>({
    loading: true,
    error: "",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadLogs() {
      if (!tenant) return;

      setFetchState({ loading: true, error: "" });

      try {
        const response = await fetch(
          `/api/forum/private-import-logs?tenantSlug=${encodeURIComponent(
            tenant
          )}`,
          { cache: "no-store" }
        );
        const data: unknown = await response.json().catch(() => null);
        const record = isRecord(data) ? data : {};

        if (!response.ok || record.success === false) {
          throw new Error(
            toText(record.error) || "保存済み参考投稿の取得に失敗しました。"
          );
        }

        if (!cancelled) {
          setLogs(Array.isArray(record.logs) ? record.logs : []);
          setFetchState({ loading: false, error: "" });
        }
      } catch (error) {
        if (!cancelled) {
          setFetchState({
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : "保存済み参考投稿の取得に失敗しました。",
          });
        }
      }
    }

    loadLogs();

    return () => {
      cancelled = true;
    };
  }, [tenant]);

  const sortedLogs = useMemo(() => logs, [logs]);

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <Link
          href={`/${tenant}/forum`}
          style={{
            display: "inline-flex",
            marginBottom: 12,
            color: "#0369a1",
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          ← フォーラムへ戻る
        </Link>
        <h1 style={{ margin: "0 0 8px", fontSize: 30, fontWeight: 900 }}>
          保存済み参考投稿
        </h1>
        <p style={{ ...mutedStyle, margin: 0 }}>
          外部AI取り込みで保存した参考投稿を確認できます。
        </p>
      </header>

      {fetchState.loading && (
        <section style={cardStyle}>保存済み参考投稿を読み込んでいます...</section>
      )}

      {!fetchState.loading && fetchState.error && (
        <section
          style={{
            ...cardStyle,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#991b1b",
          }}
        >
          {fetchState.error}
        </section>
      )}

      {!fetchState.loading && !fetchState.error && sortedLogs.length === 0 && (
        <section style={cardStyle}>まだ保存済み参考投稿はありません。</section>
      )}

      {!fetchState.loading && !fetchState.error && sortedLogs.length > 0 && (
        <section style={{ display: "grid", gap: 14 }}>
          {sortedLogs.map((log) => {
            const candidate = isRecord(log.candidate) ? log.candidate : {};
            const relatedThread = isRecord(log.related_thread)
              ? log.related_thread
              : {};
            const title = toText(candidate.title) || "無題の投稿候補";
            const question = compactText(candidate.question);
            const aiAnswer = compactText(candidate.ai_answer);
            const category = toText(candidate.category);
            const node = toText(candidate.node);
            const relatedTitle =
              toText(relatedThread.title) || "参考スレッド";
            const relatedReason = compactText(relatedThread.reason);
            const relatedSummary = compactText(relatedThread.ai_summary);
            const relatedUrl = toText(log.related_thread_url);

            return (
              <article key={log.id} style={cardStyle}>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <span style={pillStyle}>保存日時 {formatDate(log.created_at)}</span>
                  {category && <span style={pillStyle}>カテゴリ {category}</span>}
                  {node && <span style={pillStyle}>ノード {node}</span>}
                </div>

                <div style={{ display: "grid", gap: 12 }}>
                  <FieldBlock label="自分の投稿候補">
                    <strong>{title}</strong>
                  </FieldBlock>

                  <FieldBlock label="質問プレビュー">{question}</FieldBlock>

                  <FieldBlock label="AI回答・整理プレビュー">
                    {aiAnswer}
                  </FieldBlock>

                  <div
                    style={{
                      borderTop: "1px solid #e2e8f0",
                      paddingTop: 12,
                    }}
                  >
                    <FieldBlock label="参考に保存した既存スレッド">
                      <strong>{relatedTitle}</strong>
                    </FieldBlock>
                  </div>

                  <FieldBlock label="類似理由">{relatedReason}</FieldBlock>

                  <FieldBlock label="既存スレッド要約プレビュー">
                    {relatedSummary}
                  </FieldBlock>

                  {relatedUrl && (
                    <div>
                      <Link
                        href={relatedUrl}
                        style={{
                          display: "inline-flex",
                          border: "1px solid #0ea5e9",
                          borderRadius: 8,
                          background: "#e0f2fe",
                          color: "#075985",
                          padding: "9px 12px",
                          fontWeight: 900,
                          textDecoration: "none",
                        }}
                      >
                        関連スレッドを開く
                      </Link>
                    </div>
                  )}

                  {toText(log.memo) && (
                    <FieldBlock label="メモ">{log.memo}</FieldBlock>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
