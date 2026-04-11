//   src/components/forum/LinkButton.tsx


type Props = {
  href: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  target?: "_self" | "_blank";
  rel?: string;
  variant?: "default" | "subtle" | "card";
};

export default function LinkButton({
  href,
  children,
  style,
  target,
  rel,
  variant = "default",
}: Props) {
  const baseStyle: React.CSSProperties =
    variant === "subtle"
      ? {
          color: "#0d47a1",
          textDecoration: "none",
          fontWeight: 700,
          display: "inline-block",
        }
      : variant === "card"
      ? {
          display: "block",
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: "10px 12px",
          background: "#fff",
          textDecoration: "none",
          color: "#111",
        }
      : {
          display: "inline-block",
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid #ccc",
          textDecoration: "none",
          fontWeight: 700,
          color: "#111",
          background: "#fff",
        };

  return (
    <a href={href} target={target} rel={rel} style={{ ...baseStyle, ...style }}>
      {children}
    </a>
  );
}



