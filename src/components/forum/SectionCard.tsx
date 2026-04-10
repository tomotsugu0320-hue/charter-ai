//   src/components/forum/SectionCard.tsx



type Props = {
  children: React.ReactNode;
};

export default function SectionCard({ children }: Props) {
  return (
    <div
      style={{
        background: "#1a1a1a",
        color: "#fff",
        border: "1px solid #333",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
      }}
    >
      {children}
    </div>
  );
}


