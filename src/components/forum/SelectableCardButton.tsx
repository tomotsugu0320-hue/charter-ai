//   src/components/forum/SelectableCardButton.tsx


type Props = {
  title: string;
  hint?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
  variant?: "default" | "danger" | "info";
};

export default function SelectableCardButton({
  title,
  hint = "議論を見る・ここから意見を書く →",
  onClick,
  style,
  variant = "default",
}: Props) {
  const baseStyle: React.CSSProperties =
    variant === "danger"
      ? {
          width: "100%",
          display: "grid",
          gap: 8,
          textAlign: "left",
          border: "1px solid #f44336",
          borderRadius: 10,
          padding: "10px 12px",
          background: "#fff5f5",
          color: "#111",
          fontSize: 16,
          cursor: "pointer",
          fontWeight: 700,
        }
      : variant === "info"
      ? {
          width: "100%",
          display: "grid",
          gap: 8,
          textAlign: "left",
          border: "1px solid #2196f3",
          borderRadius: 10,
          padding: "10px 12px",
          background: "#f0f6ff",
          color: "#111",
          fontSize: 16,
          cursor: "pointer",
          fontWeight: 700,
        }
      : {
          width: "100%",
          display: "grid",
          gap: 8,
          textAlign: "left",
          border: "1px solid #ddd",
          borderRadius: 10,
          padding: "12px 14px",
          background: "#fff",
          color: "#111",
          fontSize: 16,
          cursor: "pointer",
        };

  const hintColor =
    variant === "danger" ? "#b71c1c" : variant === "info" ? "#0d47a1" : "#0d47a1";

  return (
    <button onClick={onClick} style={{ ...baseStyle, ...style }}>
      <span style={{ lineHeight: 1.6 }}>{title}</span>
      <span
        style={{
          fontSize: 16,
          color: hintColor,
          fontWeight: 700,
          lineHeight: 1.4,
          whiteSpace: "nowrap",
        }}
      >
        {hint}
      </span>
    </button>
  );
}
