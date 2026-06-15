"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";

type PeriodFilter = "six_months" | "one_year" | "all";
type TargetKind = "thread_summary" | "logic_score" | "both";
type VersionStatusFilter = "all" | "unapplied" | "applied" | "empty";
type VersionStatus = "unapplied" | "applied" | "empty";

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

type ApplyVersionResponse = {
  ok?: boolean;
  error?: string;
  version?: {
    id: string;
    thread_id: string;
    is_applied: boolean;
    applied_at?: string | null;
  };
};

type ApplyLogicScoreVersionResponse = {
  ok?: boolean;
  error?: string;
  version?: {
    id: string;
    post_id: string;
    is_applied: boolean;
    applied_at?: string | null;
  };
  post?: {
    id: string;
    logic_score?: number | null;
    logic_score_reason?: string | null;
    logic_break_type?: string | null;
    logic_break_note?: string | null;
  };
};

type SummaryComparePayload = {
  thread_id?: string | null;
  summary_text?: string | null;
  provisional_answer?: string | null;
  evidence_text?: string | null;
  counterargument_text?: string | null;
  related_topics?: unknown;
};

type ThreadSummaryVersion = {
  id: string;
  thread_id: string;
  thread_title?: string | null;
  job_id?: string | null;
  job_item_id?: string | null;
  prompt_version: string;
  model?: string | null;
  is_applied: boolean;
  applied_at?: string | null;
  version_status?: VersionStatus;
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
  actual_cost_usd?: number | null;
  created_at?: string | null;
  summary_text?: string | null;
  summary_excerpt?: string | null;
  provisional_answer?: string | null;
  evidence_text?: string | null;
  counterargument_text?: string | null;
  related_topics?: unknown;
  structure_json?: unknown;
  raw_result?: unknown;
  current_summary?: SummaryComparePayload | null;
  thread?: {
    id?: string;
    title?: string | null;
    category?: string | null;
    created_at?: string | null;
  } | null;
};

type LogicScoreVersion = {
  id: string;
  post_id: string;
  thread_id?: string | null;
  thread_title?: string | null;
  thread_category?: string | null;
  post_excerpt?: string | null;
  current_logic_score?: number | null;
  current_logic_score_reason?: string | null;
  job_id?: string | null;
  job_item_id?: string | null;
  prompt_version: string;
  model?: string | null;
  logic_score?: number | null;
  logic_score_reason?: string | null;
  logic_break_type?: string | null;
  logic_break_note?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
  actual_cost_usd?: number | null;
  is_applied: boolean;
  applied_at?: string | null;
  created_at?: string | null;
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

function shortInlineText(value: string | null | undefined, maxLength = 110) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function shortId(value: string | null | undefined, maxLength = 8) {
  const text = String(value ?? "").trim();
  if (!text) return "-";
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
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

function formatUnknownJson(value: unknown) {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value || "-";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function isPlaceholderVersionSummary(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  return (
    !text ||
    text.includes("AI整理結果を取得しました") ||
    text.includes("AI謨ｴ逅")
  );
}

function getVersionStatus(version: ThreadSummaryVersion): VersionStatus {
  if (version.version_status === "unapplied" || version.version_status === "applied" || version.version_status === "empty") {
    return version.version_status;
  }
  if (isPlaceholderVersionSummary(version.summary_text)) return "empty";
  if (version.is_applied) return "applied";
  return "unapplied";
}

function getVersionStatusMeta(status: VersionStatus) {
  if (status === "applied") {
    return {
      label: "適用済み",
      border: "#bbf7d0",
      background: "#f0fdf4",
      color: "#166534",
    };
  }
  if (status === "empty") {
    return {
      label: "本文なし / 失敗",
      border: "#fed7aa",
      background: "#fff7ed",
      color: "#9a3412",
    };
  }
  return {
    label: "未適用",
    border: "#bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
  };
}

function VersionStatusBadge({ status }: { status: VersionStatus }) {
  const meta = getVersionStatusMeta(status);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        border: `1px solid ${meta.border}`,
        borderRadius: 999,
        background: meta.background,
        color: meta.color,
        fontSize: 12,
        fontWeight: 900,
        padding: "4px 8px",
        whiteSpace: "nowrap",
      }}
    >
      {meta.label}
    </span>
  );
}

