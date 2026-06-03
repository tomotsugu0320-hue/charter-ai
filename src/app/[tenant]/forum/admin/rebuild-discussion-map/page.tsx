"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";

type RebuildMapResponse = {
  success?: boolean;
  error?: string;
  error_code?: string;
  details?: string;
  message?: string;
  preview?: unknown;
  source?: {
    threads?: number;
    posts?: number;
    saved?: boolean;
  };
};

type PreviewRoot = {
  id: string;
  label: string;
  summary: string;
};

type PreviewNode = {
  id: string;
  label: string;
  summary: string;
  parent_id: string | null;
  related_keywords: string[];
  source_thread_ids: string[];
};

type PreviewTreeNode = PreviewRoot & {
  parent_id?: string | null;
  related_keywords?: string[];
  source_thread_ids?: string[];
  children: PreviewTreeNode[];
};

type ExistingNodeMatch = {
  existing_node_id: string;
  suggested_node_id: string;
  confidence: string;
  reason: string;
};

type NewNodeCandidate = {
  id: string;
  label: string;
  reason: string;
};

type MergeCandidate = {
  from_node_ids: string[];
  to_label: string;
  reason: string;
};

type PreviewSuggestions = {
  existingNodeMatches: ExistingNodeMatch[];
  newNodeCandidates: NewNodeCandidate[];
  mergeCandidates: MergeCandidate[];
};

const pageStyle = {
  maxWidth: 960,
  margin: "0 auto",
  padding: 24,
  color: "#111827",
} satisfies CSSProperties;

const cardStyle = {
  border: "1px solid #dbe3ef",
  borderRadius: 8,
  background: "#ffffff",
  color: "#111827",
  padding: 16,
} satisfies CSSProperties;

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#ffffff",
  color: "#111827",
} satisfies CSSProperties;

const buttonStyle = {
  border: "1px solid #111827",
  borderRadius: 8,
  background: "#111827",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 800,
  padding: "10px 14px",
} satisfies CSSProperties;

function formatJson(value: unknown) {
  if (value === undefined || value === null) return "";

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => textValue(item))
    .filter((item) => item.length > 0);
}

function compactErrorText(value: string) {
  const text = value.replace(/\s+/g, " ").trim();

  if (!text) return "";
  if (text.startsWith("<")) return "API returned a non-JSON response";

  return text.length > 240 ? `${text.slice(0, 240)}...` : text;
}

function buildApiErrorMessage(
  response: Response,
  result: RebuildMapResponse
) {
  const parts = [`HTTP ${response.status}`];
  const apiMessage =
    result.error || result.details || result.message || "API request failed";

  if (result.error_code) {
    parts.push(`error_code: ${result.error_code}`);
  }

  parts.push(apiMessage);

  return `議論マップ再編案の生成に失敗しました。${parts.join(" / ")}`;
}

function buildPreviewTree(preview: unknown): PreviewTreeNode | null {
  if (!isRecord(preview)) return null;

  const rootValue = isRecord(preview.root) ? preview.root : {};
  const root: PreviewTreeNode = {
    id: textValue(rootValue.id) || "root",
    label: textValue(rootValue.label) || "議論全体",
    summary: textValue(rootValue.summary),
    children: [],
  };

  const rawNodes = Array.isArray(preview.nodes) ? preview.nodes : [];
  const nodes: PreviewTreeNode[] = rawNodes
    .filter(isRecord)
    .map((node): PreviewTreeNode => ({
      id: textValue(node.id),
      label: textValue(node.label) || "無題の論点",
      summary: textValue(node.summary),
      parent_id: textValue(node.parent_id) || null,
      related_keywords: stringArray(node.related_keywords),
      source_thread_ids: stringArray(node.source_thread_ids),
      children: [],
    }))
    .filter((node) => node.id.length > 0);

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));

  for (const node of nodes) {
    const parentId = node.parent_id;
    const parent =
      parentId && parentId !== root.id ? nodeMap.get(parentId) : undefined;

    if (parent && parent.id !== node.id) {
      parent.children.push(node);
    } else {
      root.children.push(node);
    }
  }

  return root;
}

