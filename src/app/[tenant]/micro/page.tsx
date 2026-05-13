"use client";

import Link from "next/link";
import {
  CSSProperties,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
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
  sourceData?: SourceData[] | SourceData;
};

type MicroGroup = {
  id: string;
  title: string;
  description: string | null;
  updated_at: string | null;
};

type GroupsResponse = {
  success?: boolean;
  error?: string;
  groups?: MicroGroup[];
};

type SummaryResponse = {
  success?: boolean;
  error?: string;
};

type MicroActionResponse = {
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

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "日時なし";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "日時なし";

  return date.toLocaleString("ja-JP");
}

function getSourceDataList(value: SourceData[] | SourceData | undefined) {
  return Array.isArray(value) ? value : [];
}

function getCreatedSourceData(value: SourceData[] | SourceData | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseTagInput(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[,\u3001]/)
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#111827",
  color: "#f9fafb",
  padding: "28px 16px",
};

const shellStyle: CSSProperties = {
  width: "100%",
  maxWidth: 720,
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: 16,
};

const formStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  marginTop: 14,
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
  marginTop: 14,
};

const actionRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const navListStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 10,
  marginTop: 14,
};

const navLinkStyle: CSSProperties = {
  display: "block",
  background: "#0f172a",
  color: "#bfdbfe",
  border: "1px solid #334155",
  borderRadius: 8,
  padding: "12px 14px",
  textDecoration: "none",
  fontSize: 15,
  fontWeight: 700,
  lineHeight: 1.5,
};

const currentSearchStyle: CSSProperties = {
  margin: "12px 0 0",
  color: "#bfdbfe",
  background: "#172554",
  border: "1px solid #1d4ed8",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13,
  overflowWrap: "anywhere",
};

const groupListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  marginTop: 14,
};

const groupCardStyle: CSSProperties = {
  width: "100%",
  background: "#0f172a",
  color: "#f8fafc",
  border: "1px solid #334155",
  borderRadius: 8,
  padding: 12,
  textAlign: "left",
  cursor: "pointer",
  font: "inherit",
};

const groupTitleStyle: CSSProperties = {
  margin: 0,
  color: "#ffffff",
  fontSize: 16,
  lineHeight: 1.45,
  fontWeight: 700,
  overflowWrap: "anywhere",
};

const groupDescriptionStyle: CSSProperties = {
  margin: "8px 0 0",
  color: "#d1d5db",
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  lineHeight: 1.6,
};

