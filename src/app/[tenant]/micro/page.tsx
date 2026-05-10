"use client";

import {
  CSSProperties,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams } from "next/navigation";
import MicroButton from "@/components/micro/MicroButton";
import MicroSectionCard from "@/components/micro/MicroSectionCard";
import MicroSectionTitle from "@/components/micro/MicroSectionTitle";
import MicroSourceDataCard from "@/components/micro/MicroSourceDataCard";
import MicroTextArea from "@/components/micro/MicroTextArea";

type SourceData = {
  id: string;
  title: string | null;
  raw_content: string;
  source_type: string;
  pinned: boolean;
  usage_count: number;
  last_used_at: string | null;
  summary: string | null;
};

type SourceDataResponse = {
  success?: boolean;
  error?: string;
  sourceData?: SourceData[];
};

type SummaryResponse = {
  success?: boolean;
  error?: string;
};

function getTenantSlug(params: ReturnType<typeof useParams>) {
  const value = params?.tenant;

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return typeof value === "string" ? value : "";
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#111827",
  color: "#f9fafb",
  padding: "32px 16px",
};

const shellStyle: CSSProperties = {
  width: "100%",
  maxWidth: 720,
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: 20,
};

const formStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  marginTop: 16,
};

const fieldStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const labelStyle: CSSProperties = {
  color: "#e5e7eb",
  fontSize: 14,
  fontWeight: 700,
};

const selectStyle: CSSProperties = {
  width: "100%",
  borderRadius: 8,
  border: "1px solid #4b5563",
  background: "#0f172a",
  color: "#f8fafc",
  padding: "10px 12px",
  fontSize: 15,
  outline: "none",
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  borderRadius: 8,
  border: "1px solid #4b5563",
  background: "#0f172a",
  color: "#f8fafc",
  padding: "10px 12px",
  fontSize: 15,
  outline: "none",
};

const mutedTextStyle: CSSProperties = {
  margin: "16px 0 0",
  color: "#d1d5db",
};

const messageStyle: CSSProperties = {
  margin: "14px 0 0",
  color: "#fecaca",
  background: "#7f1d1d",
  border: "1px solid #ef4444",
  borderRadius: 8,
  padding: "10px 12px",
};

const listStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  marginTop: 16,
};

const sourceTypeOptions = [
  { value: "free_log", label: "フリーログ" },
  { value: "smart_note", label: "スマートノート" },
  { value: "chat_log", label: "チャットログ" },
  { value: "imported_text", label: "取り込みテキスト" },
  { value: "manual", label: "手入力" },
  { value: "voice", label: "音声メモ" },
  { value: "chatgpt_share", label: "ChatGPT共有" },
  { value: "line", label: "LINE" },
  { value: "web_clip", label: "Webクリップ" },
];

