//   src/components/forum/SectionCard.tsx

type Props = {
  children: React.ReactNode;
  style?: React.CSSProperties;
  variant?: "dark" | "white" | "soft" | "info";
};

export default function SectionCard({
  children,
  style,
  variant = "dark",
}: Props) {
  const baseStyle: React.CSSProperties =
    variant === "white"
      ? {
          background: "#fff",
          color: "#111",
          border: "1px solid #ddd",
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
        }
      : variant === "soft"
      ? {
          background: "#f6f6f6",
          color: "#111",
          border: "1px solid #e5e5e5",
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
        }
      : variant === "info"
      ? {
          background: "#eef4ff",
          color: "#0d47a1",
          border: "1px solid #c9d8ff",
          borderRadius: 10,
          padding: "12px 14px",
          marginBottom: 12,
        }
      : {
          background: "#1a1a1a",
          color: "#fff",
          border: "1px solid #333",
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
        };

  return <div style={{ ...baseStyle, ...style }}>{children}</div>;
}


