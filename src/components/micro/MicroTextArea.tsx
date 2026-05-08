import { TextareaHTMLAttributes } from "react";

type MicroTextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export default function MicroTextArea({ style, ...props }: MicroTextAreaProps) {
  return (
    <textarea
      {...props}
      style={{
        width: "100%",
        boxSizing: "border-box",
        resize: "vertical",
        borderRadius: 8,
        border: "1px solid #4b5563",
        background: "#0f172a",
        color: "#f8fafc",
        padding: 12,
        fontSize: 16,
        lineHeight: 1.6,
        outline: "none",
        ...style,
      }}
    />
  );
}
