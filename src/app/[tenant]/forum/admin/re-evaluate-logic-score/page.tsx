"use client";

import { useState } from "react";

type LogicScorePost = {
  id?: string;
  logic_score?: number | null;
  logic_score_reason?: string | null;
  logic_break_type?: string | null;
  logic_break_note?: string | null;
};

type ReEvaluateResponse = {
  success?: boolean;
  error?: string;
  post?: LogicScorePost | null;
};

export default function ReEvaluateLogicScorePage() {
  const [adminKey, setAdminKey] = useState("");
  const [postId, setPostId] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReEvaluateResponse | null>(null);

  async function handleReEvaluate() {
    const trimmedPostId = postId.trim();

    if (!trimmedPostId) {
      setStatus(null);
      setResult(null);
      setError("postIdを入力してください。");
      return;
    }

    if (
      !confirm(
        "この投稿をAI再評価します。OpenAI API費用が発生します。実行しますか？"
      )
    ) {
      return;
    }

    setLoading(true);
    setStatus(null);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/forum/re-evaluate-logic-score", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({ postId: trimmedPostId }),
      });

      const raw = await res.text();
      let json: ReEvaluateResponse = {};

      try {
        json = raw ? (JSON.parse(raw) as ReEvaluateResponse) : {};
      } catch {
        json = { success: false, error: raw || "レスポンスの読込に失敗しました" };
      }

      setStatus(res.status);

      if (!res.ok) {
        setError(json.error || `再評価に失敗しました（HTTP ${res.status}）`);
        return;
      }

      setResult(json);
    } catch (e: any) {
      setError(e?.message || "再評価リクエストに失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: 20,
        color: "#111827",
      }}
    >
      <h1 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 800 }}>
        単一投稿AI論理スコア再評価
      </h1>

      <p style={{ margin: "0 0 16px", color: "#475569", lineHeight: 1.6 }}>
        管理者が指定した投稿1件だけをAIで再評価します。
      </p>

      <div
        style={{
          marginBottom: 18,
          border: "1px solid #fed7aa",
          borderRadius: 8,
          background: "#fff7ed",
          color: "#9a3412",
          padding: "10px 12px",
          lineHeight: 1.6,
          fontWeight: 700,
        }}
      >
        実行時にOpenAI API費用が発生します。postIdを確認してから実行してください。
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>
            管理者キー
          </span>
          <input
            type="password"
            value={adminKey}
            onChange={(event) => setAdminKey(event.target.value)}
            placeholder="ADMIN_KEY"
            style={{
              width: "100%",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              background: "#fff",
              color: "#111827",
              padding: "9px 10px",
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>
            postId
          </span>
          <input
            type="text"
            value={postId}
            onChange={(event) => setPostId(event.target.value)}
            placeholder="投稿ID（UUID）"
            style={{
              width: "100%",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              background: "#fff",
              color: "#111827",
              padding: "9px 10px",
            }}
          />
        </label>

        <button
          type="button"
          onClick={() => void handleReEvaluate()}
          disabled={loading}
          style={{
            width: "fit-content",
            border: "1px solid #111827",
            borderRadius: 8,
            background: loading ? "#cbd5e1" : "#111827",
            color: loading ? "#334155" : "#fff",
            cursor: loading ? "wait" : "pointer",
            fontWeight: 800,
            padding: "10px 14px",
          }}
        >
          {loading ? "再評価中..." : "単一投稿をAI再評価"}
        </button>
      </div>

      {error && (
        <section
          style={{
            marginTop: 18,
            border: "1px solid #fecaca",
            borderRadius: 8,
            background: "#fef2f2",
            color: "#991b1b",
            padding: "12px 14px",
            lineHeight: 1.6,
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 4 }}>再評価エラー</div>
          {status !== null && <div>status: {status}</div>}
          <div>{error}</div>
        </section>
      )}

      {result && (
        <section
          style={{
            marginTop: 18,
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            background: "#f8fafc",
            color: "#111827",
            padding: "14px",
            lineHeight: 1.7,
          }}
        >
          <h2 style={{ margin: "0 0 10px", fontSize: 18, fontWeight: 800 }}>
            再評価結果
          </h2>

          <div style={{ display: "grid", gap: 6 }}>
            <div>success: {String(result.success === true)}</div>
            <div>post.id: {result.post?.id || "-"}</div>
            <div>
              post.logic_score:{" "}
              {result.post?.logic_score === null ||
              result.post?.logic_score === undefined
                ? "-"
                : result.post.logic_score}
            </div>
            <div>post.logic_score_reason: {result.post?.logic_score_reason || "-"}</div>
            <div>post.logic_break_type: {result.post?.logic_break_type || "-"}</div>
            <div>post.logic_break_note: {result.post?.logic_break_note || "-"}</div>
          </div>
        </section>
      )}
    </main>
  );
}
