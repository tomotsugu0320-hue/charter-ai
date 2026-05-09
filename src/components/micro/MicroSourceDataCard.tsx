type MicroSourceDataCardProps = {
  content: string;
  sourceType: string;
  title: string | null;
  archiveDisabled?: boolean;
  onArchive: () => void;
};

const sourceTypeLabels: Record<string, string> = {
  free_log: "フリーログ",
  smart_note: "スマートノート",
  chat_log: "チャットログ",
  imported_text: "取り込みテキスト",
  manual: "手入力",
  voice: "音声メモ",
  chatgpt_share: "ChatGPT共有",
  line: "LINE",
  web_clip: "Webクリップ",
};

export default function MicroSourceDataCard({
  archiveDisabled = false,
  content,
  sourceType,
  title,
  onArchive,
}: MicroSourceDataCardProps) {
  const sourceTypeLabel = sourceTypeLabels[sourceType] ?? sourceType;
  const displayTitle = title?.trim() || "無題";

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
      <h3
        style={{
          margin: "0 0 10px",
          color: "#ffffff",
          fontSize: 17,
          lineHeight: 1.4,
          overflowWrap: "anywhere",
        }}
      >
        {displayTitle}
      </h3>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-start",
          marginBottom: 10,
        }}
      >
        <span
          style={{
            background: "#1e293b",
            color: "#e0f2fe",
            border: "1px solid #334155",
            borderRadius: 999,
            padding: "3px 9px",
            fontSize: 12,
            fontWeight: 700,
            lineHeight: 1.5,
          }}
        >
          {sourceTypeLabel}
        </span>
      </div>

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
