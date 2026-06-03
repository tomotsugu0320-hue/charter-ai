"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState, type CSSProperties } from "react";

type RebuildMapResponse = {
  success?: boolean;
  error?: string;
  preview?: unknown;
  source?: {
    threads?: number;
    posts?: number;
    saved?: boolean;
  };
};

const pageStyle = {
  maxWidth: 960,
  margin: "0 auto",
  padding: 24,
  color: "#111827",
} satisfies CSSProperties;

const cardStyle = {
  border: "1px solid #dbe3ef",
  borderRadius: 8,
  background: "#ffffff",
  color: "#111827",
  padding: 16,
} satisfies CSSProperties;

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#ffffff",
  color: "#111827",
} satisfies CSSProperties;

const buttonStyle = {
  border: "1px solid #111827",
  borderRadius: 8,
  background: "#111827",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 800,
  padding: "10px 14px",
} satisfies CSSProperties;

function formatJson(value: unknown) {
  if (value === undefined || value === null) return "";

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function RebuildDiscussionMapPage() {
  const params = useParams();
  const tenantParam = params?.tenant;
  const tenant = Array.isArray(tenantParam)
    ? tenantParam[0] ?? "dev"
    : tenantParam ?? "dev";

  const [adminKey, setAdminKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RebuildMapResponse | null>(null);

  const requestAdminKey = adminKey.trim();
  const previewJson = useMemo(() => formatJson(result?.preview), [result]);

  async function handleGenerate() {
    if (!requestAdminKey) {
      setError("管理者キーを入力してください。");
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/forum/admin-rebuild-discussion-map", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": requestAdminKey,
        },
      });
      const json = (await res.json().catch(() => ({}))) as RebuildMapResponse;

      if (!res.ok || json.success !== true) {
        setError(json.error || "議論マップ再編案の生成に失敗しました。");
        return;
      }

      setResult(json);
    } catch {
      setError("通信エラーが発生しました。もう一度お試しください。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={pageStyle}>
      <Link
        href={`/${tenant}/forum/admin`}
        style={{
          display: "inline-block",
          marginBottom: 14,
          color: "#2563eb",
          fontWeight: 800,
          textDecoration: "none",
        }}
      >
        ← forum管理トップへ戻る
      </Link>

      <h1 style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 900 }}>
        議論マップ再編案
      </h1>
      <p style={{ margin: "0 0 18px", color: "#475569", lineHeight: 1.7 }}>
        現在の公開中スレッドと投稿をもとに、AIが議論ツリーの再編案を生成します。
        今回はプレビューのみで、本番マップには反映されません。
      </p>

      <section style={{ ...cardStyle, marginBottom: 18 }}>
        <label
          htmlFor="admin-key"
          style={{ display: "block", marginBottom: 8, fontWeight: 800 }}
        >
          管理者キー
        </label>
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <input
            id="admin-key"
            type="password"
            value={adminKey}
            onChange={(event) => setAdminKey(event.target.value)}
            placeholder="ADMIN_KEY"
            style={{ ...inputStyle, flex: "1 1 260px" }}
          />
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={loading}
            style={{
              ...buttonStyle,
              opacity: loading ? 0.65 : 1,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "生成中..." : "再編案を生成"}
          </button>
        </div>
      </section>

      {error && (
        <section
          style={{
            ...cardStyle,
            marginBottom: 18,
            borderColor: "#fca5a5",
            background: "#fef2f2",
            color: "#991b1b",
            lineHeight: 1.7,
          }}
        >
          {error}
        </section>
      )}

      {result?.success === true && (
        <section style={{ ...cardStyle, marginBottom: 18 }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 20, fontWeight: 900 }}>
            生成結果
          </h2>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              marginBottom: 14,
            }}
          >
            <span
              style={{
                border: "1px solid #bfdbfe",
                borderRadius: 999,
                background: "#eff6ff",
                color: "#1d4ed8",
                fontWeight: 900,
                padding: "4px 10px",
              }}
            >
              threads: {result.source?.threads ?? 0}
            </span>
            <span
              style={{
                border: "1px solid #bbf7d0",
                borderRadius: 999,
                background: "#f0fdf4",
                color: "#166534",
                fontWeight: 900,
                padding: "4px 10px",
              }}
            >
              posts: {result.source?.posts ?? 0}
            </span>
            <span
              style={{
                border: "1px solid #fed7aa",
                borderRadius: 999,
                background: "#fff7ed",
                color: "#9a3412",
                fontWeight: 900,
                padding: "4px 10px",
              }}
            >
              preview only
            </span>
          </div>

          <pre
            style={{
              maxHeight: 640,
              overflow: "auto",
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              background: "#0f172a",
              color: "#e2e8f0",
              padding: 14,
              lineHeight: 1.6,
              fontSize: 13,
            }}
          >
            {previewJson}
          </pre>
        </section>
      )}
    </main>
  );
}
