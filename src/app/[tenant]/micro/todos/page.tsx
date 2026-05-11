"use client";

import Link from "next/link";
import { CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import MicroSectionCard from "@/components/micro/MicroSectionCard";
import MicroSectionTitle from "@/components/micro/MicroSectionTitle";

type MicroTodo = {
  id: string;
  source_data_id: string | null;
  title: string;
  description: string | null;
  todo_state: string;
  created_at: string;
};

type TodosResponse = {
  success?: boolean;
  error?: string;
  todos?: MicroTodo[];
  todo?: MicroTodo;
};

function getTenantSlug(params: ReturnType<typeof useParams>) {
  const value = params?.tenant;

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return typeof value === "string" ? value : "";
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "日時なし";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "日時なし";

  return date.toLocaleString("ja-JP");
}

const todoStateLabels: Record<string, string> = {
  open: "未完了",
  done: "完了",
  blocked: "保留",
};

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#111827",
  color: "#f9fafb",
  padding: "32px 16px",
};

const shellStyle: CSSProperties = {
  width: "100%",
  maxWidth: 720,
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: 20,
};

const backLinkStyle: CSSProperties = {
  alignSelf: "flex-start",
  color: "#bfdbfe",
  background: "#1e3a8a",
  border: "1px solid #2563eb",
  borderRadius: 8,
  padding: "8px 12px",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 700,
};

const mutedTextStyle: CSSProperties = {
  margin: "16px 0 0",
  color: "#d1d5db",
};

const messageStyle: CSSProperties = {
  margin: "14px 0 0",
  color: "#fecaca",
  background: "#7f1d1d",
  border: "1px solid #ef4444",
  borderRadius: 8,
  padding: "10px 12px",
};

const listStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  marginTop: 16,
};

const todoCardStyle: CSSProperties = {
  background: "#0f172a",
  color: "#f8fafc",
  border: "1px solid #334155",
  borderRadius: 8,
  padding: 14,
};

const todoTitleStyle: CSSProperties = {
  margin: 0,
  color: "#ffffff",
  fontSize: 17,
  lineHeight: 1.5,
  overflowWrap: "anywhere",
};

const todoDescriptionStyle: CSSProperties = {
  margin: "8px 0 0",
  color: "#dbeafe",
  lineHeight: 1.65,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
};

const metaStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  marginTop: 12,
  color: "#cbd5e1",
  fontSize: 13,
  lineHeight: 1.5,
};

const sourceLinkStyle: CSSProperties = {
  color: "#bfdbfe",
  background: "#172554",
  border: "1px solid #1d4ed8",
  borderRadius: 8,
  padding: "6px 8px",
  textDecoration: "none",
  overflowWrap: "anywhere",
};

const stateStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  alignSelf: "flex-start",
  background: "#064e3b",
  color: "#d1fae5",
  border: "1px solid #047857",
  borderRadius: 999,
  padding: "3px 9px",
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.5,
  marginTop: 12,
};

const doneStateStyle: CSSProperties = {
  ...stateStyle,
  background: "#1e3a8a",
  color: "#dbeafe",
  border: "1px solid #2563eb",
};

const actionRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 12,
};

const buttonStyle: CSSProperties = {
  alignSelf: "flex-start",
  border: "1px solid #60a5fa",
  borderRadius: 8,
  background: "#2563eb",
  color: "#ffffff",
  cursor: "pointer",
  padding: "10px 14px",
  fontSize: 14,
  fontWeight: 700,
};

const disabledButtonStyle: CSSProperties = {
  ...buttonStyle,
  border: "1px solid #4b5563",
  background: "#374151",
  color: "#d1d5db",
  cursor: "not-allowed",
};

export default function MicroTodosPage() {
  const params = useParams();
  const tenantSlug = useMemo(() => getTenantSlug(params), [params]);

  const [todos, setTodos] = useState<MicroTodo[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingTodoId, setUpdatingTodoId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const loadTodos = useCallback(async () => {
    if (!tenantSlug) return;

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(
        `/api/micro/todos?tenant_slug=${encodeURIComponent(tenantSlug)}`,
        { cache: "no-store" }
      );
      const data = (await res.json()) as TodosResponse;

      if (!res.ok || data.success === false) {
        throw new Error(data.error || "ToDo一覧の読み込みに失敗しました");
      }

      setTodos(data.todos ?? []);
    } catch (error) {
      setTodos([]);
      setMessage(
        error instanceof Error
          ? error.message
          : "ToDo一覧の読み込みに失敗しました"
      );
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    void loadTodos();
  }, [loadTodos]);

  const handleUpdateTodoState = async (
    todoId: string,
    action: "done" | "reopen"
  ) => {
    setUpdatingTodoId(todoId);
    setMessage("");

    try {
      const res = await fetch("/api/micro/todos", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: todoId,
          action,
        }),
      });
      const data = (await res.json()) as TodosResponse;

      if (!res.ok || data.success === false) {
        throw new Error(data.error || "ToDo状態の更新に失敗しました");
      }

      await loadTodos();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "ToDo状態の更新に失敗しました"
      );
    } finally {
      setUpdatingTodoId(null);
    }
  };

  return (
    <main style={pageStyle}>
      <div style={shellStyle}>
        <Link
          href={`/${encodeURIComponent(tenantSlug)}/micro`}
          style={backLinkStyle}
        >
          一覧へ戻る
        </Link>

        <MicroSectionCard>
          <MicroSectionTitle level={1}>ToDo一覧</MicroSectionTitle>
          {message && <p style={messageStyle}>{message}</p>}
        </MicroSectionCard>

        <MicroSectionCard>
          <MicroSectionTitle>未完了ToDo</MicroSectionTitle>

          {loading ? (
            <p style={mutedTextStyle}>読み込み中</p>
          ) : todos.length === 0 ? (
            <p style={mutedTextStyle}>ToDoはまだありません。</p>
          ) : (
            <div style={listStyle}>
              {todos.map((todo) => {
                const isDone = todo.todo_state === "done";
                const action = isDone ? "reopen" : "done";
                const isUpdating = updatingTodoId === todo.id;

                return (
                  <article key={todo.id} style={todoCardStyle}>
                    <h2 style={todoTitleStyle}>{todo.title}</h2>
                    {todo.description && (
                      <p style={todoDescriptionStyle}>{todo.description}</p>
                    )}

                    <span style={isDone ? doneStateStyle : stateStyle}>
                      {todoStateLabels[todo.todo_state] ?? todo.todo_state}
                    </span>

                    <div style={metaStyle}>
                      <span>作成日時: {formatTimestamp(todo.created_at)}</span>
                      {todo.source_data_id ? (
                        <Link
                          href={`/${encodeURIComponent(
                            tenantSlug
                          )}/micro/source/${encodeURIComponent(
                            todo.source_data_id
                          )}`}
                          style={sourceLinkStyle}
                        >
                          source_data_id: {todo.source_data_id}
                        </Link>
                      ) : (
                        <span>source_data_id: なし</span>
                      )}
                    </div>

                    <div style={actionRowStyle}>
                      <button
                        type="button"
                        onClick={() => void handleUpdateTodoState(todo.id, action)}
                        disabled={isUpdating}
                        style={isUpdating ? disabledButtonStyle : buttonStyle}
                      >
                        {isUpdating
                          ? "更新中"
                          : isDone
                            ? "未完了に戻す"
                            : "完了"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </MicroSectionCard>
      </div>
    </main>
  );
}
