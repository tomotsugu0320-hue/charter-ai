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
  ? popularThreads.filter((t) =>
      String(t.title || "").includes(keyword) ||
      String(t.summary || "").includes(keyword)
    )
  : popularThreads;

const filteredActiveThreads = keyword
  ? activeThreads.filter((t) =>
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
    padding: 12,
    borderRadius: 8,
    background: "#f0f4ff",
    border: "1px solid #ccd",
  }}
>
  <div style={{ fontSize: 12, color: "#666" }}>
    この掲示板の使い方
  </div>

  <div style={{ fontWeight: 700, marginTop: 4 }}>
    ① 結論や疑問を書く  
    ② AIが論点として整理  
    ③ みんなで前提・根拠を深掘り
  </div>
</div>

{goal && (
  <div
    style={{
      marginTop: 16,
      padding: 12,
      borderRadius: 8,
      background: "#f5f5f5",
      border: "1px solid #ddd",
    }}
  >
    <div style={{ fontSize: 12, color: "#666" }}>
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
      background: "#fafafa",
      border: "1px solid #eee",
    }}
  >
    <div style={{ fontSize: 12, color: "#666" }}>
      注目している論点
    </div>
    <div style={{ fontWeight: 700 }}>{keyword}</div>
  </div>
)}

      {/* 人気スレ */}
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
        border: "1px solid #ddd",
        borderRadius: 10,
        padding: 12,
        marginBottom: 8,
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
  <div style={{ fontWeight: 800, fontSize: 18 }}>
    {t.title}
  </div>
</Link>


{t.assumption && (
  <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
    前提：{t.assumption}
  </div>
)}

{t.evidence && (
  <div style={{ fontSize: 12, color: "#2a7", marginTop: 4 }}>
    🧾 根拠：{t.evidence}
  </div>
)}

      <div style={{ fontSize: 12, color: "#666" }}>
        平均スコア: {t.avg_logic_score} / 投稿数: {t.post_count}
      </div>
    </div>
  ))}
</section>


      {/* 活発スレ */}
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
        border: "1px solid #ddd",
        borderRadius: 10,
        padding: 12,
        marginBottom: 8,
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
  <div style={{ fontWeight: 800, fontSize: 18 }}>
    {t.title}
  </div>
</Link>

{t.assumption && (
  <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
    前提：{t.assumption}
  </div>
)}

{t.evidence && (
  <div style={{ fontSize: 12, color: "#2a7", marginTop: 4 }}>
    🧾 根拠：{t.evidence}
  </div>
)}
      <div style={{ fontSize: 12, color: "#666" }}>
        投稿数: {t.post_count} / 平均スコア: {t.avg_logic_score}
      </div>
    </div>
  ))}
</section>

      {/* 入力エリア */}

<div style={{ marginBottom: 12 }}>
  <a
    href={`/${tenant}/macro`}
    style={{
      display: "inline-block",
      padding: "10px 14px",
      borderRadius: 8,
      background: "#f5f5f5",
      border: "1px solid #ddd",
      color: "#111",
      fontWeight: 700,
      textDecoration: "none",
    }}
  >
    このテーマをマクロで整理する
  </a>
</div>

      <section style={{ marginTop: 32 }}>
        <p style={{ marginBottom: 8, color: "#666" }}>
考えをそのまま書いてください。
AIが自動で整理します。
        </p>

{generatedIssue && (
  <div
    style={{
      background: "#f0f4ff",
      padding: 12,
      borderRadius: 8,
      marginBottom: 12,
      border: "1px solid #ccd",
    }}
  >
    <div style={{ fontWeight: 800, marginBottom: 8 }}>AI整理結果</div>

    <div style={{ fontWeight: 700 }}>主張</div>
    <div style={{ marginTop: 4 }}>{generatedIssue.claim}</div>

    <div style={{ marginTop: 10, fontWeight: 700 }}>前提</div>
    <ul style={{ marginTop: 4, paddingLeft: 20 }}>
      {generatedIssue.premises.map((p, i) => (
        <li key={i}>{p}</li>
      ))}
    </ul>

    <div style={{ marginTop: 10, fontWeight: 700 }}>根拠</div>
    <ul style={{ marginTop: 4, paddingLeft: 20 }}>
      {generatedIssue.reasons.map((r, i) => (
        <li key={i}>{r}</li>
      ))}
    </ul>
  </div>
)}


<h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
あなたの考え
</h3>



<textarea
  value={text}
  onChange={(e) => setText(e.target.value)}
  placeholder="考えをそのまま書いてください"
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
<p style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
投稿すると、AIが論点として整理します
</p>
      </section>
    </main>
  );
}