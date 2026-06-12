"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type CSSProperties } from "react";

type AdminForumBetaUser = {
  id: string;
  login_id: string;
  display_name: string;
  created_at: string | null;
  last_login_at: string | null;
};

type PasswordFormState = {
  newPassword: string;
  newPasswordConfirm: string;
};

const pageStyle = {
  maxWidth: 1080,
  margin: "0 auto",
  padding: 24,
  color: "#111827",
} satisfies CSSProperties;

const cardStyle = {
  border: "1px solid #dbe3ef",
  borderRadius: 8,
  background: "#ffffff",
  color: "#111827",
  padding: 16,
} satisfies CSSProperties;

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#ffffff",
  color: "#111827",
} satisfies CSSProperties;

const buttonStyle = {
  border: "1px solid #111827",
  borderRadius: 8,
  background: "#111827",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 800,
  padding: "10px 14px",
} satisfies CSSProperties;

const secondaryButtonStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#ffffff",
  color: "#111827",
  cursor: "pointer",
  fontWeight: 800,
  padding: "9px 12px",
} satisfies CSSProperties;

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP");
}

function emptyPasswordForm(): PasswordFormState {
  return {
    newPassword: "",
    newPasswordConfirm: "",
  };
}

export default function AdminUsersPage() {
  const params = useParams();
  const tenantParam = params?.tenant;
  const tenant = Array.isArray(tenantParam)
    ? tenantParam[0] ?? "dev"
    : tenantParam ?? "dev";

  const [adminKey, setAdminKey] = useState("");
  const [users, setUsers] = useState<AdminForumBetaUser[]>([]);
  const [passwordForms, setPasswordForms] = useState<
    Record<string, PasswordFormState>
  >({});
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestAdminKey = adminKey.trim();

  function requireAdminKey() {
    if (requestAdminKey) return true;
    setError("管理者キーを入力してください。");
    return false;
  }

  function updatePasswordForm(
    userId: string,
    field: keyof PasswordFormState,
    value: string
  ) {
    setPasswordForms((current) => ({
      ...current,
      [userId]: {
        ...(current[userId] ?? emptyPasswordForm()),
        [field]: value,
      },
    }));
  }

  async function loadUsers() {
    if (!requireAdminKey()) return;

    setLoadingUsers(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/forum/admin/users", {
        headers: { "x-admin-key": requestAdminKey },
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as {
        users?: AdminForumBetaUser[];
        error?: string;
      };

      if (!res.ok) {
        setError(json.error || "ユーザー一覧の取得に失敗しました。");
        return;
      }

      const nextUsers = Array.isArray(json.users) ? json.users : [];
      setUsers(nextUsers);
      setPasswordForms(
        Object.fromEntries(nextUsers.map((user) => [user.id, emptyPasswordForm()]))
      );
    } catch {
      setError("ユーザー一覧の取得に失敗しました。");
    } finally {
      setLoadingUsers(false);
    }
  }

  async function resetPassword(user: AdminForumBetaUser) {
    if (!requireAdminKey()) return;

    const form = passwordForms[user.id] ?? emptyPasswordForm();

    setError(null);
    setMessage(null);

    if (form.newPassword !== form.newPasswordConfirm) {
      setError("新しいパスワードが一致しません。");
      return;
    }

    setSavingUserId(user.id);

    try {
      const res = await fetch(
        `/api/forum/admin/users/${encodeURIComponent(user.id)}/reset-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": requestAdminKey,
          },
          body: JSON.stringify({
            newPassword: form.newPassword,
            newPasswordConfirm: form.newPasswordConfirm,
          }),
        }
      );
      const json = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        setError(json.error || "パスワード再設定に失敗しました。");
        return;
      }

      setPasswordForms((current) => ({
        ...current,
        [user.id]: emptyPasswordForm(),
      }));
      setMessage(`${user.login_id} のパスワードを再設定しました。`);
    } catch {
      setError("パスワード再設定に失敗しました。");
    } finally {
      setSavingUserId(null);
    }
  }

  return (
    <main style={pageStyle}>
      <Link
        href={`/${tenant}/forum/admin`}
        style={{
          display: "inline-block",
          marginBottom: 14,
          color: "#2563eb",
          fontWeight: 800,
          textDecoration: "none",
        }}
      >
        ← forum管理トップへ戻る
      </Link>

      <h1 style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 900 }}>
        登録ユーザー管理
      </h1>
      <p style={{ margin: "0 0 18px", color: "#475569", lineHeight: 1.7 }}>
        ベータ登録ユーザーのID、ハンドルネーム、作成日、最終ログインを確認し、
        必要な場合だけパスワードを再設定します。現在のパスワードは表示できません。
      </p>

      <section style={{ ...cardStyle, marginBottom: 18 }}>
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
            value={adminKey}
            onChange={(event) => setAdminKey(event.target.value)}
            placeholder="ADMIN_KEY"
            style={{ ...inputStyle, flex: "1 1 260px" }}
          />
          <button
            type="button"
            onClick={() => void loadUsers()}
            disabled={loadingUsers}
            style={{
              ...buttonStyle,
              opacity: loadingUsers ? 0.65 : 1,
            }}
          >
            {loadingUsers ? "読み込み中..." : "ユーザー一覧を読み込む"}
          </button>
        </div>
      </section>

      {message && (
        <div
          style={{
            ...cardStyle,
            marginBottom: 18,
            borderColor: "#86efac",
            background: "#f0fdf4",
            color: "#166534",
          }}
        >
          {message}
        </div>
      )}

      {error && (
        <div
          style={{
            ...cardStyle,
            marginBottom: 18,
            borderColor: "#fca5a5",
            background: "#fef2f2",
            color: "#991b1b",
          }}
        >
          {error}
        </div>
      )}

      <section style={{ ...cardStyle, marginBottom: 18 }}>
        <h2 style={{ margin: "0 0 12px", fontSize: 22 }}>
          登録ユーザー一覧
        </h2>

        {users.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>
            まだ一覧は読み込まれていません。
          </p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {users.map((user) => {
              const form = passwordForms[user.id] ?? emptyPasswordForm();
              const isSaving = savingUserId === user.id;

              return (
                <article
                  key={user.id}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: 14,
                    background: "#ffffff",
                    color: "#111827",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ color: "#64748b", fontSize: 13 }}>
                        登録ID
                      </div>
                      <div
                        style={{
                          fontWeight: 900,
                          marginTop: 4,
                          wordBreak: "break-all",
                        }}
                      >
                        {user.login_id}
                      </div>
                      <div
                        style={{
                          color: "#64748b",
                          fontSize: 12,
                          marginTop: 6,
                          wordBreak: "break-all",
                        }}
                      >
                        ユーザーID: {user.id}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: "#64748b", fontSize: 13 }}>
                        ハンドルネーム
                      </div>
                      <div style={{ fontWeight: 800, marginTop: 4 }}>
                        {user.display_name || "-"}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: "#64748b", fontSize: 13 }}>
                        作成日 / 最終ログイン
                      </div>
                      <div style={{ marginTop: 4, lineHeight: 1.7 }}>
                        <div>作成日: {formatDate(user.created_at)}</div>
                        <div>最終ログイン: {formatDate(user.last_login_at)}</div>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      borderTop: "1px solid #e2e8f0",
                      marginTop: 14,
                      paddingTop: 14,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 900,
                        marginBottom: 10,
                      }}
                    >
                      パスワード再設定
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
                        gap: 10,
                        alignItems: "end",
                      }}
                    >
                      <label style={{ fontWeight: 800 }}>
                        新しいパスワード
                        <input
                          type="password"
                          autoComplete="new-password"
                          value={form.newPassword}
                          onChange={(event) =>
                            updatePasswordForm(
                              user.id,
                              "newPassword",
                              event.target.value
                            )
                          }
                          placeholder="新しいパスワード"
                          style={{ ...inputStyle, marginTop: 8 }}
                        />
                      </label>
                      <label style={{ fontWeight: 800 }}>
                        新しいパスワード確認
                        <input
                          type="password"
                          autoComplete="new-password"
                          value={form.newPasswordConfirm}
                          onChange={(event) =>
                            updatePasswordForm(
                              user.id,
                              "newPasswordConfirm",
                              event.target.value
                            )
                          }
                          placeholder="もう一度入力"
                          style={{ ...inputStyle, marginTop: 8 }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => void resetPassword(user)}
                        disabled={isSaving}
                        style={{
                          ...secondaryButtonStyle,
                          opacity: isSaving ? 0.65 : 1,
                        }}
                      >
                        {isSaving ? "再設定中..." : "再設定する"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
