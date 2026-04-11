//   src/components/forum/OpinionView.tsx


"use client";

import SectionCard from "@/components/forum/SectionCard";
import PostCard from "@/components/forum/PostCard";
import OpinionCard from "@/components/forum/OpinionCard";


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
              {bestOpinionsByIssue[groupIndex]?.best && (
                <PostCard
                  style={{
                    marginBottom: 16,
                    border: "2px solid #2e7d32",
                    background: "#f1f8f4",
                    color: "#111",
                  }}
                >
                  <div style={{ fontWeight: 800, color: "#2e7d32" }}>
                    🏆 ベスト意見
                  </div>

                  <div style={{ marginTop: 6 }}>
                    {bestOpinionsByIssue[groupIndex].best.opinion.content}
                  </div>

                  <div style={{ marginTop: 6, color: "#555" }}>
                    スコア：
                    {bestOpinionsByIssue[groupIndex].best.effectiveScore}
                  </div>
                </PostCard>
              )}

              {group.opinions.length === 0 ? (
                <div style={{ color: "#777", fontSize: currentFont.base }}>
                  まだ意見がない。
                </div>
              ) : (
                group.opinions.map((op: any) => (

<OpinionCard
  key={op.opinion.id}
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

                ))
              )}
            </div>
          </details>
        </SectionCard>
      ))}
    </div>
  );
}