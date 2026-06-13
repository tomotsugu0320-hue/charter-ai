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

function shorten(value: string | null | undefined, length = 80) {
  if (!value) {
    return "-";
  }
  return value.length > length ? `${value.slice(0, length)}...` : value;
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
      setMessage("ADMIN_KEYを入力してください");
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
        throw new Error(data.error || "API使用量を取得できませんでした");
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
      setMessage(error instanceof Error ? error.message : "入力内容を確認してください");
    } finally {
      setIsLoading(false);
    }
  }

  const summary = usage?.summary;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link href={`/${tenant}/forum/admin`} className="text-cyan-200 hover:text-cyan-100">
            管理メニューへ戻る
          </Link>
          <span className="text-slate-600">/</span>
          <Link href={`/${tenant}/forum`} className="text-cyan-200 hover:text-cyan-100">
            Forumトップへ戻る
          </Link>
        </div>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Forum Admin
            </p>
            <h1 className="text-2xl font-bold text-white">OpenAI API使用量</h1>
            <p className="text-sm leading-6 text-slate-300">
              Forum内のAI処理で記録されたAPI使用ログを確認します。ページ表示だけではOpenAI APIを呼びません。
            </p>
          </div>

          {!isVerified && (
            <div className="mt-5 max-w-xl space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <label className="block text-sm font-semibold text-slate-100" htmlFor="admin-key">
                ADMIN_KEY
              </label>
              <input
                id="admin-key"
                type="password"
                value={adminKey}
                onChange={(event) => setAdminKey(event.target.value)}
                autoComplete="new-password"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                placeholder="管理者キーを入力"
              />
              <button
                type="button"
                onClick={() => loadUsage(adminKey)}
                disabled={isLoading}
                className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? "確認中..." : "使用量を表示"}
              </button>
              {message && <p className="text-sm text-amber-200">{message}</p>}
            </div>
          )}
        </section>

        {isVerified && summary && (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <p className="text-xs text-slate-400">今日のAPI実行回数</p>
                <p className="mt-2 text-3xl font-bold text-white">{formatNumber(summary.todayCount)}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <p className="text-xs text-slate-400">7日間のAPI実行回数</p>
                <p className="mt-2 text-3xl font-bold text-white">{formatNumber(summary.sevenDayCount)}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <p className="text-xs text-slate-400">30日間のAPI実行回数</p>
                <p className="mt-2 text-3xl font-bold text-white">{formatNumber(summary.thirtyDayCount)}</p>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <p className="text-xs text-slate-400">推定input token合計</p>
                <p className="mt-2 text-xl font-semibold text-white">{formatNumber(summary.inputTokenTotal)}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <p className="text-xs text-slate-400">推定output token合計</p>
                <p className="mt-2 text-xl font-semibold text-white">{formatNumber(summary.outputTokenTotal)}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <p className="text-xs text-slate-400">推定total token合計</p>
                <p className="mt-2 text-xl font-semibold text-white">{formatNumber(summary.totalTokenTotal)}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <p className="text-xs text-slate-400">推定コスト合計</p>
                <p className="mt-2 text-xl font-semibold text-white">{formatCost(summary.estimatedCostTotal)}</p>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <UsageGroupList title="feature_key別" rows={summary.byFeatureKey} />
              <UsageGroupList title="model別" rows={summary.byModel} />
              <UsageGroupList title="success / error" rows={summary.byStatus} />
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-white">最新ログ</h2>
                <button
                  type="button"
                  onClick={() => loadUsage()}
                  disabled={isLoading}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:border-cyan-400 disabled:opacity-60"
                >
                  再読み込み
                </button>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-800 text-xs text-slate-400">
                    <tr>
                      <th className="py-2 pr-4">日時</th>
                      <th className="py-2 pr-4">feature</th>
                      <th className="py-2 pr-4">model</th>
                      <th className="py-2 pr-4">status</th>
                      <th className="py-2 pr-4">target</th>
                      <th className="py-2 pr-4">tokens</th>
                      <th className="py-2 pr-4">cost</th>
                      <th className="py-2">error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {(usage.latestLogs ?? []).map((log) => (
                      <tr key={log.id} className="align-top text-slate-200">
                        <td className="py-2 pr-4 whitespace-nowrap">{formatDate(log.created_at)}</td>
                        <td className="py-2 pr-4">{log.feature_key || "unknown"}</td>
                        <td className="py-2 pr-4">{log.model || "-"}</td>
                        <td className="py-2 pr-4">{log.status || "-"}</td>
                        <td className="py-2 pr-4">
                          {log.target_type || "-"}
                          {log.target_id ? ` / ${log.target_id}` : ""}
                        </td>
                        <td className="py-2 pr-4">{formatNumber(log.total_token_estimate)}</td>
                        <td className="py-2 pr-4">{formatCost(log.estimated_cost)}</td>
                        <td className="py-2 text-slate-400">{shorten(log.error_message)}</td>
                      </tr>
                    ))}
                    {(!usage.latestLogs || usage.latestLogs.length === 0) && (
                      <tr>
                        <td className="py-4 text-slate-400" colSpan={8}>
                          まだAPI使用ログはありません。
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 text-sm leading-6 text-slate-300">
              <h2 className="text-base font-bold text-white">将来の一括再整理メモ</h2>
              <p className="mt-2">
                今回は一括再整理機能は実装していません。将来追加する場合は、条件設定、対象件数プレビュー、
                推定API回数・token・費用表示、管理者確認、少量ずつ実行の順に進めます。
                既に3層化済み、古いprompt_versionのみ、非表示・削除済み除外などの条件を先に絞り込みます。
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function UsageGroupList({ title, rows }: { title: string; rows: UsageGroup[] }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
      <h2 className="text-base font-bold text-white">{title}</h2>
      <div className="mt-4 space-y-3">
        {rows.length === 0 && <p className="text-sm text-slate-400">データがありません。</p>}
        {rows.slice(0, 12).map((row) => (
          <div key={row.key} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <div className="flex items-start justify-between gap-3">
              <p className="break-all text-sm font-semibold text-slate-100">{row.key}</p>
              <p className="whitespace-nowrap text-sm text-cyan-200">{formatNumber(row.count)}件</p>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              tokens {formatNumber(row.totalTokenTotal)} / cost {formatCost(row.estimatedCostTotal)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