const groupMetaStyle: CSSProperties = {
  marginTop: 8,
  color: "#93c5fd",
  fontSize: 12,
  lineHeight: 1.5,
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
  const router = useRouter();
  const tenantSlug = useMemo(() => getTenantSlug(params), [params]);

  const [items, setItems] = useState<SourceData[]>([]);
  const [groups, setGroups] = useState<MicroGroup[]>([]);
  const [title, setTitle] = useState("");
  const [rawContent, setRawContent] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceType, setSourceType] = useState("free_log");
  const [loading, setLoading] = useState(false);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [pinningId, setPinningId] = useState<string | null>(null);
  const [summarizingId, setSummarizingId] = useState<string | null>(null);
  const [openingGroupId, setOpeningGroupId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [groupsMessage, setGroupsMessage] = useState("");

  const loadSourceData = useCallback(async () => {
    if (!tenantSlug) return;

    setLoading(true);
    setMessage("");

    try {
      const queryParams = new URLSearchParams({ tenant_slug: tenantSlug });

      if (searchQuery) {
        queryParams.set("q", searchQuery);
      }

      const res = await fetch(
        `/api/micro/source-data?${queryParams.toString()}`,
        { cache: "no-store" }
      );
      const data = (await res.json()) as SourceDataResponse;

      if (!res.ok || data.success === false) {
        throw new Error(data.error || "読み込みに失敗しました");
      }

      setItems(getSourceDataList(data.sourceData));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "読み込みに失敗しました"
      );
    } finally {
      setLoading(false);
    }
  }, [searchQuery, tenantSlug]);

  const loadGroups = useCallback(async () => {
    if (!tenantSlug) return;

    setGroupsLoading(true);
    setGroupsMessage("");

    try {
      const res = await fetch(
        `/api/micro/groups?tenant_slug=${encodeURIComponent(tenantSlug)}`,
        { cache: "no-store" }
      );
      const data = (await res.json()) as GroupsResponse;

      if (!res.ok || data.success === false) {
        throw new Error(data.error || "グループの読み込みに失敗しました");
      }

      setGroups(data.groups ?? []);
    } catch (error) {
      setGroupsMessage(
        error instanceof Error
          ? error.message
          : "グループの読み込みに失敗しました"
      );
    } finally {
      setGroupsLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    void loadSourceData();
    void loadGroups();
  }, [loadGroups, loadSourceData]);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchQuery(searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setSearchQuery("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const text = rawContent.trim();
    if (!text || !tenantSlug) return;

    const tagNames = parseTagInput(tagInput);
    const groupId = selectedGroupId;

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

      const createdSourceData = getCreatedSourceData(data.sourceData);
      const createdSourceDataId = createdSourceData?.id;
      const needsLinking = tagNames.length > 0 || Boolean(groupId);

      if (needsLinking && !createdSourceDataId) {
        throw new Error("保存後の紐付けに失敗しました");
      }

      if (createdSourceDataId) {
        for (const tagName of tagNames) {
          const tagRes = await fetch("/api/micro/tags", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              tenant_slug: tenantSlug,
              sourceDataId: createdSourceDataId,
              name: tagName,
            }),
          });
          const tagData = (await tagRes.json()) as MicroActionResponse;

          if (!tagRes.ok || tagData.success === false) {
            throw new Error(tagData.error || "タグの紐付けに失敗しました");
          }
        }

        if (groupId) {
          const groupRes = await fetch("/api/micro/groups", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              tenant_slug: tenantSlug,
              action: "add_source",
              groupId,
              sourceDataId: createdSourceDataId,
            }),
          });
          const groupData = (await groupRes.json()) as MicroActionResponse;

          if (!groupRes.ok || groupData.success === false) {
            throw new Error(groupData.error || "グループの紐付けに失敗しました");
          }
        }
      }

      setTitle("");
      setRawContent("");
      setTagInput("");
      setSelectedGroupId("");
      await Promise.all([loadSourceData(), loadGroups()]);
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

  const handleOpenSourceData = async (id: string) => {
    if (!tenantSlug) return;

    setOpeningId(id);
    setMessage("");

    try {
      await fetch("/api/micro/source-data", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          action: "touch",
        }),
      });
    } finally {
      setOpeningId(null);
      router.push(
        `/${encodeURIComponent(tenantSlug)}/micro/source/${encodeURIComponent(
          id
        )}`
      );
    }
  };

  const handleOpenGroup = (id: string) => {
    if (!tenantSlug) return;

    setOpeningGroupId(id);
    router.push(
      `/${encodeURIComponent(tenantSlug)}/micro/group/${encodeURIComponent(id)}`
    );
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
          <MicroSectionTitle>移動</MicroSectionTitle>
          <div style={navListStyle}>
            <Link
              href={`/${encodeURIComponent(tenantSlug)}/micro/todos`}
              style={navLinkStyle}
            >
              ToDo
            </Link>
            <Link
              href={`/${encodeURIComponent(tenantSlug)}/micro/archived`}
              style={navLinkStyle}
            >
              保管ログ
            </Link>
          </div>
        </MicroSectionCard>

        <MicroSectionCard>
          <MicroSectionTitle level={1}>新規ログ</MicroSectionTitle>

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
              <span style={labelStyle}>ログ種別</span>
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

            <label style={fieldStyle}>
              <span style={labelStyle}>タグ</span>
              <input
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                placeholder="タグをカンマ区切りで入力"
                style={inputStyle}
              />
            </label>

            <label style={fieldStyle}>
              <span style={labelStyle}>グループ</span>
              <select
                value={selectedGroupId}
                onChange={(event) => setSelectedGroupId(event.target.value)}
                style={selectStyle}
              >
                <option value="">選択しない</option>
                {groupsLoading && (
                  <option value="" disabled>
                    読み込み中
                  </option>
                )}
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.title}
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
          <MicroSectionTitle>ログ検索</MicroSectionTitle>

          <form onSubmit={handleSearchSubmit} style={formStyle}>
            <label style={fieldStyle}>
              <span style={labelStyle}>キーワード</span>
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="タイトル・本文・整理を検索"
                style={inputStyle}
              />
            </label>

            <div style={actionRowStyle}>
              <MicroButton type="submit">検索</MicroButton>
              <MicroButton
                type="button"
                disabled={!searchInput && !searchQuery}
                onClick={handleClearSearch}
                style={{
                  background: !searchInput && !searchQuery ? "#374151" : "#1e293b",
                  border:
                    !searchInput && !searchQuery
                      ? "1px solid #4b5563"
                      : "1px solid #64748b",
                }}
              >
                解除
              </MicroButton>
            </div>
          </form>

          {searchQuery && (
            <div style={currentSearchStyle}>検索中: {searchQuery}</div>
          )}
        </MicroSectionCard>

        <MicroSectionCard>
          <MicroSectionTitle>グループ</MicroSectionTitle>

          {groupsLoading ? (
            <p style={mutedTextStyle}>読み込み中</p>
          ) : groupsMessage ? (
            <p style={messageStyle}>{groupsMessage}</p>
          ) : groups.length === 0 ? (
            <p style={mutedTextStyle}>まだグループはありません。</p>
          ) : (
            <div style={groupListStyle}>
              {groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  disabled={openingGroupId === group.id}
                  onClick={() => handleOpenGroup(group.id)}
                  style={{
                    ...groupCardStyle,
                    cursor:
                      openingGroupId === group.id ? "progress" : "pointer",
                  }}
                >
                  <h3 style={groupTitleStyle}>{group.title}</h3>
                  {group.description && (
                    <div style={groupDescriptionStyle}>
                      {group.description}
                    </div>
                  )}
                  <div style={groupMetaStyle}>
                    更新日: {formatTimestamp(group.updated_at)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </MicroSectionCard>

        <MicroSectionCard>
          <MicroSectionTitle>思考ログ</MicroSectionTitle>

          {loading ? (
            <p style={mutedTextStyle}>読み込み中</p>
          ) : items.length === 0 ? (
            <p style={mutedTextStyle}>
              {searchQuery
                ? "条件に合うログはありません。"
                : "まだ保存されたログはありません。"}
            </p>
          ) : (
            <div style={listStyle}>
              {items.map((item) => (
                <MicroSourceDataCard
                  key={item.id}
                  archiveDisabled={archivingId === item.id}
                  content={item.raw_content}
                  lastUsedAt={item.last_used_at}
                  openDisabled={openingId === item.id}
                  pinned={item.pinned}
                  pinDisabled={pinningId === item.id}
                  sourceType={item.source_type}
                  summary={item.summary}
                  summarizeDisabled={summarizingId === item.id}
                  title={item.title}
                  usageCount={item.usage_count}
                  onArchive={() => void handleArchive(item.id)}
                  onOpen={() => void handleOpenSourceData(item.id)}
                  onSummarize={() => void handleSummarize(item)}
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
