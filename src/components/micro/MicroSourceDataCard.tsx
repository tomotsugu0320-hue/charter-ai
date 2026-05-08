type MicroSourceDataCardProps = {
  content: string;
  archiveDisabled?: boolean;
  onArchive: () => void;
};

export default function MicroSourceDataCard({
  archiveDisabled = false,
  content,
  onArchive,
}: MicroSourceDataCardProps) {
  return (
    <article
      style={{
        background: "#0f172a",
        color: "#f8fafc",
        border: "1px solid #334155",
        borderRadius: 8,
        padding: 14,
        lineHeight: 1.7,
      }}
    >
      <div
        style={{
          color: "#f8fafc",
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
        }}
      >
        {content}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: 12,
        }}
      >
        <button
          type="button"
          onClick={onArchive}
          disabled={archiveDisabled}
          style={{
            border: archiveDisabled ? "1px solid #4b5563" : "1px solid #64748b",
            borderRadius: 8,
            background: archiveDisabled ? "#374151" : "#1e293b",
            color: archiveDisabled ? "#d1d5db" : "#f8fafc",
            cursor: archiveDisabled ? "not-allowed" : "pointer",
            padding: "7px 12px",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {archiveDisabled ? "保管中" : "保管"}
        </button>
      </div>
    </article>
  );
}
