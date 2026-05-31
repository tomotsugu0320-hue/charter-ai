//   src/components/forum/OpinionCard.tsx


"use client";

import PostCard from "@/components/forum/PostCard";
import PrimaryButton from "@/components/forum/PrimaryButton";
import ReplyGroup from "@/components/forum/ReplyGroup";
import SectionCard from "@/components/forum/SectionCard";

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


function scrollToPostForm() {
  const el = document.getElementById("post-form");
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}


function roleLabel(role: string) {
  switch (role) {
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

function roleBadgeStyle(role: string) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "2px 8px",
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1.4,
    whiteSpace: "nowrap" as const,
  };

  switch (role) {
    case "issue_raise":
      return {
        ...base,
        border: "1px solid #ddd6fe",
        background: "#f5f3ff",
        color: "#5b21b6",
      };
    case "rebuttal":
      return {
        ...base,
        border: "1px solid #fecaca",
        background: "#fef2f2",
        color: "#991b1b",
      };
    case "supplement":
      return {
        ...base,
        border: "1px solid #bfdbfe",
        background: "#eff6ff",
        color: "#1d4ed8",
      };
    case "explanation":
      return {
        ...base,
        border: "1px solid #bbf7d0",
        background: "#f0fdf4",
        color: "#166534",
      };
    case "opinion":
      return {
        ...base,
        border: "1px solid #d1d5db",
        background: "#f9fafb",
        color: "#111827",
      };
    default:
      return {
        ...base,
        border: "1px solid #d1d5db",
        background: "#f9fafb",
        color: "#374151",
      };
  }
}

function stanceLabelText(stance?: string | null) {
  switch (stance) {
    case "support":
      return "賛成";
    case "oppose":
      return "反対";
    case "neutral":
      return "中立";
    case "other":
      return "その他";
    case "unknown":
      return "未分類";
    default:
      return "";
  }
}


function scoreColor(score?: number) {
  if (score === null || score === undefined) return "#777";
  if (score >= 80) return "#2e7d32";
  if (score >= 60) return "#1565c0";
  if (score >= 40) return "#ef6c00";
  return "#b71c1c";
}

function logicScoreReasonText(reason: string) {
  const text = reason.trim();
  const isFallbackReason =
    text.startsWith("fallback") ||
    text.includes("fallback +") ||
    text.includes("fallback strict");

  if (!isFallbackReason) return text;

  if (text.includes("主張のみ") || text.includes("根拠不足")) {
    return "簡易判定：主張はありますが、理由・根拠・因果関係がまだ十分ではありません。";
  }

  if (text.includes("因果・根拠が弱い")) {
    return "簡易判定：理由はありますが、因果関係や根拠の説明がまだ弱い状態です。";
  }

  return "簡易判定：この投稿はまだAI詳細評価前です。前提・根拠・因果関係をもとに仮判定しています。";
}

function scoreBadgeStyle(score?: number | null) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "2px 8px",
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1.4,
    whiteSpace: "nowrap" as const,
  };

  if (score === null || score === undefined) {
    return {
      ...base,
      border: "1px solid #e2e8f0",
      background: "#f8fafc",
      color: "#64748b",
    };
  }

  if (score >= 80) {
    return {
      ...base,
      border: "1px solid #bbf7d0",
      background: "#f0fdf4",
      color: scoreColor(score),
    };
  }

  if (score >= 60) {
    return {
      ...base,
      border: "1px solid #bfdbfe",
      background: "#eff6ff",
      color: scoreColor(score),
    };
  }

  if (score >= 40) {
    return {
      ...base,
      border: "1px solid #fed7aa",
      background: "#fff7ed",
      color: scoreColor(score),
    };
  }

  return {
    ...base,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: scoreColor(score),
  };
}

