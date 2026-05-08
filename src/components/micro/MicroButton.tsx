import { ButtonHTMLAttributes, ReactNode } from "react";

type MicroButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export default function MicroButton({
  children,
  disabled,
  style,
  ...props
}: MicroButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled}
      style={{
        alignSelf: "flex-start",
        border: disabled ? "1px solid #4b5563" : "1px solid #60a5fa",
        borderRadius: 8,
        background: disabled ? "#374151" : "#2563eb",
        color: disabled ? "#d1d5db" : "#ffffff",
        cursor: disabled ? "not-allowed" : "pointer",
        padding: "10px 16px",
        fontSize: 15,
        fontWeight: 700,
        ...style,
      }}
    >
      {children}
    </button>
  );
}
