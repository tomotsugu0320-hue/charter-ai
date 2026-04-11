//   src/components/forum/PrimaryButton.tsx


type Props = {
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  style?: React.CSSProperties;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  variant?: "primary" | "secondary" | "outline" | "danger";
};

export default function PrimaryButton({
  children,
  onClick,
  style,
  disabled,
  type = "button",
  variant = "primary",
}: Props) {
  const baseStyle: React.CSSProperties =
    variant === "secondary"
      ? {
          padding: "10px 16px",
          borderRadius: 8,
          background: "#fff",
          color: "#111",
          fontWeight: 700,
          border: "1px solid #ccc",
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.6 : 1,
        }
      : variant === "outline"
      ? {
          padding: "10px 16px",
          borderRadius: 8,
          background: "transparent",
          color: "#111",
          fontWeight: 700,
          border: "1px solid #999",
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.6 : 1,
        }
      : variant === "danger"
      ? {
          padding: "10px 16px",
          borderRadius: 8,
          background: "#b71c1c",
          color: "#fff",
          fontWeight: 700,
          border: "none",
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.6 : 1,
        }
      : {
          padding: "10px 16px",
          borderRadius: 8,
          background: "#1a1a1a",
          color: "#fff",
          fontWeight: 700,
          border: "none",
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.6 : 1,
        };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{ ...baseStyle, ...style }}
    >
      {children}
    </button>
  );
}