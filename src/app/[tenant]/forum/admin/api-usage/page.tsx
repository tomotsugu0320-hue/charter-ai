"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";

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

function statusClassName(status: string | null) {
  if (status === "success") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "error") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-600";
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
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link
            href={`/${tenant}/forum/admin`}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 shadow-sm hover:border-blue-300 hover:text-blue-700"
          >
            管理メニューへ戻る
          </Link>
          <Link
            href={`/${tenant}/forum`}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 shadow-sm hover:border-blue-300 hover:text-blue-700"
          >
            Forumトップへ戻る
          </Link>
        </nav>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-600">
                Forum Admin
              </p>
              <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                OpenAI API使用量
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-slate-600">
                Forum内のAI処理で記録されたAPI使用ログを確認します。このページ表示だけではOpenAI APIを呼びません。
              </p>
            </div>
            <div className="inline-flex w-fit items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
              表示専用
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <div className="flex-1">
                <label className="mb-2 block text-sm font-bold text-slate-800" htmlFor="admin-key">
                  ADMIN_KEY
                </label>
                <input
                  id="admin-key"
                  type="password"
                  value={adminKey}
                  onChange={(event) => setAdminKey(event.target.value)}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  placeholder="管理者キーを入力"
                />
              </div>
              <button
                type="button"
                onClick={() => loadUsage(adminKey)}
                disabled={isLoading}
                className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? "確認中..." : isVerified ? "再読み込み" : "使用量を表示"}
              </button>
            </div>
            <div className="mt-3 flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-slate-500">
                入力値は保存しません。ページを再読み込みすると再入力が必要です。
              </p>
              {message && <p className="font-semibold text-amber-700">{message}</p>}
            </div>
          </div>
        </section>

        {isVerified && summary ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="今日のAPI実行回数" value={formatNumber(summary.todayCount)} />
              <MetricCard label="7日間のAPI実行回数" value={formatNumber(summary.sevenDayCount)} />
              <MetricCard label="30日間のAPI実行回数" value={formatNumber(summary.thirtyDayCount)} />
              <MetricCard label="推定コスト合計" value={formatCost(summary.estimatedCostTotal)} />
            </section>

            <section className="grid gap-4 sm:grid-cols-3">
              <MetricCard label="推定input token合計" value={formatNumber(summary.inputTokenTotal)} tone="blue" />
              <MetricCard label="推定output token合計" value={formatNumber(summary.outputTokenTotal)} tone="blue" />
              <MetricCard label="推定total token合計" value={formatNumber(summary.totalTokenTotal)} tone="blue" />
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <UsageGroupList title="feature_key別" rows={summary.byFeatureKey} />
              <UsageGroupList title="model別" rows={summary.byModel} />
              <UsageGroupList title="success / error" rows={summary.byStatus} />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-950">最新ログ</h2>
                  <p className="mt-1 text-sm text-slate-500">直近50件まで表示します。</p>
                </div>
                <button
                  type="button"
                  onClick={() => loadUsage()}
                  disabled={isLoading}
                  className="w-fit rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  再読み込み
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-[980px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">日時</th>
                      <th className="px-4 py-3">feature</th>
                      <th className="px-4 py-3">model</th>
                      <th className="px-4 py-3">status</th>
                      <th className="px-4 py-3">target</th>
                      <th className="px-4 py-3 text-right">tokens</th>
                      <th className="px-4 py-3 text-right">cost</th>
                      <th className="px-4 py-3">error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {latestLogs.map((log) => (
                      <tr key={log.id} className="align-top hover:bg-slate-50/80">
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {formatDate(log.created_at)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {log.feature_key || "unknown"}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{log.model || "-"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusClassName(log.status)}`}>
                            {log.status || "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {log.target_type || "-"}
                          {log.target_id ? ` / ${log.target_id}` : ""}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">
                          {formatNumber(log.total_token_estimate)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {formatCost(log.estimated_cost)}
                        </td>
                        <td className="max-w-[260px] px-4 py-3 text-slate-500">
                          {shorten(log.error_message)}
                        </td>
                      </tr>
                    ))}
                    {latestLogs.length === 0 && (
                      <tr>
                        <td className="px-4 py-10 text-center text-slate-500" colSpan={8}>
                          まだ記録がありません。
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-950 shadow-sm">
              <h2 className="text-base font-black text-amber-950">将来の一括再整理メモ</h2>
              <p className="mt-2">
                今回は一括再整理機能は実装していません。将来追加する場合は、条件設定、対象件数プレビュー、
                推定API回数・token・費用表示、管理者確認、少量ずつ実行の順に進めます。
                既に3層化済み、古いprompt_versionのみ、非表示・削除済み除外などの条件で先に絞り込みます。
              </p>
            </section>
          </>
        ) : (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500 shadow-sm">
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
  const accentClassName =
    tone === "blue" ? "bg-blue-500" : "bg-slate-900";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`mb-4 h-1.5 w-10 rounded-full ${accentClassName}`} />
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 break-words text-3xl font-black tracking-tight text-slate-950">
        {value}
      </p>
    </div>
  );
}

function UsageGroupList({ title, rows }: { title: string; rows: UsageGroup[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-black text-slate-950">{title}</h2>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
          {formatNumber(rows.length)}種
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {rows.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            まだ記録がありません。
          </div>
        )}
        {rows.slice(0, 12).map((row) => (
          <div key={row.key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <p className="break-all text-sm font-bold text-slate-900">{row.key}</p>
              <p className="whitespace-nowrap text-sm font-black text-blue-700">
                {formatNumber(row.count)}件
              </p>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              tokens {formatNumber(row.totalTokenTotal)} / cost {formatCost(row.estimatedCostTotal)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