function buildPreviewSuggestions(preview: unknown): PreviewSuggestions {
  if (!isRecord(preview)) {
    return {
      existingNodeMatches: [],
      newNodeCandidates: [],
      mergeCandidates: [],
    };
  }

  const existingNodeMatches = Array.isArray(preview.existing_node_matches)
    ? preview.existing_node_matches
        .filter(isRecord)
        .map((item): ExistingNodeMatch => ({
          existing_node_id: textValue(item.existing_node_id),
          suggested_node_id: textValue(item.suggested_node_id),
          confidence:
            typeof item.confidence === "number"
              ? String(item.confidence)
              : textValue(item.confidence),
          reason: textValue(item.reason),
        }))
        .filter(
          (item) =>
            item.existing_node_id ||
            item.suggested_node_id ||
            item.confidence ||
            item.reason
        )
    : [];

  const newNodeCandidates = Array.isArray(preview.new_node_candidates)
    ? preview.new_node_candidates
        .filter(isRecord)
        .map((item): NewNodeCandidate => ({
          id: textValue(item.id),
          label: textValue(item.label),
          reason: textValue(item.reason),
        }))
        .filter((item) => item.id || item.label || item.reason)
    : [];

  const mergeCandidates = Array.isArray(preview.merge_candidates)
    ? preview.merge_candidates
        .filter(isRecord)
        .map((item): MergeCandidate => ({
          from_node_ids: stringArray(item.from_node_ids),
          to_label: textValue(item.to_label),
          reason: textValue(item.reason),
        }))
        .filter(
          (item) =>
            item.from_node_ids.length > 0 || item.to_label || item.reason
        )
    : [];

  return {
    existingNodeMatches,
    newNodeCandidates,
    mergeCandidates,
  };
}