export default function OpinionCard({
  op,
  hideLowScore,
  currentFont,
  setSelectedGuide,
  setPostRole,
  setReplyToOpinionId,
  explanations,
  feedbackLoadingPostId,
  handleFeedback,
  onHidePost,
}: any) {
const score = op.opinion.logic_score;
const numericScore =
  typeof score === "number"
    ? score
    : typeof score === "string" && score.trim() !== ""
    ? Number(score)
    : null;
const isLowScore =
  typeof numericScore === "number" &&
  Number.isFinite(numericScore) &&
  numericScore > 0 &&
  numericScore < 60;
  const canHideOpinion =
    !!onHidePost &&
    !String(op.opinion.id).startsWith("virtual-") &&
    op.opinion.can_delete === true;

const displayText = op.opinion.is_sensitive
  ? "（非公開）プライバシー保護のため一部内容を表示していません"
  : (op.opinion.sanitized_text || op.opinion.content);

const { claim, premises, reasons } = splitContent(displayText);
const savedConclusionExplanation = String(
  op.opinion.ai_conclusion_explanation ?? ""
).trim();
const savedCounterargumentExplanation = String(
  op.opinion.ai_counterargument_explanation ?? ""
).trim();
const stanceText = stanceLabelText(op.opinion.stance_label);
const logicScoreReason = String(op.opinion.logic_score_reason ?? "").trim();
const displayLogicScoreReason = logicScoreReasonText(logicScoreReason);
const logicBreakType = String(op.opinion.logic_break_type ?? "").trim();
const logicBreakNote = String(op.opinion.logic_break_note ?? "").trim();
const shouldShowLogicBreakNote =
  logicBreakType && logicBreakType !== "none" && logicBreakNote;
const feedbackActions = [
  ["conclusion_unknown", "AIで結論を解説"],
  ["counterargument_unknown", "AIで反対意見を解説"],
].filter(([type]) => {
  if (type === "conclusion_unknown") return !savedConclusionExplanation;
  if (type === "counterargument_unknown") return !savedCounterargumentExplanation;
  return true;
});

  return (
    <PostCard
      style={{
        marginBottom: 16,
        background: "#fff",
        color: "#111",
        border: "1px solid #ddd",
        opacity: hideLowScore && isLowScore ? 0.5 : 1,
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
            gap: 8,
            fontWeight: 700,
            color: roleColor(op.opinion.post_role),
          }}
        >
          <span style={roleBadgeStyle(op.opinion.post_role)}>
            {roleLabel(op.opinion.post_role)}
          </span>
<span style={scoreBadgeStyle(score)}>
  {score === null || score === undefined ? "AI論理スコア 未評価" : `AI論理スコア ${score}点`}
</span>
          {stanceText && (
            <span
              style={{
                marginLeft: 8,
                padding: "2px 7px",
                border: "1px solid #d1d5db",
                borderRadius: 999,
                background: "#f9fafb",
                color: "#374151",
                fontSize: currentFont?.base ? currentFont.base * 0.85 : 12,
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              立場: {stanceText}
            </span>
          )}
        </div>

        {canHideOpinion && (
          <button
            type="button"
            onClick={() => onHidePost(op.opinion.id)}
            style={{
              flexShrink: 0,
              fontSize: 12,
              color: "#6b7280",
              border: "1px solid #d1d5db",
              borderRadius: 999,
              background: "transparent",
              cursor: "pointer",
              padding: "4px 8px",
              lineHeight: 1.2,
            }}
          >
            非表示
          </button>
        )}
      </div>

{op.opinion.is_sensitive && (
  <div
    style={{
      marginBottom: 10,
      padding: "8px 10px",
      borderRadius: 8,
      background: "#fff8e1",
      border: "1px solid #f0c36d",
      color: "#8a5a00",
      fontSize: currentFont?.base ? currentFont.base * 0.9 : 14,
      lineHeight: 1.6,
      fontWeight: 700,
    }}
  >
    ⚠ プライバシー保護のため元の文章は非公開です
  </div>
)}

      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 8,
          flexWrap: "wrap",
        }}
      >
        <PrimaryButton
onClick={() => {
setSelectedGuide({ type: "根拠", text: displayText });
  setPostRole("rebuttal");
  setReplyToOpinionId(op.opinion.id);
window.dispatchEvent(new Event("scroll-to-post-form"));
}}
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            fontSize: currentFont?.base,
          }}
        >
          反論する
        </PrimaryButton>

        <PrimaryButton
