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
import MicroSectionCard from "@/components/micro/MicroSectionCard";
import MicroSectionTitle from "@/components/micro/MicroSectionTitle";

type SourceDataDetail = {
  id: string;
  title: string | null;
  source_type: string;
  raw_content: string;
  status: string;
  pinned: boolean;
  usage_count: number;
  last_used_at: string | null;
  summary: string | null;
};

type SourceDataResponse = {
  success?: boolean;
  error?: string;
  sourceData?: SourceDataDetail;
  relatedSources?: RelatedSource[];
};

type RelatedSource = {
  id: string;
  title: string | null;
  source_type: string;
  summary: string | null;
  updated_at: string | null;
};

type MicroGroup = {
  id: string;
  title: string;
  description: string | null;
  linked?: boolean;
};

type GroupsResponse = {
  success?: boolean;
  error?: string;
  groups?: MicroGroup[];
  sourceGroups?: MicroGroup[];
};

type SummaryVersion = {
  id: string;
  version_type: string;
  input_snapshot: unknown;
  output_snapshot: unknown;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type SummaryVersionsResponse = {
  success?: boolean;
  error?: string;
  versions?: SummaryVersion[];
};

function getParam(params: ReturnType<typeof useParams>, key: string) {
  const value = params?.[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return typeof value === "string" ? value : "";
}

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

const statusLabels: Record<string, string> = {
  draft: "下書き",
  active: "有効",
  archived: "保管済み",
};

const versionTypeLabels: Record<string, string> = {
  ai_generated: "AI整理",
  user_edit: "ユーザー修正",
  status_change: "状態変更",
  archive_restore: "保管・復元",
};

function formatDate(value: string | null) {
  if (!value) return "未使用";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未使用";

  return date.toLocaleString("ja-JP");
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "日時なし";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "日時なし";

  return date.toLocaleString("ja-JP");
}

function readSummaryFromSnapshot(value: unknown) {
  if (!value || typeof value !== "object") return "";

  const summary = (value as Record<string, unknown>).summary;
  return typeof summary === "string" ? summary : "";
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

const backLinkStyle: CSSProperties = {
  alignSelf: "flex-start",
  color: "#bfdbfe",
  background: "#1e3a8a",
  border: "1px solid #2563eb",
  borderRadius: 8,
  padding: "8px 12px",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 700,
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

const titleStyle: CSSProperties = {
  margin: "14px 0 0",
  color: "#ffffff",
  fontSize: 24,
  lineHeight: 1.35,
  overflowWrap: "anywhere",
};

const badgeRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 12,
};

const badgeStyle: CSSProperties = {
  background: "#1e293b",
  color: "#e0f2fe",
  border: "1px solid #334155",
  borderRadius: 999,
  padding: "3px 9px",
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.5,
};

const pinnedBadgeStyle: CSSProperties = {
  background: "#78350f",
  color: "#fef3c7",
  border: "1px solid #92400e",
  borderRadius: 999,
  padding: "3px 9px",
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.5,
};

const statusBadgeStyle: CSSProperties = {
  background: "#064e3b",
  color: "#d1fae5",
  border: "1px solid #047857",
  borderRadius: 999,
  padding: "3px 9px",
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.5,
};

const contentStyle: CSSProperties = {
  marginTop: 16,
  color: "#f8fafc",
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  lineHeight: 1.75,
};

const summaryStyle: CSSProperties = {
  marginTop: 12,
  background: "#172554",
  color: "#dbeafe",
  border: "1px solid #1d4ed8",
  borderRadius: 8,
  padding: "12px 14px",
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  lineHeight: 1.7,
};

const metaGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 10,
  marginTop: 16,
};

const metaItemStyle: CSSProperties = {
  background: "#0f172a",
  color: "#e5e7eb",
  border: "1px solid #334155",
  borderRadius: 8,
  padding: "10px 12px",
  lineHeight: 1.5,
};

const metaLabelStyle: CSSProperties = {
  display: "block",
  color: "#93c5fd",
  fontSize: 12,
  fontWeight: 700,
  marginBottom: 4,
};

const historyListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  marginTop: 16,
};

const historyCardStyle: CSSProperties = {
  background: "#0f172a",
  color: "#f8fafc",
  border: "1px solid #334155",
  borderRadius: 8,
  padding: 12,
};

const historyMetaStyle: CSSProperties = {
  color: "#cbd5e1",
  fontSize: 12,
  lineHeight: 1.6,
  marginBottom: 8,
};

const historyContentStyle: CSSProperties = {
  color: "#f8fafc",
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  lineHeight: 1.7,
};

const relatedListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  marginTop: 16,
};

