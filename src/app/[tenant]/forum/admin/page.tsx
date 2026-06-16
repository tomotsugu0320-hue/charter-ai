"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";

const pageStyle: CSSProperties = {
  maxWidth: 920,
  margin: "0 auto",
  padding: 24,
  color: "#111827",
};

const noticeStyle: CSSProperties = {
  border: "1px solid #fed7aa",
  borderRadius: 8,
  background: "#fff7ed",
  color: "#9a3412",
  lineHeight: 1.7,
  marginBottom: 18,
  padding: "14px 16px",
};

const menuGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
  gap: 12,
};

const menuCardStyle: CSSProperties = {
  display: "block",
  border: "1px solid #dbe3ef",
  borderRadius: 8,
  background: "#ffffff",
  color: "#111827",
  padding: 16,
  textDecoration: "none",
};

const menuDescriptionStyle: CSSProperties = {
  margin: "8px 0 0",
  color: "#475569",
  lineHeight: 1.7,
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#ffffff",
  color: "#111827",
};

const buttonStyle: CSSProperties = {
  border: "1px solid #111827",
  borderRadius: 8,
  background: "#111827",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 800,
  padding: "10px 14px",
};

type AiOpsMode = "classify" | "rebuild";
type AiOpsLimit = 5 | 10 | 20;

const AI_OPS_LIMIT_OPTIONS: AiOpsLimit[] = [5, 10, 20];
const CLASSIFICATION_TARGET_POST_ROLES = new Set([
  "opinion",
  "rebuttal",
  "supplement",
  "explanation",
]);
const AI_OPS_UPDATE_CLASSIFICATION_KEYS = [
  "agreement",
  "rebuttal",
  "premise_addition",
  "evidence_addition",
  "case_addition",
  "metric_suggestion",
  "topic_shift",
  "emotional_reaction",
  "needs_review_or_misinformation_risk",
] as const;

type AiOpsUpdateClassificationKey =
  (typeof AI_OPS_UPDATE_CLASSIFICATION_KEYS)[number];

type RecentThreadTarget = {
  threadId: string;
  title: string;
};

type AiOpsItemResult = {
  threadId: string;
  title: string;
  status: "completed" | "skipped" | "failed";
  message: string;
};

type AiOpsResult = {
  label: string;
  targetCount: number;
  executedCount: number;
  successCount: number;
  skippedCount: number;
  failedCount: number;
  items: AiOpsItemResult[];
};

type AiOpsPreviewItem = {
  threadId: string;
  title: string;
  status:
    | "classification_waiting"
    | "rebuild_waiting"
    | "rebuilt"
    | "no_material"
    | "missing_thread_id"
    | "fetch_failed";
  reason: string;
  hasClassifications: boolean;
  isRebuilt: boolean;
};

type AiOpsPreview = {
  targetCount: number;
  classificationWaitingCount: number;
  rebuildWaitingCount: number;
  rebuiltThreadCount: number;
  noMaterialCount: number;
  failedCount: number;
  missingThreadIdCount: number;
  items: AiOpsPreviewItem[];
};

type AiOpsUsageSummary = {
  calls: number;
  success_calls: number;
  failed_calls: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost: number;
};

type AiOpsChangedClassifications = Record<AiOpsUpdateClassificationKey, number>;

type AiOpsRebuildUpdateWaiting = {
  total_threads: number;
  high_threads: number;
  medium_threads: number;
  low_threads: number;
  changed_classifications: AiOpsChangedClassifications;
};

