"use client";

import {
  CSSProperties,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams } from "next/navigation";
import MicroButton from "@/components/micro/MicroButton";
import MicroSectionCard from "@/components/micro/MicroSectionCard";
import MicroSectionTitle from "@/components/micro/MicroSectionTitle";
import MicroSourceDataCard from "@/components/micro/MicroSourceDataCard";
import MicroTextArea from "@/components/micro/MicroTextArea";

type SourceData = {
  id: string;
  raw_content: string;
};

type SourceDataResponse = {
  success?: boolean;
  error?: string;
  sourceData?: SourceData[];
};

function getTenantSlug(params: ReturnType<typeof useParams>) {
  const value = params?.tenant;

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return typeof value === "string" ? value : "";
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

const formStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  marginTop: 16,
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
  marginTop: 16,
};

export default function MicroPage() {
  const params = useParams();
  const tenantSlug = useMemo(() => getTenantSlug(params), [params]);

  const [items, setItems] = useState<SourceData[]>([]);
  const [rawContent, setRawContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const loadSourceData = useCallback(async () => {
    if (!tenantSlug) return;

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(
        `/api/micro/source-data?tenant_slug=${encodeURIComponent(tenantSlug)}`,
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
    void loadSourceData();
  }, [loadSourceData]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const text = rawContent.trim();
    if (!text || !tenantSlug) return;

    setSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/micro/source-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenant_slug: tenantSlug,
          raw_content: text,
        }),
      });
      const data = (await res.json()) as SourceDataResponse;

      if (!res.ok || data.success === false) {
        throw new Error(data.error || "保存に失敗しました");
      }

      setRawContent("");
      await loadSourceData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main style={pageStyle}>
      <div style={shellStyle}>
        <MicroSectionCard>
          <MicroSectionTitle level={1}>Micro</MicroSectionTitle>

          <form onSubmit={handleSubmit} style={formStyle}>
            <MicroTextArea
              value={rawContent}
              onChange={(event) => setRawContent(event.target.value)}
              placeholder="思考ログを書く"
              rows={5}
            />

            <MicroButton
              type="submit"
              disabled={saving || rawContent.trim().length === 0}
            >
              {saving ? "保存中" : "保存"}
            </MicroButton>
          </form>

          {message && <p style={messageStyle}>{message}</p>}
        </MicroSectionCard>

        <MicroSectionCard>
          <MicroSectionTitle>一覧</MicroSectionTitle>

          {loading ? (
            <p style={mutedTextStyle}>読み込み中</p>
          ) : items.length === 0 ? (
            <p style={mutedTextStyle}>まだ保存されたログはありません。</p>
          ) : (
            <div style={listStyle}>
              {items.map((item) => (
                <MicroSourceDataCard key={item.id} content={item.raw_content} />
              ))}
            </div>
          )}
        </MicroSectionCard>
      </div>
    </main>
  );
}
