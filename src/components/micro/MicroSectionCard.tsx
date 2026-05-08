import { ReactNode } from "react";

type MicroSectionCardProps = {
  children: ReactNode;
};

export default function MicroSectionCard({ children }: MicroSectionCardProps) {
  return (
    <section
      style={{
        background: "#1f2937",
        color: "#f9fafb",
        border: "1px solid #374151",
        borderRadius: 8,
        padding: 20,
      }}
    >
      {children}
    </section>
  );
}
