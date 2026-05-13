"use client";

import { CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import MicroButton from "@/components/micro/MicroButton";
import MicroSectionCard from "@/components/micro/MicroSectionCard";
import MicroSectionTitle from "@/components/micro/MicroSectionTitle";

type ArchivedSourceData = {
  id: string;
  raw_content: string;
  archived_at: string | null;
};

type SourceDataResponse = {
  success?: boolean;
  error?: string;
  sourceData?: ArchivedSourceData[];
};

function getTenantSlug(params: ReturnType<typeof useParams>) {
  const value = params?.tenant;

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return typeof value === "string" ? value : "";
}

function formatDate(value: string | null) {
  if (!value) return "日時なし";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "日時なし";

  return date.toLocaleString("ja-JP");
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#111827",
  color: "#f9fafb",
  padding: "28px 16px",
};

const shellStyle: CSSProperties = {
  width: "100%",
  maxWidth: 720,
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: 16,
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

const listStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  marginTop: 14,
};

const archivedCardStyle: CSSProperties = {
  background: "#0f172a",
  color: "#f8fafc",
  border: "1px solid #334155",
  borderRadius: 8,
  padding: 14,
  lineHeight: 1.7,
};

const contentStyle: CSSProperties = {
  color: "#f8fafc",
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
};

const metaStyle: CSSProperties = {
  marginTop: 12,
  color: "#cbd5e1",
  fontSize: 13,
};

const actionStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  marginTop: 12,
};

export default function ArchivedMicroPage() {
  const params = useParams();
  const tenantSlug = useMemo(() => getTenantSlug(params), [params]);

  const [items, setItems] = useState<ArchivedSourceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const loadArchivedSourceData = useCallback(async () => {
    if (!tenantSlug) return;

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(
        `/api/micro/source-data?tenant_slug=${encodeURIComponent(
          tenantSlug
        )}&status=archived`,
        { cache: "no-store" }
      );
      const data = (await res.json()) as SourceDataResponse;

      if (!res.ok || data.success === false) {
        throw new Error(data.error || "読み込みに失敗しました");
      }

      setItems(data.sourceData ?? []);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "読み込みに失敗しました"
      );
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    void loadArchivedSourceData();
  }, [loadArchivedSourceData]);

  const handleRestore = async (id: string) => {
    setRestoringId(id);
    setMessage("");

    try {
      const res = await fetch("/api/micro/source-data", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          action: "restore",
        }),
      });
      const data = (await res.json()) as SourceDataResponse;

      if (!res.ok || data.success === false) {
        throw new Error(data.error || "復元に失敗しました");
      }

      await loadArchivedSourceData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "復元に失敗しました");
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <main style={pageStyle}>
      <div style={shellStyle}>
        <MicroSectionCard>
          <MicroSectionTitle level={1}>保管ログ</MicroSectionTitle>
          {message && <p style={messageStyle}>{message}</p>}
        </MicroSectionCard>

        <MicroSectionCard>
          <MicroSectionTitle>保管ログ</MicroSectionTitle>

          {loading ? (
            <p style={mutedTextStyle}>読み込み中</p>
          ) : items.length === 0 ? (
            <p style={mutedTextStyle}>保管ログはありません。</p>
          ) : (
            <div style={listStyle}>
              {items.map((item) => (
                <article key={item.id} style={archivedCardStyle}>
                  <div style={contentStyle}>{item.raw_content}</div>
                  <div style={metaStyle}>
                    保管: {formatDate(item.archived_at)}
                  </div>
                  <div style={actionStyle}>
                    <MicroButton
                      type="button"
                      disabled={restoringId === item.id}
                      onClick={() => void handleRestore(item.id)}
                    >
                      {restoringId === item.id ? "復元中" : "復元"}
                    </MicroButton>
                  </div>
                </article>
              ))}
            </div>
          )}
        </MicroSectionCard>
      </div>
    </main>
  );
}
