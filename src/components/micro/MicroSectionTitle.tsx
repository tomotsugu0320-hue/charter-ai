type MicroSectionTitleProps = {
  children: string;
  level?: 1 | 2;
};

export default function MicroSectionTitle({
  children,
  level = 2,
}: MicroSectionTitleProps) {
  const Tag = level === 1 ? "h1" : "h2";

  return (
    <Tag
      style={{
        margin: 0,
        fontSize: level === 1 ? 24 : 18,
        lineHeight: level === 1 ? 1.3 : 1.4,
        color: "#ffffff",
      }}
    >
      {children}
    </Tag>
  );
}