type AiOpsOverview = {
  overview: {
    total_threads: number;
    classification_waiting_threads: number;
    classification_waiting_posts: number;
    classified_threads: number;
    rebuild_waiting_threads: number;
    rebuild_update_waiting_threads: number;
    rebuild_update_waiting_high_threads: number;
    rebuild_update_waiting_medium_threads: number;
    rebuild_update_waiting_low_threads: number;
    rebuilt_threads: number;
    no_material_threads: number;
  };
  rebuild_update_waiting: AiOpsRebuildUpdateWaiting;
  usage: {
    post_ai_classification: AiOpsUsageSummary;
    thread_summary_from_classifications: AiOpsUsageSummary;
    total: AiOpsUsageSummary;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function numberFromRecord(record: Record<string, unknown>, key: string) {
  const numeric = Number(record[key]);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeUsageSummary(value: unknown): AiOpsUsageSummary {
  const record = isRecord(value) ? value : {};

  return {
    calls: numberFromRecord(record, "calls"),
    success_calls: numberFromRecord(record, "success_calls"),
    failed_calls: numberFromRecord(record, "failed_calls"),
    input_tokens: numberFromRecord(record, "input_tokens"),
    output_tokens: numberFromRecord(record, "output_tokens"),
    total_tokens: numberFromRecord(record, "total_tokens"),
    estimated_cost: numberFromRecord(record, "estimated_cost"),
  };
}

function normalizeChangedClassifications(value: unknown): AiOpsChangedClassifications {
  const record = isRecord(value) ? value : {};
  const counts = {} as AiOpsChangedClassifications;

  for (const key of AI_OPS_UPDATE_CLASSIFICATION_KEYS) {
    counts[key] = numberFromRecord(record, key);
  }

  return counts;
}

function normalizeRebuildUpdateWaiting(value: unknown): AiOpsRebuildUpdateWaiting {
  const record = isRecord(value) ? value : {};

  return {
    total_threads: numberFromRecord(record, "total_threads"),
    high_threads: numberFromRecord(record, "high_threads"),
    medium_threads: numberFromRecord(record, "medium_threads"),
    low_threads: numberFromRecord(record, "low_threads"),
    changed_classifications: normalizeChangedClassifications(
      record.changed_classifications
    ),
  };
}

function normalizeAiOpsOverview(value: unknown): AiOpsOverview | null {
  if (!isRecord(value) || !isRecord(value.overview) || !isRecord(value.usage)) {
    return null;
  }

  return {
    overview: {
      total_threads: numberFromRecord(value.overview, "total_threads"),
      classification_waiting_threads: numberFromRecord(
        value.overview,
        "classification_waiting_threads"
      ),
      classification_waiting_posts: numberFromRecord(
        value.overview,
        "classification_waiting_posts"
      ),
      classified_threads: numberFromRecord(value.overview, "classified_threads"),
      rebuild_waiting_threads: numberFromRecord(
        value.overview,
        "rebuild_waiting_threads"
      ),
      rebuild_update_waiting_threads: numberFromRecord(
        value.overview,
        "rebuild_update_waiting_threads"
      ),
      rebuild_update_waiting_high_threads: numberFromRecord(
        value.overview,
        "rebuild_update_waiting_high_threads"
      ),
      rebuild_update_waiting_medium_threads: numberFromRecord(
        value.overview,
        "rebuild_update_waiting_medium_threads"
      ),
      rebuild_update_waiting_low_threads: numberFromRecord(
        value.overview,
        "rebuild_update_waiting_low_threads"
      ),
      rebuilt_threads: numberFromRecord(value.overview, "rebuilt_threads"),
      no_material_threads: numberFromRecord(value.overview, "no_material_threads"),
    },
    rebuild_update_waiting: normalizeRebuildUpdateWaiting(
      value.rebuild_update_waiting
    ),
    usage: {
      post_ai_classification: normalizeUsageSummary(value.usage.post_ai_classification),
      thread_summary_from_classifications: normalizeUsageSummary(
        value.usage.thread_summary_from_classifications
      ),
      total: normalizeUsageSummary(value.usage.total),
    },
  };
}

function formatCount(value: number) {
  return Math.round(value).toLocaleString("ja-JP");
}

function formatCostUsd(value: number) {
  return `$${value.toFixed(4)}`;
}

function getThreadId(value: unknown) {
  if (!isRecord(value)) return "";

  return String(value.id ?? value.thread_id ?? "").trim();
}

function getThreadTitle(value: unknown) {
  if (!isRecord(value)) return "無題のスレッド";

  const title = String(value.title ?? "").trim();
  return title || "無題のスレッド";
}

export default function ForumAdminPage() {
  const params = useParams();
  const tenantParam = params?.tenant;
  const tenant = Array.isArray(tenantParam)
    ? tenantParam[0] ?? "dev"
    : tenantParam ?? "dev";
  const [adminKey, setAdminKey] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState("");
  const [aiOpsLimit, setAiOpsLimit] = useState<AiOpsLimit>(5);
  const [aiOpsLoading, setAiOpsLoading] = useState<AiOpsMode | null>(null);
  const [aiOpsPreviewLoading, setAiOpsPreviewLoading] = useState(false);
  const [aiOpsPreview, setAiOpsPreview] = useState<AiOpsPreview | null>(null);
  const [aiOpsOverviewLoading, setAiOpsOverviewLoading] = useState(false);
  const [aiOpsOverview, setAiOpsOverview] = useState<AiOpsOverview | null>(null);
  const [aiOpsOverviewMessage, setAiOpsOverviewMessage] = useState("");
  const [aiOpsMessage, setAiOpsMessage] = useState("");
  const [aiOpsResult, setAiOpsResult] = useState<AiOpsResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkAdminSession() {
      try {
        const response = await fetch("/api/forum/admin/users", {
          cache: "no-store",
        });

        if (!cancelled && response.ok) {
          setIsVerified(true);
          setError("");
        }
      } catch {
        // Keep showing the manual ADMIN_KEY form when the session check fails.
      }
    }

    void checkAdminSession();

    return () => {
      cancelled = true;
    };
  }, []);

  async function verifyAdminKey() {
    const requestAdminKey = adminKey.trim();

    if (!requestAdminKey) {
      setError("管理者キーを入力してください。");
      return;
    }

    setIsChecking(true);
    setError("");
    setAdminKey("");

    try {
      const response = await fetch("/api/forum/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminKey: requestAdminKey }),
        cache: "no-store",
      });

      if (!response.ok) {
        setIsVerified(false);
        setError("管理者キーが正しくありません。");
        return;
      }

      setIsVerified(true);
    } catch {
      setIsVerified(false);
      setError("管理者キーを確認できませんでした。");
    } finally {
      setIsChecking(false);
    }
  }

  async function clearAdminSession() {
    setIsChecking(true);
    setError("");

    try {
      await fetch("/api/forum/admin/session", {
        method: "DELETE",
        cache: "no-store",
      });
    } finally {
      setAdminKey("");
      setIsVerified(false);
      setIsChecking(false);
    }
  }

  async function loadRecentThreadTargets(limit: AiOpsLimit) {
    const response = await fetch("/api/forum/top-summary", {
      cache: "no-store",
    });
    const result = (await response.json().catch(() => null)) as unknown;

    if (!response.ok || !isRecord(result) || result.success === false) {
      throw new Error(
        isRecord(result) && typeof result.error === "string"
          ? result.error
          : "最新スレッドを取得できませんでした。"
      );
    }

    const recentThreads = Array.isArray(result.recentThreads)
      ? result.recentThreads.slice(0, limit)
      : [];

    return recentThreads.map((thread) => ({
      threadId: getThreadId(thread),
      title: getThreadTitle(thread),
    }));
  }

  async function loadAiOpsOverview() {
    if (aiOpsOverviewLoading || aiOpsLoading || aiOpsPreviewLoading) return;

    setAiOpsOverviewLoading(true);
    setAiOpsOverviewMessage("全体状況を確認しています。");

    try {
      const response = await fetch("/api/forum/admin/ai-ops-overview", {
        cache: "no-store",
      });
      const result = (await response.json().catch(() => null)) as unknown;

      if (!response.ok || !isRecord(result) || result.ok === false) {
        throw new Error(
          isRecord(result) && typeof result.error === "string"
            ? result.error
            : "全体状況を取得できませんでした。"
        );
      }

      const overview = normalizeAiOpsOverview(result);
      if (!overview) {
        throw new Error("全体状況の形式を確認できませんでした。");
      }

      setAiOpsOverview(overview);
      setAiOpsOverviewMessage("全体状況を確認しました。OpenAI APIは使用していません。");
    } catch (overviewError) {
      setAiOpsOverview(null);
      setAiOpsOverviewMessage(
        overviewError instanceof Error
          ? overviewError.message
          : "全体状況を取得できませんでした。"
      );
    } finally {
      setAiOpsOverviewLoading(false);
    }
  }

  async function loadAiOpsPreview() {
    if (aiOpsPreviewLoading || aiOpsLoading) return;

    const selectedLimit = aiOpsLimit;
    setAiOpsPreviewLoading(true);
    setAiOpsMessage(`最新${selectedLimit}件の状況を確認しています。`);
    setAiOpsResult(null);

    const items: AiOpsPreviewItem[] = [];
    let classificationWaitingCount = 0;
    let rebuildWaitingCount = 0;
    let rebuiltThreadCount = 0;
    let noMaterialCount = 0;
    let failedCount = 0;
    let missingThreadIdCount = 0;

    try {
      const targets = await loadRecentThreadTargets(selectedLimit);

      for (const target of targets) {
        if (!target.threadId) {
          missingThreadIdCount += 1;
          items.push({
            threadId: "",
            title: target.title,
            status: "missing_thread_id",
            reason: "thread_idなし",
            hasClassifications: false,
            isRebuilt: false,
          });
          continue;
        }

        try {
          const detailResponse = await fetch(
            `/api/forum/thread-detail?threadId=${encodeURIComponent(target.threadId)}`,
            { cache: "no-store" }
          );
          const detail = (await detailResponse.json().catch(() => null)) as unknown;

          if (!detailResponse.ok || !isRecord(detail)) {
            failedCount += 1;
            items.push({
              threadId: target.threadId,
              title: target.title,
              status: "fetch_failed",
              reason: "thread-detail取得失敗",
              hasClassifications: false,
              isRebuilt: false,
            });
            continue;
          }

          const posts = Array.isArray(detail.posts) ? detail.posts : [];
          const targetPosts = posts.filter(
            (post) =>
              isRecord(post) &&
              typeof post.post_role === "string" &&
              CLASSIFICATION_TARGET_POST_ROLES.has(post.post_role)
          );
          const hasClassifications = targetPosts.some(
            (post) => isRecord(post) && Boolean(post.ai_classification)
          );
          const summary = isRecord(detail.summary) ? detail.summary : null;
          const isRebuilt =
            summary?.summary_type === "thread_summary_from_classifications";
          const hasMaterial = targetPosts.length > 0;

          if (isRebuilt) {
            rebuiltThreadCount += 1;
          } else if (!hasMaterial) {
            noMaterialCount += 1;
          } else if (hasClassifications) {
            rebuildWaitingCount += 1;
          } else {
            classificationWaitingCount += 1;
          }

          items.push({
            threadId: target.threadId,
            title: target.title,
            status: isRebuilt
              ? "rebuilt"
              : !hasMaterial
              ? "no_material"
              : hasClassifications
              ? "rebuild_waiting"
              : "classification_waiting",
            reason: isRebuilt
              ? "AI再総括済み"
              : !hasMaterial
              ? "分類対象のコメント・補足・反論がありません"
              : hasClassifications
              ? "分類済みコメントがあり、AI再総括できます"
              : "コメントはありますが、まだAI分類されていません",
            hasClassifications,
            isRebuilt,
          });
        } catch {
          failedCount += 1;
          items.push({
            threadId: target.threadId,
            title: target.title,
            status: "fetch_failed",
            reason: "thread-detail取得失敗",
            hasClassifications: false,
            isRebuilt: false,
          });
        }
      }

      setAiOpsPreview({
        targetCount: targets.length,
        classificationWaitingCount,
        rebuildWaitingCount,
        rebuiltThreadCount,
        noMaterialCount,
        failedCount,
        missingThreadIdCount,
        items,
      });
      setAiOpsMessage("状況確認が完了しました。OpenAI APIは使用していません。");
    } catch (previewError) {
      setAiOpsPreview(null);
      setAiOpsMessage(
        previewError instanceof Error
          ? previewError.message
          : "状況を確認できませんでした。"
      );
    } finally {
      setAiOpsPreviewLoading(false);
    }
  }

  async function runClassifyLatestThreads() {
    if (aiOpsLoading) return;

    const selectedLimit = aiOpsLimit;
    setAiOpsLoading("classify");
    setAiOpsMessage(`最新${selectedLimit}件のコメント分類を実行しています。`);
    setAiOpsPreview(null);
    setAiOpsResult(null);

    const items: AiOpsItemResult[] = [];
    let executedCount = 0;
    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    try {
      const targets = await loadRecentThreadTargets(selectedLimit);

      for (const target of targets) {
        if (!target.threadId) {
          skippedCount += 1;
          items.push({
            threadId: "",
            title: target.title,
            status: "skipped",
            message: "thread_idなし",
          });
          continue;
        }

        executedCount += 1;

        try {
          const response = await fetch("/api/forum/admin/classify-posts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              thread_id: target.threadId,
              max_items: 5,
              force_reclassify: false,
            }),
            cache: "no-store",
          });
          const result = (await response.json().catch(() => null)) as unknown;

          if (!response.ok || (isRecord(result) && result.ok === false)) {
            throw new Error(
              isRecord(result) && typeof result.error === "string"
                ? result.error
                : "コメント分類に失敗しました。"
            );
          }

          const processed = isRecord(result) ? Number(result.processed_count ?? 0) : 0;
          const success = isRecord(result) ? Number(result.success_count ?? 0) : 0;
          const skipped = isRecord(result) ? Number(result.skipped_count ?? 0) : 0;
          const failed = isRecord(result) ? Number(result.failed_count ?? 0) : 0;

          successCount += Number.isFinite(success) ? success : 0;
          skippedCount += Number.isFinite(skipped) ? skipped : 0;
          failedCount += Number.isFinite(failed) ? failed : 0;
          items.push({
            threadId: target.threadId,
            title: target.title,
            status: failed > 0 ? "failed" : success > 0 ? "completed" : "skipped",
            message: `処理 ${processed}件 / 成功 ${success}件 / skip ${skipped}件 / 失敗 ${failed}件`,
          });
        } catch (itemError) {
          failedCount += 1;
          items.push({
            threadId: target.threadId,
            title: target.title,
            status: "failed",
            message:
              itemError instanceof Error
                ? itemError.message
                : "コメント分類に失敗しました。",
          });
        }
      }

      setAiOpsResult({
        label: `最新${selectedLimit}件のコメントをAI分類`,
        targetCount: targets.length,
        executedCount,
        successCount,
        skippedCount,
        failedCount,
        items,
      });
      setAiOpsMessage("コメント分類が完了しました。");
    } catch (runError) {
      setAiOpsMessage(
        runError instanceof Error
          ? runError.message
          : "コメント分類を実行できませんでした。"
      );
      setAiOpsResult(null);
    } finally {
      setAiOpsLoading(null);
    }
  }

  async function runRebuildLatestThreads() {
    if (aiOpsLoading) return;

    const selectedLimit = aiOpsLimit;
    setAiOpsLoading("rebuild");
    setAiOpsMessage(`最新${selectedLimit}件のAI再総括を確認・実行しています。`);
    setAiOpsPreview(null);
    setAiOpsResult(null);

    const items: AiOpsItemResult[] = [];
    let executedCount = 0;
    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    try {
      const targets = await loadRecentThreadTargets(selectedLimit);

      for (const target of targets) {
        if (!target.threadId) {
          skippedCount += 1;
          items.push({
            threadId: "",
            title: target.title,
            status: "skipped",
            message: "thread_idなし",
          });
          continue;
        }

        let detail: unknown = null;

        try {
          const detailResponse = await fetch(
            `/api/forum/thread-detail?threadId=${encodeURIComponent(target.threadId)}`,
            { cache: "no-store" }
          );
          detail = await detailResponse.json().catch(() => null);

          if (!detailResponse.ok || !isRecord(detail)) {
            skippedCount += 1;
            items.push({
              threadId: target.threadId,
              title: target.title,
              status: "skipped",
              message: "thread-detail取得失敗",
            });
            continue;
          }
        } catch {
          skippedCount += 1;
          items.push({
            threadId: target.threadId,
            title: target.title,
            status: "skipped",
            message: "thread-detail取得失敗",
          });
          continue;
        }

        const posts = Array.isArray(detail.posts) ? detail.posts : [];
        const hasClassifiedComment = posts.some(
          (post) => isRecord(post) && Boolean(post.ai_classification)
        );
        const summary = isRecord(detail.summary) ? detail.summary : null;
        const alreadyRebuilt =
          summary?.summary_type === "thread_summary_from_classifications";

        if (alreadyRebuilt) {
          skippedCount += 1;
          items.push({
            threadId: target.threadId,
            title: target.title,
            status: "skipped",
            message: "再総括済み",
          });
          continue;
        }

        if (!hasClassifiedComment) {
          skippedCount += 1;
          items.push({
            threadId: target.threadId,
            title: target.title,
            status: "skipped",
            message: "分類済みコメントなし",
          });
          continue;
        }

        executedCount += 1;

        try {
          const response = await fetch(
            "/api/forum/admin/thread-summary/rebuild-from-classifications",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ thread_id: target.threadId }),
              cache: "no-store",
            }
          );
          const result = (await response.json().catch(() => null)) as unknown;

          if (!response.ok || (isRecord(result) && result.ok === false)) {
            throw new Error(
              isRecord(result) && typeof result.error === "string"
                ? result.error
                : "AI再総括に失敗しました。"
            );
          }

          const classifiedCount = isRecord(result)
            ? Number(result.classified_count ?? 0)
            : 0;
          const usedCount = isRecord(result) ? Number(result.used_count ?? 0) : 0;

          successCount += 1;
          items.push({
            threadId: target.threadId,
            title: target.title,
            status: "completed",
            message: `再総括済み（分類 ${classifiedCount}件 / 使用 ${usedCount}件）`,
          });
        } catch (itemError) {
          failedCount += 1;
          items.push({
            threadId: target.threadId,
            title: target.title,
            status: "failed",
            message:
              itemError instanceof Error ? itemError.message : "AI再総括に失敗しました。",
          });
        }
      }

      setAiOpsResult({
        label: `最新${selectedLimit}件をAI再総括`,
        targetCount: targets.length,
        executedCount,
        successCount,
        skippedCount,
        failedCount,
        items,
      });
      setAiOpsMessage("AI再総括の確認・実行が完了しました。");
    } catch (runError) {
      setAiOpsMessage(
        runError instanceof Error
          ? runError.message
          : "AI再総括を実行できませんでした。"
      );
      setAiOpsResult(null);
    } finally {
      setAiOpsLoading(null);
    }
  }

  return (
    <main style={pageStyle}>
      <h1 style={{ margin: "0 0 10px", fontSize: 28, fontWeight: 900 }}>
        forum 管理
      </h1>

      <Link
        href={`/${tenant}/forum`}
        style={{
          display: "inline-block",
          marginBottom: 14,
          color: "#2563eb",
          fontWeight: 800,
          textDecoration: "none",
        }}
      >
        Forumトップへ戻る
      </Link>

      <section style={noticeStyle}>
        <div>このページは管理者向けです。</div>
        <div>管理メニューを表示するには ADMIN_KEY が必要です。</div>
        <div>AI論理スコア再評価ではOpenAI API費用が発生します。</div>
      </section>

      {!isVerified && (
        <section style={{ ...menuCardStyle, marginBottom: 18 }}>
          <label
            htmlFor="admin-key"
            style={{ display: "block", marginBottom: 8, fontWeight: 800 }}
          >
            管理者キー
          </label>
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <input
              id="admin-key"
              type="password"
              autoComplete="new-password"
              value={adminKey}
              onChange={(event) => setAdminKey(event.target.value)}
              placeholder="ADMIN_KEY"
              style={{ ...inputStyle, flex: "1 1 260px" }}
            />
            <button
              type="button"
              onClick={() => void verifyAdminKey()}
              disabled={isChecking}
              style={{ ...buttonStyle, opacity: isChecking ? 0.65 : 1 }}
            >
              {isChecking ? "確認中..." : "管理メニューを表示"}
            </button>
          </div>
          {error && (
            <p style={{ color: "#991b1b", margin: "10px 0 0" }}>
              {error}
            </p>
          )}
        </section>
      )}

      {isVerified && (
        <>
          <section style={{ ...menuCardStyle, marginBottom: 18 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>
              管理者セッションが有効です。
            </div>
            <button
              type="button"
              onClick={() => void clearAdminSession()}
              disabled={isChecking}
              style={{
                ...buttonStyle,
                borderColor: "#991b1b",
                background: "#991b1b",
                opacity: isChecking ? 0.65 : 1,
              }}
            >
              管理セッション解除
            </button>
          </section>

          <section style={{ ...menuCardStyle, marginBottom: 18 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>
              AI管理操作
            </h2>
            <p style={menuDescriptionStyle}>
              選択した最新スレッドだけを対象に、コメント分類やAI再総括を手動実行します。
            </p>
            <p
              style={{
                margin: "8px 0 0",
                color: "#9a3412",
                fontWeight: 800,
                lineHeight: 1.7,
              }}
            >
              状況確認はOpenAI APIを使いません。コメント分類とAI再総括はOpenAI APIを使用します。
            </p>

            <div
              style={{
                marginTop: 14,
                border: "1px solid #dbe3ef",
                borderRadius: 8,
                background: "#f8fafc",
                padding: 12,
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: 8 }}>全体状況</div>
              <p style={{ ...menuDescriptionStyle, marginTop: 0, fontSize: 13 }}>
                全体状況の確認はOpenAI APIを使用しません。DBに保存済みの投稿・分類・使用量ログだけを読みます。
              </p>
              <button
                type="button"
                onClick={() => void loadAiOpsOverview()}
                disabled={
                  aiOpsOverviewLoading ||
                  Boolean(aiOpsLoading) ||
                  aiOpsPreviewLoading
                }
                style={{
                  ...buttonStyle,
                  borderColor: "#0f766e",
                  background: "#0f766e",
                  opacity:
                    aiOpsOverviewLoading || aiOpsLoading || aiOpsPreviewLoading
                      ? 0.65
                      : 1,
                  cursor:
                    aiOpsOverviewLoading || aiOpsLoading || aiOpsPreviewLoading
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {aiOpsOverviewLoading ? "全体状況を確認中..." : "全体状況を確認"}
              </button>

              {aiOpsOverviewMessage && (
                <p
                  style={{
                    margin: "10px 0 0",
                    color:
                      aiOpsOverviewMessage.includes("できません") ||
                      aiOpsOverviewMessage.includes("失敗")
                        ? "#991b1b"
                        : "#334155",
                    fontWeight: 800,
                    lineHeight: 1.7,
                  }}
                >
                  {aiOpsOverviewMessage}
                </p>
              )}

              {aiOpsOverview && (
                <div style={{ marginTop: 12 }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                      gap: 8,
                      color: "#334155",
                      fontSize: 13,
                      fontWeight: 800,
                      lineHeight: 1.6,
                    }}
                  >
                    <span>
                      全スレッド: {formatCount(aiOpsOverview.overview.total_threads)}件
                    </span>
                    <span>
                      コメントAI分類待ち投稿:{" "}
                      {formatCount(
                        aiOpsOverview.overview.classification_waiting_posts
                      )}
                      件
                    </span>
                    <span>
                      コメントAI分類待ちスレッド:{" "}
                      {formatCount(
                        aiOpsOverview.overview.classification_waiting_threads
                      )}
                      件
                    </span>
                    <span>
                      AI再総括待ち:{" "}
                      {formatCount(aiOpsOverview.overview.rebuild_waiting_threads)}
                      件
                    </span>
                    <span>
                      AI再総括更新待ち:{" "}
                      {formatCount(
                        aiOpsOverview.overview.rebuild_update_waiting_threads
                      )}
                      件
                    </span>
                    <span>
                      更新待ち 高:{" "}
                      {formatCount(
                        aiOpsOverview.overview.rebuild_update_waiting_high_threads
                      )}
                      件
                    </span>
                    <span>
                      更新待ち 中:{" "}
                      {formatCount(
                        aiOpsOverview.overview
                          .rebuild_update_waiting_medium_threads
                      )}
                      件
                    </span>
                    <span>
                      更新待ち 低:{" "}
                      {formatCount(
                        aiOpsOverview.overview.rebuild_update_waiting_low_threads
                      )}
                      件
                    </span>
                    <span>
                      AI再総括済み（更新不要）:{" "}
                      {formatCount(aiOpsOverview.overview.rebuilt_threads)}件
                    </span>
                    <span>
                      材料なし:{" "}
                      {formatCount(aiOpsOverview.overview.no_material_threads)}件
                    </span>
                  </div>
                  <p style={{ ...menuDescriptionStyle, fontSize: 13 }}>
                    AI再総括待ちは、分類済みコメントがあるがまだ一度もAI再総括していないスレッドです。AI再総括更新待ちは、再総括後に新しい分類済みコメントが追加されたスレッドです。AI再総括済みは、最新の分類済みコメントまで反映済みです。
                  </p>
                  <p style={{ ...menuDescriptionStyle, fontSize: 13 }}>
                    優先度 高: 反論・前提・根拠・検証指標など、結論が変わる可能性が高い追加あり。中: 事例・同意など、説明を補強する追加あり。低: 感情反応・論点ずれ中心。
                  </p>

                  <div style={{ marginTop: 12, fontWeight: 900 }}>
                    OpenAI使用量
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: 8,
                      marginTop: 8,
                      color: "#475569",
                      fontSize: 13,
                      lineHeight: 1.7,
                    }}
                  >
                    <div>
                      <strong>コメントAI分類</strong>
                      <br />
                      {formatCount(aiOpsOverview.usage.post_ai_classification.calls)}
                      回 /{" "}
                      {formatCount(
                        aiOpsOverview.usage.post_ai_classification.total_tokens
                      )}{" "}
                      token /{" "}
                      {formatCostUsd(
                        aiOpsOverview.usage.post_ai_classification.estimated_cost
                      )}
                    </div>
                    <div>
                      <strong>AI再総括</strong>
                      <br />
                      {formatCount(
                        aiOpsOverview.usage.thread_summary_from_classifications
                          .calls
                      )}
                      回 /{" "}
                      {formatCount(
                        aiOpsOverview.usage.thread_summary_from_classifications
                          .total_tokens
                      )}{" "}
                      token /{" "}
                      {formatCostUsd(
                        aiOpsOverview.usage.thread_summary_from_classifications
                          .estimated_cost
                      )}
                    </div>
                    <div>
                      <strong>合計</strong>
                      <br />
                      {formatCount(aiOpsOverview.usage.total.calls)}回 /{" "}
                      {formatCount(aiOpsOverview.usage.total.total_tokens)} token /{" "}
                      {formatCostUsd(aiOpsOverview.usage.total.estimated_cost)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>
                対象件数
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {AI_OPS_LIMIT_OPTIONS.map((limit) => (
                  <button
                    key={limit}
                    type="button"
                    onClick={() => {
                      setAiOpsLimit(limit);
                      setAiOpsPreview(null);
                      setAiOpsResult(null);
                      setAiOpsMessage("");
                    }}
                    disabled={Boolean(aiOpsLoading) || aiOpsPreviewLoading}
                    style={{
                      border: "1px solid #cbd5e1",
                      borderRadius: 999,
                      background: aiOpsLimit === limit ? "#111827" : "#ffffff",
                      color: aiOpsLimit === limit ? "#ffffff" : "#111827",
                      cursor:
                        aiOpsLoading || aiOpsPreviewLoading ? "not-allowed" : "pointer",
                      fontWeight: 800,
                      padding: "8px 12px",
                    }}
                  >
                    最新{limit}件
                  </button>
                ))}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                marginTop: 14,
                }}
              >
                <button
                  type="button"
                  onClick={() => void loadAiOpsPreview()}
                  disabled={Boolean(aiOpsLoading) || aiOpsPreviewLoading}
                  style={{
                    ...buttonStyle,
                    borderColor: "#475569",
                    background: "#475569",
                    opacity: aiOpsLoading || aiOpsPreviewLoading ? 0.65 : 1,
                    cursor:
                      aiOpsLoading || aiOpsPreviewLoading ? "not-allowed" : "pointer",
                  }}
                >
                  {aiOpsPreviewLoading ? "状況確認中..." : "状況を確認"}
                </button>
              <button
                type="button"
                onClick={() => void runClassifyLatestThreads()}
                disabled={Boolean(aiOpsLoading) || aiOpsPreviewLoading}
                style={{
                  ...buttonStyle,
                  opacity: aiOpsLoading || aiOpsPreviewLoading ? 0.65 : 1,
                  cursor:
                    aiOpsLoading || aiOpsPreviewLoading ? "not-allowed" : "pointer",
                }}
              >
                {aiOpsLoading === "classify"
                  ? "コメント分類中..."
                  : `最新${aiOpsLimit}件のコメントをAI分類`}
              </button>
              <button
                type="button"
                onClick={() => void runRebuildLatestThreads()}
                disabled={Boolean(aiOpsLoading) || aiOpsPreviewLoading}
                style={{
                  ...buttonStyle,
                  borderColor: "#1e40af",
                  background: "#1e40af",
                  opacity: aiOpsLoading || aiOpsPreviewLoading ? 0.65 : 1,
                  cursor:
                    aiOpsLoading || aiOpsPreviewLoading ? "not-allowed" : "pointer",
                }}
              >
                {aiOpsLoading === "rebuild"
                  ? "AI再総括中..."
                  : `最新${aiOpsLimit}件をAI再総括`}
              </button>
            </div>

            <p style={{ ...menuDescriptionStyle, fontSize: 13 }}>
              将来候補: 「コメント分類 → AI再総括」を順番に実行する操作。今回は安全のため実ボタンは置いていません。
            </p>

            {aiOpsMessage && (
              <p
                style={{
                  margin: "12px 0 0",
                  color:
                    aiOpsMessage.includes("できません") ||
                    aiOpsMessage.includes("失敗")
                      ? "#991b1b"
                      : "#334155",
                  fontWeight: 800,
                  lineHeight: 1.7,
                }}
              >
                {aiOpsMessage}
              </p>
            )}

            {aiOpsPreview && (
              <div
                style={{
                  marginTop: 12,
                  border: "1px solid #dbe3ef",
                  borderRadius: 8,
                  background: "#f8fafc",
                  padding: 12,
                }}
              >
                <div style={{ fontWeight: 900, marginBottom: 8 }}>
                  選択対象: 最新{aiOpsLimit}件
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                    gap: 8,
                    color: "#334155",
                    fontSize: 13,
                    fontWeight: 800,
                    lineHeight: 1.6,
                  }}
                >
                  <span>対象スレッド: {aiOpsPreview.targetCount}件</span>
                  <span>分類待ち: {aiOpsPreview.classificationWaitingCount}件</span>
                  <span>再総括待ち: {aiOpsPreview.rebuildWaitingCount}件</span>
                  <span>AI再総括済み: {aiOpsPreview.rebuiltThreadCount}件</span>
                  <span>材料なし: {aiOpsPreview.noMaterialCount}件</span>
                  <span>取得失敗: {aiOpsPreview.failedCount}件</span>
                  <span>thread_idなし: {aiOpsPreview.missingThreadIdCount}件</span>
                </div>
                <p style={{ ...menuDescriptionStyle, fontSize: 13 }}>
                  分類待ちが多い場合は「コメントをAI分類」を実行してください。再総括待ちが多い場合は「AI再総括」を実行してください。
                </p>
                <ul
                  style={{
                    margin: "10px 0 0",
                    paddingLeft: 18,
                    color: "#475569",
                    lineHeight: 1.7,
                  }}
                >
                  {aiOpsPreview.items.map((item, index) => (
                    <li key={`${item.threadId || "no-thread"}-${index}`}>
                      <span style={{ fontWeight: 800 }}>
                        {item.status === "classification_waiting"
                          ? "分類待ち"
                          : item.status === "rebuild_waiting"
                          ? "再総括待ち"
                          : item.status === "rebuilt"
                          ? "再総括済み"
                          : item.status === "no_material"
                          ? "材料なし"
                          : item.status === "missing_thread_id"
                          ? "thread_idなし"
                          : "取得失敗"}
                      </span>
                      {" / "}
                      {item.title}
                      {" / "}
                      {item.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {aiOpsResult && (
              <div
                style={{
                  marginTop: 12,
                  border: "1px solid #dbe3ef",
                  borderRadius: 8,
                  background: "#f8fafc",
                  padding: 12,
                }}
              >
                <div style={{ fontWeight: 900, marginBottom: 8 }}>
                  {aiOpsResult.label}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    color: "#475569",
                    fontSize: 13,
                    fontWeight: 800,
                    lineHeight: 1.6,
                  }}
                >
                  <span>対象 {aiOpsResult.targetCount}件</span>
                  <span>実行 {aiOpsResult.executedCount}件</span>
                  <span>成功 {aiOpsResult.successCount}件</span>
                  <span>skip {aiOpsResult.skippedCount}件</span>
                  <span>失敗 {aiOpsResult.failedCount}件</span>
                </div>
                <ul
                  style={{
                    margin: "10px 0 0",
                    paddingLeft: 18,
                    color: "#334155",
                    lineHeight: 1.7,
                  }}
                >
                  {aiOpsResult.items.map((item, index) => (
                    <li key={`${item.threadId || "no-thread"}-${index}`}>
                      <span style={{ fontWeight: 800 }}>
                        {item.status === "completed"
                          ? "成功"
                          : item.status === "skipped"
                          ? "skip"
                          : "失敗"}
                      </span>
                      {" / "}
                      {item.title}
                      {" / "}
                      {item.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <div style={menuGridStyle}>
          <Link
            href={`/${tenant}/forum/admin/delete-threads`}
            style={menuCardStyle}
          >
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>
              会員向け：非表示/復元
            </h2>
            <p style={menuDescriptionStyle}>
              管理者キーなしでスレッドの非表示・復元を行えます。完全削除のみ管理者キーが必要です。
            </p>
          </Link>

          <Link
            href={`/${tenant}/forum/admin/re-evaluate-logic-score`}
            style={menuCardStyle}
          >
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>
              AI論理スコア再評価
            </h2>
            <p style={menuDescriptionStyle}>
              投稿のAI論理スコアを管理者操作で1件ずつ再評価します。
            </p>
          </Link>

          <Link href={`/${tenant}/forum/admin/users`} style={menuCardStyle}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>
              登録ユーザー管理
            </h2>
            <p style={menuDescriptionStyle}>
              ベータ登録ユーザーのID、ハンドルネーム、最終ログインを確認し、無効化・復活・パスワード再設定を行います。
            </p>
          </Link>

          <Link href={`/${tenant}/forum/admin/api-usage`} style={menuCardStyle}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>
              OpenAI API使用量
            </h2>
            <p style={menuDescriptionStyle}>
              Forum内のAI処理の実行回数、推定token、成功/失敗ログを確認します。
            </p>
          </Link>

          <Link href={`/${tenant}/forum/admin/bulk-refresh`} style={menuCardStyle}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>
              一括再整理プレビュー
            </h2>
            <p style={menuDescriptionStyle}>
              既存スレッド・投稿を再整理する前に、対象件数、推定API回数、token、費用だけを確認します。OpenAI APIは実行しません。
            </p>
          </Link>

          <Link
            href={`/${tenant}/forum/admin/rebuild-discussion-map`}
            style={menuCardStyle}
          >
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>
              議論マップ再編案
            </h2>
            <p style={menuDescriptionStyle}>
              公開中のスレッドと投稿をもとに、AIが議論ツリーの再編案を生成します。今回はプレビューのみです。
            </p>
          </Link>
          </div>
        </>
      )}
    </main>
  );
}
