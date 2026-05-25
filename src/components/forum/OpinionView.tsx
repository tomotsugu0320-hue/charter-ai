//   src/components/forum/OpinionView.tsx


"use client";

import { useEffect, useState } from "react";
import SectionCard from "@/components/forum/SectionCard";
import PostCard from "@/components/forum/PostCard";
import OpinionCard from "@/components/forum/OpinionCard";

function getShortSummary(content: string) {
  if (!content) return "";

  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const claim =
    lines.find((l) => l.startsWith("主張:")) ||
    lines.find((l) => l.startsWith("論点:")) ||
    lines[0] ||
    "";

  return claim.replace(/^主張:\s*/, "").replace(/^論点:\s*/, "");
}

async function copyPostLink(postId: string) {
  if (typeof window === "undefined" || !navigator?.clipboard) return;

  const postUrl = `${window.location.origin}${window.location.pathname}#post-${postId}`;

  try {
    await navigator.clipboard.writeText(postUrl);
    alert("この意見のリンクをコピーしました。");
  } catch (e) {
    console.error(e);
  }
}

export default function OpinionView({
  groupedByOpinion,
  bestOpinionsByIssue,
  hideLowScore,
  currentFont,
  thread,
  setSelectedGuide,
  setPostRole,
  setReplyToOpinionId,
  explanations,
  feedbackLoadingPostId,
  handleFeedback,
  onHidePost,
  currentAuthorKey,
}: any) {
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(
    null
  );

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const applyHashHighlight = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const hash = window.location.hash;

      if (!hash.startsWith("#post-")) {
        setHighlightedPostId(null);
        return;
      }

      const postId = decodeURIComponent(hash.slice("#post-".length));
      setHighlightedPostId(postId);

      timeoutId = setTimeout(() => {
        setHighlightedPostId((current) => (current === postId ? null : current));
      }, 3200);
    };

    applyHashHighlight();
    window.addEventListener("hashchange", applyHashHighlight);

    return () => {
      window.removeEventListener("hashchange", applyHashHighlight);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [groupedByOpinion]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {groupedByOpinion.map((group: any, groupIndex: number) => (
        <SectionCard
          key={group.issue?.id ?? `group-${groupIndex}`}
          variant="soft"
          style={{ borderRadius: 14, color: "#111" }}
        >
          <details open style={{ marginBottom: 12 }}>
<summary
  style={{
    cursor: "pointer",
    fontWeight: 700,
    color: "#0f4aa1",
    fontSize: currentFont.base,
  }}
>
{group.issue
  ? `問い: ${group.issue.content}`
  : `問い: ${thread?.title ?? "このスレのテーマ"}`}
</summary>
            <div style={{ marginTop: 12 }}>
{group.opinions.length === 0 ? (
  <div style={{ color: "#777", fontSize: currentFont.base }}>
    まだ意見がない。
  </div>
) : (
  <div>
    {group.opinions.map((op: any) => {
  const best = bestOpinionsByIssue[groupIndex]?.best;
  const isBest = !!best && best.opinion.id === op.opinion.id;
  const isExpanded = isBest || expandedMap[op.opinion.id] === true;
  const short = getShortSummary(op.opinion.content);
  const replyCount = op.children?.length ?? 0;
  const rawScore = op.opinion.logic_score;
  const numericScore =
    typeof rawScore === "number"
      ? rawScore
      : typeof rawScore === "string" && rawScore.trim() !== ""
      ? Number(rawScore)
      : null;
  const isLowScore =
    typeof numericScore === "number" &&
    Number.isFinite(numericScore) &&
    numericScore > 0 &&
    numericScore < 60;
  const cardOpacity = hideLowScore && isLowScore ? 0.5 : 1;
  const isHighlighted = highlightedPostId === String(op.opinion.id);

  return (
    <div
      key={op.opinion.id}
      id={`post-${op.opinion.id}`}
      style={{ scrollMarginTop: 96 }}
    >
      <PostCard
        style={{
          border: isHighlighted
            ? "2px solid #f59e0b"
            : isBest
            ? "2px solid #2e7d32"
            : "1px solid #ddd",
          background: isHighlighted ? "#fffbeb" : isBest ? "#e8f5e9" : "#fff",
          color: "#111",
          boxShadow: isHighlighted
            ? "0 0 0 3px rgba(245, 158, 11, 0.18)"
            : undefined,
          opacity: cardOpacity,
        }}
      >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 4 }}>
          {isBest ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
                fontWeight: 800,
                fontSize: currentFont.base,
                color: "#2e7d32",
              }}
            >
              <div style={{ display: "grid", gap: 2 }}>
                <span>🏆 まず読む意見 {op.opinion.logic_score ?? "-"}</span>
                <span
                  style={{
                    color: "#666",
                    fontWeight: 500,
                    fontSize: currentFont.base * 0.85,
                  }}
                >
                  AI論理スコアの目安
                </span>
              </div>
              <span
                style={{
                  color: "#666",
                  fontWeight: 600,
                  fontSize: currentFont.base * 0.9,
                }}
              >
                投稿数 {group.opinions.length}件
              </span>
            </div>
          ) : (
            <div
              style={{
                fontWeight: 800,
                fontSize: currentFont.base,
              }}
            >
              意見・AI論理スコア {op.opinion.logic_score ?? "-"}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          {!isBest && (
            <button
              type="button"
              onClick={() =>
                setExpandedMap((prev) => ({
                  ...prev,
                  [op.opinion.id]: !prev[op.opinion.id],
                }))
              }
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "#0d47a1",
                fontSize: currentFont.base * 0.9,
                fontWeight: 700,
                padding: "4px 0",
              }}
            >
              {isExpanded ? "閉じる" : "意見と返信を見る"}
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void copyPostLink(op.opinion.id);
            }}
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 999,
              background: "#f8fafc",
              color: "#334155",
              cursor: "pointer",
              fontSize: currentFont.base * 0.85,
              fontWeight: 700,
              padding: "4px 8px",
              whiteSpace: "nowrap",
            }}
          >
            リンクをコピー
          </button>

        </div>
      </div>

      {isExpanded ? (
        <div style={{ marginTop: 10 }}>
          <OpinionCard
            op={op}
            hideLowScore={hideLowScore}
            currentFont={currentFont}
            setSelectedGuide={setSelectedGuide}
            setPostRole={setPostRole}
            setReplyToOpinionId={setReplyToOpinionId}
            explanations={explanations}
            feedbackLoadingPostId={feedbackLoadingPostId}
            handleFeedback={handleFeedback}
            onHidePost={onHidePost}
            currentAuthorKey={currentAuthorKey}
          />
        </div>
      ) : (
        <div
          onClick={() =>
            setExpandedMap((prev) => ({
              ...prev,
              [op.opinion.id]: true,
            }))
          }
          style={{
            marginTop: 10,
            cursor: "pointer",
          }}
        >
          <div
            style={{
              fontSize: currentFont.base,
              lineHeight: 1.7,
              color: "#111",
            }}
          >
            👉 {op.opinion.is_sensitive ? "プライバシー保護のため一部非公開" : short}
          </div>

          <div
            style={{
              marginTop: 6,
              color: "#666",
              fontSize: currentFont.base * 0.85,
            }}
          >
            開くと反論・補足も見られます
          </div>
          {replyCount > 0 && (
            <div
              style={{
                marginTop: 6,
                color: "#666",
                fontSize: currentFont.base * 0.85,
              }}
            >
              反論・補足あり（{replyCount}件）
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => {
          setReplyToOpinionId(op.opinion.id);
          setPostRole("rebuttal");
        }}
        style={{
          marginTop: 8,
          fontSize: 12,
          color: "#b71c1c",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          fontWeight: 700,
        }}
      >
        この意見に反論する
      </button>
      </PostCard>
    </div>
      );
    })}
  </div>
)}
            </div>
          </details>
        </SectionCard>
      ))}
    </div>
  );
}

