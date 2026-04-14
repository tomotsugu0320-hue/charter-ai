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

function scoreColor(score?: number) {
  if (!score) return "#777";
  if (score >= 80) return "#2e7d32";
  if (score >= 60) return "#1565c0";
  if (score >= 40) return "#ef6c00";
  return "#b71c1c";
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
}: any) {
  const score = op.opinion.logic_score ?? 0;

const displayText = op.opinion.is_sensitive
  ? "（非公開）プライバシー保護のため一部内容を表示していません"
  : (op.opinion.sanitized_text || op.opinion.content);

const { claim, premises, reasons } = splitContent(displayText);

  return (
    <PostCard
      style={{
        marginBottom: 16,
        background: "#fff",
        color: "#111",
        border: "1px solid #ddd",
        opacity:
          hideLowScore && score > 0 && score < 60
            ? 0.65
            : score >= 80
            ? 1
            : score >= 60
            ? 0.95
            : score >= 40
            ? 0.85
            : 0.75,
      }}
    >
      <div
        style={{
          fontWeight: 700,
          marginBottom: 6,
          color: roleColor(op.opinion.post_role),
        }}
      >
        💬 {roleLabel(op.opinion.post_role)}
        <span style={{ marginLeft: 8, color: scoreColor(score) }}>
          {score || "未評価"}
        </span>
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
          反論
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
          補足
        </PrimaryButton>
      </div>

      <div>
        <div style={{ marginBottom: 6 }}>
          <b>主張</b>
          <div>{claim}</div>
        </div>

        {premises.length > 0 && (
          <div style={{ marginBottom: 6 }}>
            <b>前提</b>
            <ul style={{ paddingLeft: 20 }}>
              {premises.map((p: string, i: number) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        )}

        {reasons.length > 0 && (
          <div>
            <b>根拠</b>
            <ul style={{ paddingLeft: 20 }}>
              {reasons.map((r: string, i: number) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: 10,
          marginBottom: 10,
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        {[
  ["term_unknown", "AIで言葉を解説"],
  ["premise_unknown", "AIで前提を解説"],
  ["conclusion_unknown", "AIで結論を解説"],
  ["evidence_unknown", "AIで根拠を解説"],
  ["counterargument_unknown", "AIで反対意見を解説"],
].map(([type, label]) => (
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

      <ReplyGroup op={op} hideLowScore={hideLowScore} />
    </PostCard>
  );
}