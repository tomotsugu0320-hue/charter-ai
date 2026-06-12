"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import ForumHamburgerMenu from "@/components/forum/ForumHamburgerMenu";

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
  const params = useParams();
  const tenantParam = params?.tenant;
  const tenant = Array.isArray(tenantParam)
    ? tenantParam[0] ?? "dev"
    : tenantParam ?? "dev";
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [mode, setMode] = useState<Mode>("visible");
  const [adminKey, setAdminKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [operatingThreadId, setOperatingThreadId] = useState<string | null>(
    null
  );
  const [openDangerThreadIds, setOpenDangerThreadIds] = useState<
    Record<string, boolean>
  >({});
  const requestAdminKey = adminKey.trim();

  function titleOf(thread: ThreadRow) {
    return thread.title?.trim() || "無題のスレッド";
  }

  function requireAdminKey() {
    if (requestAdminKey) return true;

    setError("完全削除には管理者キーを入力してください。");
    return false;
  }

  async function load() {
    setListLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/forum/admin-threads?mode=${mode}`);
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setThreads([]);
        setError(
          res.status === 401 || json?.error === "Login required."
            ? "ログインが必要です。Forumトップからログインしてください。"
            : json?.error || "スレッド一覧の取得に失敗しました。"
        );
        return;
      }

      setThreads(json.threads ?? []);
    } finally {
      setListLoading(false);
    }
  }

  async function del(thread: ThreadRow) {
    if (!confirm(`このスレッドを非表示にします。対象: ${titleOf(thread)}`)) {
      return;
    }

    setOperatingThreadId(thread.id);
    setError(null);

    try {
      const res = await fetch("/api/forum/delete-thread", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ threadId: thread.id }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(json?.error || "スレッド非表示に失敗しました。");
        return;
      }

      setThreads((current) =>
        mode === "all"
          ? current.map((currentThread) =>
              currentThread.id === thread.id
                ? {
                    ...currentThread,
                    is_deleted: true,
                    deleted_at: new Date().toISOString(),
                  }
                : currentThread
            )
          : current.filter((currentThread) => currentThread.id !== thread.id)
      );
    } finally {
      setOperatingThreadId(null);
    }
  }

  async function restore(thread: ThreadRow) {
    if (
      !confirm(
        `このスレッドを公開状態に戻します。対象: ${titleOf(thread)}`
      )
    ) {
      return;
    }

    setOperatingThreadId(thread.id);
    setError(null);

    try {
      const res = await fetch("/api/forum/restore-thread", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ threadId: thread.id }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(json?.error || "スレッド復元に失敗しました。");
        return;
      }

      setThreads((current) =>
        mode === "all"
          ? current.map((currentThread) =>
              currentThread.id === thread.id
                ? { ...currentThread, is_deleted: false, deleted_at: null }
                : currentThread
            )
          : current.filter((currentThread) => currentThread.id !== thread.id)
      );
    } finally {
      setOperatingThreadId(null);
    }
  }

  async function hardDelete(thread: ThreadRow) {
    if (!requireAdminKey()) return;
    if (
      !confirm(
        `完全削除します。元に戻せません。対象: ${titleOf(
          thread
        )}。本当に削除しますか？`
      )
    ) {
      return;
    }

    setOperatingThreadId(thread.id);
    setError(null);

    try {
      const res = await fetch("/api/forum/hard-delete-thread", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": requestAdminKey,
        },
        body: JSON.stringify({ threadId: thread.id }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(json?.error || "スレッドの完全削除に失敗しました。");
        return;
      }

      setThreads((current) =>
        current.filter((currentThread) => currentThread.id !== thread.id)
      );
    } finally {
      setOperatingThreadId(null);
    }
  }

  useEffect(() => {
    void load();
  }, [mode]);

  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        void load();
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [mode]);

  return (
    <main style={{ padding: 20 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <Link
          href={`/${tenant}/forum`}
          style={{
            display: "inline-block",
            color: "#1d4ed8",
            fontWeight: 800,
            padding: "6px 0",
            textDecoration: "underline",
          }}
        >
          ← Forumトップへ戻る
        </Link>
        <ForumHamburgerMenu tenant={tenant} />
      </div>

      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
        管理画面（会員）：非表示/復元
      </h1>

      <p style={{ opacity: 0.7, marginBottom: 16 }}>
        この画面では、スレッドの非表示・復元を行えます。完全削除は管理者のみです。
      </p>

      <div
        style={{
          border: "1px solid #bfdbfe",
          borderRadius: 8,
          background: "#eff6ff",
          color: "#1e3a8a",
          lineHeight: 1.7,
          marginBottom: 16,
          padding: "10px 12px",
          fontWeight: 700,
        }}
      >
        一覧の読み込み、非表示、復元は管理者キーなしで使えます。完全削除だけ管理者キーが必要です。
      </div>

      <button
        type="button"
        onClick={() => void load()}
        disabled={listLoading}
        style={{
          border: "1px solid #111827",
          borderRadius: 6,
          background: listLoading ? "#cbd5e1" : "#111827",
          color: listLoading ? "#334155" : "#fff",
          cursor: listLoading ? "wait" : "pointer",
          fontWeight: 800,
          marginBottom: 16,
          padding: "8px 12px",
        }}
      >
        {listLoading ? "読み込み中..." : "一覧を読み込む"}
      </button>

      {error && (
        <div
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

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 16,
        }}
      >
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
            const operating = operatingThreadId === thread.id;
            const dangerOpen = openDangerThreadIds[thread.id] === true;

            return (
              <section
                key={thread.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  padding: 12,
                  background: "#fff",
                  color: "#111827",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      border: hidden
                        ? "1px solid #fcd34d"
                        : "1px solid #86efac",
                      borderRadius: 999,
                      background: hidden ? "#fffbeb" : "#f0fdf4",
                      color: hidden ? "#92400e" : "#166534",
                      fontSize: 12,
                      fontWeight: 800,
                      padding: "2px 8px",
                    }}
                  >
                    {hidden ? "非表示中" : "公開中"}
                  </span>

                  <div style={{ fontWeight: 700 }}>{titleOf(thread)}</div>
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
                    onClick={() => void restore(thread)}
                    disabled={operating}
                    style={{
                      color: "#166534",
                      border: "1px solid #86efac",
                      borderRadius: 6,
                      background: "#fff",
                      padding: "6px 10px",
                      cursor: operating ? "wait" : "pointer",
                      opacity: operating ? 0.65 : 1,
                    }}
                  >
                    {operating ? "処理中..." : "復元"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void del(thread)}
                    disabled={operating}
                    style={{
                      color: "#991b1b",
                      border: "1px solid #fca5a5",
                      borderRadius: 6,
                      background: "#fff",
                      padding: "6px 10px",
                      cursor: operating ? "wait" : "pointer",
                      opacity: operating ? 0.65 : 1,
                    }}
                  >
                    {operating ? "処理中..." : "非表示"}
                  </button>
                )}

                <div style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    onClick={() =>
                      setOpenDangerThreadIds((current) => ({
                        ...current,
                        [thread.id]: !dangerOpen,
                      }))
                    }
                    style={{
                      color: dangerOpen ? "#7f1d1d" : "#374151",
                      border: dangerOpen
                        ? "1px solid #fca5a5"
                        : "1px solid #d1d5db",
                      borderRadius: 6,
                      background: dangerOpen ? "#fef2f2" : "#fff",
                      padding: "6px 10px",
                      cursor: "pointer",
                      fontWeight: 700,
                    }}
                  >
                    {dangerOpen ? "危険操作を閉じる" : "危険操作を表示"}
                  </button>
                </div>

                {dangerOpen && (
                  <div
                    style={{
                      border: "1px solid #fecaca",
                      borderRadius: 8,
                      background: "#fef2f2",
                      color: "#7f1d1d",
                      marginTop: 10,
                      padding: "10px 12px",
                    }}
                  >
                    <div style={{ fontWeight: 800, marginBottom: 8 }}>
                      危険操作
                    </div>
                    <div
                      style={{
                        color: "#7f1d1d",
                        fontSize: 13,
                        lineHeight: 1.6,
                        marginBottom: 8,
                      }}
                    >
                      完全削除には管理者キーが必要です。
                    </div>

                    <label
                      style={{
                        display: "block",
                        fontSize: 12,
                        fontWeight: 800,
                        marginBottom: 6,
                      }}
                    >
                      管理者キー（完全削除のみ）
                    </label>
                    <input
                      type="password"
                      value={adminKey}
                      onChange={(event) => setAdminKey(event.target.value)}
                      placeholder="ADMIN_KEY"
                      style={{
                        width: "100%",
                        maxWidth: 360,
                        border: "1px solid #fecaca",
                        borderRadius: 6,
                        marginBottom: 10,
                        padding: "8px 10px",
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => void hardDelete(thread)}
                      disabled={operating}
                      style={{
                        color: "#991b1b",
                        border: "1px solid #ef4444",
                        borderRadius: 6,
                        background: "#fff",
                        padding: "6px 10px",
                        cursor: operating ? "wait" : "pointer",
                        fontWeight: 700,
                        opacity: operating ? 0.65 : 1,
                      }}
                    >
                      {operating ? "処理中..." : "完全削除（復元不可）"}
                    </button>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
