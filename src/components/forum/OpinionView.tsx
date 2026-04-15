//   src/components/forum/OpinionView.tsx


"use client";

import { useState } from "react";
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
}: any) {
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});

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
                fontSize: currentFont.base,
                fontWeight: 800,
                color: "#0d47a1",
                cursor: "pointer",
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

  return (
    <PostCard
      key={op.opinion.id}
      style={{
        border: isBest ? "2px solid #2e7d32" : "1px solid #ddd",
        background: isBest ? "#e8f5e9" : "#fff",
        color: "#111",
      }}
    >
      {op.opinion.id.startsWith("virtual-") && (
        <div style={{ fontSize: 12, color: "#999" }}>
          ※AIによる仮の意見
        </div>
      )}

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
                <span>🏆 スコア上位意見 {op.opinion.logic_score ?? "-"}</span>
                <span
                  style={{
                    color: "#666",
                    fontWeight: 500,
                    fontSize: currentFont.base * 0.85,
                  }}
                >
                  （論理構造の評価に基づくスコア）
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
              💬 意見 {op.opinion.logic_score ?? "-"}
            </div>
          )}
        </div>

        {!isBest && (
          <button
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
              padding: 0,
            }}
          >
            {isExpanded ? "閉じる" : "開く"}
          </button>
        )}
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
            クリックで詳細表示
          </div>
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

