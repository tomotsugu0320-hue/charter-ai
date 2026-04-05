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
  const [rawResult, setRawResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
const [popularThreads, setPopularThreads] = useState<any[]>([]);
const [activeThreads, setActiveThreads] = useState<any[]>([]);
const [generatedIssue, setGeneratedIssue] = useState<string | null>(null);

useEffect(() => {
  (async () => {
    try {
      const res = await fetch("/api/forum/top-summary");
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result?.error || "取得失敗");
      }

      setPopularThreads(result.popularThreads ?? []);
      setActiveThreads(result.activeThreads ?? []);
    } catch (e) {
      console.error(e);
    }
  })();
}, []);


const handleSubmit = async () => {
  const trimmed = text.trim();

  if (!trimmed) {
    setError("入力してから投稿して。");
    return;
  }

  setLoading(true);
  setError(null);

  try {
    // 👇 追加（ここ！！）
    const issueRes = await fetch("/api/forum/generate-issue", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: trimmed }),
    });

    const { issue } = await issueRes.json();
      setGeneratedIssue(issue);

    console.log("[generated issue]", issue);

    // ここで今はログだけでOK（後でDBに入れる）

    // 👇 既存処理
    const res = await fetch("/api/forum/thread-suggestions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: trimmed }),
    });

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result?.error || "APIエラー");
    }

    setSuggestions(result.suggestions ?? []);
    setShouldCreate(result.shouldCreate ?? false);
    setSuggestionId(result.suggestionId ?? null);
    setRawResult(result);

  } catch (e: any) {
    console.error(e);
    setError(e?.message || "送信に失敗した");
  } finally {
    setLoading(false);
  }
};


  return (
    <main
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "24px 16px 64px",
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
        AI掲示板
      </h1>

<section style={{ marginBottom: 24 }}>
  <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>
    🔥 人気スレ
  </h2>

  {popularThreads.map((t) => (
    <div
      key={t.id}
      style={{
        padding: 12,
        border: "1px solid #ddd",
        borderRadius: 10,
        marginBottom: 8,
        cursor: "pointer",
      }}
      onClick={() => router.push(`/${tenant}/forum/thread/${t.id}`)}
    >
      <div style={{ fontWeight: 700 }}>{t.title}</div>
      <div style={{ fontSize: 12, color: "#666" }}>
平均スコア: {t.avg_logic_score}
<span
  style={{
    marginLeft: 6,
    fontSize: 11,
    color: "#666",
  }}
>
  {t.avg_logic_score >= 80
    ? "（高品質）"
    : t.avg_logic_score >= 60
    ? "（標準）"
    : "（要改善）"}
</span>
 / 投稿数: {t.post_count}
      </div>
    </div>
  ))}
</section>

<section style={{ marginBottom: 24 }}>
  <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>
    📈 議論が活発なスレ
  </h2>

  {activeThreads.map((t) => (
    <div
      key={t.id}
      style={{
        padding: 12,
        border: "1px solid #ddd",
        borderRadius: 10,
        marginBottom: 8,
        cursor: "pointer",
      }}
      onClick={() => router.push(`/${tenant}/forum/thread/${t.id}`)}
    >
      <div style={{ fontWeight: 700 }}>{t.title}</div>
      <div style={{ fontSize: 12, color: "#666" }}>
投稿数: {t.post_count} / 平均スコア: {t.avg_logic_score}
<span
  style={{
    marginLeft: 6,
    fontSize: 11,
    color: "#666",
  }}
>
  {t.avg_logic_score >= 80
    ? "（高品質）"
    : t.avg_logic_score >= 60
    ? "（標準）"
    : "（要改善）"}
</span>
      </div>
    </div>
  ))}
</section>



      <p style={{ color: "#555", marginBottom: 20 }}>
        考えをそのまま書いてください。似ている議論があれば提案します。
      </p>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 16,
          background: "#fff",
        }}
      >
        <label
          htmlFor="forum-text"
          style={{
            display: "block",
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          投稿したい内容
        </label>

{generatedIssue && (
  <div
    style={{
      marginBottom: 12,
      padding: 10,
      background: "#f0f4ff",
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 600,
    }}
  >
    🧠 論点：{generatedIssue}
  </div>
)}

        <textarea
          id="forum-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="例：移民やばくね？ / 消費税って必要？"
          rows={5}
          style={{
            width: "100%",
            border: "1px solid #ccc",
            borderRadius: 8,
            padding: 12,
            fontSize: 16,
            resize: "vertical",
            outline: "none",
          }}
        />

        <div style={{ marginTop: 12, display: "flex", gap: 12 }}>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              border: "none",
              borderRadius: 8,
              padding: "10px 16px",
              background: loading ? "#999" : "#111",
              color: "#fff",
              cursor: loading ? "default" : "pointer",
              fontWeight: 700,
            }}
          >
            {loading ? "送信中..." : "スレ候補を見る"}
          </button>

          <button
            onClick={() => {
              setText("");
              setSuggestions([]);
              setShouldCreate(false);
              setSuggestionId(null);
              setRawResult(null);
              setError(null);
            }}
            disabled={loading}
            style={{
              border: "1px solid #ccc",
              borderRadius: 8,
              padding: "10px 16px",
              background: "#fff",
              cursor: loading ? "default" : "pointer",
              fontWeight: 700,
            }}
          >
            クリア
          </button>
        </div>

        {error && (
          <div
            style={{
              marginTop: 12,
              color: "#b00020",
              fontWeight: 700,
            }}
          >
            {error}
          </div>
        )}

      </div>

      {suggestions.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>
            似ているスレ候補
          </h2>

          <div style={{ display: "grid", gap: 12 }}>
            {suggestions.map((item) => (
              <div
                key={item.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 12,
                  padding: 16,
                  background: "#fafafa",
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 700 }}>
                  {item.title}
                </div>

                {item.ai_summary && (
                  <div
                    style={{
                      marginTop: 8,
                      color: "#444",
                      lineHeight: 1.6,
                    }}
                  >
                    {item.ai_summary}
                  </div>
                )}

<div
  style={{
    marginTop: 10,
    fontSize: 14,
    color: "#666",
    lineHeight: 1.6,
  }}
>
  類似度: {item.similarity_score}
  <span
    style={{
      marginLeft: 6,
      fontSize: 12,
      fontWeight: 600,
      color:
        item.similarity_score >= 0.8
          ? "#2e7d32"
          : item.similarity_score >= 0.5
          ? "#f9a825"
          : "#999",
    }}
  >
    {item.similarity_score >= 0.8
      ? "（かなり近い）"
      : item.similarity_score >= 0.5
      ? "（やや近い）"
      : "（参考程度）"}
  </span>
  <br />
  平均スコア: {item.avg_logic_score ?? "未評価"}
  {item.avg_logic_score != null && (
    <span
      style={{
        marginLeft: 6,
        fontSize: 12,
        color: "#666",
      }}
    >
      {item.avg_logic_score >= 80
        ? "（高品質）"
        : item.avg_logic_score >= 60
        ? "（標準）"
        : "（要改善）"}
    </span>
  )}
  <br />
  投稿数: {item.post_count ?? 0}
</div>

                <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
 
<button
  style={{
    border: "none",
    borderRadius: 8,
    padding: "8px 12px",
    background: "#111",
    color: "#fff",
    cursor: "pointer",
  }}
  onClick={async () => {
    if (!suggestionId) {
      alert("suggestionIdがない");
      return;
    }

    try {
      const res = await fetch("/api/forum/post-to-thread", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          threadId: item.id,
          suggestionId,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result?.error || "既存スレ投稿失敗");
      }

      console.log("[post-to-thread result]", result);

      if (!result?.threadId) {
        throw new Error("threadIdが返ってきていない");
      }

      router.push(`/${tenant}/forum/thread/${result.threadId}`);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "エラー");
    }
  }}
>
  この既存スレを使う
</button>

<button
  style={{
    border: "1px solid #ccc",
    borderRadius: 8,
    padding: "8px 12px",
    background: "#fff",
    cursor: "pointer",
  }}
  onClick={async () => {
    if (!suggestionId) {
      alert("suggestionIdがない");
      return;
    }

    try {
      const res = await fetch("/api/forum/create-thread", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ suggestionId }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result?.error || "作成失敗");
      }

      console.log("[create-thread result]", result);

      if (!result?.threadId) {
        throw new Error("threadIdが返ってきていない");
      }

      router.push(`/${tenant}/forum/thread/${result.threadId}`);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "エラー");
    }
  }}
>
  それでも新規作成する
</button>

                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {shouldCreate && suggestions.length === 0 && (
        <section
          style={{
            marginTop: 24,
            border: "1px solid #cfd8dc",
            borderRadius: 12,
            padding: 16,
            background: "#f7fbff",
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            新規スレッド作成候補
          </h2>
          <p style={{ margin: 0, lineHeight: 1.7 }}>
            似ているスレが見つからないので、新しいスレッドを作ってよさそう。
          </p>

<button
  style={{
    marginTop: 12,
    border: "none",
    borderRadius: 8,
    padding: "10px 14px",
    background: "#111",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 700,
  }}
  onClick={async () => {
    if (!suggestionId) {
      alert("suggestionIdがない");
      return;
    }

    try {
      const res = await fetch("/api/forum/create-thread", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ suggestionId }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result?.error || "作成失敗");
      }

      console.log("[create-thread result]", result);

      if (!result?.threadId) {
        throw new Error("threadIdが返ってきていない");
      }

      router.push(`/${tenant}/forum/thread/${result.threadId}`);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "エラー");
    }
  }}
>
  新規スレッドを作る
</button>
        </section>
      )}




    </main>
  );
}