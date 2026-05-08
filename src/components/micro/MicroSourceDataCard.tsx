type MicroSourceDataCardProps = {
  content: string;
};

export default function MicroSourceDataCard({
  content,
}: MicroSourceDataCardProps) {
  return (
    <article
      style={{
        background: "#0f172a",
        color: "#f8fafc",
        border: "1px solid #334155",
        borderRadius: 8,
        padding: 14,
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        lineHeight: 1.7,
      }}
    >
      {content}
    </article>
  );
}
