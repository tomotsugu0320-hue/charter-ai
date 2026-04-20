"use client";

import { useEffect, useState } from "react";

type Mode = "visible" | "hidden" | "all";

type ThreadRow = {
  id: string;
  title: string | null;
  original_post: string | null;
  created_at: string | null;
  is_deleted: boolean | null;
  deleted_at: string | null;
};

const modeLabels: Record<Mode, string> = {
  visible: "表示中",
  hidden: "非表示",
  all: "すべて",
};

export default function DeleteThreadsPage() {
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [mode, setMode] = useState<Mode>("visible");
  const [adminKey, setAdminKey] = useState("");
  const requestAdminKey = adminKey || process.env.NEXT_PUBLIC_ADMIN_KEY || "";

  async function load() {
    const res = await fetch(`/api/forum/admin-threads?mode=${mode}`, {
      headers: { "x-admin-key": requestAdminKey },
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(json?.error || "スレッド一覧の取得に失敗しました");
      return;
    }

    setThreads(json.threads ?? []);
  }

  async function del(id: string) {
    if (!confirm("このスレッドをトップ一覧から非表示にする？")) return;

    const res = await fetch("/api/forum/delete-thread", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": requestAdminKey,
      },
      body: JSON.stringify({ threadId: id }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(json?.error || "スレッド非表示に失敗しました");
      return;
    }

    setThreads((current) =>
      mode === "all"
        ? current.map((thread) =>
            thread.id === id
              ? {
                  ...thread,
                  is_deleted: true,
                  deleted_at: new Date().toISOString(),
                }
              : thread
          )
        : current.filter((thread) => thread.id !== id)
    );
  }

  async function restore(id: string) {
    const res = await fetch("/api/forum/restore-thread", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": requestAdminKey,
      },
      body: JSON.stringify({ threadId: id }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(json?.error || "スレッド復元に失敗しました");
      return;
    }

    setThreads((current) =>
      mode === "all"
        ? current.map((thread) =>
            thread.id === id
              ? { ...thread, is_deleted: false, deleted_at: null }
              : thread
          )
        : current.filter((thread) => thread.id !== id)
    );
  }

  async function hardDelete(id: string) {
    if (
      !confirm(
        "このスレッドを完全削除しますか？\nこの操作は元に戻せません。"
      )
    ) {
      return;
    }

    const res = await fetch("/api/forum/hard-delete-thread", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": requestAdminKey,
      },
      body: JSON.stringify({ threadId: id }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(json?.error || "スレッドの完全削除に失敗しました");
      return;
    }

    setThreads((current) => current.filter((thread) => thread.id !== id));
  }

  useEffect(() => {
    void load();
  }, [mode]);

  return (
    <main style={{ padding: 20 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
        スレッド非表示管理
      </h1>

      <p style={{ opacity: 0.7, marginBottom: 16 }}>
        トップ一覧に表示する/しないを切り替えます。
      </p>

      <div style={{ marginBottom: 16 }}>
        <label
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 700,
            color: "#374151",
            marginBottom: 6,
          }}
        >
          管理者キー（完全削除用）
        </label>
        <input
          type="password"
          value={adminKey}
          onChange={(event) => setAdminKey(event.target.value)}
          placeholder="ADMIN_KEY"
          style={{
            width: "100%",
            maxWidth: 360,
            border: "1px solid #d1d5db",
            borderRadius: 6,
            padding: "8px 10px",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["visible", "hidden", "all"] as Mode[]).map((nextMode) => (
          <button
            key={nextMode}
            type="button"
            onClick={() => setMode(nextMode)}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid #ccc",
              background: mode === nextMode ? "#111827" : "#fff",
              color: mode === nextMode ? "#fff" : "#111827",
              cursor: "pointer",
            }}
          >
            {modeLabels[nextMode]}
          </button>
        ))}
      </div>

      {threads.length === 0 ? (
        <p style={{ opacity: 0.7 }}>スレッドがありません。</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {threads.map((thread) => {
            const hidden = thread.is_deleted === true;

            return (
              <section
                key={thread.id}
                style={{
                  position: "relative",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  padding: "48px 12px 12px",
                  background: "#fff",
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 6 }}>
                  {thread.title || "無題のスレッド"}
                </div>

                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    color: "#444",
                    marginBottom: 8,
                  }}
                >
                  {thread.original_post || "本文なし"}
                </div>

                <div style={{ fontSize: 12, color: "#777", marginBottom: 10 }}>
                  作成:{" "}
                  {thread.created_at
                    ? new Date(thread.created_at).toLocaleString()
                    : "日時不明"}
                  {hidden && thread.deleted_at
                    ? ` / 非表示: ${new Date(
                        thread.deleted_at
                      ).toLocaleString()}`
                    : ""}
                </div>

                {hidden ? (
                  <button
                    type="button"
                    onClick={() => void restore(thread.id)}
                    style={{
                      color: "#166534",
                      border: "1px solid #86efac",
                      borderRadius: 6,
                      background: "#fff",
                      padding: "6px 10px",
                      cursor: "pointer",
                    }}
                  >
                    復元
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void del(thread.id)}
                    style={{
                      color: "red",
                      border: "1px solid #fca5a5",
                      borderRadius: 6,
                      background: "#fff",
                      padding: "6px 10px",
                      cursor: "pointer",
                    }}
                  >
                    非表示
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => void hardDelete(thread.id)}
                  style={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    color: "#991b1b",
                    border: "1px solid #ef4444",
                    borderRadius: 6,
                    background: "#fef2f2",
                    padding: "6px 10px",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  完全削除（復元不可）
                </button>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