onClick={() => {
setSelectedGuide({ type: "前提", text: displayText });
  setPostRole("supplement");
  setReplyToOpinionId(op.opinion.id);

window.dispatchEvent(new Event("scroll-to-post-form"));
}}
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            fontSize: currentFont?.base,
          }}
        >
          補足する
        </PrimaryButton>
      </div>

      <div>
        <div style={{ marginBottom: 6 }}>
          <b>主張</b>
          <div>{claim}</div>
        </div>

      </div>

      {displayLogicScoreReason && (
        <div
          style={{
            marginTop: 10,
            marginBottom: 10,
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            background: "#f8fafc",
            color: "#334155",
            padding: "10px 12px",
            fontSize: currentFont?.base,
            lineHeight: 1.7,
          }}
        >
          <div
            style={{
              marginBottom: 6,
              color: "#0f172a",
              fontWeight: 800,
            }}
          >
            AI論理スコアの理由
          </div>
          <div>{displayLogicScoreReason}</div>
          {shouldShowLogicBreakNote && (
            <div
              style={{
                marginTop: 8,
                color: "#475569",
                fontWeight: 700,
              }}
            >
              補足: {logicBreakNote}
            </div>
          )}
          <PrimaryButton
            onClick={() => {
              setSelectedGuide({
                type: "根拠",
                text: `AI評価への反論: ${displayLogicScoreReason}`,
              });
              setPostRole("supplement");
              setReplyToOpinionId(op.opinion.id);
              window.dispatchEvent(new Event("scroll-to-post-form"));
            }}
            style={{
              marginTop: 10,
              padding: "6px 10px",
              borderRadius: 6,
              fontSize: currentFont?.base,
            }}
          >
            このAI評価に反論する
          </PrimaryButton>
        </div>
      )}

      {(savedConclusionExplanation || savedCounterargumentExplanation) && (
        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          {savedConclusionExplanation && (
<SectionCard
  variant="info"
  style={{
    color: "#111",
    fontSize: currentFont?.base,
    lineHeight: 1.7,
    border: "1px solid #bbdefb",
  }}
>
  <div
    style={{
      fontWeight: 800,
      marginBottom: 6,
      color: "#0d47a1",
    }}
  >
    AIの整理
  </div>
  <div>{savedConclusionExplanation}</div>
</SectionCard>
          )}

          {savedCounterargumentExplanation && (
<SectionCard
  variant="info"
  style={{
    color: "#111",
    fontSize: currentFont?.base,
    lineHeight: 1.7,
    border: "1px solid #bbdefb",
  }}
>
  <div
    style={{
      fontWeight: 800,
      marginBottom: 6,
      color: "#0d47a1",
    }}
  >
    反対側の見方
  </div>
  <div>{savedCounterargumentExplanation}</div>
</SectionCard>
          )}
        </div>
      )}

      {feedbackActions.length > 0 && (
      <div
        style={{
          marginTop: 10,
          marginBottom: 10,
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        {feedbackActions.map(([type, label]) => (
          <PrimaryButton
            key={type}
            variant="secondary"
            onClick={() => handleFeedback(op.opinion.id, type)}
            disabled={feedbackLoadingPostId === op.opinion.id}
            style={{
              borderRadius: 999,
              padding: "6px 10px",
              fontSize: currentFont?.base,
            }}
          >
            {label}
          </PrimaryButton>
        ))}
      </div>
      )}

<PrimaryButton
  variant="secondary"
  onClick={() =>
    window.open(
      `https://www.google.com/search?q=${encodeURIComponent(claim || displayText)}`,
      "_blank"
    )
  }
  style={{
    borderRadius: 999,
    padding: "5px 9px",
    fontSize: currentFont?.base ? currentFont.base * 0.9 : undefined,
    marginTop: 2,
  }}
>
  Googleで調べる
</PrimaryButton>

      {feedbackLoadingPostId === op.opinion.id &&
        !explanations?.[op.opinion.id] && (
<div
  style={{
    color: "#666",
    marginTop: 6,
    fontSize: currentFont?.base,
    fontWeight: 700,
  }}
>
  AIがこの意見を分析中...
</div>
        )}

      {explanations?.[op.opinion.id] && (
<SectionCard
  variant="info"
  style={{
    marginTop: 8,
    color: "#111",
    fontSize: currentFont?.base,
    lineHeight: 1.7,
    border: "1px solid #bbdefb",
  }}
>
  <div
    style={{
      fontWeight: 800,
      marginBottom: 6,
      color: "#0d47a1",
    }}
  >
    🤖 AI解説
  </div>
  <div>{explanations[op.opinion.id]}</div>
</SectionCard>
      )}

      <ReplyGroup
        op={op}
        hideLowScore={hideLowScore}
        onHidePost={onHidePost}
      />
    </PostCard>
  );
}
