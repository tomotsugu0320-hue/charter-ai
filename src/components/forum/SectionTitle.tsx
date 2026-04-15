//   src/components/forum/SectionTitle.tsx


type Props = {
  children: React.ReactNode;
  fontSize?: number;
  style?: React.CSSProperties;
};

export default function SectionTitle({ children, fontSize, style }: Props) {
  return (
    <h2
      style={{
        fontSize: fontSize ?? 18,
        ...style,
      }}
    >
      {children}
    </h2>
  );
}