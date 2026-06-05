"use client";

import { FormEvent, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function ForumLoginPage() {
  const params = useParams();
  const router = useRouter();
  const tenantParam = params?.tenant;
  const tenant = Array.isArray(tenantParam)
    ? tenantParam[0]
    : tenantParam || "dev";
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/forum/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: user.trim(), password }),
      });
      const json = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        setError(
          json.error ||
            (response.status === 500
              ? "ログイン設定が未完了です。管理者に確認してください。"
              : "ログインできませんでした。IDとパスワードを確認してください。")
        );
        return;
      }

      router.replace(`/${tenant}/forum`);
    } catch {
      setError("通信に失敗しました。時間をおいてもう一度お試しください。");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#f8fafc",
        color: "#111827",
        padding: "32px 16px",
      }}
    >
      <section
        style={{
          maxWidth: 520,
          margin: "0 auto",
          border: "1px solid #dbe3ef",
          borderRadius: 12,
          background: "#ffffff",
          color: "#111827",
          padding: 24,
          boxShadow: "0 16px 40px rgba(15, 23, 42, 0.08)",
        }}
      >
        <p
          style={{
            margin: "0 0 8px",
            color: "#475569",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          限定ベータ
        </p>
        <h1 style={{ margin: "0 0 10px", fontSize: 28, fontWeight: 900 }}>
          AI知恵袋Forum ログイン
        </h1>
        <p style={{ margin: "0 0 22px", color: "#475569", lineHeight: 1.7 }}>
          共有されたIDとパスワードを入力してください。
        </p>

        <form onSubmit={handleSubmit}>
          <label
            style={{
              display: "block",
              marginBottom: 14,
              color: "#111827",
              fontWeight: 800,
            }}
          >
            共通ID
            <input
              autoComplete="username"
              value={user}
              onChange={(event) => setUser(event.target.value)}
              style={{
                display: "block",
                width: "100%",
                boxSizing: "border-box",
                marginTop: 8,
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                background: "#ffffff",
                color: "#111827",
                fontSize: 16,
                padding: "12px 14px",
                outline: "none",
              }}
            />
          </label>

          <label
            style={{
              display: "block",
              marginBottom: 18,
              color: "#111827",
              fontWeight: 800,
            }}
          >
            パスワード
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              style={{
                display: "block",
                width: "100%",
                boxSizing: "border-box",
                marginTop: 8,
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                background: "#ffffff",
                color: "#111827",
                fontSize: 16,
                padding: "12px 14px",
                outline: "none",
              }}
            />
          </label>

          {error && (
            <div
              role="alert"
              style={{
                border: "1px solid #fecaca",
                borderRadius: 8,
                background: "#fef2f2",
                color: "#991b1b",
                lineHeight: 1.6,
                marginBottom: 16,
                padding: "10px 12px",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: "100%",
              border: "1px solid #111827",
              borderRadius: 8,
              background: isLoading ? "#475569" : "#111827",
              color: "#ffffff",
              cursor: isLoading ? "not-allowed" : "pointer",
              fontSize: 16,
              fontWeight: 900,
              padding: "13px 16px",
            }}
          >
            {isLoading ? "ログイン中..." : "ログイン"}
          </button>
        </form>
      </section>
    </main>
  );
}
