"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState, type CSSProperties } from "react";

type UsageGroup = {
  key: string;
  count: number;
  inputTokenTotal: number;
  outputTokenTotal: number;
  totalTokenTotal: number;
  estimatedCostTotal: number | null;
};

type UsageLog = {
  id: string;
  created_at: string;
  feature_key: string | null;
  route_path: string | null;
  model: string | null;
  prompt_version: string | null;
  target_type: string | null;
  target_id: string | null;
  input_token_estimate: number | null;
  output_token_estimate: number | null;
  total_token_estimate: number | null;
  estimated_cost: number | string | null;
  status: string | null;
  error_message: string | null;
};

type UsageResponse = {
  ok: boolean;
  error?: string;
  summary?: {
    todayCount: number;
    sevenDayCount: number;
    thirtyDayCount: number;
    inputTokenTotal: number;
    outputTokenTotal: number;
    totalTokenTotal: number;
    estimatedCostTotal: number | null;
    byFeatureKey: UsageGroup[];
    byModel: UsageGroup[];
    byStatus: UsageGroup[];
  };
  latestLogs?: UsageLog[];
};

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#f3f4f6",
  color: "#111827",
  padding: "24px 16px 40px",
};

const containerStyle: CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto",
  display: "grid",
  gap: 18,
};

const linkBarStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
};

const linkPillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid #dbe3ef",
  borderRadius: 999,
  background: "#ffffff",
  color: "#2563eb",
  fontSize: 14,
  fontWeight: 800,
  padding: "8px 13px",
  textDecoration: "none",
};

const cardStyle: CSSProperties = {
  border: "1px solid #dbe3ef",
  borderRadius: 12,
  background: "#ffffff",
  boxShadow: "0 8px 22px rgba(15, 23, 42, 0.06)",
};

const heroCardStyle: CSSProperties = {
  ...cardStyle,
  padding: 22,
};

const mutedTextStyle: CSSProperties = {
  color: "#475569",
  lineHeight: 1.7,
};

const adminKeyCardStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  background: "#f8fafc",
  marginTop: 18,
  padding: 16,
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#ffffff",
  color: "#111827",
  fontSize: 14,
  padding: "11px 12px",
  outline: "none",
};

const buttonStyle: CSSProperties = {
  border: "1px solid #111827",
  borderRadius: 8,
  background: "#111827",
  color: "#ffffff",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 900,
  padding: "11px 16px",
  whiteSpace: "nowrap",
};

const metricGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))",
  gap: 12,
};

const groupGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
  gap: 12,
};

const tableHeaderCellStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "0.04em",
  padding: "12px 14px",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const tableCellStyle: CSSProperties = {
  borderTop: "1px solid #e2e8f0",
  color: "#334155",
  fontSize: 14,
  padding: "12px 14px",
  verticalAlign: "top",
};

function formatNumber(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("ja-JP");
}

function formatCost(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return "未設定";
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "未設定";
  }
  return `$${numeric.toFixed(4)}`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("ja-JP");
}

function shorten(value: string | null | undefined, length = 90) {
  if (!value) {
    return "-";
  }
  return value.length > length ? `${value.slice(0, length)}...` : value;
}

function statusBadgeStyle(status: string | null): CSSProperties {
  if (status === "success") {
    return {
      border: "1px solid #bbf7d0",
      background: "#f0fdf4",
      color: "#166534",
    };
  }
  if (status === "error") {
    return {
      border: "1px solid #fecdd3",
      background: "#fff1f2",
      color: "#be123c",
    };
  }
  return {
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    color: "#475569",
  };
}

