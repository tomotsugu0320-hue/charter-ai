//   src/components/forum/PostCard.tsx


type Props = {
  children: React.ReactNode;
  style?: React.CSSProperties;
};

export default function PostCard({ children, style }: Props) {
  return (
    <div
      style={{
        border: "1px solid #333",
        borderRadius: 10,
        padding: 12,
        background: "#1a1a1a",
        color: "#fff",
        marginBottom: 8,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