function compareTextBlock(label: string, oldValue?: string | null, newValue?: string | null) {
  const boxStyle: CSSProperties = {
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    background: "#f8fafc",
    padding: 12,
    minHeight: 96,
    whiteSpace: "pre-wrap",
    lineHeight: 1.7,
    color: "#334155",
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <h4 style={{ margin: 0, fontSize: 15 }}>{label}</h4>
      <div style={gridStyle}>
        <div>
          <div style={{ ...labelStyle, marginBottom: 6 }}>旧データ</div>
          <div style={boxStyle}>{oldValue?.trim() || "旧データ未取得"}</div>
        </div>
        <div>
          <div style={{ ...labelStyle, marginBottom: 6 }}>新version</div>
          <div style={boxStyle}>{newValue?.trim() || "新version未取得"}</div>
        </div>
      </div>
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
  const [versions, setVersions] = useState<ThreadSummaryVersion[]>([]);
  const [versionsMessage, setVersionsMessage] = useState("");
  const [logicScoreVersions, setLogicScoreVersions] = useState<LogicScoreVersion[]>([]);
  const [logicScoreVersionsMessage, setLogicScoreVersionsMessage] = useState("");
  const [versionStatusFilter, setVersionStatusFilter] =
    useState<VersionStatusFilter>("all");
  const [versionPromptFilter, setVersionPromptFilter] = useState("all");
  const [versionSearchText, setVersionSearchText] = useState("");
  const [selectedVersion, setSelectedVersion] =
    useState<ThreadSummaryVersion | null>(null);
  const [versionLoadingId, setVersionLoadingId] = useState("");
  const latestVersionRequestRef = useRef("");
  const [applyConfirm, setApplyConfirm] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyMessage, setApplyMessage] = useState("");
  const [logicScoreApplyConfirmId, setLogicScoreApplyConfirmId] = useState("");
  const [logicScoreApplyLoadingId, setLogicScoreApplyLoadingId] = useState("");
  const [logicScoreApplyMessage, setLogicScoreApplyMessage] = useState("");

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

  async function loadVersions(requestAdminKey = "") {
    setVersionsMessage("");

    try {
      const response = await fetch("/api/forum/admin/bulk-refresh/versions", {
        headers: requestAdminKey ? { "x-admin-key": requestAdminKey } : {},
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        versions?: ThreadSummaryVersion[];
      };

      if (!response.ok || data.ok !== true) {
        setVersions([]);
        setVersionsMessage(
          data.error
            ? `生成済みversionを取得できませんでした: ${data.error}`
            : "管理セッションがないため、生成済みversionは未取得です。"
        );
        return;
      }

      setVersions(data.versions ?? []);
    } catch {
      setVersionsMessage("生成済みversionの取得で通信エラーが発生しました。");
    }
  }

  async function loadLogicScoreVersions(requestAdminKey = "") {
    setLogicScoreVersionsMessage("");

    try {
      const response = await fetch("/api/forum/admin/bulk-refresh/logic-score-versions", {
        headers: requestAdminKey ? { "x-admin-key": requestAdminKey } : {},
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        versions?: LogicScoreVersion[];
      };

      if (!response.ok || data.ok !== true) {
        setLogicScoreVersions([]);
        setLogicScoreVersionsMessage(
          data.error
            ? `logic_score versionを取得できませんでした: ${data.error}`
            : "管理セッションがないため、logic_score versionは未取得です。"
        );
        return;
      }

      setLogicScoreVersions(data.versions ?? []);
    } catch {
      setLogicScoreVersionsMessage("logic_score versionの取得で通信エラーが発生しました。");
    }
  }

  async function loadVersionDetail(versionId: string, requestAdminKey = "") {
    latestVersionRequestRef.current = versionId;
    setVersionLoadingId(versionId);
    setVersionsMessage("");
    setSelectedVersion(null);
    setApplyConfirm(false);
    setApplyMessage("");

    try {
      const response = await fetch(
        `/api/forum/admin/bulk-refresh/versions/${encodeURIComponent(versionId)}`,
        {
          headers: requestAdminKey ? { "x-admin-key": requestAdminKey } : {},
        }
      );
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        version?: ThreadSummaryVersion;
      };

      if (!response.ok || data.ok !== true || !data.version) {
        setVersionsMessage(data.error || "version詳細を取得できませんでした。");
        return;
      }

      if (latestVersionRequestRef.current !== versionId) {
        return;
      }

      setSelectedVersion(data.version);
    } catch {
      setVersionsMessage("version詳細の取得で通信エラーが発生しました。");
    } finally {
      if (latestVersionRequestRef.current === versionId) {
        setVersionLoadingId("");
      }
    }
  }

  async function applySelectedVersion() {
    if (!selectedVersion || !applyConfirm || applyLoading) return;

    const requestAdminKey = adminKey.trim();
    setApplyLoading(true);
    setApplyMessage("");

    try {
      const response = await fetch(
        `/api/forum/admin/bulk-refresh/versions/${encodeURIComponent(
          selectedVersion.id
        )}/apply`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(requestAdminKey ? { "x-admin-key": requestAdminKey } : {}),
          },
          body: JSON.stringify({
            confirmApply: true,
          }),
        }
      );
      const data = (await response.json().catch(() => ({}))) as ApplyVersionResponse;

      if (!response.ok || data.ok !== true) {
        setApplyMessage(data.error || "このversionを適用できませんでした。");
        return;
      }

      setApplyConfirm(false);
      await loadVersions(requestAdminKey);
      await loadVersionDetail(selectedVersion.id, requestAdminKey);
      setApplyMessage("このversionを1件だけ現行AI要約に反映しました。");
    } catch {
      setApplyMessage("version適用中に通信エラーが発生しました。");
    } finally {
      setApplyLoading(false);
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
      await loadVersions(requestAdminKey);
    } catch {
      setRunMessage("テスト実行中に通信エラーが発生しました。");
    } finally {
      setRunLoading(false);
    }
  }

  async function runLogicScoreTest() {
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
          target_type: "logic_score",
          max_items: maxRunItems,
          minLogicScore: minLogicScore.trim() || null,
          includeNoLogicScore,
          excludeHiddenDeleted,
          confirmNoOverwrite,
          confirmCost,
          confirmMaxTen,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as RunResponse;

      if (!response.ok || data.ok !== true) {
        setRunMessage(data.error || "logic_scoreテスト実行に失敗しました。");
        return;
      }

      setRunResult(data);
      setRunMessage("logic_scoreテスト実行が完了しました。");
      setAdminKey("");
      await loadJobs(requestAdminKey);
      await loadLogicScoreVersions(requestAdminKey);
    } catch {
      setRunMessage("logic_scoreテスト実行中に通信エラーが発生しました。");
    } finally {
      setRunLoading(false);
    }
  }

  async function applyLogicScoreVersion(version: LogicScoreVersion) {
    if (
      version.is_applied ||
      logicScoreApplyConfirmId !== version.id ||
      logicScoreApplyLoadingId
    ) {
      return;
    }

    const requestAdminKey = adminKey.trim();
    setLogicScoreApplyLoadingId(version.id);
    setLogicScoreApplyMessage("");

    try {
      const response = await fetch(
        `/api/forum/admin/bulk-refresh/logic-score-versions/${encodeURIComponent(
          version.id
        )}/apply`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(requestAdminKey ? { "x-admin-key": requestAdminKey } : {}),
          },
          body: JSON.stringify({
            confirmApply: true,
          }),
        }
      );
      const data = (await response.json().catch(() => ({}))) as ApplyLogicScoreVersionResponse;

      if (!response.ok || data.ok !== true) {
        setLogicScoreApplyMessage(data.error || "logic_score versionを適用できませんでした。");
        return;
      }

      setLogicScoreApplyConfirmId("");
      setLogicScoreApplyMessage("logic_score versionを1件だけ投稿評価に反映しました。");
      await loadLogicScoreVersions(requestAdminKey);
    } catch {
      setLogicScoreApplyMessage("logic_score version適用中に通信エラーが発生しました。");
    } finally {
      setLogicScoreApplyLoadingId("");
    }
  }

  useEffect(() => {
    void loadJobs();
    void loadVersions();
    void loadLogicScoreVersions();
  }, []);

  const samples = preview?.sample_targets ?? [];
  const versionPromptOptions = Array.from(
    new Set(versions.map((version) => version.prompt_version).filter(Boolean))
  );
  const normalizedVersionSearch = versionSearchText.trim().toLowerCase();
  const filteredVersions = versions.filter((version) => {
    const status = getVersionStatus(version);
    const matchesStatus =
      versionStatusFilter === "all" || status === versionStatusFilter;
    const matchesPrompt =
      versionPromptFilter === "all" || version.prompt_version === versionPromptFilter;
    const searchableText = [
      version.thread_title,
      version.thread?.title,
      version.thread_id,
      version.job_id,
      version.prompt_version,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesSearch =
      !normalizedVersionSearch || searchableText.includes(normalizedVersionSearch);

    return matchesStatus && matchesPrompt && matchesSearch;
  });
  const versionStatusCounts = versions.reduce<Record<VersionStatus | "total", number>>(
    (counts, version) => {
      const status = getVersionStatus(version);
      counts[status] += 1;
      counts.total += 1;
      return counts;
    },
    { total: 0, unapplied: 0, applied: 0, empty: 0 }
  );
  const canRunThreadSummaryTest =
    Boolean(preview) &&
    confirmNoOverwrite &&
    confirmCost &&
    confirmMaxTen &&
    !runLoading;
  const selectedVersionThreadMatched =
    !selectedVersion?.current_summary?.thread_id ||
    selectedVersion.current_summary.thread_id === selectedVersion.thread_id;
  const selectedVersionStatus = selectedVersion
    ? getVersionStatus(selectedVersion)
    : "empty";
  const canApplySelectedVersion =
    Boolean(selectedVersion) &&
    !selectedVersion?.is_applied &&
    selectedVersionStatus === "unapplied" &&
    selectedVersionThreadMatched &&
    applyConfirm &&
    !applyLoading;

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
          <h2 style={{ margin: "0 0 12px", fontSize: 20 }}>安全テスト実行</h2>
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
            <strong>対象種別:</strong> スレッド要約 / logic_score
            <br />
            <span>
              logic_scoreは forum_post_logic_score_versions に is_applied=false で保存します。
              forum_posts.logic_score は更新しません。
            </span>
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
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
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
              <button
                type="button"
                onClick={() => void runLogicScoreTest()}
                disabled={!canRunThreadSummaryTest}
                style={{
                  ...buttonStyle,
                  background: "#2563eb",
                  borderColor: "#2563eb",
                  opacity: canRunThreadSummaryTest ? 1 : 0.55,
                  cursor: canRunThreadSummaryTest ? "pointer" : "not-allowed",
                }}
              >
                {runLoading ? "テスト実行中..." : "logic_scoreを最大10件だけテスト実行"}
              </button>
            </div>
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
              {statCard("target", runResult.job.target_type)}
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
            <div>
              <h2 style={{ margin: 0, fontSize: 20 }}>生成済みlogic_score version</h2>
              <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.7 }}>
                logic_scoreテスト実行で保存された再評価versionの確認用です。
                未適用versionは確認チェック後、1件だけforum_postsへ反映できます。
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadLogicScoreVersions(adminKey.trim())}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                background: "#ffffff",
                color: "#111827",
                cursor: "pointer",
                fontWeight: 800,
                padding: "8px 12px",
                flex: "0 0 auto",
              }}
            >
              再読み込み
            </button>
          </div>

          {logicScoreVersionsMessage && (
            <p style={{ margin: "0 0 12px", color: "#92400e", lineHeight: 1.7 }}>
              {logicScoreVersionsMessage}
            </p>
          )}

          {logicScoreApplyMessage && (
            <p
              style={{
                margin: "0 0 12px",
                color: logicScoreApplyMessage.includes("反映しました") ? "#166534" : "#991b1b",
                fontWeight: 800,
                lineHeight: 1.7,
              }}
            >
              {logicScoreApplyMessage}
            </p>
          )}

          {logicScoreVersions.length === 0 ? (
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
              まだ生成済みlogic_score versionはありません。
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {logicScoreVersions.map((version) => (
                <article
                  key={version.id}
                  style={{
                    border: `1px solid ${version.is_applied ? "#bbf7d0" : "#dbe3ef"}`,
                    borderRadius: 10,
                    background: "#ffffff",
                    padding: 14,
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: "1 1 320px" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                        <span
                          style={{
                            border: `1px solid ${version.is_applied ? "#86efac" : "#bfdbfe"}`,
                            borderRadius: 999,
                            background: version.is_applied ? "#dcfce7" : "#eff6ff",
                            color: version.is_applied ? "#166534" : "#1d4ed8",
                            fontSize: 12,
                            fontWeight: 900,
                            padding: "4px 8px",
                          }}
                        >
                          {version.is_applied ? "適用済み" : "未適用"}
                        </span>
                        <span
                          style={{
                            border: `1px solid ${version.is_applied ? "#86efac" : "#fde68a"}`,
                            borderRadius: 999,
                            background: version.is_applied ? "#dcfce7" : "#fffbeb",
                            color: version.is_applied ? "#166534" : "#92400e",
                            fontSize: 12,
                            fontWeight: 900,
                            padding: "4px 8px",
                          }}
                        >
                          {version.is_applied
                            ? `applied_at: ${formatDate(version.applied_at)}`
                            : "1件だけ適用候補"}
                        </span>
                      </div>
                      <h3 style={{ margin: 0, fontSize: 17, lineHeight: 1.4 }}>
                        {version.thread_title || "スレッド未取得"}
                      </h3>
                      <p
                        style={{
                          margin: "8px 0 0",
                          color: "#475569",
                          lineHeight: 1.6,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {version.post_excerpt || "投稿本文プレビューなし"}
                      </p>
                    </div>
                    <div
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: 10,
                        background: "#f8fafc",
                        color: "#0f172a",
                        fontSize: 28,
                        fontWeight: 900,
                        minWidth: 78,
                        padding: "10px 12px",
                        textAlign: "center",
                      }}
                    >
                      {version.logic_score ?? "-"}
                    </div>
                  </div>

                  <div style={{ color: "#334155", lineHeight: 1.7 }}>
                    {shortInlineText(version.logic_score_reason, 180) || "評価理由なし"}
                  </div>

                  <div style={gridStyle}>
                    <div>
                      <div style={{ ...labelStyle, marginBottom: 6 }}>current score</div>
                      <div
                        style={{
                          border: "1px solid #e2e8f0",
                          borderRadius: 8,
                          background: "#f8fafc",
                          padding: 12,
                          fontSize: 22,
                          fontWeight: 900,
                        }}
                      >
                        {version.current_logic_score ?? "-"}
                      </div>
                    </div>
                    <div>
                      <div style={{ ...labelStyle, marginBottom: 6 }}>new score</div>
                      <div
                        style={{
                          border: "1px solid #bfdbfe",
                          borderRadius: 8,
                          background: "#eff6ff",
                          color: "#1d4ed8",
                          padding: 12,
                          fontSize: 22,
                          fontWeight: 900,
                        }}
                      >
                        {version.logic_score ?? "-"}
                      </div>
                    </div>
                  </div>

                  <div style={gridStyle}>
                    <div>
                      <div style={{ ...labelStyle, marginBottom: 6 }}>current reason</div>
                      <div
                        style={{
                          border: "1px solid #e2e8f0",
                          borderRadius: 8,
                          background: "#f8fafc",
                          color: "#475569",
                          lineHeight: 1.7,
                          padding: 12,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {version.current_logic_score_reason || "現在理由なし"}
                      </div>
                    </div>
                    <div>
                      <div style={{ ...labelStyle, marginBottom: 6 }}>new reason</div>
                      <div
                        style={{
                          border: "1px solid #bfdbfe",
                          borderRadius: 8,
                          background: "#eff6ff",
                          color: "#1e3a8a",
                          lineHeight: 1.7,
                          padding: 12,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {version.logic_score_reason || "新評価理由なし"}
                      </div>
                    </div>
                  </div>

                  {!version.is_applied ? (
                    <div
                      style={{
                        border: "1px solid #fde68a",
                        borderRadius: 8,
                        background: "#fffbeb",
                        color: "#78350f",
                        display: "grid",
                        gap: 10,
                        lineHeight: 1.7,
                        padding: 12,
                      }}
                    >
                      <label>
                        <input
                          type="checkbox"
                          checked={logicScoreApplyConfirmId === version.id}
                          onChange={(event) =>
                            setLogicScoreApplyConfirmId(event.target.checked ? version.id : "")
                          }
                        />{" "}
                        このlogic_score versionを1件だけ現在の投稿評価に反映することを確認しました
                      </label>
                      <div>
                        <button
                          type="button"
                          onClick={() => void applyLogicScoreVersion(version)}
                          disabled={
                            logicScoreApplyConfirmId !== version.id ||
                            Boolean(logicScoreApplyLoadingId)
                          }
                          style={{
                            ...buttonStyle,
                            opacity:
                              logicScoreApplyConfirmId === version.id &&
                              !logicScoreApplyLoadingId
                                ? 1
                                : 0.55,
                            cursor:
                              logicScoreApplyConfirmId === version.id &&
                              !logicScoreApplyLoadingId
                                ? "pointer"
                                : "not-allowed",
                          }}
                        >
                          {logicScoreApplyLoadingId === version.id
                            ? "適用中..."
                            : "このlogic_score versionを1件だけ適用"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        border: "1px solid #bbf7d0",
                        borderRadius: 8,
                        background: "#f0fdf4",
                        color: "#166534",
                        fontWeight: 800,
                        lineHeight: 1.7,
                        padding: 12,
                      }}
                    >
                      このlogic_score versionは適用済みです。再適用はできません。
                    </div>
                  )}

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
                      gap: 10,
                    }}
                  >
                    <div>
                      <div style={labelStyle}>post id</div>
                      <code title={version.post_id}>{shortId(version.post_id)}</code>
                    </div>
                    <div>
                      <div style={labelStyle}>thread id</div>
                      <code title={version.thread_id || ""}>{shortId(version.thread_id)}</code>
                    </div>
                    <div>
                      <div style={labelStyle}>prompt_version</div>
                      <div style={{ overflowWrap: "anywhere" }}>{version.prompt_version}</div>
                    </div>
                    <div>
                      <div style={labelStyle}>is_applied</div>
                      <div>{version.is_applied ? "true" : "false"}</div>
                    </div>
                    <div>
                      <div style={labelStyle}>total_tokens</div>
                      <div>{formatNumber(version.total_tokens)}</div>
                    </div>
                    <div>
                      <div style={labelStyle}>cost</div>
                      <div>{formatCost(version.actual_cost_usd)}</div>
                    </div>
                    <div>
                      <div style={labelStyle}>created_at</div>
                      <div>{formatDate(version.created_at)}</div>
                    </div>
                    <div>
                      <div style={labelStyle}>applied_at</div>
                      <div>{formatDate(version.applied_at)}</div>
                    </div>
                  </div>
                </article>
              ))}
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
            <div>
              <h2 style={{ margin: 0, fontSize: 20 }}>生成済みAI要約version</h2>
              <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.7 }}>
                この一覧は、テスト実行で生成されたAI要約versionの確認用です。まだ本番表示には反映されていません。
                既存のAI要約は上書きされていません。内容を確認して問題なければ、次の段階で1件ずつ適用する機能を検討します。
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadVersions(adminKey.trim())}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                background: "#ffffff",
                color: "#111827",
                cursor: "pointer",
                fontWeight: 800,
                padding: "8px 12px",
                flex: "0 0 auto",
              }}
            >
              再読み込み
            </button>
          </div>

          {versionsMessage && (
            <p style={{ margin: "0 0 12px", color: "#92400e", lineHeight: 1.7 }}>
              {versionsMessage}
            </p>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))",
              gap: 10,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                border: "1px solid #bfdbfe",
                borderRadius: 10,
                background: "#eff6ff",
                padding: 12,
              }}
            >
              <div style={{ ...labelStyle, color: "#1d4ed8" }}>未適用</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#1e3a8a" }}>
                {formatNumber(versionStatusCounts.unapplied)}件
              </div>
            </div>
            <div
              style={{
                border: "1px solid #bbf7d0",
                borderRadius: 10,
                background: "#f0fdf4",
                padding: 12,
              }}
            >
              <div style={{ ...labelStyle, color: "#166534" }}>適用済み</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#14532d" }}>
                {formatNumber(versionStatusCounts.applied)}件
              </div>
            </div>
            <div
              style={{
                border: "1px solid #fed7aa",
                borderRadius: 10,
                background: "#fff7ed",
                padding: 12,
              }}
            >
              <div style={{ ...labelStyle, color: "#9a3412" }}>本文なし / 失敗</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#7c2d12" }}>
                {formatNumber(versionStatusCounts.empty)}件
              </div>
            </div>
            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                background: "#f8fafc",
                padding: 12,
              }}
            >
              <div style={labelStyle}>全体</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a" }}>
                {formatNumber(versionStatusCounts.total)}件
              </div>
            </div>
          </div>

          <div
            style={{
              border: "1px solid #bfdbfe",
              borderRadius: 10,
              background: "#eff6ff",
              color: "#1e3a8a",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 14,
              padding: 12,
            }}
          >
            <div>
              <div style={{ fontWeight: 900 }}>次に確認する候補：未適用version</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                本文ありの未適用versionを、詳細確認してから1件ずつ適用します。
              </div>
            </div>
            <button
              type="button"
              onClick={() => setVersionStatusFilter("unapplied")}
              style={{
                border: "1px solid #2563eb",
                borderRadius: 8,
                background: versionStatusFilter === "unapplied" ? "#2563eb" : "#ffffff",
                color: versionStatusFilter === "unapplied" ? "#ffffff" : "#1d4ed8",
                cursor: "pointer",
                fontWeight: 900,
                padding: "8px 12px",
              }}
            >
              未適用だけ表示
            </button>
          </div>

          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              background: "#f8fafc",
              padding: 12,
              display: "grid",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div style={gridStyle}>
              <label style={fieldStyle}>
                <span style={labelStyle}>状態</span>
                <select
                  value={versionStatusFilter}
                  onChange={(event) =>
                    setVersionStatusFilter(event.target.value as VersionStatusFilter)
                  }
                  style={inputStyle}
                >
                  <option value="all">すべて</option>
                  <option value="unapplied">未適用</option>
                  <option value="applied">適用済み</option>
                  <option value="empty">本文なし / 失敗</option>
                </select>
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>prompt_version</span>
                <select
                  value={versionPromptFilter}
                  onChange={(event) => setVersionPromptFilter(event.target.value)}
                  style={inputStyle}
                >
                  <option value="all">すべて</option>
                  {versionPromptOptions.map((promptVersion) => (
                    <option key={promptVersion} value={promptVersion}>
                      {promptVersion}
                    </option>
                  ))}
                </select>
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>thread title / id 検索</span>
                <input
                  type="search"
                  value={versionSearchText}
                  onChange={(event) => setVersionSearchText(event.target.value)}
                  placeholder="タイトル、thread_id、job_id"
                  style={inputStyle}
                />
              </label>
            </div>
            <div style={{ color: "#64748b", fontSize: 13, fontWeight: 800 }}>
              表示中 {formatNumber(filteredVersions.length)} / 全体{" "}
              {formatNumber(versions.length)}
            </div>
          </div>

          {versions.length > 0 && filteredVersions.length === 0 && (
            <div
              style={{
                border: "1px dashed #cbd5e1",
                borderRadius: 8,
                background: "#f8fafc",
                color: "#64748b",
                padding: 18,
                textAlign: "center",
                marginBottom: 14,
              }}
            >
              条件に合うversionはありません。
            </div>
          )}

          {versions.length === 0 ? (
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
              まだ生成済みAI要約versionはありません。
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {filteredVersions.map((version) => {
                const status = getVersionStatus(version);
                const statusMeta = getVersionStatusMeta(status);
                const summaryPreview =
                  shortInlineText(version.summary_excerpt || version.summary_text, 110) ||
                  "本文プレビューなし";

                return (
                  <article
                    key={version.id}
                    style={{
                      border: `1px solid ${statusMeta.border}`,
                      borderRadius: 10,
                      background: "#ffffff",
                      padding: 14,
                      display: "grid",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ minWidth: 0, flex: "1 1 320px" }}>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 8,
                            marginBottom: 8,
                          }}
                        >
                          <VersionStatusBadge status={status} />
                          {status === "unapplied" && (
                            <span
                              style={{
                                border: "1px solid #93c5fd",
                                borderRadius: 999,
                                background: "#dbeafe",
                                color: "#1e40af",
                                fontSize: 12,
                                fontWeight: 900,
                                padding: "4px 8px",
                              }}
                            >
                              確認待ち
                            </span>
                          )}
                          {status === "applied" && (
                            <span
                              style={{
                                border: "1px solid #86efac",
                                borderRadius: 999,
                                background: "#dcfce7",
                                color: "#166534",
                                fontSize: 12,
                                fontWeight: 900,
                                padding: "4px 8px",
                              }}
                            >
                              Forum反映済み
                            </span>
                          )}
                          {status === "empty" && (
                            <span
                              style={{
                                border: "1px solid #fdba74",
                                borderRadius: 999,
                                background: "#ffedd5",
                                color: "#9a3412",
                                fontSize: 12,
                                fontWeight: 900,
                                padding: "4px 8px",
                              }}
                            >
                              適用不可
                            </span>
                          )}
                        </div>
                        <h3
                          style={{
                            fontSize: 17,
                            lineHeight: 1.4,
                            margin: 0,
                            overflowWrap: "anywhere",
                          }}
                        >
                          {version.thread_title || "無題スレッド"}
                        </h3>
                        <p
                          style={{
                            color: "#475569",
                            lineHeight: 1.6,
                            margin: "8px 0 0",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {summaryPreview}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void loadVersionDetail(version.id, adminKey.trim())}
                        disabled={versionLoadingId === version.id}
                        style={{
                          border: "1px solid #cbd5e1",
                          borderRadius: 8,
                          background: "#ffffff",
                          color: "#111827",
                          cursor: "pointer",
                          fontWeight: 800,
                          padding: "8px 12px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {versionLoadingId === version.id ? "取得中..." : "詳細を見る"}
                      </button>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
                        gap: 10,
                      }}
                    >
                      <div>
                        <div style={labelStyle}>prompt_version</div>
                        <div style={{ overflowWrap: "anywhere" }}>{version.prompt_version}</div>
                      </div>
                      <div>
                        <div style={labelStyle}>is_applied</div>
                        <div>{version.is_applied ? "true" : "false"}</div>
                      </div>
                      <div>
                        <div style={labelStyle}>applied_at</div>
                        <div>{formatDate(version.applied_at)}</div>
                      </div>
                      <div>
                        <div style={labelStyle}>total_tokens</div>
                        <div>{formatNumber(version.total_tokens)}</div>
                      </div>
                      <div>
                        <div style={labelStyle}>cost</div>
                        <div>{formatCost(version.actual_cost_usd)}</div>
                      </div>
                      <div>
                        <div style={labelStyle}>created_at</div>
                        <div>{formatDate(version.created_at)}</div>
                      </div>
                      <div>
                        <div style={labelStyle}>version id</div>
                        <code title={version.id}>{shortId(version.id)}</code>
                      </div>
                      <div>
                        <div style={labelStyle}>thread id</div>
                        <code title={version.thread_id}>{shortId(version.thread_id)}</code>
                      </div>
                      <div>
                        <div style={labelStyle}>job id</div>
                        <code title={version.job_id || ""}>{shortId(version.job_id)}</code>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {selectedVersion && (
            <div
              style={{
                borderTop: "1px solid #e2e8f0",
                marginTop: 18,
                paddingTop: 18,
                display: "grid",
                gap: 16,
              }}
            >
              <div style={gridStyle}>
                {statCard("version id", selectedVersion.id)}
                {statCard("状態", getVersionStatusMeta(selectedVersionStatus).label)}
                {statCard("thread id", selectedVersion.thread_id)}
                {statCard(
                  "thread title",
                  selectedVersion.thread_title || selectedVersion.thread?.title || "-"
                )}
                {statCard(
                  "old data thread id",
                  selectedVersion.current_summary?.thread_id || "旧データ未取得"
                )}
                {statCard("is_applied", selectedVersion.is_applied ? "true" : "false")}
                {statCard("applied_at", formatDate(selectedVersion.applied_at))}
                {statCard("total token", formatNumber(selectedVersion.total_tokens))}
                {statCard("cost", formatCost(selectedVersion.actual_cost_usd), "USD")}
              </div>

              <div
                style={{
                  border: `1px solid ${getVersionStatusMeta(selectedVersionStatus).border}`,
                  borderRadius: 8,
                  background: getVersionStatusMeta(selectedVersionStatus).background,
                  color: getVersionStatusMeta(selectedVersionStatus).color,
                  padding: 12,
                  lineHeight: 1.7,
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "grid", gap: 6 }}>
                  <VersionStatusBadge status={selectedVersionStatus} />
                  {selectedVersionStatus === "empty" ? (
                    <strong>本文が保存されていないため適用できません。</strong>
                  ) : selectedVersion.is_applied ? (
                    <strong>
                      このversionはすでにForumへ反映済みです。applied_at:{" "}
                      {formatDate(selectedVersion.applied_at)}
                    </strong>
                  ) : (
                    <strong>
                      未適用の確認待ちversionです。内容を確認してから1件だけ適用できます。
                    </strong>
                  )}
                  <span>
                    詳細表示や展開だけではOpenAI APIを呼びません。forum_postsも更新しません。
                  </span>
                  {applyMessage && selectedVersionStatus !== "unapplied" && (
                    <span
                      style={{
                        color: applyMessage.includes("反映しました") ? "#166534" : "#991b1b",
                        fontWeight: 900,
                      }}
                    >
                      {applyMessage}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedVersion(null);
                    setApplyConfirm(false);
                    setApplyMessage("");
                  }}
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    background: "#ffffff",
                    color: "#111827",
                    cursor: "pointer",
                    fontWeight: 800,
                    padding: "8px 12px",
                    whiteSpace: "nowrap",
                  }}
                >
                  一覧へ戻る
                </button>
              </div>

              {selectedVersionStatus === "unapplied" && !selectedVersion.is_applied ? (
                <div
                  style={{
                    border: "1px solid #fde68a",
                    borderRadius: 8,
                    background: "#fffbeb",
                    color: "#78350f",
                    padding: 12,
                    lineHeight: 1.7,
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <strong>1件だけ適用</strong>
                  <span>
                    この操作は、選択中のversion 1件だけを同じthread_idの現行AI要約へ反映します。
                    OpenAI APIは呼びません。forum_postsも更新しません。
                  </span>
                  {!selectedVersionThreadMatched && (
                    <span style={{ color: "#991b1b", fontWeight: 800 }}>
                      thread_idが一致しないため適用できません。
                    </span>
                  )}
                  <label>
                    <input
                      type="checkbox"
                      checked={applyConfirm}
                      onChange={(event) => setApplyConfirm(event.target.checked)}
                    />{" "}
                    この1件だけを現行AI要約に反映することを確認しました
                  </label>
                  <div>
                    <button
                      type="button"
                      onClick={() => void applySelectedVersion()}
                      disabled={!canApplySelectedVersion}
                      style={{
                        ...buttonStyle,
                        opacity: canApplySelectedVersion ? 1 : 0.55,
                        cursor: canApplySelectedVersion ? "pointer" : "not-allowed",
                      }}
                    >
                      {applyLoading ? "適用中..." : "このversionを1件だけ適用"}
                    </button>
                  </div>
                  {applyMessage && (
                    <p
                      style={{
                        margin: 0,
                        color: applyMessage.includes("反映しました") ? "#166534" : "#991b1b",
                        fontWeight: 800,
                      }}
                    >
                      {applyMessage}
                    </p>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    background: "#f8fafc",
                    color: "#475569",
                    padding: 12,
                    lineHeight: 1.7,
                    fontWeight: 800,
                  }}
                >
                  {selectedVersionStatus === "empty"
                    ? "本文なし / 失敗versionのため、この画面からは適用できません。"
                    : `適用済みversionのため、再適用ボタンは表示していません。applied_at: ${formatDate(
                        selectedVersion.applied_at
                      )}`}
                </div>
              )}

              {compareTextBlock(
                "要約",
                selectedVersion.current_summary?.summary_text,
                selectedVersion.summary_text
              )}
              {compareTextBlock(
                "結論",
                selectedVersion.current_summary?.provisional_answer,
                selectedVersion.provisional_answer
              )}
              {compareTextBlock(
                "根拠",
                selectedVersion.current_summary?.evidence_text,
                selectedVersion.evidence_text
              )}
              {compareTextBlock(
                "反論・リスク",
                selectedVersion.current_summary?.counterargument_text,
                selectedVersion.counterargument_text
              )}

              <div style={gridStyle}>
                <div>
                  <div style={{ ...labelStyle, marginBottom: 6 }}>related_topics</div>
                  <pre
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      background: "#f8fafc",
                      padding: 12,
                      overflowX: "auto",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {formatUnknownJson(selectedVersion.related_topics)}
                  </pre>
                </div>
                <div>
                  <div style={{ ...labelStyle, marginBottom: 6 }}>structure_json</div>
                  <pre
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      background: "#f8fafc",
                      padding: 12,
                      overflowX: "auto",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {formatUnknownJson(selectedVersion.structure_json)}
                  </pre>
                </div>
              </div>
              <div>
                <div style={{ ...labelStyle, marginBottom: 6 }}>raw_result</div>
                <pre
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    background: "#f8fafc",
                    padding: 12,
                    overflowX: "auto",
                    whiteSpace: "pre-wrap",
                    maxHeight: 360,
                  }}
                >
                  {formatUnknownJson(selectedVersion.raw_result)}
                </pre>
              </div>
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