const relatedCardStyle: CSSProperties = {
  width: "100%",
  border: "1px solid #334155",
  borderRadius: 8,
  background: "#0f172a",
  color: "#f8fafc",
  padding: 12,
  textAlign: "left",
  cursor: "pointer",
  font: "inherit",
};

const relatedTitleStyle: CSSProperties = {
  margin: 0,
  color: "#ffffff",
  fontSize: 16,
  lineHeight: 1.45,
  overflowWrap: "anywhere",
};

const relatedMetaStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 8,
  color: "#cbd5e1",
  fontSize: 12,
  lineHeight: 1.5,
};

const relatedSummaryStyle: CSSProperties = {
  marginTop: 10,
  color: "#dbeafe",
  background: "#172554",
  border: "1px solid #1d4ed8",
  borderRadius: 8,
  padding: "8px 10px",
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  lineHeight: 1.6,
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

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 72,
  resize: "vertical",
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

const groupListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  marginTop: 16,
};

const groupItemStyle: CSSProperties = {
  background: "#0f172a",
  color: "#f8fafc",
  border: "1px solid #334155",
  borderRadius: 8,
  padding: "10px 12px",
  fontWeight: 700,
  overflowWrap: "anywhere",
};

const actionRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const buttonStyle: CSSProperties = {
  alignSelf: "flex-start",
  border: "1px solid #60a5fa",
  borderRadius: 8,
  background: "#2563eb",
  color: "#ffffff",
  cursor: "pointer",
  padding: "10px 14px",
  fontSize: 14,
  fontWeight: 700,
};

const disabledButtonStyle: CSSProperties = {
  ...buttonStyle,
  border: "1px solid #4b5563",
  background: "#374151",
  color: "#d1d5db",
  cursor: "not-allowed",
};

