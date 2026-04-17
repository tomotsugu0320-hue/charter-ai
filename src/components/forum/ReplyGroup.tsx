//   src/components/forum/ReplyGroup.tsx


"use client";

import PostCard from "@/components/forum/PostCard";

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

export default function ReplyGroup({
  op,
  hideLowScore,
  onHidePost,
  currentAuthorKey,
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
        返信を見る（{op.children.length}件）
      </summary>

      <div
        style={{
          marginTop: 10,
          paddingLeft: 12,
          borderLeft: "3px solid #ddd",
          display: "grid",
          gap: 8,
        }}
      >
        {op.children.map((child: any) => {
          const childScore = child.logic_score ?? 0;
          const split = splitContent(child.content);
          const canHideChild =
            !!onHidePost &&
            !!currentAuthorKey &&
            child.author_key === currentAuthorKey;

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
                background: "#fafafa",
                border: "1px solid #ddd",
                color: "#111",
                opacity: childOpacity,
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
                    fontWeight: 700,
                    color: roleColor(child.post_role),
                  }}
                >
                  {roleLabel(child.post_role)}（
                  <span style={{ color: scoreColor(childScore) }}>
                    {childScore || "未評価"}
                  </span>
                  ）
                </div>

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
