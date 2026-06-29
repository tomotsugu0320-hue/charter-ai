"use client";

import { useEffect, useState, type CSSProperties, type FormEvent } from "react";

type ReportButtonProps = {
  postId: string;
  threadId?: string | null;
};

const reasonOptions = [
  { value: "personal_info", label: "個人情報が含まれている" },
  { value: "harassment", label: "攻撃的・嫌がらせ" },
  { value: "spam", label: "スパム・宣伝" },
  { value: "illegal_or_dangerous", label: "危険・不適切な内容" },
  { value: "wrong_publication", label: "誤って公開された会話ログ" },
  { value: "other", label: "その他" },
] as const;

const buttonStyle: CSSProperties = {
  flexShrink: 0,
  fontSize: 12,
  color: "#6b7280",
  border: "1px solid #d1d5db",
  borderRadius: 999,
  background: "transparent",
  cursor: "pointer",
  padding: "4px 8px",
  lineHeight: 1.2,
};

const panelStyle: CSSProperties = {
  marginTop: 8,
  padding: 10,
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  background: "#f9fafb",
  color: "#111827",
  display: "grid",
  gap: 8,
  maxWidth: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  overflowWrap: "anywhere",
};

export default function ReportButton({ postId, threadId }: ReportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isNarrowScreen, setIsNarrowScreen] = useState(false);
  const [reasonType, setReasonType] = useState<(typeof reasonOptions)[number]["value"]>(
    "personal_info"
  );
  const [reasonDetail, setReasonDetail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 640px)");
    const syncNarrowScreen = () => setIsNarrowScreen(mediaQuery.matches);

    syncNarrowScreen();
    mediaQuery.addEventListener("change", syncNarrowScreen);
    return () => mediaQuery.removeEventListener("change", syncNarrowScreen);
  }, []);

  const activePanelStyle: CSSProperties = isNarrowScreen
    ? {
        ...panelStyle,
        position: "fixed",
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 1000,
        marginTop: 0,
        width: "auto",
        maxWidth: "calc(100vw - 32px)",
        maxHeight: "calc(100vh - 32px)",
        overflowY: "auto",
        boxShadow: "0 20px 45px rgba(15, 23, 42, 0.24)",
      }
    : {
        ...panelStyle,
        width: "min(360px, calc(100vw - 32px))",
      };

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/forum/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post_id: postId,
          thread_id: threadId,
          reason_type: reasonType,
          reason_detail: reasonDetail,
        }),
      });
      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error("通報にはログインが必要です。");
        }
        throw new Error(json?.error || "通報の送信に失敗しました。");
      }

      setMessage("通報を受け付けました。");
      setReasonDetail("");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "通報の送信に失敗しました。"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: "100%", position: "relative" }}>
      <button
        type="button"
        onClick={() => {
          setIsOpen((current) => !current);
          setMessage(null);
          setError(null);
        }}
        style={buttonStyle}
        aria-expanded={isOpen}
      >
        通報
      </button>

      {isOpen && (
        <form onSubmit={submitReport} style={activePanelStyle}>
          <label
            style={{
              display: "grid",
              gap: 4,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            通報理由
            <select
              value={reasonType}
              onChange={(event) =>
                setReasonType(
                  event.target.value as (typeof reasonOptions)[number]["value"]
                )
              }
              style={{
                width: "100%",
                boxSizing: "border-box",
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                padding: "6px 8px",
                fontSize: 13,
              }}
            >
              {reasonOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label
            style={{
              display: "grid",
              gap: 4,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            補足（任意）
            <textarea
              value={reasonDetail}
              onChange={(event) => setReasonDetail(event.target.value.slice(0, 500))}
              maxLength={500}
              rows={3}
              placeholder="管理者に伝えたい点があれば短く書いてください。"
              style={{
                width: "100%",
                boxSizing: "border-box",
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                padding: 8,
                fontSize: 13,
                lineHeight: 1.5,
                resize: "vertical",
              }}
            />
          </label>

          <div
            style={{
              color: "#92400e",
              fontSize: 12,
              lineHeight: 1.5,
              fontWeight: 700,
            }}
          >
            通報理由に電話番号・住所・メールアドレスなどの個人情報を入力しないでください。
          </div>

          {message && (
            <div style={{ color: "#166534", fontSize: 12, fontWeight: 700 }}>
              {message}
            </div>
          )}
          {error && (
            <div style={{ color: "#b91c1c", fontSize: 12, fontWeight: 700 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                border: "1px solid #1d4ed8",
                borderRadius: 999,
                background: isSubmitting ? "#93c5fd" : "#2563eb",
                color: "#fff",
                cursor: isSubmitting ? "wait" : "pointer",
                fontSize: 12,
                fontWeight: 800,
                padding: "6px 10px",
              }}
            >
              {isSubmitting ? "送信中..." : "通報を送信"}
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                border: "1px solid #d1d5db",
                borderRadius: 999,
                background: "#fff",
                color: "#374151",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
                padding: "6px 10px",
              }}
            >
              閉じる
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