export default function ForumAdminApiUsagePage() {
  const params = useParams<{ tenant?: string }>();
  const tenant = params?.tenant ?? "dev";
  const adminKeyRef = useRef("");
  const [adminKey, setAdminKey] = useState("");
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function loadUsage(keyOverride?: string) {
    const key = (keyOverride ?? adminKeyRef.current).trim();
    if (!key) {
      setMessage("ADMIN_KEYを入力してください。");
      setIsVerified(false);
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/forum/admin/api-usage", {
        headers: {
          "x-admin-key": key,
        },
      });
      const data = (await response.json()) as UsageResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "API使用量を取得できませんでした。");
      }

      adminKeyRef.current = key;
      setAdminKey("");
      setIsVerified(true);
      setUsage(data);
    } catch (error) {
      setUsage(null);
      setIsVerified(false);
      adminKeyRef.current = "";
      setAdminKey("");
      setMessage(error instanceof Error ? error.message : "入力内容を確認してください。");
    } finally {
      setIsLoading(false);
    }
  }

  const summary = usage?.summary;
  const latestLogs = usage?.latestLogs ?? [];

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <nav style={linkBarStyle}>
          <Link href={`/${tenant}/forum/admin`} style={linkPillStyle}>
            管理メニューへ戻る
          </Link>
          <Link href={`/${tenant}/forum`} style={linkPillStyle}>
            Forumトップへ戻る
          </Link>
        </nav>

        <section style={heroCardStyle}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 14,
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  color: "#2563eb",
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: "0.18em",
                  marginBottom: 8,
                  textTransform: "uppercase",
                }}
              >
                Forum Admin
              </div>
              <h1 style={{ margin: 0, fontSize: 30, fontWeight: 950 }}>
                OpenAI API使用量
              </h1>
              <p style={{ ...mutedTextStyle, margin: "10px 0 0", maxWidth: 760 }}>
                Forum内のAI処理で記録されたAPI使用ログを確認します。このページ表示だけではOpenAI APIを呼びません。
              </p>
            </div>
            <div
              style={{
                alignSelf: "flex-start",
                border: "1px solid #bbf7d0",
                borderRadius: 999,
                background: "#f0fdf4",
                color: "#166534",
                fontSize: 12,
                fontWeight: 900,
                padding: "7px 11px",
              }}
            >
              表示専用
            </div>
          </div>

          <div style={adminKeyCardStyle}>
            <label
              htmlFor="admin-key"
              style={{ display: "block", fontSize: 14, fontWeight: 900, marginBottom: 8 }}
            >
              ADMIN_KEY
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <input
                id="admin-key"
                type="password"
                value={adminKey}
                onChange={(event) => setAdminKey(event.target.value)}
                autoComplete="new-password"
                placeholder="管理者キーを入力"
                style={{ ...inputStyle, flex: "1 1 260px" }}
              />
              <button
                type="button"
                onClick={() => loadUsage(adminKey)}
                disabled={isLoading}
                style={{
                  ...buttonStyle,
                  opacity: isLoading ? 0.65 : 1,
                  cursor: isLoading ? "wait" : "pointer",
                }}
              >
                {isLoading ? "確認中..." : isVerified ? "再読み込み" : "使用量を表示"}
              </button>
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                justifyContent: "space-between",
                marginTop: 10,
              }}
            >
              <p style={{ ...mutedTextStyle, fontSize: 13, margin: 0 }}>
                入力値はCookie/localStorage/sessionStorage/URL queryには保存しません。
              </p>
              {message && (
                <p style={{ color: "#b45309", fontSize: 13, fontWeight: 800, margin: 0 }}>
                  {message}
                </p>
              )}
            </div>
          </div>
        </section>

        {isVerified && summary ? (
          <>
            <section style={metricGridStyle}>
              <MetricCard label="今日のAPI実行回数" value={formatNumber(summary.todayCount)} />
              <MetricCard label="7日間のAPI実行回数" value={formatNumber(summary.sevenDayCount)} />
              <MetricCard label="30日間のAPI実行回数" value={formatNumber(summary.thirtyDayCount)} />
              <MetricCard label="推定コスト合計" value={formatCost(summary.estimatedCostTotal)} />
              <MetricCard
                label="推定input token合計"
                value={formatNumber(summary.inputTokenTotal)}
                tone="blue"
              />
              <MetricCard
                label="推定output token合計"
                value={formatNumber(summary.outputTokenTotal)}
                tone="blue"
              />
              <MetricCard
                label="推定total token合計"
                value={formatNumber(summary.totalTokenTotal)}
                tone="blue"
              />
            </section>

            <section style={groupGridStyle}>
              <UsageGroupList title="feature_key別" rows={summary.byFeatureKey} />
              <UsageGroupList title="model別" rows={summary.byModel} />
              <UsageGroupList title="success / error" rows={summary.byStatus} />
            </section>

            <section style={cardStyle}>
              <div
                style={{
                  alignItems: "center",
                  borderBottom: "1px solid #e2e8f0",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  justifyContent: "space-between",
                  padding: 18,
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 950 }}>最新ログ</h2>
                  <p style={{ ...mutedTextStyle, fontSize: 13, margin: "4px 0 0" }}>
                    直近50件まで表示します。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => loadUsage()}
                  disabled={isLoading}
                  style={{
                    ...buttonStyle,
                    background: "#ffffff",
                    color: "#111827",
                    opacity: isLoading ? 0.65 : 1,
                  }}
                >
                  再読み込み
                </button>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    borderCollapse: "collapse",
                    minWidth: 980,
                    width: "100%",
                  }}
                >
                  <thead style={{ background: "#f8fafc" }}>
                    <tr>
                      <th style={tableHeaderCellStyle}>日時</th>
                      <th style={tableHeaderCellStyle}>feature</th>
                      <th style={tableHeaderCellStyle}>model</th>
                      <th style={tableHeaderCellStyle}>status</th>
                      <th style={tableHeaderCellStyle}>target</th>
                      <th style={{ ...tableHeaderCellStyle, textAlign: "right" }}>tokens</th>
                      <th style={{ ...tableHeaderCellStyle, textAlign: "right" }}>cost</th>
                      <th style={tableHeaderCellStyle}>error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestLogs.map((log) => (
                      <tr key={log.id}>
                        <td style={{ ...tableCellStyle, whiteSpace: "nowrap" }}>
                          {formatDate(log.created_at)}
                        </td>
                        <td style={{ ...tableCellStyle, color: "#0f172a", fontWeight: 800 }}>
                          {log.feature_key || "unknown"}
                        </td>
                        <td style={tableCellStyle}>{log.model || "-"}</td>
                        <td style={tableCellStyle}>
                          <span
                            style={{
                              ...statusBadgeStyle(log.status),
                              borderRadius: 999,
                              display: "inline-flex",
                              fontSize: 12,
                              fontWeight: 900,
                              padding: "4px 9px",
                            }}
                          >
                            {log.status || "-"}
                          </span>
                        </td>
                        <td style={tableCellStyle}>
                          {log.target_type || "-"}
                          {log.target_id ? ` / ${log.target_id}` : ""}
                        </td>
                        <td style={{ ...tableCellStyle, color: "#0f172a", fontWeight: 800, textAlign: "right" }}>
                          {formatNumber(log.total_token_estimate)}
                        </td>
                        <td style={{ ...tableCellStyle, textAlign: "right" }}>
                          {formatCost(log.estimated_cost)}
                        </td>
                        <td style={{ ...tableCellStyle, maxWidth: 280 }}>
                          {shorten(log.error_message)}
                        </td>
                      </tr>
                    ))}
                    {latestLogs.length === 0 && (
                      <tr>
                        <td colSpan={8} style={{ ...tableCellStyle, padding: 28, textAlign: "center" }}>
                          まだ記録がありません。
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section
              style={{
                border: "1px solid #fed7aa",
                borderRadius: 12,
                background: "#fff7ed",
                color: "#9a3412",
                lineHeight: 1.8,
                padding: 18,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 950 }}>
                将来の一括再整理メモ
              </h2>
              <p style={{ margin: "8px 0 0" }}>
                今回は一括再整理機能は実装していません。将来追加する場合は、条件設定、対象件数プレビュー、
                推定API回数・token・費用表示、管理者確認、少量ずつ実行の順に進めます。
                既に3層化済み、古いprompt_versionのみ、非表示・削除済み除外などの条件で先に絞り込みます。
              </p>
            </section>
          </>
        ) : (
          <section
            style={{
              ...cardStyle,
              borderStyle: "dashed",
              color: "#64748b",
              padding: 28,
              textAlign: "center",
            }}
          >
            ADMIN_KEYを入力すると、API使用量の集計と最新ログが表示されます。
          </section>
        )}
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "blue";
}) {
  return (
    <div style={{ ...cardStyle, padding: 18 }}>
      <div
        style={{
          background: tone === "blue" ? "#2563eb" : "#111827",
          borderRadius: 999,
          height: 5,
          marginBottom: 14,
          width: 42,
        }}
      />
      <p
        style={{
          color: "#64748b",
          fontSize: 12,
          fontWeight: 900,
          letterSpacing: "0.04em",
          margin: 0,
        }}
      >
        {label}
      </p>
      <p
        style={{
          color: "#0f172a",
          fontSize: 30,
          fontWeight: 950,
          lineHeight: 1.1,
          margin: "8px 0 0",
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </p>
    </div>
  );
}

function UsageGroupList({ title, rows }: { title: string; rows: UsageGroup[] }) {
  return (
    <div style={{ ...cardStyle, padding: 18 }}>
      <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 950 }}>{title}</h2>
        <span
          style={{
            borderRadius: 999,
            background: "#f1f5f9",
            color: "#475569",
            fontSize: 12,
            fontWeight: 900,
            padding: "4px 9px",
          }}
        >
          {formatNumber(rows.length)}種
        </span>
      </div>

      <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
        {rows.length === 0 && (
          <div
            style={{
              border: "1px dashed #cbd5e1",
              borderRadius: 10,
              background: "#f8fafc",
              color: "#64748b",
              fontSize: 14,
              padding: 14,
            }}
          >
            まだ記録がありません。
          </div>
        )}
        {rows.slice(0, 12).map((row) => (
          <div
            key={row.key}
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              background: "#f8fafc",
              padding: 12,
            }}
          >
            <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
              <p style={{ color: "#0f172a", fontSize: 14, fontWeight: 900, margin: 0, overflowWrap: "anywhere" }}>
                {row.key}
              </p>
              <p style={{ color: "#2563eb", fontSize: 14, fontWeight: 950, margin: 0, whiteSpace: "nowrap" }}>
                {formatNumber(row.count)}件
              </p>
            </div>
            <p style={{ color: "#64748b", fontSize: 12, margin: "6px 0 0" }}>
              tokens {formatNumber(row.totalTokenTotal)} / cost {formatCost(row.estimatedCostTotal)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