export default function MicroPage() {
  const params = useParams();
  const tenantSlug = useMemo(() => getTenantSlug(params), [params]);

  const [items, setItems] = useState<SourceData[]>([]);
  const [title, setTitle] = useState("");
  const [rawContent, setRawContent] = useState("");
  const [sourceType, setSourceType] = useState("free_log");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [pinningId, setPinningId] = useState<string | null>(null);
  const [summarizingId, setSummarizingId] = useState<string | null>(null);
  const [touchingId, setTouchingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const loadSourceData = useCallback(async () => {
    if (!tenantSlug) return;

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(
        `/api/micro/source-data?tenant_slug=${encodeURIComponent(tenantSlug)}`,
        { cache: "no-store" }
      );
      const data = (await res.json()) as SourceDataResponse;

      if (!res.ok || data.success === false) {
        throw new Error(data.error || "読み込みに失敗しました");
      }

      setItems(data.sourceData ?? []);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "読み込みに失敗しました"
      );
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    void loadSourceData();
  }, [loadSourceData]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const text = rawContent.trim();
    if (!text || !tenantSlug) return;

    setSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/micro/source-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenant_slug: tenantSlug,
          title: title.trim() || null,
          raw_content: text,
          source_type: sourceType,
        }),
      });
      const data = (await res.json()) as SourceDataResponse;

      if (!res.ok || data.success === false) {
        throw new Error(data.error || "保存に失敗しました");
      }

      setTitle("");
      setRawContent("");
      await loadSourceData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (id: string) => {
    setArchivingId(id);
    setMessage("");

    try {
      const res = await fetch("/api/micro/source-data", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          action: "archive",
        }),
      });
      const data = (await res.json()) as SourceDataResponse;

      if (!res.ok || data.success === false) {
        throw new Error(data.error || "保管に失敗しました");
      }

      await loadSourceData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保管に失敗しました");
    } finally {
      setArchivingId(null);
    }
  };

  const handleTogglePin = async (item: SourceData) => {
    setPinningId(item.id);
    setMessage("");

    try {
      const res = await fetch("/api/micro/source-data", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: item.id,
          action: item.pinned ? "unpin" : "pin",
        }),
      });
      const data = (await res.json()) as SourceDataResponse;

      if (!res.ok || data.success === false) {
        throw new Error(data.error || "ピンの更新に失敗しました");
      }

      await loadSourceData();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "ピンの更新に失敗しました"
      );
    } finally {
      setPinningId(null);
    }
  };

  const handleTouch = async (id: string) => {
    setTouchingId(id);
    setMessage("");

    try {
      const res = await fetch("/api/micro/source-data", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          action: "touch",
        }),
      });
      const data = (await res.json()) as SourceDataResponse;

      if (!res.ok || data.success === false) {
        throw new Error(data.error || "利用記録の更新に失敗しました");
      }

      await loadSourceData();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "利用記録の更新に失敗しました"
      );
    } finally {
      setTouchingId(null);
    }
  };

  const handleSummarize = async (item: SourceData) => {
    setSummarizingId(item.id);
    setMessage("");

    try {
      const res = await fetch("/api/micro/summaries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenantSlug,
          sourceDataId: item.id,
          rawContent: item.raw_content,
        }),
      });
      const data = (await res.json()) as SummaryResponse;

      if (!res.ok || data.success === false) {
        throw new Error(data.error || "整理に失敗しました");
      }

      await loadSourceData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "整理に失敗しました");
    } finally {
      setSummarizingId(null);
    }
  };

  return (
    <main style={pageStyle}>
      <div style={shellStyle}>
        <MicroSectionCard>
          <MicroSectionTitle level={1}>Micro</MicroSectionTitle>

          <form onSubmit={handleSubmit} style={formStyle}>
            <label style={fieldStyle}>
              <span style={labelStyle}>タイトル</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="タイトルを書く"
                style={inputStyle}
              />
            </label>

            <label style={fieldStyle}>
              <span style={labelStyle}>種類</span>
              <select
                value={sourceType}
                onChange={(event) => setSourceType(event.target.value)}
                style={selectStyle}
              >
                {sourceTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <MicroTextArea
              value={rawContent}
              onChange={(event) => setRawContent(event.target.value)}
              placeholder="思考ログを書く"
              rows={5}
            />

            <MicroButton
              type="submit"
              disabled={saving || rawContent.trim().length === 0}
            >
              {saving ? "保存中" : "保存"}
            </MicroButton>
          </form>

          {message && <p style={messageStyle}>{message}</p>}
        </MicroSectionCard>

        <MicroSectionCard>
          <MicroSectionTitle>一覧</MicroSectionTitle>

          {loading ? (
            <p style={mutedTextStyle}>読み込み中</p>
          ) : items.length === 0 ? (
            <p style={mutedTextStyle}>まだ保存されたログはありません。</p>
          ) : (
            <div style={listStyle}>
              {items.map((item) => (
                <MicroSourceDataCard
                  key={item.id}
                  archiveDisabled={archivingId === item.id}
                  content={item.raw_content}
                  lastUsedAt={item.last_used_at}
                  pinned={item.pinned}
                  pinDisabled={pinningId === item.id}
                  sourceType={item.source_type}
                  summary={item.summary}
                  summarizeDisabled={summarizingId === item.id}
                  title={item.title}
                  touchDisabled={touchingId === item.id}
                  usageCount={item.usage_count}
                  onArchive={() => void handleArchive(item.id)}
                  onSummarize={() => void handleSummarize(item)}
                  onTouch={() => void handleTouch(item.id)}
                  onTogglePin={() => void handleTogglePin(item)}
                />
              ))}
            </div>
          )}
        </MicroSectionCard>
      </div>
    </main>
  );
}
