// src/app/[tenant]/forum/page.tsx

"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function ForumPage() {
  const params = useParams();
  const tenant = params?.tenant as string;
  const searchParams = useSearchParams();
  const keyword = searchParams.get("keyword") || "";
  const goal = searchParams.get("goal") || "";

  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const [popularThreads, setPopularThreads] = useState<any[]>([]);
  const [activeThreads, setActiveThreads] = useState<any[]>([]);

  const [generatedIssue, setGeneratedIssue] = useState<{
    claim: string;
    premises: string[];
    reasons: string[];
  } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/forum/top-summary");
        const result = await res.json();

        console.log("top-summary result:", result);
        console.log("popularThreads sample:", result.popularThreads?.[0]);

        setPopularThreads(result.popularThreads ?? []);
        setActiveThreads(result.activeThreads ?? []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const filteredPopularThreads = keyword
    ? popularThreads.filter(
        (t) =>
          String(t.title || "").includes(keyword) ||
          String(t.summary || "").includes(keyword)
      )
    : popularThreads;

  const filteredActiveThreads = keyword
    ? activeThreads.filter(
        (t) =>
          String(t.title || "").includes(keyword) ||
          String(t.summary || "").includes(keyword)
      )
    : activeThreads;

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
        body: JSON.stringify({
          content: trimmed,
        }),
      });

      const { claim, premises, reasons } = await res.json();

      setGeneratedIssue({
        claim,
        premises,
        reasons,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>AI掲示板</h1>

      <div
        style={{
          marginTop: 16,
          padding: 16,
          borderRadius: 12,
          background: "#1a1a1a",
          border: "1px solid #333",
          color: "#fff",
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 6 }}>
          これは「正解を出す掲示板」ではありません。
        </div>

        <div style={{ fontSize: 14, color: "#ccc" }}>
          考えを分解し、前提と根拠のズレを見える化する場所です。
          <br />
          議論が噛み合わない原因は「前提のズレ」にあります。
        </div>
      </div>

      {goal && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 8,
            background: "#1a1a1a",
            border: "1px solid #333",
            color: "#fff",
          }}
        >
          <div style={{ fontSize: 12, color: "#aaa" }}>
            マクロから渡されたゴール
          </div>
          <div style={{ fontWeight: 700 }}>{goal}</div>
        </div>
      )}

      {keyword && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 8,
            background: "#1a1a1a",
            border: "1px solid #333",
            color: "#fff",
          }}
        >
          <div style={{ fontSize: 12, color: "#aaa" }}>
            注目している論点
          </div>
          <div style={{ fontWeight: 700 }}>{keyword}</div>
        </div>
      )}

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>🔥 人気スレ</h2>

        {keyword && filteredPopularThreads.length === 0 && (
          <p style={{ color: "#666" }}>
            「{keyword}」に一致する人気スレはまだありません。
          </p>
        )}

        {filteredPopularThreads.map((t) => (
          <div
            key={t.id}
            style={{
              border: "1px solid #333",
              background: "#111",
              borderRadius: 10,
              padding: 12,
              marginBottom: 8,
              color: "#fff",
            }}
          >
            <Link
              href={`/${tenant}/forum/thread/${t.id}`}
              style={{
                textDecoration: "underline",
                color: "inherit",
                display: "block",
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 18 }}>{t.title}</div>
            </Link>

            {t.assumption && (
              <div style={{ fontSize: 12, color: "#bbb", marginTop: 4 }}>
                前提：{t.assumption}
              </div>
            )}

            {t.evidence && (
              <div style={{ fontSize: 12, color: "#2a7", marginTop: 4 }}>
                🧾 根拠：{t.evidence}
              </div>
            )}

            <div style={{ fontSize: 12, color: "#aaa" }}>
              平均スコア: {t.avg_logic_score} / 投稿数: {t.post_count}
            </div>
          </div>
        ))}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>📈 活発スレ</h2>

        {keyword && filteredActiveThreads.length === 0 && (
          <p style={{ color: "#666" }}>
            「{keyword}」に一致する活発スレはまだありません。
          </p>
        )}

        {filteredActiveThreads.map((t) => (
          <div
            key={t.id}
            style={{
              border: "1px solid #333",
              background: "#111",
              borderRadius: 10,
              padding: 12,
              marginBottom: 8,
              color: "#fff",
            }}
          >
            <Link
              href={`/${tenant}/forum/thread/${t.id}`}
              style={{
                textDecoration: "underline",
                color: "inherit",
                display: "block",
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 18 }}>{t.title}</div>
            </Link>

            {t.assumption && (
              <div style={{ fontSize: 12, color: "#bbb", marginTop: 4 }}>
                前提：{t.assumption}
              </div>
            )}

            {t.evidence && (
              <div style={{ fontSize: 12, color: "#2a7", marginTop: 4 }}>
                🧾 根拠：{t.evidence}
              </div>
            )}

            <div style={{ fontSize: 12, color: "#aaa" }}>
              投稿数: {t.post_count} / 平均スコア: {t.avg_logic_score}
            </div>
          </div>
        ))}
      </section>

      <div style={{ marginBottom: 12 }}>
        <a
          href={`/${tenant}/macro`}
          style={{
            display: "inline-block",
            border: "1px solid #333",
            borderRadius: 8,
            padding: 12,
            fontSize: 16,
            background: "#1a1a1a",
            color: "#fff",
            textDecoration: "none",
          }}
        >
          このテーマをマクロで整理する
        </a>
      </div>

      <section style={{ marginTop: 32 }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ color: "#fff", fontWeight: 700 }}>
            議論が噛み合わない原因は「前提のズレ」です。
          </div>

          <div style={{ color: "#aaa", fontSize: 13, marginTop: 4 }}>
            あなたの考えを書くと、それを分解して見える化します。
          </div>
        </div>

        {generatedIssue && (
          <div
            style={{
              background: "#1a1a1a",
              border: "1px solid #333",
              color: "#fff",
              padding: 12,
              borderRadius: 8,
              marginBottom: 12,
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 8 }}>AI整理結果</div>

            <div style={{ fontWeight: 700 }}>主張</div>
            <div style={{ marginTop: 4 }}>{generatedIssue.claim}</div>

            <div style={{ marginTop: 10, fontWeight: 700 }}>前提</div>
            {generatedIssue.premises.length === 0 ? (
              <div style={{ marginTop: 4, color: "#888" }}>
                （前提はまだ入力されていません）
              </div>
            ) : (
              <ul style={{ marginTop: 4, paddingLeft: 20 }}>
                {generatedIssue.premises.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            )}

            <div style={{ marginTop: 10, fontWeight: 700 }}>根拠</div>
            {generatedIssue.reasons.length === 0 ? (
              <div style={{ marginTop: 4, color: "#888" }}>
                （根拠はまだ入力されていません）
              </div>
            ) : (
              <ul style={{ marginTop: 4, paddingLeft: 20 }}>
                {generatedIssue.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
          あなたの考え
        </h3>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`例：
消費税は減税すべき。
日本は需要不足であり、消費税は消費を抑えるため。`}
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
          {loading ? "処理中..." : "構造化して投稿する"}
        </button>

        <p style={{ fontSize: 12, color: "#aaa", marginTop: 6 }}>
          投稿すると、主張・前提・根拠に分解されます
        </p>
      </section>
    </main>
  );
}