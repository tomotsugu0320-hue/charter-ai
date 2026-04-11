//   src/components/forum/SectionTitle.tsx


type Props = {
  children: React.ReactNode;
  style?: React.CSSProperties;
};

export default function SectionTitle({ children, style }: Props) {
  return (
    <h2
      style={{
        fontSize: 20,
        fontWeight: 800,
        marginBottom: 12,
        ...style,
      }}
    >
      {children}
    </h2>
  );
}