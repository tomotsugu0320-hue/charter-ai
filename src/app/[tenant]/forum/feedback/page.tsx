"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import ForumHamburgerMenu from "@/components/forum/ForumHamburgerMenu";

const pageStyle: CSSProperties = {
  maxWidth: 820,
  margin: "0 auto",
  padding: "24px 16px 56px",
  color: "#111827",
};

const cardStyle: CSSProperties = {
  border: "1px solid #dbe3ef",
  borderRadius: 10,
  background: "#ffffff",
  boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
  padding: 18,
};

const labelStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  fontWeight: 800,
  lineHeight: 1.5,
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#ffffff",
  color: "#111827",
  font: "inherit",
  padding: "10px 12px",
};

const reportTypeOptions = [
  { value: "bug", label: "不具合" },
  { value: "display", label: "表示が見づらい" },
  { value: "unclear", label: "内容が分かりにくい" },
  { value: "link", label: "リンク切れ" },
  { value: "ai_output", label: "AI整理への改善要望" },
  { value: "request", label: "改善要望" },
  { value: "other", label: "その他" },
];

const deviceOptions = [
  { value: "pc", label: "PC" },
  { value: "smartphone", label: "スマホ" },
  { value: "tablet", label: "タブレット" },
  { value: "unknown", label: "不明" },
];

export default function ForumFeedbackPage() {
  const params = useParams();
  const tenantParam = params?.tenant;
  const tenant = Array.isArray(tenantParam)
    ? tenantParam[0] ?? "dev"
    : tenantParam ?? "dev";

  const [reportType, setReportType] = useState("bug");
  const [deviceType, setDeviceType] = useState("unknown");
  const [pageUrl, setPageUrl] = useState("");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const initialUrl = document.referrer || window.location.href;
    setPageUrl(initialUrl.slice(0, 1000));
  }, []);

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccessMessage("");
    setErrorMessage("");

    if (!message.trim()) {
      setErrorMessage("内容を入力してください。");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/forum/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant,
          page_url: pageUrl,
          report_type: reportType,
          device_type: deviceType,
          message,
          contact,
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || result?.ok === false) {
        setErrorMessage(
          result?.error ||
            "報告を送信できませんでした。時間をおいて再度お試しください。"
        );
        return;
      }

      setSuccessMessage("報告ありがとうございました。確認して改善に使います。");
      setMessage("");
      setContact("");
    } catch {
      setErrorMessage(
        "報告を送信できませんでした。通信状況を確認して再度お試しください。"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main style={pageStyle}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <Link
          href={`/${tenant}/forum`}
          style={{ color: "#2563eb", fontWeight: 900, textDecoration: "none" }}
        >
          AI知恵袋 Forum
        </Link>
        <ForumHamburgerMenu tenant={tenant} />
      </header>

      <section style={{ marginBottom: 18 }}>
        <p
          style={{
            margin: "0 0 8px",
            color: "#2563eb",
            fontSize: 13,
            fontWeight: 900,
          }}
        >
          公開ベータの改善に使います
        </p>
        <h1 style={{ margin: "0 0 10px", fontSize: 30, fontWeight: 900 }}>
          不具合・改善を報告
        </h1>
        <p style={{ margin: 0, color: "#475569", lineHeight: 1.8 }}>
          表示崩れ、リンク切れ、スマホで見づらい箇所、AI整理が分かりにくい箇所などを送れます。
          投稿内容そのものの問題は、投稿カードの「通報」から知らせてください。
        </p>
      </section>

      <form onSubmit={submitFeedback} style={{ ...cardStyle, display: "grid", gap: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
            gap: 14,
          }}
        >
          <label style={labelStyle}>
            種類
            <select
              value={reportType}
              onChange={(event) => setReportType(event.target.value)}
              style={inputStyle}
            >
              {reportTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label style={labelStyle}>
            端末
            <select
              value={deviceType}
              onChange={(event) => setDeviceType(event.target.value)}
              style={inputStyle}
            >
              {deviceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label style={labelStyle}>
          ページURL
          <input
            value={pageUrl}
            onChange={(event) => setPageUrl(event.target.value.slice(0, 1000))}
            placeholder="問題があったページのURL"
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          内容 <span style={{ color: "#dc2626" }}>必須</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value.slice(0, 2000))}
            required
            rows={7}
            placeholder="どの画面で、何が起きたかを書いてください。例：スマホでカードが横にはみ出す、リンク先が違う、AI整理の説明が分かりにくい"
            style={{ ...inputStyle, lineHeight: 1.7, resize: "vertical" }}
          />
        </label>

        <label style={labelStyle}>
          連絡先 <span style={{ color: "#64748b", fontWeight: 600 }}>任意</span>
          <input
            value={contact}
            onChange={(event) => setContact(event.target.value.slice(0, 200))}
            placeholder="返信が必要な場合だけ入力してください"
            style={inputStyle}
          />
        </label>

        <p
          style={{
            margin: 0,
            border: "1px solid #fde68a",
            borderRadius: 8,
            background: "#fffbeb",
            color: "#92400e",
            lineHeight: 1.7,
            padding: "10px 12px",
          }}
        >
          報告内容には、電話番号・住所・メールアドレスなどの個人情報をできるだけ書かないでください。
        </p>

        {errorMessage && (
          <div
            style={{
              border: "1px solid #fecaca",
              borderRadius: 8,
              background: "#fef2f2",
              color: "#991b1b",
              fontWeight: 800,
              padding: "10px 12px",
            }}
          >
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div
            style={{
              border: "1px solid #bbf7d0",
              borderRadius: 8,
              background: "#f0fdf4",
              color: "#166534",
              fontWeight: 800,
              padding: "10px 12px",
            }}
          >
            {successMessage}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              border: "1px solid #2563eb",
              borderRadius: 999,
              background: "#2563eb",
              color: "#ffffff",
              cursor: isSubmitting ? "wait" : "pointer",
              fontWeight: 900,
              padding: "10px 16px",
            }}
          >
            {isSubmitting ? "送信中..." : "報告を送信する"}
          </button>
          <Link
            href={`/${tenant}/forum`}
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 999,
              color: "#334155",
              fontWeight: 900,
              padding: "10px 16px",
              textDecoration: "none",
            }}
          >
            Forumトップへ戻る
          </Link>
        </div>
      </form>
    </main>
  );
}
