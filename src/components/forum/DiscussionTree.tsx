//   src/components/forum/DiscussionTree.tsx


"use client";

import { useState } from "react";
import LinkButton from "@/components/forum/LinkButton";
import SectionCard from "@/components/forum/SectionCard";

type PostRow = {
  id: string;
  thread_id: string;
  source_type: string;
  post_role: string;
  content: string;
  author_key?: string;
  trust_status: string;
  created_at?: string;
  logic_score?: number;
  logic_score_reason?: string;
  logic_break_type?: string;
  logic_break_note?: string;
  prediction_flag?: boolean;
  prediction_target?: string | null;
  prediction_deadline?: string | null;
  parent_opinion_id?: string | null;
  prediction_result?: string | null;
};

type OpinionGroup = {
  opinion: PostRow;
  children: PostRow[];
};

type IssueGroup = {
  issue: PostRow | null;
  opinions: OpinionGroup[];
};

type RelatedThread = {
  id: string;
  content: string;
  post_role: string;
  created_at?: string;
  thread_id: string;
  thread_title?: string;
};

type DiscussionTreeProps = {
  tenant: string;
  threadId: string;
  groupedByOpinion: IssueGroup[];
  variant: "A" | "C";
  currentFont: {
    base: number;
    title: number;
  };
  onSelectNode: (node: { type: string; text: string }) => void;
};

function cutText(text: string, max = 52) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function roleLabel(role: string) {
  switch (role) {
    case "issue_raise":
      return "論点";
    case "opinion":
      return "意見";
    case "rebuttal":
      return "反論";
    case "supplement":
      return "補足";
    case "explanation":
      return "解説";
    default:
      return role;
  }
}

function nodeBorderColor(role: string) {
  switch (role) {
    case "issue_raise":
      return "#7c3aed";
    case "opinion":
      return "#222";
    case "rebuttal":
      return "#dc2626";
    case "supplement":
      return "#2563eb";
    case "explanation":
      return "#16a34a";
    default:
      return "#999";
  }
}

export default function DiscussionTree({
  tenant,
  threadId,
  groupedByOpinion,
  currentFont,
  variant,
  onSelectNode,
}: DiscussionTreeProps) {
  const [relatedMap, setRelatedMap] = useState<Record<string, RelatedThread[]>>(
    {}
  );
  const [loadingNodeId, setLoadingNodeId] = useState<string | null>(null);
  const [openNodeMap, setOpenNodeMap] = useState<Record<string, boolean>>({});

  const isCompact = variant === "A";

  async function loadRelated(nodeId: string, text: string) {
    const alreadyLoaded = relatedMap[nodeId];
    const isOpen = openNodeMap[nodeId];

    if (alreadyLoaded) {
      setOpenNodeMap((prev) => ({
        ...prev,
        [nodeId]: !isOpen,
      }));
      return;
    }

    try {
      setLoadingNodeId(nodeId);

      const res = await fetch("/api/forum/search-related", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          threadId,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result?.error || "関連スレッド取得失敗");
      }

      const posts = Array.isArray(result.posts)
        ? (result.posts as RelatedThread[])
        : [];

      const uniqueThreads: RelatedThread[] = Array.from(
        new Map<string, RelatedThread>(
          posts
            .filter((post) => String(post.thread_id) !== String(threadId))
            .map((post) => [post.thread_id, post])
        ).values()
      ).slice(0, 3);

      setRelatedMap((prev) => ({
        ...prev,
        [nodeId]: uniqueThreads,
      }));

      setOpenNodeMap((prev) => ({
        ...prev,
        [nodeId]: true,
      }));
    } catch (e) {
      console.error(e);
      setRelatedMap((prev) => ({
        ...prev,
        [nodeId]: [],
      }));
      setOpenNodeMap((prev) => ({
        ...prev,
        [nodeId]: true,
      }));
    } finally {
      setLoadingNodeId(null);
    }
  }

  function renderRelated(nodeId: string) {
    const items = relatedMap[nodeId];
    const isOpen = openNodeMap[nodeId];

    if (!isOpen) return null;

    return (
      <div
        style={{
          marginTop: 8,
          marginLeft: 18,
          display: "grid",
          gap: 8,
        }}
      >
        {loadingNodeId === nodeId ? (
          <div style={{ fontSize: currentFont.base, color: "#666" }}>
            関連スレッドを読み込み中...
          </div>
        ) : items && items.length > 0 ? (
          items.map((post) => (
            <LinkButton
              key={`${nodeId}-${post.thread_id}`}
              href={`/${tenant}/forum/thread/${post.thread_id}`}
              variant="card"
            >
              <div
                style={{
                  fontSize: currentFont.base,
                  color: "#999",
                  marginBottom: 4,
                }}
              >
                関連スレッド
              </div>

              <div
                style={{
                  fontSize: currentFont.base,
                  color: "#0d47a1",
                  fontWeight: 800,
                  lineHeight: 1.6,
                  marginBottom: 4,
                }}
              >
                {post.thread_title || cutText(post.content, 40)}
              </div>

              <div
                style={{
                  fontSize: currentFont.base,
                  color: "#666",
                }}
              >
                {roleLabel(post.post_role)} / {cutText(post.content, 44)}
              </div>
            </LinkButton>
          ))
        ) : (
          <div style={{ fontSize: currentFont.base, color: "#999" }}>
            関連スレッドはまだありません
          </div>
        )}
      </div>
    );
  }

  function renderNode(post: PostRow, depth: number) {
    const nodeId = post.id;
    const isOpen = !!openNodeMap[nodeId];
    const hasLoaded = !!relatedMap[nodeId];

    const targetOpinion = groupedByOpinion
      .flatMap((g) => g.opinions)
      .find((o) => o.opinion.id === post.id);

    const childRebuttals =
      targetOpinion?.children.filter((c) => c.post_role === "rebuttal").length ??
      0;

    const childSupplements =
      targetOpinion?.children.filter((c) => c.post_role === "supplement").length ??
      0;

    return (
      <div
        key={post.id}
        style={{
          marginLeft: isCompact ? depth * 14 : depth * 26,
          marginTop: 8,
        }}
      >
        {variant === "C" && depth >= 2 && (
          <div style={{ fontSize: 12, color: "#999", marginBottom: 4 }}>
            └ 構造階層 {depth}
          </div>
        )}

        <div
          style={{
            minWidth: 260,
            borderLeft: isCompact
              ? `2px solid ${nodeBorderColor(post.post_role)}`
              : `5px solid ${nodeBorderColor(post.post_role)}`,
            background: "#fff",
            borderRadius: 10,
            padding: isCompact ? "8px 10px" : "12px 14px",
            boxShadow: isCompact
              ? "0 1px 2px rgba(0,0,0,0.05)"
              : "0 2px 6px rgba(0,0,0,0.08)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                fontSize: currentFont.base,
                fontWeight: 800,
                color: "#222",
              }}
            >
              {roleLabel(post.post_role)}
              <span style={{ marginLeft: 6, color: "#f59e0b", fontWeight: 700 }}>
                ⭐{post.logic_score ?? "-"}
              </span>

              {post.post_role === "opinion" && (
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: currentFont.base,
                    color: "#666",
                    fontWeight: 600,
                  }}
                >
                  反論{childRebuttals} / 補足{childSupplements}
                </span>
              )}
            </div>

            <button
              onClick={() => loadRelated(nodeId, post.content)}
              style={{
                border: "1px solid #ddd",
                background: "#f7f7f7",
                borderRadius: 999,
                padding: "4px 10px",
                fontSize: currentFont.base,
                cursor: "pointer",
                color: "#444",
              }}
            >
              {hasLoaded && isOpen ? "閉じる" : "🔗 関連を見る"}
            </button>
          </div>
        </div>

