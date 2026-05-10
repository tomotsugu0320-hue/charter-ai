"use client";

import Link from "next/link";
import { CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import MicroSectionCard from "@/components/micro/MicroSectionCard";
import MicroSectionTitle from "@/components/micro/MicroSectionTitle";

type SourceDataDetail = {
  id: string;
  title: string | null;
  source_type: string;
  raw_content: string;
  status: string;
  pinned: boolean;
  usage_count: number;
  last_used_at: string | null;
  summary: string | null;
};

type SourceDataResponse = {
  success?: boolean;
  error?: string;
  sourceData?: SourceDataDetail;
};

function getParam(params: ReturnType<typeof useParams>, key: string) {
  const value = params?.[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return typeof value === "string" ? value : "";
}

const sourceTypeLabels: Record<string, string> = {
  free_log: "フリーログ",
  smart_note: "スマートノート",
  chat_log: "チャットログ",
  imported_text: "取り込みテキスト",
  manual: "手入力",
  voice: "音声メモ",
  chatgpt_share: "ChatGPT共有",
  line: "LINE",
  web_clip: "Webクリップ",
};

const statusLabels: Record<string, string> = {
  draft: "下書き",
  active: "有効",
  archived: "保管済み",
};

function formatDate(value: string | null) {
  if (!value) return "未使用";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未使用";

  return date.toLocaleString("ja-JP");
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#111827",
  color: "#f9fafb",
  padding: "32px 16px",
};

const shellStyle: CSSProperties = {
  width: "100%",
  maxWidth: 720,
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: 20,
};

const backLinkStyle: CSSProperties = {
  alignSelf: "flex-start",
  color: "#bfdbfe",
  background: "#1e3a8a",
  border: "1px solid #2563eb",
  borderRadius: 8,
  padding: "8px 12px",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 700,
};

const mutedTextStyle: CSSProperties = {
  margin: "16px 0 0",
  color: "#d1d5db",
};

const messageStyle: CSSProperties = {
  margin: "14px 0 0",
  color: "#fecaca",
  background: "#7f1d1d",
  border: "1px solid #ef4444",
  borderRadius: 8,
  padding: "10px 12px",
};

const titleStyle: CSSProperties = {
  margin: "14px 0 0",
  color: "#ffffff",
  fontSize: 24,
  lineHeight: 1.35,
  overflowWrap: "anywhere",
};

const badgeRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 12,
};

const badgeStyle: CSSProperties = {
  background: "#1e293b",
  color: "#e0f2fe",
  border: "1px solid #334155",
  borderRadius: 999,
  padding: "3px 9px",
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.5,
};

const pinnedBadgeStyle: CSSProperties = {
  background: "#78350f",
  color: "#fef3c7",
  border: "1px solid #92400e",
  borderRadius: 999,
  padding: "3px 9px",
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.5,
};

const statusBadgeStyle: CSSProperties = {
  background: "#064e3b",
  color: "#d1fae5",
  border: "1px solid #047857",
  borderRadius: 999,
  padding: "3px 9px",
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.5,
};

const contentStyle: CSSProperties = {
  marginTop: 16,
  color: "#f8fafc",
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  lineHeight: 1.75,
};

const summaryStyle: CSSProperties = {
  marginTop: 12,
  background: "#172554",
  color: "#dbeafe",
  border: "1px solid #1d4ed8",
  borderRadius: 8,
  padding: "12px 14px",
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  lineHeight: 1.7,
};

const metaGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 10,
  marginTop: 16,
};

const metaItemStyle: CSSProperties = {
  background: "#0f172a",
  color: "#e5e7eb",
  border: "1px solid #334155",
  borderRadius: 8,
  padding: "10px 12px",
  lineHeight: 1.5,
};

const metaLabelStyle: CSSProperties = {
  display: "block",
  color: "#93c5fd",
  fontSize: 12,
  fontWeight: 700,
  marginBottom: 4,
};

export default function MicroSourceDetailPage() {
  const params = useParams();
  const tenantSlug = useMemo(() => getParam(params, "tenant"), [params]);
  const id = useMemo(() => getParam(params, "id"), [params]);

  const [item, setItem] = useState<SourceDataDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadSourceData = useCallback(async () => {
    if (!tenantSlug || !id) return;

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(
        `/api/micro/source-data?tenant_slug=${encodeURIComponent(
          tenantSlug
        )}&id=${encodeURIComponent(id)}`,
        { cache: "no-store" }
      );
      const data = (await res.json()) as SourceDataResponse;

      if (!res.ok || data.success === false || !data.sourceData) {
        throw new Error(data.error || "読み込みに失敗しました");
      }

      setItem(data.sourceData);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "読み込みに失敗しました"
      );
    } finally {
      setLoading(false);
    }
  }, [id, tenantSlug]);

  useEffect(() => {
    void loadSourceData();
  }, [loadSourceData]);

  const displayTitle = item?.title?.trim() || "無題";
  const sourceTypeLabel = item
    ? sourceTypeLabels[item.source_type] ?? item.source_type
    : "";
  const statusLabel = item ? statusLabels[item.status] ?? item.status : "";

  return (
    <main style={pageStyle}>
      <div style={shellStyle}>
        <Link
          href={`/${encodeURIComponent(tenantSlug)}/micro`}
          style={backLinkStyle}
        >
          一覧へ戻る
        </Link>

        <MicroSectionCard>
          <MicroSectionTitle level={1}>思考ログ詳細</MicroSectionTitle>

          {loading ? (
            <p style={mutedTextStyle}>読み込み中</p>
          ) : message ? (
            <p style={messageStyle}>{message}</p>
          ) : item ? (
            <>
              <h2 style={titleStyle}>{displayTitle}</h2>

              <div style={badgeRowStyle}>
                <span style={badgeStyle}>{sourceTypeLabel}</span>
                <span style={statusBadgeStyle}>{statusLabel}</span>
                {item.pinned && <span style={pinnedBadgeStyle}>ピン留め中</span>}
              </div>

              <div style={contentStyle}>{item.raw_content}</div>
            </>
          ) : (
            <p style={mutedTextStyle}>思考ログが見つかりませんでした。</p>
          )}
        </MicroSectionCard>

        {item && (
          <>
            <MicroSectionCard>
              <MicroSectionTitle>整理</MicroSectionTitle>
              {item.summary ? (
                <div style={summaryStyle}>{item.summary}</div>
              ) : (
                <p style={mutedTextStyle}>整理はまだありません。</p>
              )}
            </MicroSectionCard>

            <MicroSectionCard>
              <MicroSectionTitle>状態</MicroSectionTitle>
              <div style={metaGridStyle}>
                <div style={metaItemStyle}>
                  <span style={metaLabelStyle}>利用回数</span>
                  {item.usage_count ?? 0}
                </div>
                <div style={metaItemStyle}>
                  <span style={metaLabelStyle}>最終利用</span>
                  {formatDate(item.last_used_at)}
                </div>
                <div style={metaItemStyle}>
                  <span style={metaLabelStyle}>ピン</span>
                  {item.pinned ? "ピン留め中" : "なし"}
                </div>
                <div style={metaItemStyle}>
                  <span style={metaLabelStyle}>ステータス</span>
                  {statusLabel}
                </div>
              </div>
            </MicroSectionCard>
          </>
        )}
      </div>
    </main>
  );
}
