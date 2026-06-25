//   src/components/forum/OpinionView.tsx


"use client";

import { useEffect, useMemo, useState } from "react";
import SectionCard from "@/components/forum/SectionCard";
import PostCard from "@/components/forum/PostCard";
import OpinionCard from "@/components/forum/OpinionCard";

const INITIAL_VISIBLE_OPINIONS = 5;
const LOAD_MORE_OPINIONS = 10;

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
  if (typeof window === "undefined" || typeof navigator === "undefined") return;

  const postUrl = `${window.location.origin}${window.location.pathname}#post-${postId}`;

  try {
    if (navigator.share) {
      await navigator.share({
        title: document.title,
        text: "この意見を共有",
        url: postUrl,
      });
      return;
    }

    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(postUrl);
    alert("この意見のURLをコピーしました。");
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
}: any) {
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const [visibleOpinionCount, setVisibleOpinionCount] = useState(
    INITIAL_VISIBLE_OPINIONS
  );
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(
    null
  );

  useEffect(() => {
    setVisibleOpinionCount(INITIAL_VISIBLE_OPINIONS);
  }, [groupedByOpinion]);

  const totalOpinionCount = useMemo(
    () =>
      groupedByOpinion.reduce(
        (total: number, group: any) => total + (group.opinions?.length ?? 0),
        0
      ),
    [groupedByOpinion]
  );

  const visibleGroupedByOpinion = useMemo(() => {
    let remaining = visibleOpinionCount;

    return groupedByOpinion
      .map((group: any, sourceIndex: number) => {
        const opinions = group.opinions ?? [];

        if (opinions.length === 0) {
          return totalOpinionCount === 0
            ? { ...group, sourceIndex }
            : { ...group, opinions: [], sourceIndex };
        }

        const visibleOpinions = opinions.slice(0, Math.max(remaining, 0));
        remaining -= visibleOpinions.length;

        return {
          ...group,
          opinions: visibleOpinions,
          sourceIndex,
        };
      })
      .filter(
        (group: any) => totalOpinionCount === 0 || group.opinions.length > 0
      );
  }, [groupedByOpinion, totalOpinionCount, visibleOpinionCount]);

  const hasMoreOpinions = visibleOpinionCount < totalOpinionCount;
  const remainingOpinionCount = Math.max(
    totalOpinionCount - visibleOpinionCount,
    0
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
      {visibleGroupedByOpinion.map((group: any, groupIndex: number) => (
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
  ? `起（問い）: ${group.issue.content}`
  : `起（問い）: ${thread?.title ?? "このスレのテーマ"}`}
</summary>
            <div style={{ marginTop: 12 }}>
{group.opinions.length === 0 ? (
  <div style={{ color: "#777", fontSize: currentFont.base }}>
    まだ意見がない。
  </div>
) : (
  <div>
    {group.opinions.map((op: any) => {
  const sourceGroupIndex =
    typeof group.sourceIndex === "number" ? group.sourceIndex : groupIndex;
  const best = bestOpinionsByIssue[sourceGroupIndex]?.best;
  const isBest = !!best && best.opinion.id === op.opinion.id;
  const short = getShortSummary(op.opinion.content);
  const replyCount = op.children?.length ?? 0;
  const rawScore = op.opinion.logic_score;
  const numericScore =
    typeof rawScore === "number"
      ? rawScore
      : typeof rawScore === "string" && rawScore.trim() !== ""
      ? Number(rawScore)
      : null;
  const hasLogicScoreReason =
    String(op.opinion.logic_score_reason ?? "").trim().length > 0;
  const isLowScore =
    typeof numericScore === "number" &&
    Number.isFinite(numericScore) &&
    numericScore > 0 &&
    numericScore < 60;
  const isFeaturedOpinion =
    isBest &&
    hasLogicScoreReason &&
    typeof numericScore === "number" &&
    Number.isFinite(numericScore) &&
    numericScore >= 70;
  const featuredLabel =
    typeof numericScore === "number" && numericScore >= 80
      ? "特選"
      : "おすすめ";
  const isExpanded = isFeaturedOpinion || expandedMap[op.opinion.id] === true;
  const cardOpacity = hideLowScore && isLowScore ? 0.5 : 1;
  const isHighlighted = highlightedPostId === String(op.opinion.id);
  const canHideOpinion =
    !!onHidePost &&
    !String(op.opinion.id).startsWith("virtual-") &&
    op.opinion.can_delete === true;

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
            : isFeaturedOpinion
            ? "2px solid #2e7d32"
            : "1px solid #ddd",
          background: isHighlighted ? "#fffbeb" : isFeaturedOpinion ? "#e8f5e9" : "#fff",
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
          {isFeaturedOpinion ? (
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
                <span>
                  🏆 AI{featuredLabel}の注目反応 {op.opinion.logic_score ?? "-"}
                </span>
                <span
                  style={{
                    color: "#666",
                    fontWeight: 500,
                    fontSize: currentFont.base * 0.85,
                  }}
                >
                  {featuredLabel === "特選"
                    ? "意見・反論・補足の中から、特に読む価値が高い投稿をAIが選びました。"
                    : "意見・反論・補足の中から、読む参考になる投稿をAIが選びました。"}
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
              意見・AI評価 {op.opinion.logic_score ?? "-"}
            </div>
          )}
          <div
            style={{
              color: "#94a3b8",
              fontSize: currentFont.base * 0.68,
              fontWeight: 500,
              lineHeight: 1.3,
              opacity: 0.75,
              overflowWrap: "anywhere",
            }}
          >
            投稿ID: {op.opinion.id}
          </div>
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
            共有
          </button>
          {canHideOpinion && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onHidePost(op.opinion.id);
              }}
              style={{
                border: "1px solid #d1d5db",
                borderRadius: 999,
                background: "#ffffff",
                color: "#6b7280",
                cursor: "pointer",
                fontSize: currentFont.base * 0.85,
                fontWeight: 700,
                padding: "4px 8px",
                whiteSpace: "nowrap",
              }}
            >
              非表示
            </button>
          )}

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
            開くとこの意見への返信も見られます
          </div>
          {replyCount > 0 && (
            <div
              style={{
                marginTop: 6,
                color: "#666",
                fontSize: currentFont.base * 0.85,
              }}
            >
              この意見への返信（{replyCount}件）
            </div>
          )}
        </div>
      )}

      {!isExpanded && (
        <div
          style={{
            marginTop: 10,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <button
            onClick={() => {
              setReplyToOpinionId(op.opinion.id);
              setPostRole("rebuttal");
            }}
            style={{
              fontSize: 12,
              color: "#b71c1c",
              border: "1px solid #fecaca",
              borderRadius: 999,
              background: "#fff7f7",
              cursor: "pointer",
              fontWeight: 700,
              padding: "5px 10px",
            }}
          >
            反論する
          </button>
          <button
            onClick={() => {
              setReplyToOpinionId(op.opinion.id);
              setPostRole("supplement");
            }}
            style={{
              fontSize: 12,
              color: "#1d4ed8",
              border: "1px solid #bfdbfe",
              borderRadius: 999,
              background: "#eff6ff",
              cursor: "pointer",
              fontWeight: 700,
              padding: "5px 10px",
            }}
          >
            補足する
          </button>
        </div>
      )}
      </PostCard>
    </div>
      );
    })}
    {hasMoreOpinions && groupIndex === visibleGroupedByOpinion.length - 1 && (
      <button
        type="button"
        onClick={() =>
          setVisibleOpinionCount((current) =>
            Math.min(current + LOAD_MORE_OPINIONS, totalOpinionCount)
          )
        }
        style={{
          marginTop: 14,
          width: "100%",
          border: "1px solid #cbd5e1",
          borderRadius: 10,
          padding: "12px 14px",
          background: "#f8fafc",
          color: "#0f172a",
          cursor: "pointer",
          fontSize: currentFont.base,
          fontWeight: 800,
        }}
      >
        次の10件を見る
        {remainingOpinionCount > 0
          ? `（残り${remainingOpinionCount}件）`
          : ""}
      </button>
    )}
  </div>
)}
            </div>
          </details>
        </SectionCard>
      ))}
    </div>
  );
}