export default function RebuildDiscussionMapPage() {
  const params = useParams();
  const tenantParam = params?.tenant;
  const tenant = Array.isArray(tenantParam)
    ? tenantParam[0] ?? "dev"
    : tenantParam ?? "dev";

  const [adminKey, setAdminKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RebuildMapResponse | null>(null);
  const [expandedSourceNodeIds, setExpandedSourceNodeIds] = useState<
    Record<string, boolean>
  >({});

  const requestAdminKey = adminKey.trim();
  const previewJson = useMemo(() => formatJson(result?.preview), [result]);
  const previewTree = useMemo(
    () => buildPreviewTree(result?.preview),
    [result]
  );
  const previewSuggestions = useMemo(
    () => buildPreviewSuggestions(result?.preview),
    [result]
  );
  const hasPreviewSuggestions =
    previewSuggestions.existingNodeMatches.length > 0 ||
    previewSuggestions.newNodeCandidates.length > 0 ||
    previewSuggestions.mergeCandidates.length > 0;

  function renderSuggestionValue(label: string, value: string) {
    return (
      <div
        style={{
          display: "grid",
          gap: 3,
          minWidth: 0,
        }}
      >
        <span style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>
          {label}
        </span>
        <span style={{ overflowWrap: "anywhere", lineHeight: 1.6 }}>
          {value || "-"}
        </span>
      </div>
    );
  }

  function renderSuggestionSection(
    title: string,
    children: ReactNode
  ) {
    return (
      <section style={{ display: "grid", gap: 8 }}>
        <h4 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>{title}</h4>
        <div style={{ display: "grid", gap: 8 }}>{children}</div>
      </section>
    );
  }

  function renderTreeNode(node: PreviewTreeNode, depth = 0) {
    const sourceThreadIds = node.source_thread_ids ?? [];
    const sourceIdsOpen = expandedSourceNodeIds[node.id] === true;

    return (
      <div
        key={node.id}
        style={{
          borderLeft: depth > 0 ? "2px solid #cbd5e1" : "none",
          marginLeft: depth > 0 ? 14 : 0,
          paddingLeft: depth > 0 ? 12 : 0,
        }}
      >
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            background: depth === 0 ? "#f8fafc" : "#ffffff",
            color: "#111827",
            marginBottom: 8,
            padding: "10px 12px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 8,
              marginBottom: node.summary ? 6 : 0,
            }}
          >
            <strong style={{ fontSize: depth === 0 ? 18 : 15 }}>
              {node.label}
            </strong>
            <code
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 999,
                background: "#ffffff",
                color: "#475569",
                fontSize: 12,
                padding: "2px 7px",
              }}
            >
              {node.id}
            </code>
          </div>

          {node.summary && (
            <p
              style={{
                margin: "0 0 8px",
                color: "#475569",
                lineHeight: 1.6,
              }}
            >
              {node.summary}
            </p>
          )}

          {node.related_keywords && node.related_keywords.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 8,
              }}
            >
              {node.related_keywords.map((keyword) => (
                <span
                  key={keyword}
                  style={{
                    border: "1px solid #bfdbfe",
                    borderRadius: 999,
                    background: "#eff6ff",
                    color: "#1d4ed8",
                    fontSize: 12,
                    fontWeight: 800,
                    padding: "2px 7px",
                  }}
                >
                  {keyword}
                </span>
              ))}
            </div>
          )}

          {sourceThreadIds.length > 0 && (
            <div
              style={{
                marginTop: 8,
                color: "#64748b",
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span>参照スレッド数：{sourceThreadIds.length}件</span>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedSourceNodeIds((current) => ({
                      ...current,
                      [node.id]: !sourceIdsOpen,
                    }))
                  }
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 999,
                    background: "#ffffff",
                    color: "#334155",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 800,
                    padding: "3px 8px",
                  }}
                >
                  {sourceIdsOpen ? "参照IDを隠す" : "参照IDを表示"}
                </button>
              </div>

              {sourceIdsOpen && (
                <div
                  style={{
                    display: "grid",
                    gap: 4,
                    marginTop: 8,
                    maxWidth: "100%",
                    overflowX: "auto",
                  }}
                >
                  {sourceThreadIds.map((threadId) => (
                    <code
                      key={threadId}
                      style={{
                        display: "block",
                        border: "1px solid #e2e8f0",
                        borderRadius: 6,
                        background: "#f8fafc",
                        color: "#475569",
                        fontSize: 12,
                        padding: "3px 6px",
                        whiteSpace: "normal",
                        wordBreak: "break-all",
                      }}
                    >
                      {threadId}
                    </code>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {node.children.length > 0 && (
          <div style={{ display: "grid", gap: 6 }}>
            {node.children.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  async function handleGenerate() {
    if (!requestAdminKey) {
      setError("管理者キーを入力してください。");
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setExpandedSourceNodeIds({});

    try {
      const res = await fetch("/api/forum/admin-rebuild-discussion-map", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": requestAdminKey,
        },
      });
      const responseText = await res.text();
      let json: RebuildMapResponse = {};

      if (responseText.trim()) {
        try {
          json = JSON.parse(responseText) as RebuildMapResponse;
        } catch {
          json = { error: compactErrorText(responseText) };
        }
      }

      if (!res.ok || json.success !== true) {
        setError(buildApiErrorMessage(res, json));
        return;
      }

      setResult(json);
    } catch {
      setError("通信エラーが発生しました。もう一度お試しください。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={pageStyle}>
      <Link
        href={`/${tenant}/forum/admin`}
        style={{
          display: "inline-block",
          marginBottom: 14,
          color: "#2563eb",
          fontWeight: 800,
          textDecoration: "none",
        }}
      >
        ← forum管理トップへ戻る
      </Link>

      <h1 style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 900 }}>
        議論マップ再編案
      </h1>
      <p style={{ margin: "0 0 18px", color: "#475569", lineHeight: 1.7 }}>
        現在の公開中スレッドと投稿をもとに、AIが議論ツリーの再編案を生成します。
        今回はプレビューのみで、本番マップには反映されません。
      </p>

      <section style={{ ...cardStyle, marginBottom: 18 }}>
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
            value={adminKey}
            onChange={(event) => setAdminKey(event.target.value)}
            placeholder="ADMIN_KEY"
            style={{ ...inputStyle, flex: "1 1 260px" }}
          />
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={loading}
            style={{
              ...buttonStyle,
              opacity: loading ? 0.65 : 1,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "生成中..." : "再編案を生成"}
          </button>
        </div>
      </section>

      {error && (
        <section
          style={{
            ...cardStyle,
            marginBottom: 18,
            borderColor: "#fca5a5",
            background: "#fef2f2",
            color: "#991b1b",
            lineHeight: 1.7,
          }}
        >
          {error}
        </section>
      )}

      {result?.success === true && (
        <section style={{ ...cardStyle, marginBottom: 18 }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 20, fontWeight: 900 }}>
            生成結果
          </h2>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              marginBottom: 14,
            }}
          >
            <span
              style={{
                border: "1px solid #bfdbfe",
                borderRadius: 999,
                background: "#eff6ff",
                color: "#1d4ed8",
                fontWeight: 900,
                padding: "4px 10px",
              }}
            >
              threads: {result.source?.threads ?? 0}
            </span>
            <span
              style={{
                border: "1px solid #bbf7d0",
                borderRadius: 999,
                background: "#f0fdf4",
                color: "#166534",
                fontWeight: 900,
                padding: "4px 10px",
              }}
            >
              posts: {result.source?.posts ?? 0}
            </span>
            <span
              style={{
                border: "1px solid #fed7aa",
                borderRadius: 999,
                background: "#fff7ed",
                color: "#9a3412",
                fontWeight: 900,
                padding: "4px 10px",
              }}
            >
              preview only
            </span>
          </div>

          <section
            style={{
              border: "1px solid #dbe3ef",
              borderRadius: 8,
              background: "#ffffff",
              color: "#111827",
              marginBottom: 16,
              padding: 14,
            }}
          >
            <h3
              style={{
                margin: "0 0 10px",
                fontSize: 18,
                fontWeight: 900,
              }}
            >
              ツリー表示
            </h3>

            {previewTree ? (
              <div style={{ display: "grid", gap: 8 }}>
                {renderTreeNode(previewTree)}
              </div>
            ) : (
              <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
                ツリー表示できる preview.root / preview.nodes がありません。
              </p>
            )}
          </section>

          <section
            style={{
              border: "1px solid #dbe3ef",
              borderRadius: 8,
              background: "#ffffff",
              color: "#111827",
              marginBottom: 16,
              padding: 14,
            }}
          >
            <h3
              style={{
                margin: "0 0 10px",
                fontSize: 18,
                fontWeight: 900,
              }}
            >
              AI提案
            </h3>

            {!hasPreviewSuggestions ? (
              <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
                候補なし
              </p>
            ) : (
              <div style={{ display: "grid", gap: 16 }}>
                {previewSuggestions.existingNodeMatches.length > 0 &&
                  renderSuggestionSection(
                    "既存ノードとの対応",
                    previewSuggestions.existingNodeMatches.map((item, index) => (
                      <article
                        key={`${item.existing_node_id}:${item.suggested_node_id}:${index}`}
                        style={{
                          border: "1px solid #e2e8f0",
                          borderRadius: 8,
                          background: "#f8fafc",
                          color: "#111827",
                          display: "grid",
                          gap: 8,
                          padding: 12,
                        }}
                      >
                        {renderSuggestionValue(
                          "existing_node_id",
                          item.existing_node_id
                        )}
                        {renderSuggestionValue(
                          "suggested_node_id",
                          item.suggested_node_id
                        )}
                        {renderSuggestionValue("confidence", item.confidence)}
                        {renderSuggestionValue("reason", item.reason)}
                      </article>
                    ))
                  )}

                {previewSuggestions.newNodeCandidates.length > 0 &&
                  renderSuggestionSection(
                    "新規ノード候補",
                    previewSuggestions.newNodeCandidates.map((item, index) => (
                      <article
                        key={`${item.id}:${index}`}
                        style={{
                          border: "1px solid #e2e8f0",
                          borderRadius: 8,
                          background: "#f8fafc",
                          color: "#111827",
                          display: "grid",
                          gap: 8,
                          padding: 12,
                        }}
                      >
                        {renderSuggestionValue("id", item.id)}
                        {renderSuggestionValue("label", item.label)}
                        {renderSuggestionValue("reason", item.reason)}
                      </article>
                    ))
                  )}

                {previewSuggestions.mergeCandidates.length > 0 &&
                  renderSuggestionSection(
                    "統合候補",
                    previewSuggestions.mergeCandidates.map((item, index) => (
                      <article
                        key={`${item.to_label}:${index}`}
                        style={{
                          border: "1px solid #e2e8f0",
                          borderRadius: 8,
                          background: "#f8fafc",
                          color: "#111827",
                          display: "grid",
                          gap: 8,
                          padding: 12,
                        }}
                      >
                        {renderSuggestionValue(
                          "from_node_ids",
                          item.from_node_ids.join(", ")
                        )}
                        {renderSuggestionValue("to_label", item.to_label)}
                        {renderSuggestionValue("reason", item.reason)}
                      </article>
                    ))
                  )}
              </div>
            )}
          </section>

          <h3
            style={{
              margin: "0 0 10px",
              fontSize: 18,
              fontWeight: 900,
            }}
          >
            生JSON
          </h3>

          <pre
            style={{
              maxHeight: 640,
              overflow: "auto",
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              background: "#0f172a",
              color: "#e2e8f0",
              padding: 14,
              lineHeight: 1.6,
              fontSize: 13,
            }}
          >
            {previewJson}
          </pre>
        </section>
      )}
    </main>
  );
}
