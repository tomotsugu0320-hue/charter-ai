"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";

const pageStyle: CSSProperties = {
  maxWidth: 920,
  margin: "0 auto",
  padding: 24,
  color: "#111827",
};

const noticeStyle: CSSProperties = {
  border: "1px solid #fed7aa",
  borderRadius: 8,
  background: "#fff7ed",
  color: "#9a3412",
  lineHeight: 1.7,
  marginBottom: 18,
  padding: "14px 16px",
};

const menuGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
  gap: 12,
};

const menuCardStyle: CSSProperties = {
  display: "block",
  border: "1px solid #dbe3ef",
  borderRadius: 8,
  background: "#ffffff",
  color: "#111827",
  padding: 16,
  textDecoration: "none",
};

const menuDescriptionStyle: CSSProperties = {
  margin: "8px 0 0",
  color: "#475569",
  lineHeight: 1.7,
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#ffffff",
  color: "#111827",
};

const buttonStyle: CSSProperties = {
  border: "1px solid #111827",
  borderRadius: 8,
  background: "#111827",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 800,
  padding: "10px 14px",
};

export default function ForumAdminPage() {
  const params = useParams();
  const tenantParam = params?.tenant;
  const tenant = Array.isArray(tenantParam)
    ? tenantParam[0] ?? "dev"
    : tenantParam ?? "dev";
  const [adminKey, setAdminKey] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function checkAdminSession() {
      try {
        const response = await fetch("/api/forum/admin/users", {
          cache: "no-store",
        });

        if (!cancelled && response.ok) {
          setIsVerified(true);
          setError("");
        }
      } catch {
        // Keep showing the manual ADMIN_KEY form when the session check fails.
      }
    }

    void checkAdminSession();

    return () => {
      cancelled = true;
    };
  }, []);

  async function verifyAdminKey() {
    const requestAdminKey = adminKey.trim();

    if (!requestAdminKey) {
      setError("管理者キーを入力してください。");
      return;
    }

    setIsChecking(true);
    setError("");
    setAdminKey("");

    try {
      const response = await fetch("/api/forum/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminKey: requestAdminKey }),
        cache: "no-store",
      });

      if (!response.ok) {
        setIsVerified(false);
        setError("管理者キーが正しくありません。");
        return;
      }

      setIsVerified(true);
    } catch {
      setIsVerified(false);
      setError("管理者キーを確認できませんでした。");
    } finally {
      setIsChecking(false);
    }
  }

  async function clearAdminSession() {
    setIsChecking(true);
    setError("");

    try {
      await fetch("/api/forum/admin/session", {
        method: "DELETE",
        cache: "no-store",
      });
    } finally {
      setAdminKey("");
      setIsVerified(false);
      setIsChecking(false);
    }
  }

  return (
    <main style={pageStyle}>
      <h1 style={{ margin: "0 0 10px", fontSize: 28, fontWeight: 900 }}>
        forum 管理
      </h1>

      <Link
        href={`/${tenant}/forum`}
        style={{
          display: "inline-block",
          marginBottom: 14,
          color: "#2563eb",
          fontWeight: 800,
          textDecoration: "none",
        }}
      >
        Forumトップへ戻る
      </Link>

      <section style={noticeStyle}>
        <div>このページは管理者向けです。</div>
        <div>管理メニューを表示するには ADMIN_KEY が必要です。</div>
        <div>AI論理スコア再評価ではOpenAI API費用が発生します。</div>
      </section>

      {!isVerified && (
        <section style={{ ...menuCardStyle, marginBottom: 18 }}>
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
              autoComplete="new-password"
              value={adminKey}
              onChange={(event) => setAdminKey(event.target.value)}
              placeholder="ADMIN_KEY"
              style={{ ...inputStyle, flex: "1 1 260px" }}
            />
            <button
              type="button"
              onClick={() => void verifyAdminKey()}
              disabled={isChecking}
              style={{ ...buttonStyle, opacity: isChecking ? 0.65 : 1 }}
            >
              {isChecking ? "確認中..." : "管理メニューを表示"}
            </button>
          </div>
          {error && (
            <p style={{ color: "#991b1b", margin: "10px 0 0" }}>
              {error}
            </p>
          )}
        </section>
      )}

      {isVerified && (
        <>
          <section style={{ ...menuCardStyle, marginBottom: 18 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>
              管理者セッションが有効です。
            </div>
            <button
              type="button"
              onClick={() => void clearAdminSession()}
              disabled={isChecking}
              style={{
                ...buttonStyle,
                borderColor: "#991b1b",
                background: "#991b1b",
                opacity: isChecking ? 0.65 : 1,
              }}
            >
              管理セッション解除
            </button>
          </section>

          <div style={menuGridStyle}>
          <Link
            href={`/${tenant}/forum/admin/delete-threads`}
            style={menuCardStyle}
          >
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>
              会員向け：非表示/復元
            </h2>
            <p style={menuDescriptionStyle}>
              管理者キーなしでスレッドの非表示・復元を行えます。完全削除のみ管理者キーが必要です。
            </p>
          </Link>

          <Link
            href={`/${tenant}/forum/admin/re-evaluate-logic-score`}
            style={menuCardStyle}
          >
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>
              AI論理スコア再評価
            </h2>
            <p style={menuDescriptionStyle}>
              投稿のAI論理スコアを管理者操作で1件ずつ再評価します。
            </p>
          </Link>

          <Link href={`/${tenant}/forum/admin/users`} style={menuCardStyle}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>
              登録ユーザー管理
            </h2>
            <p style={menuDescriptionStyle}>
              ベータ登録ユーザーのID、ハンドルネーム、最終ログインを確認し、無効化・復活・パスワード再設定を行います。
            </p>
          </Link>

          <Link href={`/${tenant}/forum/admin/api-usage`} style={menuCardStyle}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>
              OpenAI API使用量
            </h2>
            <p style={menuDescriptionStyle}>
              Forum内のAI処理の実行回数、推定token、成功/失敗ログを確認します。
            </p>
          </Link>

          <Link
            href={`/${tenant}/forum/admin/rebuild-discussion-map`}
            style={menuCardStyle}
          >
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>
              議論マップ再編案
            </h2>
            <p style={menuDescriptionStyle}>
              公開中のスレッドと投稿をもとに、AIが議論ツリーの再編案を生成します。今回はプレビューのみです。
            </p>
          </Link>
          </div>
        </>
      )}
    </main>
  );
}
