"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";

type PeriodFilter = "six_months" | "one_year" | "all";
type TargetKind = "thread_summary" | "logic_score" | "both";

type SampleTarget = {
  target_type: string;
  id: string;
  title: string;
  excerpt: string;
  category: string;
  logic_score: number | null;
  updated_at: string | null;
  current_prompt_version: string | null;
};

type PreviewResponse = {
  ok?: boolean;
  error?: string;
  unsupported_filters?: string[];
  notes?: string[];
  target_thread_count?: number;
  target_post_count?: number;
  estimated_api_calls?: number;
  estimated_input_tokens?: number;
  estimated_output_tokens?: number;
  estimated_total_tokens?: number;
  estimated_cost_usd?: number | null;
  sample_targets?: SampleTarget[];
  estimate_assumptions?: {
    thread_summary?: {
      model: string;
      input_tokens_per_call: number;
      output_tokens_per_call: number;
    };
    logic_score?: {
      model: string;
      input_tokens_per_call: number;
      output_tokens_per_call: number;
    };
  };
};

type BulkRefreshJobItem = {
  id: string;
  target_type: string;
  target_id: string;
  status: string;
  previous_version_id?: string | null;
  new_version_id?: string | null;
  actual_total_tokens?: number | null;
  actual_cost_usd?: number | null;
  error_message?: string | null;
  created_at?: string | null;
  completed_at?: string | null;
};

type BulkRefreshJob = {
  id: string;
  status: string;
  target_type: string;
  max_items: number;
  success_count: number;
  failed_count: number;
  skipped_count: number;
  actual_api_calls?: number | null;
  actual_total_tokens?: number | null;
  actual_cost_usd?: number | null;
  error_message?: string | null;
  created_at?: string | null;
  completed_at?: string | null;
  items?: BulkRefreshJobItem[];
};

type RunResponse = {
  ok?: boolean;
  error?: string;
  prompt_version?: string;
  model?: string;
  job?: BulkRefreshJob & {
    actual_input_tokens?: number | null;
    actual_output_tokens?: number | null;
    actual_total_tokens?: number | null;
    actual_cost_usd?: number | null;
  };
  items?: BulkRefreshJobItem[];
};

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#f8fafc",
  color: "#111827",
  padding: "24px 16px 48px",
};

const containerStyle: CSSProperties = {
  maxWidth: 1120,
  margin: "0 auto",
};

const cardStyle: CSSProperties = {
  border: "1px solid #dbe3ef",
  borderRadius: 10,
  background: "#ffffff",
  boxShadow: "0 8px 22px rgba(15, 23, 42, 0.05)",
  padding: 18,
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
  gap: 12,
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: 6,
};

const labelStyle: CSSProperties = {
  color: "#334155",
  fontSize: 13,
  fontWeight: 800,
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#ffffff",
  color: "#111827",
  padding: "10px 12px",
};

const buttonStyle: CSSProperties = {
  border: "1px solid #111827",
  borderRadius: 8,
  background: "#111827",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 900,
  padding: "11px 16px",
};

const linkStyle: CSSProperties = {
  color: "#2563eb",
  fontWeight: 800,
  textDecoration: "none",
};

function formatNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return value.toLocaleString("ja-JP");
}

