type MicroSourceDataCardProps = {
  content: string;
  lastUsedAt: string | null;
  sourceType: string;
  title: string | null;
  pinned: boolean;
  archiveDisabled?: boolean;
  openDisabled?: boolean;
  pinDisabled?: boolean;
  summarizeDisabled?: boolean;
  summary: string | null;
  usageCount: number;
  onArchive: () => void;
  onOpen: () => void;
  onSummarize: () => void;
  onTogglePin: () => void;
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

function formatLastUsedAt(value: string | null) {
  if (!value) return "未使用";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未使用";

  return date.toLocaleString("ja-JP");
}

export default function MicroSourceDataCard({
  archiveDisabled = false,
  content,
  lastUsedAt,
  openDisabled = false,
  pinned,
  pinDisabled = false,
  sourceType,
  summarizeDisabled = false,
  summary,
  title,
  usageCount,
  onArchive,
  onOpen,
  onSummarize,
  onTogglePin,
}: MicroSourceDataCardProps) {
  const sourceTypeLabel = sourceTypeLabels[sourceType] ?? sourceType;
  const displayTitle = title?.trim() || "無題";

  return (
    <article
      onClick={openDisabled ? undefined : onOpen}
      style={{
        background: "#0f172a",
        color: "#f8fafc",
        border: "1px solid #334155",
        borderRadius: 8,
        padding: 14,
        lineHeight: 1.7,
        cursor: openDisabled ? "progress" : "pointer",
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
          flexWrap: "wrap",
          gap: 8,
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

        {pinned && (
          <span
            style={{
              background: "#78350f",
              color: "#fef3c7",
              border: "1px solid #92400e",
              borderRadius: 999,
              padding: "3px 9px",
              fontSize: 12,
              fontWeight: 700,
              lineHeight: 1.5,
            }}
          >
            ピン留め中
          </span>
        )}
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

      {summary && (
        <div
          style={{
            marginTop: 12,
            background: "#172554",
            color: "#dbeafe",
            border: "1px solid #1d4ed8",
            borderRadius: 8,
            padding: "10px 12px",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            lineHeight: 1.6,
          }}
        >
          {summary}
        </div>
      )}

      <div
        style={{
          marginTop: 12,
          color: "#cbd5e1",
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        利用回数: {usageCount ?? 0} / 最終利用:{" "}
        {formatLastUsedAt(lastUsedAt)}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          flexWrap: "wrap",
          gap: 8,
          marginTop: 12,
        }}
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSummarize();
          }}
          disabled={summarizeDisabled}
          style={{
            border: summarizeDisabled ? "1px solid #4b5563" : "1px solid #1d4ed8",
            borderRadius: 8,
            background: summarizeDisabled ? "#374151" : "#172554",
            color: summarizeDisabled ? "#d1d5db" : "#dbeafe",
            cursor: summarizeDisabled ? "not-allowed" : "pointer",
            padding: "7px 12px",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {summarizeDisabled ? "整理中" : summary ? "再整理" : "整理"}
        </button>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onTogglePin();
          }}
          disabled={pinDisabled}
          style={{
            border: pinDisabled ? "1px solid #4b5563" : "1px solid #92400e",
            borderRadius: 8,
            background: pinDisabled ? "#374151" : "#78350f",
            color: pinDisabled ? "#d1d5db" : "#fef3c7",
            cursor: pinDisabled ? "not-allowed" : "pointer",
            padding: "7px 12px",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {pinDisabled ? "更新中" : pinned ? "ピン解除" : "ピン"}
        </button>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onArchive();
          }}
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