<div
  onClick={() =>
    onSelectNode({
      type: roleLabel(post.post_role),
      text: post.content,
    })
  }
  style={{
    marginTop: 8,
    fontSize: currentFont.base,
    lineHeight: 1.7,
    color: "#111",
    whiteSpace: "pre-wrap",
    cursor: "pointer",
  }}
  title="この内容について書く"
>
{cutText(
  post.content
    .split("\n")
    .filter(
      (line) =>
        !line.trim().startsWith("前提:") &&
        !line.trim().startsWith("根拠:")
    )
    .join("\n"),
  120
)}
</div>

        {renderRelated(nodeId)}
      </div>
    );
  }

  return (
    <SectionCard variant="white" style={{ marginTop: 24 }}>
      <div
        style={{
          fontSize: currentFont.title,
          fontWeight: 800,
          color: "#111",
          marginBottom: 10,
        }}
      >
        議論ツリー
      </div>

      <div
        style={{
          marginBottom: 12,
          fontSize: currentFont.base,
          color: "#666",
        }}
      >
        {variant === "A"
          ? "主張 → 意見 → 反論 / 補足 を見やすく整理しています"
          : "主張 → 意見 → 反論 → 補足 の構造を詳細に表示しています"}
      </div>

      <div
        style={{
          overflowX: "auto",
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 12,
          background: "#fafafa",
        }}
      >
        <div
          style={{
            minWidth: 720,
            display: "grid",
            gap: 16,
          }}
        >
          {groupedByOpinion.length === 0 ? (
            <div style={{ fontSize: currentFont.base, color: "#666" }}>
              まだツリー表示できる投稿がありません
            </div>
          ) : (
            groupedByOpinion.map((group, groupIndex) => (
              <div key={`group-${groupIndex}`}>
                {group.issue && renderNode(group.issue, 0)}

                <div style={{ marginTop: 8 }}>
                  {group.opinions.map((op) => (
                    <div key={op.opinion.id}>
                      {renderNode(op.opinion, 1)}

                      {op.children.map((child) =>
                        renderNode(
                          child,
                          variant === "A"
                            ? 2
                            : child.post_role === "rebuttal"
                              ? 2
                              : 3
                        )
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </SectionCard>
  );
}