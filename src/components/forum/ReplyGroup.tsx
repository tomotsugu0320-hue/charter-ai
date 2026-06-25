//   src/components/forum/ReplyGroup.tsx


"use client";

import PostCard from "@/components/forum/PostCard";

type AiClassification = {
  classification?: string | null;
  confidence?: number | null;
  reason?: string | null;
  extracted_premise?: string | null;
  extracted_evidence?: string | null;
  suggested_metrics?: string[];
};

const CLASSIFICATION_LABELS: Record<string, string> = {
  agreement: "賛成",
  rebuttal: "反論",
  premise_addition: "前提追加",
  evidence_addition: "根拠追加",
  case_addition: "事例追加",
  metric_suggestion: "検証指標",
  topic_shift: "論点ずれ",
  emotional_reaction: "感情反応",
  needs_review_or_misinformation_risk: "要確認",
};

function splitContent(content: string) {
  if (!content) return { claim: "", premises: [], reasons: [] };

  const sentences = content
    .split(/[。！？\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    claim: sentences[0] ?? "",
    premises: sentences.slice(1, 3),
    reasons: sentences.slice(3),
  };
}

function roleLabel(role: string) {
  switch (role) {
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

function roleColor(role: string) {
  switch (role) {
    case "rebuttal":
      return "#b71c1c";
    case "supplement":
      return "#0d47a1";
    case "explanation":
      return "#2e7d32";
    default:
      return "#111";
  }
}

function scoreColor(score?: number) {
  if (!score) return "#777";
  if (score >= 80) return "#2e7d32";
  if (score >= 60) return "#1565c0";
  if (score >= 40) return "#ef6c00";
  return "#b71c1c";
}

function classificationLabel(classification?: string | null) {
  if (!classification) return "";
  return CLASSIFICATION_LABELS[classification] ?? "その他";
}

function formatConfidence(confidence?: number | null) {
  if (typeof confidence !== "number" || !Number.isFinite(confidence)) return "";
  const percentage = confidence <= 1 ? confidence * 100 : confidence;
  const rounded = Math.round(Math.max(0, Math.min(100, percentage)));
  return `信頼度 ${rounded}%`;
}

function classificationBadgeStyle(classification?: string | null) {
  const isReview = classification === "needs_review_or_misinformation_risk";

  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    padding: "1px 7px",
    fontSize: 11,
    fontWeight: 600,
    lineHeight: 1.4,
    whiteSpace: "nowrap" as const,
    border: isReview ? "1px solid #fde68a" : "1px solid #e2e8f0",
    background: isReview ? "#fffbeb" : "#ffffff",
    color: isReview ? "#92400e" : "#64748b",
  };
}

export default function ReplyGroup({
  op,
  hideLowScore,
  onHidePost,
}: any) {
  if (!op.children?.length) return null;

  return (
    <details style={{ marginTop: 10 }}>
      <summary
        style={{
          cursor: "pointer",
          fontWeight: 700,
          color: "#555",
        }}
      >
        この意見への返信（{op.children.length}件）
      </summary>

      <div
        style={{
          marginTop: 10,
          padding: "10px 0 0 14px",
          borderLeft: "2px solid #cbd5e1",
          display: "grid",
          gap: 8,
        }}
      >
        <div
          style={{
            color: "#64748b",
            fontSize: 12,
            fontWeight: 600,
            lineHeight: 1.5,
            marginBottom: 2,
          }}
        >
          この意見に対する返信です
        </div>

        {op.children.map((child: any) => {
          const childScore = child.logic_score ?? 0;
          const split = splitContent(child.content);
          const aiClassification = child.ai_classification as
            | AiClassification
            | null
            | undefined;
          const aiClassificationLabel = classificationLabel(
            aiClassification?.classification
          );
          const aiClassificationConfidence = formatConfidence(
            aiClassification?.confidence
          );
          const aiClassificationTitle = aiClassification?.reason
            ? `理由: ${aiClassification.reason}`
            : undefined;
          const canHideChild =
            !!onHidePost &&
            child.can_delete === true;

          const childOpacity =
            hideLowScore && childScore > 0 && childScore < 60
              ? 0.65
              : childScore >= 80
              ? 1
              : childScore >= 60
              ? 0.95
              : childScore >= 40
              ? 0.85
              : 0.75;

          return (
            <PostCard
              key={child.id}
              style={{
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                color: "#111",
                opacity: childOpacity,
                boxShadow: "none",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                  marginBottom: 6,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#64748b",
                  }}
                >
                  <span
                    style={{
                      color: roleColor(child.post_role),
                      fontWeight: 700,
                    }}
                  >
                    {roleLabel(child.post_role)}
                  </span>
                  <span style={{ color: "#64748b" }}>・</span>
                  <span>
                    AI評価{" "}
                    <span style={{ color: scoreColor(childScore) }}>
                      {childScore || "未評価"}
                    </span>
                  </span>
                </div>

                {aiClassificationLabel && (
                  <span
                    title={aiClassificationTitle}
                    style={classificationBadgeStyle(
                      aiClassification?.classification
                    )}
                  >
                    AI分類: {aiClassificationLabel}
                    {aiClassificationConfidence
                      ? ` / ${aiClassificationConfidence}`
                      : ""}
                  </span>
                )}

                {canHideChild && (
                  <button
                    type="button"
                    onClick={() => onHidePost(child.id)}
                    style={{
                      flexShrink: 0,
                      fontSize: 12,
                      color: "#6b7280",
                      background: "transparent",
                      border: "1px solid #d1d5db",
                      borderRadius: 999,
                      cursor: "pointer",
                      padding: "4px 8px",
                      lineHeight: 1.2,
                    }}
                  >
                    非表示
                  </button>
                )}
              </div>

              <div style={{ marginBottom: 6 }}>
                <b>主張</b>
                <div>{split.claim}</div>
              </div>

              {split.premises.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <b>前提</b>
                  <ul style={{ paddingLeft: 20 }}>
                    {split.premises.map((p: string, i: number) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}

              {split.reasons.length > 0 && (
                <div>
                  <b>根拠</b>
                  <ul style={{ paddingLeft: 20 }}>
                    {split.reasons.map((r: string, i: number) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

            </PostCard>
          );
        })}
      </div>
    </details>
  );
}
