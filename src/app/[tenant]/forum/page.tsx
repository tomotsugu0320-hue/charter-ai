    // src/app/[tenant]/forum/page.tsx


"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

type Suggestion = {
  id: string;
  title: string;
  ai_summary: string | null;
  similarity_score: number;
  avg_logic_score?: number | null;
  post_count?: number | null;
};

export default function ForumPage() {
  const router = useRouter();
  const params = useParams();
  const tenant = params?.tenant as string;

  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [shouldCreate, setShouldCreate] = useState(false);
  const [suggestionId, setSuggestionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);

    try {
      const issueRes = await fetch("/api/forum/generate-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });

      const { issue } = await issueRes.json();
      setGeneratedIssue(issue);

      const res = await fetch("/api/forum/thread-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });

      const result = await res.json();

      setSuggestions(result.suggestions ?? []);
      setShouldCreate(result.shouldCreate ?? false);
      setSuggestionId(result.suggestionId ?? null);

    } catch (e: any) {
      setError(e?.message || "エラー");
    } finally {
      setLoading(false);
    }
  };

  const popularIds = new Set(popularThreads.map((t) => t.id));

  const visibleActiveThreads = activeThreads.filter(
    (t) => !popularIds.has(t.id)
  );

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>AI掲示板</h1>

      {/* 人気スレ */}
      <section style={{ marginTop: 24 }}>
        <h2>🔥 人気スレ</h2>

        {popularThreads.map((t) => (
          <div key={t.id} style={{ border: "1px solid #ddd", padding: 12 }}>
            <a
              href={`/${tenant}/forum/thread/${t.id}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div style={{ fontWeight: 800, fontSize: 18 }}>
                {t.title}
              </div>
            </a>

            <div style={{ fontSize: 12 }}>
              平均スコア: {t.avg_logic_score} / 投稿数: {t.post_count}
            </div>
          </div>
        ))}
      </section>

      {/* 活発スレ */}
      <section style={{ marginTop: 24 }}>
        <h2>📈 活発スレ</h2>

        {visibleActiveThreads.map((t) => (
          <div key={t.id} style={{ border: "1px solid #ddd", padding: 12 }}>
            <a
              href={`/${tenant}/forum/thread/${t.id}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div style={{ fontWeight: 800, fontSize: 18 }}>
                {t.title}
              </div>
            </a>

            <div style={{ fontSize: 12 }}>
              投稿数: {t.post_count} / 平均スコア: {t.avg_logic_score}
            </div>
          </div>
        ))}
      </section>

      {/* 入力 */}
      <section style={{ marginTop: 24 }}>
        <p>AIが論点を整理し、既存の議論とつなげます。</p>

        {generatedIssue && (
          <div style={{ background: "#eef", padding: 10 }}>
            🧠 この話の論点：
            <div>{generatedIssue}</div>
          </div>
        )}

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          style={{ width: "100%" }}
        />

        <button onClick={handleSubmit}>
          スレ候補を見る
        </button>
      </section>
    </main>
  );
}