function formatCost(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "単価未設定";
  return `$${value.toFixed(value < 0.01 ? 6 : 4)}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP");
}

function statCard(label: string, value: string, helper?: string) {
  return (
    <div style={{ ...cardStyle, padding: 14 }}>
      <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>
        {label}
      </div>
      <div style={{ marginTop: 6, fontSize: 26, fontWeight: 950 }}>{value}</div>
      {helper && (
        <div style={{ marginTop: 6, color: "#64748b", fontSize: 12, lineHeight: 1.5 }}>
          {helper}
        </div>
      )}
    </div>
  );
}

export default function ForumAdminBulkRefreshPreviewPage() {
  const params = useParams();
  const tenantParam = params?.tenant;
  const tenant = Array.isArray(tenantParam)
    ? tenantParam[0] ?? "dev"
    : tenantParam ?? "dev";
  const [period, setPeriod] = useState<PeriodFilter>("six_months");
  const [category, setCategory] = useState("all");
  const [targetKind, setTargetKind] = useState<TargetKind>("both");
  const [minLogicScore, setMinLogicScore] = useState("");
  const [includeNoLogicScore, setIncludeNoLogicScore] = useState(true);
  const [excludeHiddenDeleted, setExcludeHiddenDeleted] = useState(true);
  const [excludeUpToDatePromptVersion, setExcludeUpToDatePromptVersion] =
    useState(false);
  const [adminKey, setAdminKey] = useState("");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [maxRunItems, setMaxRunItems] = useState(3);
  const [confirmNoOverwrite, setConfirmNoOverwrite] = useState(false);
  const [confirmCost, setConfirmCost] = useState(false);
  const [confirmMaxTen, setConfirmMaxTen] = useState(false);
  const [runLoading, setRunLoading] = useState(false);
  const [runMessage, setRunMessage] = useState("");
  const [runResult, setRunResult] = useState<RunResponse | null>(null);
  const [jobs, setJobs] = useState<BulkRefreshJob[]>([]);
  const [jobsMessage, setJobsMessage] = useState("");

  async function runPreview() {
    const requestAdminKey = adminKey.trim();

    setLoading(true);
    setMessage("");
    setPreview(null);

    try {
      const response = await fetch("/api/forum/admin/bulk-refresh/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(requestAdminKey ? { "x-admin-key": requestAdminKey } : {}),
        },
        body: JSON.stringify({
          period,
          category,
          targetKind,
          minLogicScore: minLogicScore.trim() || null,
          includeNoLogicScore,
          excludeHiddenDeleted,
          excludeUpToDatePromptVersion,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as PreviewResponse;

      if (!response.ok || data.ok !== true) {
        setMessage(
          data.error ||
            "プレビューを取得できませんでした。管理セッションが切れている場合は、管理トップで再認証してください。"
        );
        return;
      }

      setPreview(data);
      setAdminKey("");
    } catch {
      setMessage("通信エラーが発生しました。もう一度お試しください。");
    } finally {
      setLoading(false);
    }
  }

  async function loadJobs(requestAdminKey = "") {
    setJobsMessage("");

    try {
      const response = await fetch("/api/forum/admin/bulk-refresh/jobs", {
        headers: requestAdminKey ? { "x-admin-key": requestAdminKey } : {},
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        jobs?: BulkRefreshJob[];
      };

      if (!response.ok || data.ok !== true) {
        setJobs([]);
        setJobsMessage(
          data.error
            ? `実行履歴を取得できませんでした: ${data.error}`
            : "管理セッションがないため、実行履歴は未取得です。"
        );
        return;
      }

      setJobs(data.jobs ?? []);
    } catch {
      setJobsMessage("実行履歴の取得で通信エラーが発生しました。");
    }
  }

  async function runThreadSummaryTest() {
    const requestAdminKey = adminKey.trim();

    setRunLoading(true);
    setRunMessage("");
    setRunResult(null);

    try {
      const response = await fetch("/api/forum/admin/bulk-refresh/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(requestAdminKey ? { "x-admin-key": requestAdminKey } : {}),
        },
        body: JSON.stringify({
          period,
          category,
          target_type: "thread_summary",
          max_items: maxRunItems,
          excludeHiddenDeleted,
          confirmNoOverwrite,
          confirmCost,
          confirmMaxTen,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as RunResponse;

      if (!response.ok || data.ok !== true) {
        setRunMessage(data.error || "スレッド要約テスト実行に失敗しました。");
        return;
      }

      setRunResult(data);
      setRunMessage("スレッド要約テスト実行が完了しました。");
      setAdminKey("");
      await loadJobs(requestAdminKey);
    } catch {
      setRunMessage("テスト実行中に通信エラーが発生しました。");
    } finally {
      setRunLoading(false);
    }
  }

  useEffect(() => {
    void loadJobs();
  }, []);

  const samples = preview?.sample_targets ?? [];
  const canRunThreadSummaryTest =
    Boolean(preview) &&
    confirmNoOverwrite &&
    confirmCost &&
    confirmMaxTen &&
    !runLoading;

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <nav
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <Link href={`/${tenant}/forum/admin`} style={linkStyle}>
            管理メニューへ戻る
          </Link>
          <Link href={`/${tenant}/forum`} style={linkStyle}>
            Forumトップへ戻る
          </Link>
        </nav>

        <header style={{ marginBottom: 18 }}>
          <p style={{ margin: "0 0 6px", color: "#64748b", fontWeight: 800 }}>
            Forum Admin
          </p>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 950 }}>
            一括再整理プレビュー
          </h1>
          <p style={{ margin: "10px 0 0", color: "#475569", lineHeight: 1.7 }}>
            条件に合う既存スレッド・投稿を数え、AI再整理を実行した場合のAPI回数、
            token、推定費用だけを確認します。この画面ではOpenAI APIを呼びません。
          </p>
        </header>

        <section style={{ ...cardStyle, marginBottom: 18 }}>
          <h2 style={{ margin: "0 0 14px", fontSize: 20 }}>対象条件</h2>
          <div style={gridStyle}>
            <label style={fieldStyle}>
              <span style={labelStyle}>期間</span>
              <select
                value={period}
                onChange={(event) => setPeriod(event.target.value as PeriodFilter)}
                style={inputStyle}
              >
                <option value="six_months">半年以内</option>
                <option value="one_year">1年以内</option>
                <option value="all">全期間</option>
              </select>
            </label>

            <label style={fieldStyle}>
              <span style={labelStyle}>カテゴリー</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                style={inputStyle}
              >
                <option value="all">全カテゴリー</option>
                <option value="経済・政策">経済・政策</option>
                <option value="AI・技術">AI・技術</option>
                <option value="特許・発明">特許・発明</option>
                <option value="生活・健康">生活・健康</option>
                <option value="その他">その他</option>
              </select>
            </label>

            <label style={fieldStyle}>
              <span style={labelStyle}>対象種別</span>
              <select
                value={targetKind}
                onChange={(event) => setTargetKind(event.target.value as TargetKind)}
                style={inputStyle}
              >
                <option value="both">スレッド要約 + 論理スコア</option>
                <option value="thread_summary">スレッド要約</option>
                <option value="logic_score">論理スコア</option>
              </select>
            </label>

            <label style={fieldStyle}>
              <span style={labelStyle}>論理スコア条件</span>
              <input
                type="number"
                min={0}
                max={100}
                value={minLogicScore}
                onChange={(event) => setMinLogicScore(event.target.value)}
                placeholder="例: 50"
                style={inputStyle}
              />
            </label>
          </div>

          <div
            style={{
              display: "grid",
              gap: 10,
              marginTop: 14,
              color: "#334155",
              lineHeight: 1.6,
            }}
          >
            <label>
              <input
                type="checkbox"
                checked={includeNoLogicScore}
                onChange={(event) => setIncludeNoLogicScore(event.target.checked)}
              />{" "}
              論理スコアなしを含める
            </label>
            <label>
              <input
                type="checkbox"
                checked={excludeHiddenDeleted}
                onChange={(event) => setExcludeHiddenDeleted(event.target.checked)}
              />{" "}
              非表示・削除済みを除外する
            </label>
            <label>
              <input
                type="checkbox"
                checked={excludeUpToDatePromptVersion}
                onChange={(event) =>
                  setExcludeUpToDatePromptVersion(event.target.checked)
                }
              />{" "}
              既に新prompt_version済みを除外する（現状は未対応として表示）
            </label>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              alignItems: "end",
              marginTop: 16,
            }}
          >
            <label style={{ ...fieldStyle, flex: "1 1 260px" }}>
              <span style={labelStyle}>ADMIN_KEY fallback</span>
              <input
                type="password"
                autoComplete="new-password"
                value={adminKey}
                onChange={(event) => setAdminKey(event.target.value)}
                placeholder="管理セッションが切れた場合のみ入力"
                style={inputStyle}
              />
            </label>
            <button
              type="button"
              onClick={() => void runPreview()}
              disabled={loading}
              style={{ ...buttonStyle, opacity: loading ? 0.65 : 1 }}
            >
              {loading ? "確認中..." : "対象件数と推定費用を確認"}
            </button>
          </div>

          {message && (
            <p style={{ margin: "12px 0 0", color: "#991b1b", fontWeight: 800 }}>
              {message}
            </p>
          )}
        </section>

        {preview && (
          <>
            <section style={{ ...gridStyle, marginBottom: 18 }}>
              {statCard("対象スレッド", formatNumber(preview.target_thread_count))}
              {statCard("対象投稿", formatNumber(preview.target_post_count))}
              {statCard("推定API回数", formatNumber(preview.estimated_api_calls))}
              {statCard("推定コスト", formatCost(preview.estimated_cost_usd), "USD")}
              {statCard("input token", formatNumber(preview.estimated_input_tokens))}
              {statCard("output token", formatNumber(preview.estimated_output_tokens))}
              {statCard("total token", formatNumber(preview.estimated_total_tokens))}
            </section>

            <section style={{ ...cardStyle, marginBottom: 18 }}>
              <h2 style={{ margin: "0 0 12px", fontSize: 20 }}>推定前提</h2>
              <div style={gridStyle}>
                <div>
                  <strong>スレッド要約</strong>
                  <p style={{ margin: "6px 0 0", color: "#475569", lineHeight: 1.7 }}>
                    model: {preview.estimate_assumptions?.thread_summary?.model ?? "-"}
                    <br />
                    1回あたり input{" "}
                    {formatNumber(
                      preview.estimate_assumptions?.thread_summary
                        ?.input_tokens_per_call
                    )}{" "}
                    / output{" "}
                    {formatNumber(
                      preview.estimate_assumptions?.thread_summary
                        ?.output_tokens_per_call
                    )}
                  </p>
                </div>
                <div>
                  <strong>論理スコア</strong>
                  <p style={{ margin: "6px 0 0", color: "#475569", lineHeight: 1.7 }}>
                    model: {preview.estimate_assumptions?.logic_score?.model ?? "-"}
                    <br />
                    1回あたり input{" "}
                    {formatNumber(
                      preview.estimate_assumptions?.logic_score
                        ?.input_tokens_per_call
                    )}{" "}
                    / output{" "}
                    {formatNumber(
                      preview.estimate_assumptions?.logic_score
                        ?.output_tokens_per_call
                    )}
                  </p>
                </div>
              </div>
              {preview.unsupported_filters?.length ? (
                <p style={{ margin: "12px 0 0", color: "#92400e", lineHeight: 1.7 }}>
                  prompt_versionによる除外は、現状の保存データでは判定できないため未適用です。
                </p>
              ) : null}
            </section>

            <section style={{ ...cardStyle, marginBottom: 18 }}>
              <h2 style={{ margin: "0 0 12px", fontSize: 20 }}>
                対象サンプル
              </h2>
              {samples.length === 0 ? (
                <div
                  style={{
                    border: "1px dashed #cbd5e1",
                    borderRadius: 8,
                    background: "#f8fafc",
                    color: "#64748b",
                    padding: 18,
                    textAlign: "center",
                  }}
                >
                  条件に合う対象はありません。
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      minWidth: 760,
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                        <th style={{ padding: 10 }}>種別</th>
                        <th style={{ padding: 10 }}>タイトル/抜粋</th>
                        <th style={{ padding: 10 }}>カテゴリ</th>
                        <th style={{ padding: 10 }}>スコア</th>
                        <th style={{ padding: 10 }}>日時</th>
                      </tr>
                    </thead>
                    <tbody>
                      {samples.map((sample) => (
                        <tr key={`${sample.target_type}-${sample.id}`}>
                          <td style={{ borderTop: "1px solid #e2e8f0", padding: 10 }}>
                            {sample.target_type}
                          </td>
                          <td style={{ borderTop: "1px solid #e2e8f0", padding: 10 }}>
                            <strong>{sample.title}</strong>
                            <div style={{ color: "#64748b", marginTop: 4 }}>
                              {sample.excerpt || "-"}
                            </div>
                          </td>
                          <td style={{ borderTop: "1px solid #e2e8f0", padding: 10 }}>
                            {sample.category}
                          </td>
                          <td style={{ borderTop: "1px solid #e2e8f0", padding: 10 }}>
                            {sample.logic_score ?? "-"}
                          </td>
                          <td style={{ borderTop: "1px solid #e2e8f0", padding: 10 }}>
                            {formatDate(sample.updated_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        <section style={{ ...cardStyle, marginBottom: 18 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 20 }}>
            スレッド要約テスト実行
          </h2>
          <p style={{ margin: "0 0 12px", color: "#475569", lineHeight: 1.7 }}>
            最大10件だけOpenAI APIを実行し、結果を新versionとして保存します。
            既存AI回答、既存投稿本文、thread_ai_structures、forum_posts は上書きしません。
            本番表示にもまだ反映しません。
          </p>

          <div
            style={{
              border: "1px solid #bfdbfe",
              borderRadius: 8,
              background: "#eff6ff",
              color: "#1e3a8a",
              padding: 12,
              lineHeight: 1.7,
              marginBottom: 14,
            }}
          >
            <strong>対象種別:</strong> スレッド要約のみ
            <br />
            <span>論理スコア再評価は今回未対応です。</span>
          </div>

          <div style={gridStyle}>
            <label style={fieldStyle}>
              <span style={labelStyle}>最大実行件数</span>
              <input
                type="number"
                min={1}
                max={10}
                value={maxRunItems}
                onChange={(event) =>
                  setMaxRunItems(
                    Math.max(1, Math.min(10, Math.floor(Number(event.target.value) || 1)))
                  )
                }
                style={inputStyle}
              />
            </label>
            <div style={{ ...fieldStyle, color: "#475569", lineHeight: 1.7 }}>
              <span style={labelStyle}>実行条件</span>
              <span>現在のプレビュー条件と同じ期間・カテゴリーで抽出します。</span>
              <span>サーバー側でも10件以下に強制します。</span>
            </div>
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 14, lineHeight: 1.7 }}>
            <label>
              <input
                type="checkbox"
                checked={confirmNoOverwrite}
                onChange={(event) => setConfirmNoOverwrite(event.target.checked)}
              />{" "}
              過去ログを上書きしないことを確認しました
            </label>
            <label>
              <input
                type="checkbox"
                checked={confirmCost}
                onChange={(event) => setConfirmCost(event.target.checked)}
              />{" "}
              推定費用を確認しました
            </label>
            <label>
              <input
                type="checkbox"
                checked={confirmMaxTen}
                onChange={(event) => setConfirmMaxTen(event.target.checked)}
              />{" "}
              最大10件だけ実行することを確認しました
            </label>
          </div>

          <div style={{ marginTop: 16 }}>
            <button
              type="button"
              onClick={() => void runThreadSummaryTest()}
              disabled={!canRunThreadSummaryTest}
              style={{
                ...buttonStyle,
                opacity: canRunThreadSummaryTest ? 1 : 0.55,
                cursor: canRunThreadSummaryTest ? "pointer" : "not-allowed",
              }}
            >
              {runLoading ? "テスト実行中..." : "スレッド要約を最大10件だけテスト実行"}
            </button>
            {!preview && (
              <p style={{ margin: "10px 0 0", color: "#92400e", lineHeight: 1.7 }}>
                先にプレビューを実行して、対象件数と推定費用を確認してください。
              </p>
            )}
          </div>

          {runMessage && (
            <p
              style={{
                margin: "12px 0 0",
                color: runResult?.ok ? "#166534" : "#991b1b",
                fontWeight: 800,
              }}
            >
              {runMessage}
            </p>
          )}

          {runResult?.job && (
            <div style={{ ...gridStyle, marginTop: 16 }}>
              {statCard("job id", runResult.job.id)}
              {statCard("成功", formatNumber(runResult.job.success_count))}
              {statCard("skipped", formatNumber(runResult.job.skipped_count))}
              {statCard("失敗", formatNumber(runResult.job.failed_count))}
              {statCard("実token", formatNumber(runResult.job.actual_total_tokens))}
              {statCard("実コスト", formatCost(runResult.job.actual_cost_usd), "USD")}
            </div>
          )}
        </section>

        <section style={{ ...cardStyle, marginBottom: 18 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 20 }}>テスト実行履歴</h2>
            <button
              type="button"
              onClick={() => void loadJobs(adminKey.trim())}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                background: "#ffffff",
                color: "#111827",
                cursor: "pointer",
                fontWeight: 800,
                padding: "8px 12px",
              }}
            >
              再読み込み
            </button>
          </div>

          {jobsMessage && (
            <p style={{ margin: "0 0 12px", color: "#92400e", lineHeight: 1.7 }}>
              {jobsMessage}
            </p>
          )}

          {jobs.length === 0 ? (
            <div
              style={{
                border: "1px dashed #cbd5e1",
                borderRadius: 8,
                background: "#f8fafc",
                color: "#64748b",
                padding: 18,
                textAlign: "center",
              }}
            >
              まだテスト実行履歴はありません。
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: 860,
                }}
              >
                <thead>
                  <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                    <th style={{ padding: 10 }}>job</th>
                    <th style={{ padding: 10 }}>status</th>
                    <th style={{ padding: 10 }}>target</th>
                    <th style={{ padding: 10 }}>成功</th>
                    <th style={{ padding: 10 }}>skipped</th>
                    <th style={{ padding: 10 }}>失敗</th>
                    <th style={{ padding: 10 }}>API</th>
                    <th style={{ padding: 10 }}>token</th>
                    <th style={{ padding: 10 }}>cost</th>
                    <th style={{ padding: 10 }}>完了日時</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id}>
                      <td style={{ borderTop: "1px solid #e2e8f0", padding: 10 }}>
                        <code>{job.id}</code>
                      </td>
                      <td style={{ borderTop: "1px solid #e2e8f0", padding: 10 }}>
                        {job.status}
                      </td>
                      <td style={{ borderTop: "1px solid #e2e8f0", padding: 10 }}>
                        {job.target_type} / max {job.max_items}
                      </td>
                      <td style={{ borderTop: "1px solid #e2e8f0", padding: 10 }}>
                        {formatNumber(job.success_count)}
                      </td>
                      <td style={{ borderTop: "1px solid #e2e8f0", padding: 10 }}>
                        {formatNumber(job.skipped_count)}
                      </td>
                      <td style={{ borderTop: "1px solid #e2e8f0", padding: 10 }}>
                        {formatNumber(job.failed_count)}
                      </td>
                      <td style={{ borderTop: "1px solid #e2e8f0", padding: 10 }}>
                        {formatNumber(job.actual_api_calls)}
                      </td>
                      <td style={{ borderTop: "1px solid #e2e8f0", padding: 10 }}>
                        {formatNumber(job.actual_total_tokens)}
                      </td>
                      <td style={{ borderTop: "1px solid #e2e8f0", padding: 10 }}>
                        {formatCost(job.actual_cost_usd)}
                      </td>
                      <td style={{ borderTop: "1px solid #e2e8f0", padding: 10 }}>
                        {formatDate(job.completed_at || job.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section
          style={{
            ...cardStyle,
            border: "1px solid #fde68a",
            background: "#fffbeb",
            color: "#78350f",
          }}
        >
          <h2 style={{ margin: "0 0 10px", fontSize: 20 }}>過去ログ保護方針</h2>
          <p style={{ margin: 0, lineHeight: 1.8 }}>
            この画面は対象件数と推定費用を確認するだけです。まだAI再整理は実行しません。
            将来実行する場合も、既存のAI回答や投稿本文を直接上書きせず、
            新しいprompt_versionとして履歴保存する方針です。
          </p>
          <ul style={{ margin: "10px 0 0", lineHeight: 1.8 }}>
            <li>既存投稿本文は上書きしない</li>
            <li>既存AI回答を消さない</li>
            <li>新しいAI整理は別versionとして保存する</li>
            <li>実行前に対象件数と推定費用を表示する</li>
            <li>最大10件ずつなど少量実行にする</li>
            <li>管理者確認後のみ実行する</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
