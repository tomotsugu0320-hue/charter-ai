"use client";

import Link from "next/link";
import { CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import MicroSectionCard from "@/components/micro/MicroSectionCard";
import MicroSectionTitle from "@/components/micro/MicroSectionTitle";

type MicroTag = {
  id: string;
  name: string;
};

type TagSource = {
  id: string;
  title: string | null;
  source_type: string;
  summary: string | null;
  updated_at: string | null;
};

type TagsResponse = {
  success?: boolean;
  error?: string;
  tag?: MicroTag | null;
  sources?: TagSource[];
};

function getParam(params: ReturnType<typeof useParams>, key: string) {
  const value = params?.[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return typeof value === "string" ? value : "";
}

function decodeParam(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "日時なし";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "日時なし";

  return date.toLocaleString("ja-JP");
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

const titleStyle: CSSProperties = {
  margin: "14px 0 0",
  color: "#ffffff",
  fontSize: 24,
  lineHeight: 1.35,
  overflowWrap: "anywhere",
};

const metaStyle: CSSProperties = {
  margin: "12px 0 0",
  color: "#cbd5e1",
  fontSize: 13,
  lineHeight: 1.6,
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

const sourceListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  marginTop: 16,
};

const sourceCardStyle: CSSProperties = {
  width: "100%",
  border: "1px solid #334155",
  borderRadius: 8,
  background: "#0f172a",
  color: "#f8fafc",
  padding: 12,
  textAlign: "left",
  cursor: "pointer",
  font: "inherit",
};

const sourceTitleStyle: CSSProperties = {
  margin: 0,
  color: "#ffffff",
  fontSize: 16,
  lineHeight: 1.45,
  overflowWrap: "anywhere",
};

const sourceMetaStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 8,
  color: "#cbd5e1",
  fontSize: 12,
  lineHeight: 1.5,
};

const summaryStyle: CSSProperties = {
  marginTop: 10,
  color: "#dbeafe",
  background: "#172554",
  border: "1px solid #1d4ed8",
  borderRadius: 8,
  padding: "8px 10px",
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  lineHeight: 1.6,
};

export default function MicroTagPage() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = useMemo(() => getParam(params, "tenant"), [params]);
  const tagParam = useMemo(() => getParam(params, "tag"), [params]);
  const tagName = useMemo(() => decodeParam(tagParam), [tagParam]);

  const [tag, setTag] = useState<MicroTag | null>(null);
  const [sources, setSources] = useState<TagSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [openingSourceId, setOpeningSourceId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const loadTagSources = useCallback(async () => {
    if (!tenantSlug || !tagName) return;

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(
        `/api/micro/tags?tenant_slug=${encodeURIComponent(
          tenantSlug
        )}&tag=${encodeURIComponent(tagName)}`,
        { cache: "no-store" }
      );
      const data = (await res.json()) as TagsResponse;

      if (!res.ok || data.success === false) {
        throw new Error(data.error || "タグの読み込みに失敗しました");
      }

      setTag(data.tag ?? null);
      setSources(data.sources ?? []);
    } catch (error) {
      setTag(null);
      setSources([]);
      setMessage(
        error instanceof Error ? error.message : "タグの読み込みに失敗しました"
      );
    } finally {
      setLoading(false);
    }
  }, [tagName, tenantSlug]);

  useEffect(() => {
    void loadTagSources();
  }, [loadTagSources]);

  const handleOpenSource = async (sourceId: string) => {
    if (!tenantSlug) return;

    setOpeningSourceId(sourceId);

    try {
      await fetch("/api/micro/source-data", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: sourceId,
          action: "touch",
        }),
      });
    } finally {
      setOpeningSourceId(null);
      router.push(
        `/${encodeURIComponent(
          tenantSlug
        )}/micro/source/${encodeURIComponent(sourceId)}`
      );
    }
  };

  const displayTagName = tag?.name || tagName || "タグ";

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
          <MicroSectionTitle level={1}>タグ</MicroSectionTitle>

          {loading ? (
            <p style={mutedTextStyle}>読み込み中</p>
          ) : message ? (
            <p style={messageStyle}>{message}</p>
          ) : (
            <>
              <h2 style={titleStyle}>{displayTagName}</h2>
              <div style={metaStyle}>件数: {sources.length}</div>
            </>
          )}
        </MicroSectionCard>

        <MicroSectionCard>
          <MicroSectionTitle>思考ログ</MicroSectionTitle>

          {loading ? (
            <p style={mutedTextStyle}>読み込み中</p>
          ) : sources.length === 0 ? (
            <p style={mutedTextStyle}>このタグのログはまだありません。</p>
          ) : (
            <div style={sourceListStyle}>
              {sources.map((source) => {
                const sourceTitle = source.title?.trim() || "無題";
                const sourceTypeLabel =
                  sourceTypeLabels[source.source_type] ?? source.source_type;

                return (
                  <button
                    key={source.id}
                    type="button"
                    disabled={openingSourceId === source.id}
                    onClick={() => void handleOpenSource(source.id)}
                    style={{
                      ...sourceCardStyle,
                      cursor:
                        openingSourceId === source.id
                          ? "progress"
                          : "pointer",
                    }}
                  >
                    <h3 style={sourceTitleStyle}>{sourceTitle}</h3>
                    <div style={sourceMetaStyle}>
                      <span>{sourceTypeLabel}</span>
                      <span>{formatTimestamp(source.updated_at)}</span>
                    </div>
                    {source.summary && (
                      <div style={summaryStyle}>{source.summary}</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </MicroSectionCard>
      </div>
    </main>
  );
}
