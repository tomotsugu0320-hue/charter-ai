"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";

type AdminForumBetaUser = {
  id: string;
  login_id: string;
  display_name: string;
  created_at: string | null;
  last_login_at: string | null;
  status?: string | null;
  disabled_at?: string | null;
  deleted_at?: string | null;
};

type PasswordFormState = {
  newPassword: string;
  newPasswordConfirm: string;
};

type CardMessage = {
  type: "success" | "error";
  text: string;
};

const adminKeyStorageKey = "forum_admin_key";

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

function statusLabel(status: string | null | undefined) {
  if (status === "disabled") return "無効";
  if (status === "deleted") return "削除済み";
  return "有効";
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
  const [deleteConfirmTexts, setDeleteConfirmTexts] = useState<
    Record<string, string>
  >({});
  const [cardMessages, setCardMessages] = useState<Record<string, CardMessage>>(
    {}
  );
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestAdminKey = adminKey.trim();

  useEffect(() => {
    const saved = sessionStorage.getItem(adminKeyStorageKey);

    if (saved) {
      setAdminKey(saved);
    }
  }, []);

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
    setCardMessages({});

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
      setDeleteConfirmTexts({});
      sessionStorage.setItem(adminKeyStorageKey, requestAdminKey);
    } catch {
      setError("ユーザー一覧の取得に失敗しました。");
    } finally {
      setLoadingUsers(false);
    }
  }

  function setCardMessage(userId: string, message: CardMessage) {
    setCardMessages((current) => ({
      ...current,
      [userId]: message,
    }));
  }

  function updateUserStatus(userId: string, status: string) {
    const now = new Date().toISOString();

    setUsers((current) =>
      current.map((user) =>
        user.id === userId
          ? {
              ...user,
              status,
              disabled_at: status === "disabled" ? now : null,
              deleted_at: status === "deleted" ? now : user.deleted_at,
              display_name:
                status === "deleted" ? "退会ユーザー" : user.display_name,
            }
          : user
      )
    );
  }

  async function resetPassword(user: AdminForumBetaUser) {
    if (!requireAdminKey()) return;

    const form = passwordForms[user.id] ?? emptyPasswordForm();

    setError(null);
    setCardMessages((current) => {
      const next = { ...current };
      delete next[user.id];
      return next;
    });

    if (form.newPassword !== form.newPasswordConfirm) {
      setCardMessage(user.id, {
        type: "error",
        text: "入力内容を確認してください",
      });
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
        setCardMessage(user.id, {
          type: "error",
          text: json.error || "入力内容を確認してください",
        });
        return;
      }

      setPasswordForms((current) => ({
        ...current,
        [user.id]: emptyPasswordForm(),
      }));
      setCardMessage(user.id, {
        type: "success",
        text: "パスワードを再設定しました",
      });
    } catch {
      setCardMessage(user.id, {
        type: "error",
        text: "入力内容を確認してください",
      });
    } finally {
      setSavingUserId(null);
    }
  }

  async function changeUserStatus(
    user: AdminForumBetaUser,
    status: "active" | "disabled"
  ) {
    if (!requireAdminKey()) return;

    setSavingUserId(user.id);
    setError(null);

    try {
      const res = await fetch(
        `/api/forum/admin/users/${encodeURIComponent(user.id)}/disable`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": requestAdminKey,
          },
          body: JSON.stringify({ status }),
        }
      );
      const json = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        setCardMessage(user.id, {
          type: "error",
          text: json.error || "入力内容を確認してください",
        });
        return;
      }

      updateUserStatus(user.id, status);
      setCardMessage(user.id, {
        type: "success",
        text: status === "disabled" ? "無効化しました" : "復活しました",
      });
    } catch {
      setCardMessage(user.id, {
        type: "error",
        text: "入力内容を確認してください",
      });
    } finally {
      setSavingUserId(null);
    }
  }

  async function deleteUser(user: AdminForumBetaUser) {
    if (!requireAdminKey()) return;

    const confirmText = (deleteConfirmTexts[user.id] ?? "").trim();

    if (confirmText !== "削除する") {
      setCardMessage(user.id, {
        type: "error",
        text: "確認文言を入力してください",
      });
      return;
    }

    const confirmed = window.confirm(
      `${user.login_id} を削除状態にします。投稿は残して表示します。よろしいですか？`
    );

    if (!confirmed) return;

    setSavingUserId(user.id);
    setError(null);

    try {
      const res = await fetch(
        `/api/forum/admin/users/${encodeURIComponent(user.id)}/delete`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": requestAdminKey,
          },
          body: JSON.stringify({
            postHandling: "keep_visible",
            confirmText,
          }),
        }
      );
      const json = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        setCardMessage(user.id, {
          type: "error",
          text: json.error || "入力内容を確認してください",
        });
        return;
      }

      updateUserStatus(user.id, "deleted");
      setDeleteConfirmTexts((current) => ({ ...current, [user.id]: "" }));
      setCardMessage(user.id, {
        type: "success",
        text: "削除状態にしました",
      });
    } catch {
      setCardMessage(user.id, {
        type: "error",
        text: "入力内容を確認してください",
      });
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
              const cardMessage = cardMessages[user.id];
              const isSaving = savingUserId === user.id;
              const isDeleted = user.status === "deleted";
              const isDisabled = user.status === "disabled";

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
                    <div>
                      <div style={{ color: "#64748b", fontSize: 13 }}>
                        ステータス
                      </div>
                      <div style={{ fontWeight: 900, marginTop: 4 }}>
                        {statusLabel(user.status)}
                      </div>
                      {user.disabled_at && (
                        <div style={{ color: "#64748b", fontSize: 12 }}>
                          無効化: {formatDate(user.disabled_at)}
                        </div>
                      )}
                      {user.deleted_at && (
                        <div style={{ color: "#64748b", fontSize: 12 }}>
                          削除: {formatDate(user.deleted_at)}
                        </div>
                      )}
                    </div>
                  </div>

                  {cardMessage && (
                    <div
                      style={{
                        border: `1px solid ${
                          cardMessage.type === "success" ? "#86efac" : "#fca5a5"
                        }`,
                        borderRadius: 8,
                        background:
                          cardMessage.type === "success" ? "#f0fdf4" : "#fef2f2",
                        color:
                          cardMessage.type === "success" ? "#166534" : "#991b1b",
                        marginTop: 12,
                        padding: "9px 10px",
                      }}
                    >
                      {cardMessage.text}
                    </div>
                  )}

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
                        disabled={isSaving || isDeleted}
                        style={{
                          ...secondaryButtonStyle,
                          opacity: isSaving || isDeleted ? 0.65 : 1,
                        }}
                      >
                        {isSaving ? "再設定中..." : "再設定する"}
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      borderTop: "1px solid #e2e8f0",
                      marginTop: 14,
                      paddingTop: 14,
                    }}
                  >
                    <div style={{ fontWeight: 900, marginBottom: 10 }}>
                      アカウント操作
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      {isDisabled ? (
                        <button
                          type="button"
                          onClick={() => void changeUserStatus(user, "active")}
                          disabled={isSaving || isDeleted}
                          style={{
                            ...secondaryButtonStyle,
                            opacity: isSaving || isDeleted ? 0.65 : 1,
                          }}
                        >
                          復活する
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            void changeUserStatus(user, "disabled")
                          }
                          disabled={isSaving || isDeleted}
                          style={{
                            ...secondaryButtonStyle,
                            opacity: isSaving || isDeleted ? 0.65 : 1,
                          }}
                        >
                          無効化する
                        </button>
                      )}
                      <span style={{ color: "#64748b", fontSize: 13 }}>
                        無効化すると再ログインできません。投稿は残ります。
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      borderTop: "1px solid #fecaca",
                      marginTop: 14,
                      paddingTop: 14,
                    }}
                  >
                    <div style={{ color: "#991b1b", fontWeight: 900 }}>
                      アカウント削除
                    </div>
                    <p style={{ color: "#7f1d1d", lineHeight: 1.7 }}>
                      現在、投稿と登録ユーザーIDの正式な紐づきがないため、投稿は残して表示する扱いのみ対応しています。投稿の非表示・完全削除は未対応です。
                    </p>
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
                        投稿扱い
                        <select
                          disabled
                          value="keep_visible"
                          style={{ ...inputStyle, marginTop: 8 }}
                        >
                          <option value="keep_visible">投稿を残して表示</option>
                        </select>
                      </label>
                      <label style={{ fontWeight: 800 }}>
                        確認文言
                        <input
                          value={deleteConfirmTexts[user.id] ?? ""}
                          onChange={(event) =>
                            setDeleteConfirmTexts((current) => ({
                              ...current,
                              [user.id]: event.target.value,
                            }))
                          }
                          placeholder="削除する"
                          disabled={isDeleted}
                          style={{ ...inputStyle, marginTop: 8 }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => void deleteUser(user)}
                        disabled={isSaving || isDeleted}
                        style={{
                          border: "1px solid #991b1b",
                          borderRadius: 8,
                          background: "#991b1b",
                          color: "#ffffff",
                          cursor:
                            isSaving || isDeleted ? "not-allowed" : "pointer",
                          fontWeight: 800,
                          opacity: isSaving || isDeleted ? 0.65 : 1,
                          padding: "9px 12px",
                        }}
                      >
                        {isDeleted ? "削除済み" : "削除状態にする"}
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
