    // src/app/[tenant]/forum/page.tsx


"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

export default function ForumPage() {
  const params = useParams();
  const tenant = params?.tenant as string;

  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const [popularThreads, setPopularThreads] = useState<any[]>([]);
  const [activeThreads, setActiveThreads] = useState<any[]>([]);
  const [generatedIssue, setGeneratedIssue] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/forum/top-summary");
        const result = await res.json();

        setPopularThreads(result.popularThreads ?? []);
        setActiveThreads(result.activeThreads ?? []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setLoading(true);

    try {
      const res = await fetch("/api/forum/generate-issue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: trimmed }),
      });

      const { issue } = await res.json();
      setGeneratedIssue(issue);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>AI掲示板</h1>

      {/* 人気スレ */}
      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>🔥 人気スレ</h2>

        {popularThreads.map((t) => (
          <div
            key={t.id}
            style={{
              border: "1px solid #ddd",
              borderRadius: 10,
              padding: 12,
              marginBottom: 8,
            }}
          >
            <a
              href={`/${tenant}/forum/thread/${t.id}`}
              style={{
                textDecoration: "underline",
                color: "inherit",
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 18 }}>
                {t.title}
              </div>
            </a>

            <div style={{ fontSize: 12, color: "#666" }}>
              平均スコア: {t.avg_logic_score} / 投稿数: {t.post_count}
            </div>
          </div>
        ))}
      </section>

      {/* 活発スレ */}
      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>📈 活発スレ</h2>

        {activeThreads.map((t) => (
          <div
            key={t.id}
            style={{
              border: "1px solid #ddd",
              borderRadius: 10,
              padding: 12,
              marginBottom: 8,
            }}
          >
            <a
              href={`/${tenant}/forum/thread/${t.id}`}
              style={{
                textDecoration: "underline",
                color: "inherit",
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 18 }}>
                {t.title}
              </div>
            </a>

            <div style={{ fontSize: 12, color: "#666" }}>
              投稿数: {t.post_count} / 平均スコア: {t.avg_logic_score}
            </div>
          </div>
        ))}
      </section>

      {/* 入力エリア */}
      <section style={{ marginTop: 32 }}>
        <p style={{ marginBottom: 8, color: "#666" }}>
          考えをそのまま書いてください。AIが論点を整理します。
        </p>

        {generatedIssue && (
          <div
            style={{
              background: "#f0f4ff",
              padding: 10,
              borderRadius: 8,
              marginBottom: 12,
              fontWeight: 600,
            }}
          >
            🧠 論点：
            <div style={{ marginTop: 4 }}>{generatedIssue}</div>
          </div>
        )}

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="例：消費税って必要？"
          rows={5}
          style={{
            width: "100%",
            border: "1px solid #ccc",
            borderRadius: 8,
            padding: 12,
            fontSize: 16,
          }}
        />

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            marginTop: 12,
            padding: "10px 16px",
            borderRadius: 8,
            background: "#111",
            color: "#fff",
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
          }}
        >
          {loading ? "処理中..." : "AIに整理させる"}
        </button>
      </section>
    </main>
  );
}