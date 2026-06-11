"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

type Account = {
  login_id: string;
  display_name: string;
  created_at: string | null;
  last_login_at: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "未記録";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ForumAccountPage() {
  const params = useParams();
  const router = useRouter();
  const tenantParam = params?.tenant;
  const tenant = Array.isArray(tenantParam)
    ? tenantParam[0]
    : tenantParam || "dev";
  const forumPath = `/${tenant}/forum`;
  const accountPath = `/${tenant}/forum/account`;
  const loginPath = `/${tenant}/forum/login?next=${encodeURIComponent(
    accountPath
  )}`;
  const [account, setAccount] = useState<Account | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadAccount() {
      setIsLoading(true);
      setError("");

      try {
        const response = await fetch("/api/forum/account", {
          cache: "no-store",
        });

        if (response.status === 401) {
          router.replace(loginPath);
          return;
        }

        const json = (await response.json().catch(() => ({}))) as {
          account?: Account;
          error?: string;
        };

        if (!response.ok || !json.account) {
          throw new Error(json.error || "account load failed");
        }

        if (!isMounted) return;

        setAccount(json.account);
        setDisplayName(json.account.display_name || json.account.login_id);
      } catch {
        if (!isMounted) return;

        setError("入力内容を確認してください");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadAccount();

    return () => {
      isMounted = false;
    };
  }, [loginPath, router]);

  async function handleDisplayNameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setIsSavingName(true);

    try {
      const response = await fetch("/api/forum/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });
      const json = (await response.json().catch(() => ({}))) as {
        account?: Account;
        error?: string;
      };

      if (!response.ok || !json.account) {
        setError(json.error || "入力内容を確認してください");
        return;
      }

      setAccount(json.account);
      setDisplayName(json.account.display_name || json.account.login_id);
      setMessage("更新しました");
    } catch {
      setError("入力内容を確認してください");
    } finally {
      setIsSavingName(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordMessage("");
    setPasswordError("");

    if (newPassword !== newPasswordConfirm) {
      setPasswordError("パスワードが一致しません。");
      return;
    }

    setIsChangingPassword(true);

    try {
      const response = await fetch("/api/forum/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          newPasswordConfirm,
        }),
      });
      const json = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        setPasswordError(json.error || "入力内容を確認してください");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirm("");
      setPasswordMessage("更新しました");
    } catch {
      setPasswordError("入力内容を確認してください");
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/forum/logout", { method: "POST" }).catch(() => null);
    router.replace(`/${tenant}/forum/login?next=${encodeURIComponent(forumPath)}`);
  }

  const inputStyle = {
    display: "block",
    width: "100%",
    boxSizing: "border-box" as const,
    marginTop: 8,
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    background: "#ffffff",
    color: "#111827",
    fontSize: 16,
    padding: "12px 14px",
    outline: "none",
  };
  const buttonStyle = {
    border: "1px solid #111827",
    borderRadius: 8,
    background: "#111827",
    color: "#ffffff",
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 900,
    padding: "11px 14px",
  };

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
          maxWidth: 720,
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
          アカウント管理
        </h1>
        <p
          style={{
            margin: "0 0 22px",
            color: "#475569",
            fontSize: 14,
            lineHeight: 1.7,
          }}
        >
          ログインID、ハンドルネーム、パスワードを管理できます。
        </p>

        {isLoading ? (
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.7 }}>
            読み込み中...
          </p>
        ) : account ? (
          <>
            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                marginBottom: 20,
                padding: 16,
              }}
            >
              <dl
                style={{
                  display: "grid",
                  gap: 12,
                  margin: 0,
                }}
              >
                <div>
                  <dt style={{ color: "#64748b", fontSize: 13 }}>
                    ログインID
                  </dt>
                  <dd style={{ margin: "4px 0 0", fontWeight: 800 }}>
                    {account.login_id}
                  </dd>
                </div>
                <div>
                  <dt style={{ color: "#64748b", fontSize: 13 }}>
                    ハンドルネーム
                  </dt>
                  <dd style={{ margin: "4px 0 0", fontWeight: 800 }}>
                    {account.display_name}
                  </dd>
                </div>
                <div>
                  <dt style={{ color: "#64748b", fontSize: 13 }}>
                    最終ログイン日時
                  </dt>
                  <dd style={{ margin: "4px 0 0", fontWeight: 800 }}>
                    {formatDate(account.last_login_at)}
                  </dd>
                </div>
              </dl>
            </div>

            <form
              onSubmit={handleDisplayNameSubmit}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                marginBottom: 20,
                padding: 16,
              }}
            >
              <h2 style={{ margin: "0 0 14px", fontSize: 18 }}>
                ハンドルネーム変更
              </h2>
              <label
                style={{
                  display: "block",
                  color: "#111827",
                  fontWeight: 800,
                }}
              >
                ハンドルネーム
                <input
                  autoComplete="nickname"
                  maxLength={20}
                  placeholder="ハンドルネーム"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  style={inputStyle}
                />
              </label>
              {message && (
                <p style={{ color: "#047857", margin: "10px 0 0" }}>
                  {message}
                </p>
              )}
              {error && (
                <p style={{ color: "#991b1b", margin: "10px 0 0" }}>
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={isSavingName}
                style={{
                  ...buttonStyle,
                  cursor: isSavingName ? "not-allowed" : "pointer",
                  marginTop: 14,
                  opacity: isSavingName ? 0.75 : 1,
                }}
              >
                {isSavingName ? "更新中..." : "更新する"}
              </button>
            </form>

            <form
              onSubmit={handlePasswordSubmit}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                marginBottom: 20,
                padding: 16,
              }}
            >
              <h2 style={{ margin: "0 0 14px", fontSize: 18 }}>
                パスワード変更
              </h2>
              <label
                style={{
                  display: "block",
                  color: "#111827",
                  fontWeight: 800,
                  marginBottom: 14,
                }}
              >
                現在のパスワード
                <input
                  autoComplete="current-password"
                  placeholder="現在のパスワード"
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  style={inputStyle}
                />
              </label>
              <label
                style={{
                  display: "block",
                  color: "#111827",
                  fontWeight: 800,
                  marginBottom: 14,
                }}
              >
                新しいパスワード
                <input
                  autoComplete="new-password"
                  placeholder="新しいパスワード"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  style={inputStyle}
                />
              </label>
              <label
                style={{
                  display: "block",
                  color: "#111827",
                  fontWeight: 800,
                }}
              >
                新しいパスワード確認
                <input
                  autoComplete="new-password"
                  placeholder="もう一度新しいパスワードを入力"
                  type="password"
                  value={newPasswordConfirm}
                  onChange={(event) =>
                    setNewPasswordConfirm(event.target.value)
                  }
                  style={inputStyle}
                />
              </label>
              {passwordMessage && (
                <p style={{ color: "#047857", margin: "10px 0 0" }}>
                  {passwordMessage}
                </p>
              )}
              {passwordError && (
                <p style={{ color: "#991b1b", margin: "10px 0 0" }}>
                  {passwordError}
                </p>
              )}
              <button
                type="submit"
                disabled={isChangingPassword}
                style={{
                  ...buttonStyle,
                  cursor: isChangingPassword ? "not-allowed" : "pointer",
                  marginTop: 14,
                  opacity: isChangingPassword ? 0.75 : 1,
                }}
              >
                {isChangingPassword ? "変更中..." : "パスワードを変更する"}
              </button>
            </form>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                justifyContent: "space-between",
              }}
            >
              <Link
                href={forumPath}
                style={{
                  color: "#0f172a",
                  fontSize: 14,
                  fontWeight: 800,
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                }}
              >
                Forumへ戻る
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  background: "#ffffff",
                  color: "#0f172a",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 800,
                  padding: "9px 12px",
                }}
              >
                ログアウト
              </button>
            </div>
          </>
        ) : (
          <p style={{ margin: 0, color: "#991b1b", lineHeight: 1.7 }}>
            入力内容を確認してください
          </p>
        )}
      </section>
    </main>
  );
}
