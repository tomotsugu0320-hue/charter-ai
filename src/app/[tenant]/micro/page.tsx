"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

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
    <main
      style={{
        minHeight: "100vh",
        background: "#111827",
        color: "#f9fafb",
        padding: "32px 16px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 720,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <section
          style={{
            background: "#1f2937",
            color: "#f9fafb",
            border: "1px solid #374151",
            borderRadius: 8,
            padding: 20,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 24,
              lineHeight: 1.3,
              color: "#ffffff",
            }}
          >
            Micro
          </h1>

          <form
            onSubmit={handleSubmit}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              marginTop: 16,
            }}
          >
            <textarea
              value={rawContent}
              onChange={(event) => setRawContent(event.target.value)}
              placeholder="思考ログを書く"
              rows={5}
              style={{
                width: "100%",
                boxSizing: "border-box",
                resize: "vertical",
                borderRadius: 8,
                border: "1px solid #4b5563",
                background: "#0f172a",
                color: "#f8fafc",
                padding: 12,
                fontSize: 16,
                lineHeight: 1.6,
                outline: "none",
              }}
            />

            <button
              type="submit"
              disabled={saving || rawContent.trim().length === 0}
              style={{
                alignSelf: "flex-start",
                border: "1px solid #60a5fa",
                borderRadius: 8,
                background:
                  saving || rawContent.trim().length === 0
                    ? "#374151"
                    : "#2563eb",
                color:
                  saving || rawContent.trim().length === 0
                    ? "#d1d5db"
                    : "#ffffff",
                cursor:
                  saving || rawContent.trim().length === 0
                    ? "not-allowed"
                    : "pointer",
                padding: "10px 16px",
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              {saving ? "保存中" : "保存"}
            </button>
          </form>

          {message && (
            <p
              style={{
                margin: "14px 0 0",
                color: "#fecaca",
                background: "#7f1d1d",
                border: "1px solid #ef4444",
                borderRadius: 8,
                padding: "10px 12px",
              }}
            >
              {message}
            </p>
          )}
        </section>

        <section
          style={{
            background: "#1f2937",
            color: "#f9fafb",
            border: "1px solid #374151",
            borderRadius: 8,
            padding: 20,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              lineHeight: 1.4,
              color: "#ffffff",
            }}
          >
            一覧
          </h2>

          {loading ? (
            <p style={{ margin: "16px 0 0", color: "#d1d5db" }}>
              読み込み中
            </p>
          ) : items.length === 0 ? (
            <p style={{ margin: "16px 0 0", color: "#d1d5db" }}>
              まだ保存されたログはありません。
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                marginTop: 16,
              }}
            >
              {items.map((item) => (
                <article
                  key={item.id}
                  style={{
                    background: "#0f172a",
                    color: "#f8fafc",
                    border: "1px solid #334155",
                    borderRadius: 8,
                    padding: 14,
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                    lineHeight: 1.7,
                  }}
                >
                  {item.raw_content}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