export default function MicroSourceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = useMemo(() => getParam(params, "tenant"), [params]);
  const id = useMemo(() => getParam(params, "id"), [params]);

  const [item, setItem] = useState<SourceDataDetail | null>(null);
  const [relatedSources, setRelatedSources] = useState<RelatedSource[]>([]);
  const [groups, setGroups] = useState<MicroGroup[]>([]);
  const [sourceGroups, setSourceGroups] = useState<MicroGroup[]>([]);
  const [versions, setVersions] = useState<SummaryVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [openingRelatedId, setOpeningRelatedId] = useState<string | null>(null);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [savingGroup, setSavingGroup] = useState(false);
  const [addingGroup, setAddingGroup] = useState(false);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editRawContent, setEditRawContent] = useState("");
  const [editSourceType, setEditSourceType] = useState("free_log");
  const [groupTitle, setGroupTitle] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [message, setMessage] = useState("");
  const [groupMessage, setGroupMessage] = useState("");
  const [versionsMessage, setVersionsMessage] = useState("");

  const loadSourceData = useCallback(async () => {
    if (!tenantSlug || !id) return;

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(
        `/api/micro/source-data?tenant_slug=${encodeURIComponent(
          tenantSlug
        )}&id=${encodeURIComponent(id)}`,
        { cache: "no-store" }
      );
      const data = (await res.json()) as SourceDataResponse;

      if (!res.ok || data.success === false || !data.sourceData) {
        throw new Error(data.error || "読み込みに失敗しました");
      }

      setItem(data.sourceData);
      setEditTitle(data.sourceData.title ?? "");
      setEditRawContent(data.sourceData.raw_content);
      setEditSourceType(data.sourceData.source_type);
      setRelatedSources(data.relatedSources ?? []);
    } catch (error) {
      setRelatedSources([]);
      setMessage(
        error instanceof Error ? error.message : "読み込みに失敗しました"
      );
    } finally {
      setLoading(false);
    }
  }, [id, tenantSlug]);

  const loadGroups = useCallback(async () => {
    if (!tenantSlug || !id) return;

    setGroupsLoading(true);
    setGroupMessage("");

    try {
      const res = await fetch(
        `/api/micro/groups?tenant_slug=${encodeURIComponent(
          tenantSlug
        )}&sourceDataId=${encodeURIComponent(id)}`,
        { cache: "no-store" }
      );
      const data = (await res.json()) as GroupsResponse;

      if (!res.ok || data.success === false) {
        throw new Error(data.error || "グループの読み込みに失敗しました");
      }

      setGroups(data.groups ?? []);
      setSourceGroups(data.sourceGroups ?? []);
    } catch (error) {
      setGroups([]);
      setSourceGroups([]);
      setGroupMessage(
        error instanceof Error
          ? error.message
          : "グループの読み込みに失敗しました"
      );
    } finally {
      setGroupsLoading(false);
    }
  }, [id, tenantSlug]);

  const loadSummaryVersions = useCallback(async () => {
    if (!tenantSlug || !id) return;

    setVersionsLoading(true);
    setVersionsMessage("");

    try {
      const res = await fetch(
        `/api/micro/summaries?tenant_slug=${encodeURIComponent(
          tenantSlug
        )}&sourceDataId=${encodeURIComponent(id)}`,
        { cache: "no-store" }
      );
      const data = (await res.json()) as SummaryVersionsResponse;

      if (!res.ok || data.success === false) {
        throw new Error(data.error || "整理履歴の読み込みに失敗しました");
      }

      setVersions(data.versions ?? []);
    } catch (error) {
      setVersionsMessage(
        error instanceof Error
          ? error.message
          : "整理履歴の読み込みに失敗しました"
      );
    } finally {
      setVersionsLoading(false);
    }
  }, [id, tenantSlug]);

  useEffect(() => {
    void loadSourceData();
    void loadGroups();
    void loadSummaryVersions();
  }, [loadGroups, loadSourceData, loadSummaryVersions]);

  const handleOpenRelatedSource = async (relatedId: string) => {
    if (!tenantSlug) return;

    setOpeningRelatedId(relatedId);

    try {
      await fetch("/api/micro/source-data", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: relatedId,
          action: "touch",
        }),
      });
    } finally {
      setOpeningRelatedId(null);
      router.push(
        `/${encodeURIComponent(
          tenantSlug
        )}/micro/source/${encodeURIComponent(relatedId)}`
      );
    }
  };

  const handleStartEdit = () => {
    if (!item) return;

    setEditTitle(item.title ?? "");
    setEditRawContent(item.raw_content);
    setEditSourceType(item.source_type);
    setEditing(true);
    setMessage("");
  };

  const handleCancelEdit = () => {
    if (item) {
      setEditTitle(item.title ?? "");
      setEditRawContent(item.raw_content);
      setEditSourceType(item.source_type);
    }

    setEditing(false);
    setMessage("");
  };

  const handleUpdateSourceData = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const rawContent = editRawContent.trim();
    if (!id || !rawContent) return;

    setSavingEdit(true);
    setMessage("");

    try {
      const res = await fetch("/api/micro/source-data", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          action: "update",
          title: editTitle.trim() || null,
          raw_content: rawContent,
          source_type: editSourceType,
        }),
      });
      const data = (await res.json()) as SourceDataResponse;

      if (!res.ok || data.success === false) {
        throw new Error(data.error || "保存に失敗しました");
      }

      setEditing(false);
      await loadSourceData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存に失敗しました");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCreateGroup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const title = groupTitle.trim();
    if (!tenantSlug || !id || !title) return;

    setSavingGroup(true);
    setGroupMessage("");

    try {
      const res = await fetch("/api/micro/groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenant_slug: tenantSlug,
          title,
          description: groupDescription.trim() || null,
          sourceDataId: id,
        }),
      });
      const data = (await res.json()) as GroupsResponse;

      if (!res.ok || data.success === false) {
        throw new Error(data.error || "グループ作成に失敗しました");
      }

      setGroupTitle("");
      setGroupDescription("");
      await loadGroups();
    } catch (error) {
      setGroupMessage(
        error instanceof Error ? error.message : "グループ作成に失敗しました"
      );
    } finally {
      setSavingGroup(false);
    }
  };

  const handleAddToGroup = async () => {
    if (!tenantSlug || !id || !selectedGroupId) return;

    setAddingGroup(true);
    setGroupMessage("");

    try {
      const res = await fetch("/api/micro/groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenant_slug: tenantSlug,
          action: "add_source",
          groupId: selectedGroupId,
          sourceDataId: id,
        }),
      });
      const data = (await res.json()) as GroupsResponse;

      if (!res.ok || data.success === false) {
        throw new Error(data.error || "グループ追加に失敗しました");
      }

      setSelectedGroupId("");
      await loadGroups();
    } catch (error) {
      setGroupMessage(
        error instanceof Error ? error.message : "グループ追加に失敗しました"
      );
    } finally {
      setAddingGroup(false);
    }
  };

  const displayTitle = item?.title?.trim() || "無題";
  const sourceTypeLabel = item
    ? sourceTypeLabels[item.source_type] ?? item.source_type
    : "";
  const statusLabel = item ? statusLabels[item.status] ?? item.status : "";
  const availableGroups = groups.filter((group) => !group.linked);

  return (
    <main style={pageStyle}>
      <div style={shellStyle}>
        <Link
          href={`/${encodeURIComponent(tenantSlug)}/micro`}
          style={backLinkStyle}
        >
          一覧へ戻る
        </Link>

        <MicroSectionCard>
          <MicroSectionTitle level={1}>思考ログ詳細</MicroSectionTitle>

          {loading ? (
            <p style={mutedTextStyle}>読み込み中</p>
          ) : message ? (
            <p style={messageStyle}>{message}</p>
          ) : item ? (
            editing ? (
              <form onSubmit={handleUpdateSourceData} style={formStyle}>
                <label style={fieldStyle}>
                  <span style={labelStyle}>タイトル</span>
                  <input
                    value={editTitle}
                    onChange={(event) => setEditTitle(event.target.value)}
                    placeholder="タイトルを書く"
                    style={inputStyle}
                  />
                </label>

                <label style={fieldStyle}>
                  <span style={labelStyle}>種類</span>
                  <select
                    value={editSourceType}
                    onChange={(event) => setEditSourceType(event.target.value)}
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
                  <span style={labelStyle}>本文</span>
                  <textarea
                    value={editRawContent}
                    onChange={(event) => setEditRawContent(event.target.value)}
                    placeholder="思考ログを書く"
                    style={{ ...textareaStyle, minHeight: 180 }}
                  />
                </label>

                <div style={actionRowStyle}>
                  <button
                    type="submit"
                    disabled={savingEdit || editRawContent.trim().length === 0}
                    style={
                      savingEdit || editRawContent.trim().length === 0
                        ? disabledButtonStyle
                        : buttonStyle
                    }
                  >
                    {savingEdit ? "保存中" : "保存"}
                  </button>
                  <button
                    type="button"
                    disabled={savingEdit}
                    onClick={handleCancelEdit}
                    style={savingEdit ? disabledButtonStyle : buttonStyle}
                  >
                    キャンセル
                  </button>
                </div>
              </form>
            ) : (
              <>
                <h2 style={titleStyle}>{displayTitle}</h2>

                <div style={badgeRowStyle}>
                  <span style={badgeStyle}>{sourceTypeLabel}</span>
                  <span style={statusBadgeStyle}>{statusLabel}</span>
                  {item.pinned && (
                    <span style={pinnedBadgeStyle}>ピン留め中</span>
                  )}
                </div>

                <div style={contentStyle}>{item.raw_content}</div>

                <div style={{ ...actionRowStyle, marginTop: 16 }}>
                  <button type="button" onClick={handleStartEdit} style={buttonStyle}>
                    編集
                  </button>
                </div>
              </>
            )
          ) : (
            <p style={mutedTextStyle}>思考ログが見つかりませんでした。</p>
          )}
        </MicroSectionCard>

        {item && (
          <>
            <MicroSectionCard>
              <MicroSectionTitle>整理</MicroSectionTitle>
              {item.summary ? (
                <div style={summaryStyle}>{item.summary}</div>
              ) : (
                <p style={mutedTextStyle}>整理はまだありません。</p>
              )}
            </MicroSectionCard>

            <MicroSectionCard>
              <MicroSectionTitle>グループ追加</MicroSectionTitle>

              {groupsLoading ? (
                <p style={mutedTextStyle}>読み込み中</p>
              ) : groupMessage ? (
                <p style={messageStyle}>{groupMessage}</p>
              ) : null}

              <form onSubmit={handleCreateGroup} style={formStyle}>
                <label style={fieldStyle}>
                  <span style={labelStyle}>新規グループ名</span>
                  <input
                    value={groupTitle}
                    onChange={(event) => setGroupTitle(event.target.value)}
                    placeholder="グループ名を書く"
                    style={inputStyle}
                  />
                </label>

                <label style={fieldStyle}>
                  <span style={labelStyle}>説明</span>
                  <textarea
                    value={groupDescription}
                    onChange={(event) =>
                      setGroupDescription(event.target.value)
                    }
                    placeholder="必要なら説明を書く"
                    style={textareaStyle}
                  />
                </label>

                <button
                  type="submit"
                  disabled={savingGroup || groupTitle.trim().length === 0}
                  style={
                    savingGroup || groupTitle.trim().length === 0
                      ? disabledButtonStyle
                      : buttonStyle
                  }
                >
                  {savingGroup ? "作成中" : "作成して追加"}
                </button>
              </form>

              <div style={formStyle}>
                <label style={fieldStyle}>
                  <span style={labelStyle}>既存グループ</span>
                  <select
                    value={selectedGroupId}
                    onChange={(event) => setSelectedGroupId(event.target.value)}
                    style={selectStyle}
                  >
                    <option value="">追加先を選択</option>
                    {availableGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.title}
                      </option>
                    ))}
                  </select>
                </label>

                <div style={actionRowStyle}>
                  <button
                    type="button"
                    disabled={
                      addingGroup ||
                      selectedGroupId.length === 0 ||
                      availableGroups.length === 0
                    }
                    onClick={() => void handleAddToGroup()}
                    style={
                      addingGroup ||
                      selectedGroupId.length === 0 ||
                      availableGroups.length === 0
                        ? disabledButtonStyle
                        : buttonStyle
                    }
                  >
                    {addingGroup ? "追加中" : "追加"}
                  </button>
                </div>
              </div>

              <div style={groupListStyle}>
                {sourceGroups.length === 0 ? (
                  <p style={mutedTextStyle}>所属グループはまだありません。</p>
                ) : (
                  sourceGroups.map((group) => (
                    <div key={group.id} style={groupItemStyle}>
                      {group.title}
                    </div>
                  ))
                )}
              </div>
            </MicroSectionCard>

            <MicroSectionCard>
              <MicroSectionTitle>関連ログ</MicroSectionTitle>
              {relatedSources.length === 0 ? (
                <p style={mutedTextStyle}>関連ログはまだありません。</p>
              ) : (
                <div style={relatedListStyle}>
                  {relatedSources.map((relatedSource) => {
                    const relatedTitle =
                      relatedSource.title?.trim() || "無題";
                    const relatedSourceTypeLabel =
                      sourceTypeLabels[relatedSource.source_type] ??
                      relatedSource.source_type;

                    return (
                      <button
                        key={relatedSource.id}
                        type="button"
                        onClick={() =>
                          void handleOpenRelatedSource(relatedSource.id)
                        }
                        disabled={openingRelatedId === relatedSource.id}
                        style={{
                          ...relatedCardStyle,
                          cursor:
                            openingRelatedId === relatedSource.id
                              ? "progress"
                              : "pointer",
                        }}
                      >
                        <h3 style={relatedTitleStyle}>{relatedTitle}</h3>
                        <div style={relatedMetaStyle}>
                          <span>{relatedSourceTypeLabel}</span>
                          <span>{formatTimestamp(relatedSource.updated_at)}</span>
                        </div>
                        {relatedSource.summary && (
                          <div style={relatedSummaryStyle}>
                            {relatedSource.summary}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </MicroSectionCard>

            <MicroSectionCard>
              <MicroSectionTitle>整理履歴</MicroSectionTitle>
              {versionsLoading ? (
                <p style={mutedTextStyle}>読み込み中</p>
              ) : versionsMessage ? (
                <p style={messageStyle}>{versionsMessage}</p>
              ) : versions.length === 0 ? (
                <p style={mutedTextStyle}>整理履歴はまだありません。</p>
              ) : (
                <div style={historyListStyle}>
                  {versions.map((version) => {
                    const summaryText =
                      readSummaryFromSnapshot(version.output_snapshot) ||
                      "整理内容がありません。";
                    const versionTypeLabel =
                      versionTypeLabels[version.version_type] ??
                      version.version_type;

                    return (
                      <article key={version.id} style={historyCardStyle}>
                        <div style={historyMetaStyle}>
                          {versionTypeLabel} /{" "}
                          {formatTimestamp(version.updated_at)} /{" "}
                          {version.created_by}
                        </div>
                        <div style={historyContentStyle}>{summaryText}</div>
                      </article>
                    );
                  })}
                </div>
              )}
            </MicroSectionCard>

            <MicroSectionCard>
              <MicroSectionTitle>状態</MicroSectionTitle>
              <div style={metaGridStyle}>
                <div style={metaItemStyle}>
                  <span style={metaLabelStyle}>利用回数</span>
                  {item.usage_count ?? 0}
                </div>
                <div style={metaItemStyle}>
                  <span style={metaLabelStyle}>最終利用</span>
                  {formatDate(item.last_used_at)}
                </div>
                <div style={metaItemStyle}>
                  <span style={metaLabelStyle}>ピン</span>
                  {item.pinned ? "ピン留め中" : "なし"}
                </div>
                <div style={metaItemStyle}>
                  <span style={metaLabelStyle}>ステータス</span>
                  {statusLabel}
                </div>
              </div>
            </MicroSectionCard>
          </>
        )}
      </div>
    </main>
  );
}
