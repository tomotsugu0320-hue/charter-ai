"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type RelatedThread = {
  id: string;
  title?: string | null;
  category?: string | null;
  ai_summary?: string | null;
  reason?: string | null;
};

type MacroFrameworkRelatedThreadsProps = {
  tenant: string;
  frameworkTitle: string;
  metrics?: string[];
  lookAt?: string[];
};

type RelatedThreadsState =
  | { status: "loading"; threads: RelatedThread[] }
  | { status: "loaded"; threads: RelatedThread[] }
  | { status: "error"; threads: RelatedThread[] };

function compactExcerpt(value: string | null | undefined) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > 120 ? `${text.slice(0, 120)}...` : text;
}

export default function MacroFrameworkRelatedThreads({
  tenant,
  frameworkTitle,
  metrics = [],
  lookAt = [],
}: MacroFrameworkRelatedThreadsProps) {
  const [state, setState] = useState<RelatedThreadsState>({
    status: "loading",
    threads: [],
  });

  const requestBody = useMemo(
    () => ({
      text: frameworkTitle,
      claim: `${frameworkTitle}を日本経済に当てはめるときの前提・限界・確認指標`,
      premises: metrics,
      reasons: lookAt,
      disableFallback: true,
    }),
    [frameworkTitle, metrics, lookAt]
  );

  useEffect(() => {
    const controller = new AbortController();

    async function loadRelatedThreads() {
      setState({ status: "loading", threads: [] });

      try {
        const response = await fetch("/api/forum/search-related", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("関連議論を読み込めませんでした");
        }

        const result = await response.json();
        const threads = Array.isArray(result?.threads)
          ? (result.threads as RelatedThread[])
          : [];

        setState({ status: "loaded", threads });
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("macro framework related threads error:", error);
        setState({ status: "error", threads: [] });
      }
    }

    loadRelatedThreads();

    return () => {
      controller.abort();
    };
  }, [requestBody]);

  return (
    <div
      style={{
        border: "1px solid #dbeafe",
        borderRadius: 8,
        background: "#ffffff",
        padding: 14,
        marginTop: 16,
        minWidth: 0,
      }}
    >
      <h3 style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>
        この理論に関連する議論
      </h3>

      {state.status === "loading" ? (
        <p style={{ margin: "10px 0 0", color: "#64748b", lineHeight: 1.7 }}>
          関連する議論を探しています...
        </p>
      ) : null}

      {state.status === "error" ? (
        <p style={{ margin: "10px 0 0", color: "#64748b", lineHeight: 1.7 }}>
          関連議論を読み込めませんでした。
        </p>
      ) : null}

      {state.status === "loaded" && state.threads.length === 0 ? (
        <p style={{ margin: "10px 0 0", color: "#64748b", lineHeight: 1.7 }}>
          まだ関連する議論は見つかりません。新しい議論を作れます。
        </p>
      ) : null}

      {state.status === "loaded" && state.threads.length > 0 ? (
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {state.threads.map((thread) => {
            const excerpt = compactExcerpt(thread.ai_summary);

            return (
              <Link
                key={thread.id}
                href={`/${tenant}/forum/thread/${thread.id}`}
                style={{
                  display: "block",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  background: "#f8fafc",
                  color: "#111827",
                  textDecoration: "none",
                  padding: 12,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  {thread.category ? (
                    <span
                      style={{
                        border: "1px solid #bfdbfe",
                        borderRadius: 999,
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        fontSize: 12,
                        fontWeight: 800,
                        padding: "3px 8px",
                      }}
                    >
                      {thread.category}
                    </span>
                  ) : null}
                  {thread.reason ? (
                    <span style={{ color: "#64748b", fontSize: 12, fontWeight: 700 }}>
                      {thread.reason}
                    </span>
                  ) : null}
                </div>
                <div style={{ color: "#0f172a", fontWeight: 900, lineHeight: 1.5 }}>
                  {thread.title || "無題スレ"}
                </div>
                {excerpt ? (
                  <p
                    style={{
                      margin: "6px 0 0",
                      color: "#475569",
                      fontSize: 13,
                      lineHeight: 1.7,
                    }}
                  >
                    {excerpt}
                  </p>
                ) : null}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
