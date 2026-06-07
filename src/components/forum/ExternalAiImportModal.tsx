"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

type CandidateStatus = "unselected" | "post" | "skip";
type ExtractionMode = "category" | "auto";

type ExternalAiCandidate = {
  title: string;
  question: string;
  ai_answer: string;
  premises: string[];
  reasons: string[];
  risks: string[];
  supplements: string[];
  category: string;
  related_categories: string[];
  sub_category: string;
  tags: string[];
  node: string;
  source_ai: string;
  status: CandidateStatus;
  isEditing: boolean;
};

type ExternalAiImportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  tenant: string;
};

type SubmitResult = {
  status: "success" | "error";
  threadId?: string;
  url?: string;
  error?: string;
  requiresLogin?: boolean;
};

type RelatedThread = {
  id: string;
  title: string;
  category?: string | null;
  ai_summary?: string | null;
  reason?: string | null;
};

type RelatedSearchState = {
  loading: boolean;
  error?: string;
  threads: RelatedThread[];
};

type SaveReferenceState = {
  loading: boolean;
  saved?: boolean;
  logId?: string;
  error?: string;
};

const MAX_CANDIDATES = 20;
const MAX_SELECTED_CATEGORIES = 3;
const EXTERNAL_AI_IMPORT_DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAIN_CATEGORY_OPTIONS = [
  "経済・政策",
  "AI・技術",
  "特許・発明",
  "恋愛・人間関係",
  "仕事・経営",
  "生活・健康",
  "その他",
];

const SOURCE_AI_OPTIONS = [
  "未指定",
  "ChatGPT",
  "Gemini",
  "Claude",
  "Grok",
  "Perplexity",
  "その他",
];

function removeExternalAiImportDraft(draftStorageKey: string) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(draftStorageKey);
  } catch (removeError) {
    console.error("[external-ai-import draft remove failed]", removeError);
  }
}

function buildExternalAiPrompt(
  extractionMode: ExtractionMode,
  selectedCategories: string[]
) {
  const categories = selectedCategories.filter(Boolean);
  const categoryList = MAIN_CATEGORY_OPTIONS.map((category) => `- ${category}`).join("\n");
  const selectedCategoryText = categories.length
    ? categories.map((category) => `- ${category}`).join("\n")
    : "- 未選択";
  const modeInstruction =
    extractionMode === "category"
      ? `抽出モード：テーマを選んで抜き出す

抽出対象カテゴリー：
${selectedCategoryText}

選択したカテゴリーに関係する内容だけを投稿候補にしてください。
選択していないカテゴリーの話題は、投稿候補に含めないでください。`
      : `抽出モード：AIに全部分類させる

カテゴリー候補：
${categoryList}

会話ログ全体を読み、投稿候補ごとに最も近いカテゴリーへ分類してください。
投稿不要な雑談、個人的内容、プライバシー情報は除外してください。`;

  return `以下の会話ログを、AI知恵袋の掲示板投稿用に整理してください。

重要：
このプロンプトだけでは投稿候補は作れません。
下の【ここから会話ログ】〜【ここまで会話ログ】の間に、整理したい会話ログを貼ってから実行してください。

会話ログが空、または投稿候補にできる内容がない場合だけ、{"posts": []} を返してください。

【ここから会話ログ】
ここに会話ログを貼ってください。
【ここまで会話ログ】

${modeInstruction}

目的：
雑多な会話ログから、複数の問題・質問・回答・論点・反論・補足を抽出し、掲示板に投稿しやすい形に整理することです。

プライバシー保護：
投稿候補を作る前に、以下を必ず除去・匿名化してください。
- 個人名
- 住所
- 電話番号
- メールアドレス
- 店名や勤務先など、個人が特定されやすい情報
- LINE内容など、相手のプライバシーに関わる情報
- 恋愛・家族・健康・金銭など、投稿に不要な私的情報
- 第三者を特定できる表現

判断に迷う情報は、投稿候補に含めず、一般化してください。

投稿候補数と整理方針：
投稿候補は最大10件までにしてください。
重要度が高いと思われる順に並べてください。
似ている論点・重複する質問は、別々に出さず、1つの投稿候補に統合してください。
細かすぎる話題は、必要に応じて大きな論点へまとめてください。

ルール：
- 個人情報、住所、電話番号、氏名、メールアドレス、個人的すぎる内容は除去または匿名化してください。
- 雑談や投稿に不要な内容は除外してください。
- 複数の論点がある場合は、論点ごとに分けてください。
- 事実と推測を混同しないでください。
- 断定しすぎず、必要に応じて「可能性がある」と表現してください。
- 各投稿候補に main_category を必ず1つ付けてください。
- related_categories は必要に応じて複数付けてください。
- sub_category と tags も付けてください。
- tags は3〜8個程度にしてください。
- 出力は必ずJSONにしてください。
- JSON以外の説明文は出力しないでください。

出力形式：
{
  "posts": [
    {
      "main_category": "主カテゴリー",
      "related_categories": ["関連カテゴリー"],
      "sub_category": "小カテゴリー",
      "tags": ["タグ1", "タグ2", "タグ3"],
      "title": "投稿タイトル案",
      "question": "問題・質問",
      "ai_answer": "AI回答・整理",
      "premises": ["前提1", "前提2"],
      "reasons": ["根拠1", "根拠2"],
      "risks": ["反論・リスク1", "反論・リスク2"],
      "supplements": ["補足1", "補足2"],
      "category": "主カテゴリー",
      "node": "候補ノード"
    }
  ]
}`;
}

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  background: "rgba(15, 23, 42, 0.58)",
  color: "#111827",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const dialogStyle: CSSProperties = {
  width: "min(100%, 960px)",
  maxHeight: "92vh",
  overflowY: "auto",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#111827",
  boxShadow: "0 24px 70px rgba(15, 23, 42, 0.24)",
};

const sectionStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: 14,
  background: "#f8fafc",
  color: "#111827",
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: 6,
  color: "#475569",
  fontSize: 13,
  fontWeight: 800,
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  padding: "10px 12px",
  background: "#ffffff",
  color: "#111827",
  fontSize: 15,
  lineHeight: 1.6,
};

const buttonStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "9px 12px",
  background: "#ffffff",
  color: "#111827",
  cursor: "pointer",
  fontWeight: 800,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toTextArray(value: unknown) {
  if (typeof value === "string") {
    const text = value.trim();
    return text ? [text] : [];
  }
  if (!Array.isArray(value)) return [];
  return value.map(toText).filter(Boolean).slice(0, 8);
}

function getParsedCandidateList(value: unknown) {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return null;
  if (Array.isArray(value.posts)) return value.posts;
  if (Array.isArray(value.candidates)) return value.candidates;
  if (Array.isArray(value.items)) return value.items;
  return null;
}

function isCandidateStatus(value: unknown): value is CandidateStatus {
  return value === "unselected" || value === "post" || value === "skip";
}

function isExtractionMode(value: unknown): value is ExtractionMode {
  return value === "category" || value === "auto";
}

function linesToArray(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function stripMarkdownJsonFence(value: string) {
  const trimmed = value.trim();
  const fencedBlock = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fencedBlock?.[1]) return fencedBlock[1].trim();

  const embeddedFence = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (embeddedFence?.[1]) return embeddedFence[1].trim();

  return trimmed;
}

function normalizeJsonInputText(value: string) {
  return stripMarkdownJsonFence(value)
    .replace(/[“”„＂]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

function normalizeCandidate(value: unknown): ExternalAiCandidate | null {
  const record = isRecord(value) ? value : {};
  const title = toText(record.title);
  const question = toText(record.question);
  const aiAnswer =
    toText(record.ai_answer) ||
    toText(record.answer) ||
    toText(record.summary) ||
    toText(record.content);
  const mainCategory = toText(record.main_category) || toText(record.category);
  const subCategory = toText(record.sub_category);

  if (!title && !question && !aiAnswer) {
    return null;
  }

  return {
    title,
    question,
    ai_answer: aiAnswer,
    premises: toTextArray(record.premises),
    reasons: toTextArray(record.reasons),
    risks: toTextArray(record.risks),
    supplements: toTextArray(record.supplements),
    category: mainCategory,
    related_categories: toTextArray(record.related_categories),
    sub_category: subCategory,
    tags: toTextArray(record.tags),
    node: toText(record.node) || subCategory,
    source_ai: toText(record.source_ai) || "未指定",
    status: "unselected",
    isEditing: false,
  };
}

function normalizeStoredCandidate(value: unknown): ExternalAiCandidate | null {
  const candidate = normalizeCandidate(value);
  if (!candidate || !isRecord(value)) return candidate;

  return {
    ...candidate,
    status: isCandidateStatus(value.status) ? value.status : candidate.status,
    isEditing:
      typeof value.isEditing === "boolean" ? value.isEditing : candidate.isEditing,
  };
}

function normalizeRelatedThread(value: unknown): RelatedThread | null {
  if (!isRecord(value)) return null;

  const id = toText(value.id);
  if (!id) return null;

  return {
    id,
    title: toText(value.title) || "無題スレッド",
    category: toText(value.category) || null,
    ai_summary: toText(value.ai_summary) || null,
    reason: toText(value.reason) || null,
  };
}

function safeItems(items: string[] | undefined) {
  return Array.isArray(items) ? items.filter(Boolean) : [];
}

function buildCandidateClaim(candidate: ExternalAiCandidate) {
  const supplements = safeItems(candidate.supplements);
  const parts = [
    candidate.question,
    candidate.ai_answer ? `AI回答・整理:\n${candidate.ai_answer}` : "",
    supplements.length ? `補足:\n${supplements.join("\n")}` : "",
  ].filter(Boolean);

  return parts.join("\n\n") || candidate.title || "外部AI整理からの投稿";
}

function buildPrivateLogCandidate(candidate: ExternalAiCandidate) {
  return {
    title: candidate.title,
    question: candidate.question,
    ai_answer: candidate.ai_answer,
    premises: safeItems(candidate.premises),
    reasons: safeItems(candidate.reasons),
    risks: safeItems(candidate.risks),
    supplements: safeItems(candidate.supplements),
    category: candidate.category,
    main_category: candidate.category,
    related_categories: safeItems(candidate.related_categories),
    sub_category: candidate.sub_category,
    tags: safeItems(candidate.tags),
    node: candidate.node,
    source_ai: candidate.source_ai || "未指定",
  };
}

function FieldBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ ...labelStyle, marginBottom: 4 }}>{label}</div>
      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{children || "-"}</div>
    </div>
  );
}

function ListBlock({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div style={{ ...labelStyle, marginBottom: 4 }}>{label}</div>
      {items.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
          {items.map((item, index) => (
            <li key={`${label}-${index}-${item}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <div style={{ color: "#64748b" }}>-</div>
      )}
    </div>
  );
}

export default function ExternalAiImportModal({
  isOpen,
  onClose,
  tenant,
}: ExternalAiImportModalProps) {
  const [jsonInput, setJsonInput] = useState("");
  const [candidates, setCandidates] = useState<ExternalAiCandidate[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [extractionMode, setExtractionMode] =
    useState<ExtractionMode>("category");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    "経済・政策",
  ]);
  const [categoryLimitMessage, setCategoryLimitMessage] = useState("");
  const [sourceAi, setSourceAi] = useState("未指定");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitResults, setSubmitResults] = useState<Record<number, SubmitResult>>(
    {}
  );
  const [relatedByCandidate, setRelatedByCandidate] = useState<
    Record<number, RelatedSearchState>
  >({});
  const [savedReferences, setSavedReferences] = useState<
    Record<string, SaveReferenceState>
  >({});

  const selectedCount = useMemo(
    () => candidates.filter((candidate) => candidate.status === "post").length,
    [candidates]
  );
  const externalAiPrompt = useMemo(
    () => buildExternalAiPrompt(extractionMode, selectedCategories),
    [extractionMode, selectedCategories]
  );
  const draftStorageKey = `forum_external_ai_import_draft_${tenant}`;
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  useEffect(() => {
    if (!isOpen || hasRestoredDraft || typeof window === "undefined") return;

    try {
      const saved = window.sessionStorage.getItem(draftStorageKey);
      if (!saved) return;

      const parsed: unknown = JSON.parse(saved);
      if (!isRecord(parsed)) {
        removeExternalAiImportDraft(draftStorageKey);
        return;
      }

      const savedAt = parsed.savedAt;
      if (
        typeof savedAt !== "number" ||
        !Number.isFinite(savedAt) ||
        Date.now() - savedAt > EXTERNAL_AI_IMPORT_DRAFT_MAX_AGE_MS
      ) {
        removeExternalAiImportDraft(draftStorageKey);
        return;
      }

      if (!Array.isArray(parsed.candidates)) {
        removeExternalAiImportDraft(draftStorageKey);
        return;
      }

      const restoredCandidates = parsed.candidates
        .map(normalizeStoredCandidate)
        .filter((candidate): candidate is ExternalAiCandidate => Boolean(candidate));
      if (parsed.candidates.length > 0 && restoredCandidates.length === 0) {
        removeExternalAiImportDraft(draftStorageKey);
        return;
      }
      const restoredCategories = Array.isArray(parsed.selectedCategories)
        ? parsed.selectedCategories
            .map(toText)
            .filter((category) => MAIN_CATEGORY_OPTIONS.includes(category))
            .slice(0, MAX_SELECTED_CATEGORIES)
        : [];
      const restoredSourceAi = toText(parsed.sourceAi);

      setJsonInput(toText(parsed.jsonInput));
      setCandidates(restoredCandidates);
      if (isExtractionMode(parsed.extractionMode)) {
        setExtractionMode(parsed.extractionMode);
      }
      if (restoredCategories.length > 0) {
        setSelectedCategories(restoredCategories);
      }
      if (restoredSourceAi) {
        setSourceAi(restoredSourceAi);
      }
      setError("");
      setSubmitError("");
      setSubmitResults({});
      setRelatedByCandidate({});
      setSavedReferences({});
      setNotice(
        "ログイン前の投稿候補を復元しました。内容を確認して「選んだ候補を投稿する」を押してください。"
      );
    } catch (restoreError) {
      console.error("[external-ai-import draft restore failed]", restoreError);
      removeExternalAiImportDraft(draftStorageKey);
    } finally {
      setHasRestoredDraft(true);
    }
  }, [draftStorageKey, hasRestoredDraft, isOpen]);

  if (!isOpen) return null;

  const saveImportDraft = () => {
    if (typeof window === "undefined") return;

    try {
      window.sessionStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          jsonInput,
          candidates,
          extractionMode,
          selectedCategories,
          sourceAi,
          savedAt: Date.now(),
        })
      );
    } catch (saveError) {
      console.error("[external-ai-import draft save failed]", saveError);
    }
  };

  const redirectToLogin = () => {
    if (typeof window === "undefined") return;

    window.location.assign(
      `/${tenant}/forum/login?next=${encodeURIComponent(
        `/${tenant}/forum?externalAiImport=1#create`
      )}`
    );
  };

  const updateCandidate = (
    index: number,
    patch: Partial<ExternalAiCandidate>
  ) => {
    setCandidates((current) =>
      current.map((candidate, candidateIndex) =>
        candidateIndex === index ? { ...candidate, ...patch } : candidate
      )
    );
  };

  const toggleCategory = (category: string) => {
    setCopyMessage("");
    setCategoryLimitMessage("");
    setSelectedCategories((current) => {
      if (current.includes(category)) {
        return current.filter((item) => item !== category);
      }

      if (current.length >= MAX_SELECTED_CATEGORIES) {
        setCategoryLimitMessage(
          "選択できるカテゴリーは最大3つまでです。多い場合は「AIに全部分類させる」を使ってください。"
        );
        return current;
      }

      return [...current, category];
    });
  };

  const submitCandidate = async (
    candidate: ExternalAiCandidate
  ): Promise<SubmitResult> => {
    const risks = safeItems(candidate.risks);
    const body = {
      tenantSlug: tenant,
      title: candidate.title || candidate.question || "外部AI整理からの投稿",
      claim: buildCandidateClaim(candidate),
      premises: safeItems(candidate.premises),
      reasons: safeItems(candidate.reasons),
      conflicts: risks.map((risk) => ({
        opinion: "",
        rebuttal: risk,
      })),
      postType: "auto",
    };

    try {
      const response = await fetch("/api/forum/create-thread-from-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const message = isRecord(data)
          ? toText(data.error) || "投稿できませんでした。"
          : "投稿できませんでした。";
        if (response.status === 401 || message === "Login required.") {
          return {
            status: "error",
            error: "投稿するにはログインが必要です。ログイン後に投稿候補へ戻ります。",
            requiresLogin: true,
          };
        }
        return { status: "error", error: message };
      }

      const threadId = isRecord(data)
        ? toText(data.threadId) || toText(data.id)
        : "";

      if (!threadId) {
        return {
          status: "error",
          error: "投稿は完了しましたが、スレッドIDを取得できませんでした。",
        };
      }

      return {
        status: "success",
        threadId,
        url: `/${tenant}/forum/thread/${threadId}`,
      };
    } catch {
      return {
        status: "error",
        error: "投稿中に通信エラーが発生しました。",
      };
    }
  };

  const handleSubmitSelectedCandidates = async () => {
    const selected = candidates
      .map((candidate, index) => ({ candidate, index }))
      .filter(({ candidate }) => candidate.status === "post");

    if (selected.length === 0) {
      setSubmitError("投稿する候補を選んでください。");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");
    setNotice("");

    let allSubmitted = true;
    for (const { candidate, index } of selected) {
      const result = await submitCandidate(candidate);
      setSubmitResults((current) => ({
        ...current,
        [index]: result,
      }));

      if (result.requiresLogin) {
        saveImportDraft();
        setSubmitError(
          result.error ?? "投稿するにはログインが必要です。ログイン後に投稿候補へ戻ります。"
        );
        setIsSubmitting(false);
        redirectToLogin();
        return;
      }

      if (result.status !== "success") {
        allSubmitted = false;
      }
    }

    if (allSubmitted) {
      removeExternalAiImportDraft(draftStorageKey);
    }
    setIsSubmitting(false);
  };

  const handleSearchRelatedThreads = async (
    index: number,
    candidate: ExternalAiCandidate
  ) => {
    setRelatedByCandidate((current) => ({
      ...current,
      [index]: {
        loading: true,
        threads: current[index]?.threads ?? [],
      },
    }));

    try {
      const response = await fetch("/api/forum/search-related", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: [candidate.title, candidate.question, candidate.ai_answer]
            .filter(Boolean)
            .join("\n\n"),
          claim: candidate.question || candidate.title,
          premises: safeItems(candidate.premises),
          reasons: safeItems(candidate.reasons),
          disableFallback: true,
        }),
      });

      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const message = isRecord(data)
          ? toText(data.error) || "類似スレッドを確認できませんでした。"
          : "類似スレッドを確認できませんでした。";
        throw new Error(message);
      }

      const threads = isRecord(data) && Array.isArray(data.threads)
        ? data.threads
            .map(normalizeRelatedThread)
            .filter((thread): thread is RelatedThread => Boolean(thread))
        : [];

      setRelatedByCandidate((current) => ({
        ...current,
        [index]: {
          loading: false,
          threads,
        },
      }));
    } catch (searchError) {
      setRelatedByCandidate((current) => ({
        ...current,
        [index]: {
          loading: false,
          threads: [],
          error:
            searchError instanceof Error
              ? searchError.message
              : "類似スレッドを確認できませんでした。",
        },
      }));
    }
  };

  const handleSaveReference = async (
    index: number,
    candidate: ExternalAiCandidate,
    thread: RelatedThread
  ) => {
    const key = `${index}:${thread.id}`;
    const relatedThreadUrl = `/${tenant}/forum/thread/${thread.id}`;

    setSavedReferences((current) => ({
      ...current,
      [key]: {
        loading: true,
        saved: current[key]?.saved,
      },
    }));

    try {
      const response = await fetch("/api/forum/save-private-log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenantSlug: tenant,
          candidate: buildPrivateLogCandidate(candidate),
          relatedThread: thread,
          relatedThreadUrl,
          memo: "",
        }),
      });

      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const message = isRecord(data)
          ? toText(data.error) || "保存できませんでした。"
          : "保存できませんでした。";
        throw new Error(message);
      }

      const log = isRecord(data) && isRecord(data.log) ? data.log : null;

      setSavedReferences((current) => ({
        ...current,
        [key]: {
          loading: false,
          saved: true,
          logId: log ? toText(log.id) : undefined,
        },
      }));
    } catch (saveError) {
      setSavedReferences((current) => ({
        ...current,
        [key]: {
          loading: false,
          saved: false,
          error:
            saveError instanceof Error
              ? saveError.message
              : "保存できませんでした。",
        },
      }));
    }
  };

  const handleCopyPrompt = async () => {
    setCopyMessage("");

    try {
      await navigator.clipboard.writeText(stripMarkdownJsonFence(externalAiPrompt));
      setCopyMessage("プロンプトをコピーしました。");
    } catch (copyError) {
      console.error(copyError);
      setCopyMessage("コピーできませんでした。手動で選択してコピーしてください。");
    }
  };

  const handleParseJson = () => {
    setError("");
    setNotice("");

    try {
      const normalizedJsonText = normalizeJsonInputText(jsonInput);
      const parsed: unknown = JSON.parse(normalizedJsonText);
      const parsedCandidates = getParsedCandidateList(parsed);

      if (!parsedCandidates) {
        setCandidates([]);
        setSubmitResults({});
        setRelatedByCandidate({});
        setSavedReferences({});
        setError("JSONはposts / candidates / items配列を含む形式、または配列形式で貼り付けてください。");
        return;
      }

      const normalized = parsedCandidates
        .slice(0, MAX_CANDIDATES)
        .map(normalizeCandidate)
        .filter((candidate): candidate is ExternalAiCandidate =>
          Boolean(candidate)
        )
        .map((candidate) => ({
          ...candidate,
          source_ai: sourceAi || "未指定",
        }));

      if (normalized.length === 0) {
        setCandidates([]);
        setSubmitResults({});
        setRelatedByCandidate({});
        setSavedReferences({});
        setError("投稿候補として読める項目がありません。title / question / ai_answer / answer / summary / content のいずれかを含めてください。");
        return;
      }

      setCandidates(normalized);
      setSubmitResults({});
      setRelatedByCandidate({});
      setSavedReferences({});
      setSubmitError("");
      if (parsedCandidates.length > MAX_CANDIDATES) {
        setNotice(`最大${MAX_CANDIDATES}件まで読み取りました。`);
      } else {
        setNotice(`${normalized.length}件の投稿候補を読み取りました。`);
      }
    } catch {
      setCandidates([]);
      setSubmitResults({});
      setRelatedByCandidate({});
      setSavedReferences({});
      setError(
        "これはJSON形式ではありません。\nこの欄には、外部AIが出力したposts / candidates / items配列を含むJSON、またはJSON配列を貼り付けてください。\n会話ログをそのまま貼る場合は、上のプロンプトをあなたのChatGPTや外部AIに貼り、返ってきたJSONだけをここに貼り付けてください。"
      );
    }
  };

  return (
    <div style={overlayStyle} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="external-ai-import-title"
        style={dialogStyle}
      >
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 1,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "flex-start",
            borderBottom: "1px solid #e2e8f0",
            padding: 18,
            background: "#ffffff",
            color: "#111827",
          }}
        >
          <div>
            <h2 id="external-ai-import-title" style={{ margin: 0, fontSize: 22 }}>
              外部AIで整理した内容を取り込む
            </h2>
            <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.7 }}>
              外部AIで会話ログを整理し、返ってきたJSONから投稿候補を作ります。
            </p>
          </div>
          <button type="button" onClick={onClose} style={buttonStyle}>
            閉じる
          </button>
        </div>

        <div style={{ display: "grid", gap: 16, padding: 18 }}>
          <div
            style={{
              border: "1px solid #fed7aa",
              borderRadius: 10,
              padding: 12,
              background: "#fff7ed",
              color: "#9a3412",
              lineHeight: 1.7,
              fontWeight: 700,
            }}
          >
            個人情報や投稿したくない内容が含まれていないか、投稿前に必ず確認してください。
          </div>

          <section
            style={{
              ...sectionStyle,
              background: "#eff6ff",
              color: "#0f172a",
              borderColor: "#bfdbfe",
            }}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: 18 }}>
              外部AIで整理した内容を取り込む使い方
            </h3>
            <p
              style={{
                margin: "0 0 12px",
                color: "#1e3a8a",
                lineHeight: 1.7,
                fontWeight: 700,
              }}
            >
              コピーしたプロンプトを外部AIに貼り、返ってきたJSONをここに戻します。
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
                gap: 12,
              }}
            >
              <div>
                <div style={{ ...labelStyle, color: "#1d4ed8" }}>手順</div>
                <ol
                  style={{
                    margin: 0,
                    paddingLeft: 20,
                    color: "#1f2937",
                    lineHeight: 1.7,
                  }}
                >
                  <li>プロンプトをコピーする</li>
                  <li>外部AIに貼り、会話ログも渡す</li>
                  <li>返ってきたJSONをこの画面に貼る</li>
                  <li>候補を確認して投稿するか選ぶ</li>
                </ol>
              </div>

              <div>
                <div style={{ ...labelStyle, color: "#1d4ed8" }}>
                  貼れるもの
                </div>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 20,
                    color: "#1f2937",
                    lineHeight: 1.7,
                  }}
                >
                  <li>過去にChatGPTと話した経済・政策の会話</li>
                  <li>自分のメモや長くなった考え</li>
                  <li>SNSに投稿する前の下書き</li>
                  <li>複数の論点が混ざった文章</li>
                </ul>
              </div>

              <div>
                <div style={{ ...labelStyle, color: "#b91c1c" }}>
                  貼らないもの
                </div>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 20,
                    color: "#7f1d1d",
                    lineHeight: 1.7,
                  }}
                >
                  <li>個人名、住所、電話番号、メールアドレス</li>
                  <li>LINEなどの個人的なやりとり</li>
                  <li>第三者が特定される情報</li>
                  <li>店名や勤務先など個人特定につながる情報</li>
                </ul>
              </div>

              <div>
                <div style={{ ...labelStyle, color: "#047857" }}>
                  この機能でできること
                </div>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 20,
                    color: "#064e3b",
                    lineHeight: 1.7,
                  }}
                >
                  <li>複数の投稿候補をまとめて作れる</li>
                  <li>投稿前に内容を確認・編集できる</li>
                  <li>類似スレッドを確認できる</li>
                  <li>参考投稿として保存できる</li>
                </ul>
              </div>
            </div>

            <div
              style={{
                marginTop: 12,
                border: "1px solid #93c5fd",
                borderRadius: 8,
                background: "#dbeafe",
                color: "#1e3a8a",
                padding: 10,
                lineHeight: 1.7,
                fontWeight: 800,
              }}
            >
              読み取っただけでは投稿されません。投稿する候補を自分で選んでから投稿します。
            </div>
          </section>

          <section style={sectionStyle}>
            <div style={{ marginBottom: 16 }}>
              <div style={labelStyle}>抽出モード</div>
              <div
                style={{
                  marginBottom: 10,
                  color: "#64748b",
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                会話ログから投稿候補にしたいテーマだけを抜き出すか、外部AIに全体を分類させるかを選べます。
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                {(
                  [
                    {
                      value: "category",
                      label: "テーマを選んで抜き出す",
                    },
                    {
                      value: "auto",
                      label: "AIに全部分類させる",
                    },
                  ] as const
                ).map((mode) => (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => {
                      setExtractionMode(mode.value);
                      setCategoryLimitMessage("");
                      setCopyMessage("");
                    }}
                    style={{
                      ...buttonStyle,
                      padding: "7px 10px",
                      background:
                        extractionMode === mode.value ? "#e0f2fe" : "#ffffff",
                      color:
                        extractionMode === mode.value ? "#075985" : "#111827",
                      borderColor:
                        extractionMode === mode.value ? "#38bdf8" : "#cbd5e1",
                    }}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
              {extractionMode === "category" ? (
                <div
                  style={{
                    border: "1px solid #dbeafe",
                    borderRadius: 10,
                    padding: 12,
                    background: "#eff6ff",
                    color: "#1e3a8a",
                  }}
                >
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>
                    大カテゴリーを選ぶ
                  </div>
                  <div
                    style={{
                      marginBottom: 10,
                      color: "#334155",
                      fontSize: 13,
                      lineHeight: 1.6,
                    }}
                  >
                    複数選択できます。選択できるカテゴリーは最大3つまでです。
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {MAIN_CATEGORY_OPTIONS.map((category) => {
                      const selected = selectedCategories.includes(category);

                      return (
                        <button
                          key={category}
                          type="button"
                          onClick={() => toggleCategory(category)}
                          style={{
                            ...buttonStyle,
                            padding: "7px 10px",
                            background: selected ? "#1d4ed8" : "#ffffff",
                            color: selected ? "#ffffff" : "#1e3a8a",
                            borderColor: selected ? "#1d4ed8" : "#bfdbfe",
                          }}
                        >
                          {category}
                        </button>
                      );
                    })}
                  </div>
                  {categoryLimitMessage && (
                    <div
                      style={{
                        marginTop: 10,
                        color: "#991b1b",
                        fontSize: 13,
                        fontWeight: 800,
                        lineHeight: 1.6,
                      }}
                    >
                      {categoryLimitMessage}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    padding: 12,
                    background: "#f8fafc",
                    color: "#334155",
                    fontSize: 13,
                    lineHeight: 1.7,
                  }}
                >
                  会話ログ全体を外部AIに読ませ、投稿候補ごとに最も近いカテゴリーへ分類させます。投稿不要な雑談や個人的な内容は除外するよう指示します。
                </div>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label htmlFor="external-ai-source-ai" style={labelStyle}>
                整理に使ったAI
              </label>
              <div
                style={{
                  marginBottom: 8,
                  color: "#64748b",
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                外部AIで整理した投稿候補を、あとで見返す時の目印にできます。
              </div>
              <select
                id="external-ai-source-ai"
                value={sourceAi}
                onChange={(event) => {
                  const nextSourceAi = event.target.value || "未指定";
                  setSourceAi(nextSourceAi);
                  setCandidates((current) =>
                    current.map((candidate) => ({
                      ...candidate,
                      source_ai: nextSourceAi,
                    }))
                  );
                }}
                style={inputStyle}
              >
                {SOURCE_AI_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 18 }}>外部AIに貼るプロンプト</h3>
              <button type="button" onClick={handleCopyPrompt} style={buttonStyle}>
                プロンプトをコピー
              </button>
            </div>
            {copyMessage && (
              <div style={{ marginBottom: 8, color: "#475569", fontSize: 13 }}>
                {copyMessage}
              </div>
            )}
            <textarea
              readOnly
              value={externalAiPrompt}
              rows={14}
              style={{
                ...inputStyle,
                resize: "vertical",
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: 13,
                background: "#ffffff",
                color: "#0f172a",
              }}
            />
          </section>

          <section style={sectionStyle}>
            <label htmlFor="external-ai-json-input" style={labelStyle}>
              外部AIの整理結果を貼り付け
            </label>
            <div
              style={{
                marginBottom: 8,
                color: "#64748b",
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              外部AIが返したJSONだけを貼り付けてください。会話ログ本文はここでは読み取れません。
            </div>
            <textarea
              id="external-ai-json-input"
              value={jsonInput}
              onChange={(event) => setJsonInput(event.target.value)}
              placeholder="外部AIが返したJSONだけを貼り付けてください。"
              rows={10}
              style={{ ...inputStyle, resize: "vertical", minHeight: 180 }}
            />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
              <button type="button" onClick={handleParseJson} style={buttonStyle}>
                投稿候補を読み取る
              </button>
              <button
                type="button"
                onClick={() => {
                  setJsonInput("");
                  setCandidates([]);
                  setError("");
                  setNotice("");
                  setSubmitError("");
                  setSubmitResults({});
                  setRelatedByCandidate({});
                  setSavedReferences({});
                }}
                style={buttonStyle}
              >
                クリア
              </button>
            </div>
            {error && (
              <div
                style={{
                  marginTop: 12,
                  border: "1px solid #fecaca",
                  borderRadius: 8,
                  padding: 10,
                  background: "#fef2f2",
                  color: "#991b1b",
                  fontWeight: 700,
                }}
              >
                <span style={{ whiteSpace: "pre-wrap" }}>{error}</span>
              </div>
            )}
            {notice && (
              <div style={{ marginTop: 12, color: "#475569", fontWeight: 700 }}>
                {notice}
              </div>
            )}
          </section>

          {candidates.length > 0 && (
            <section style={sectionStyle}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: 18 }}>投稿候補プレビュー</h3>
                  <p style={{ margin: "6px 0 0", color: "#64748b", lineHeight: 1.6 }}>
                    投稿候補を確認・編集できます。読み取っただけでは投稿されません。
                  </p>
                </div>
                <span
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 999,
                    padding: "4px 10px",
                    background: "#ffffff",
                    color: "#334155",
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  投稿予定 {selectedCount}件
                </span>
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                {candidates.map((candidate, index) => (
                  <article
                    key={`external-ai-candidate-${index}`}
                    style={{
                      border: "1px solid #d7dde8",
                      borderRadius: 10,
                      padding: 14,
                      background: "#ffffff",
                      color: "#111827",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        flexWrap: "wrap",
                        marginBottom: 12,
                      }}
                    >
                      <strong>候補 {index + 1}</strong>
                      <span
                        style={{
                          border: "1px solid #cbd5e1",
                          borderRadius: 999,
                          padding: "2px 9px",
                          background:
                            candidate.status === "post"
                              ? "#dcfce7"
                              : candidate.status === "skip"
                              ? "#fee2e2"
                              : "#f8fafc",
                          color:
                            candidate.status === "post"
                              ? "#166534"
                              : candidate.status === "skip"
                              ? "#991b1b"
                              : "#475569",
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      >
                        {candidate.status === "post"
                          ? "投稿対象"
                          : candidate.status === "skip"
                          ? "今回は投稿しない"
                          : "未選択"}
                      </span>
                    </div>

                    {candidate.isEditing ? (
                      <div style={{ display: "grid", gap: 10 }}>
                        <label style={labelStyle}>
                          タイトル
                          <input
                            value={candidate.title}
                            onChange={(event) =>
                              updateCandidate(index, { title: event.target.value })
                            }
                            style={{ ...inputStyle, marginTop: 6 }}
                          />
                        </label>
                        <label style={labelStyle}>
                          問題・質問
                          <textarea
                            value={candidate.question}
                            onChange={(event) =>
                              updateCandidate(index, { question: event.target.value })
                            }
                            rows={3}
                            style={{ ...inputStyle, marginTop: 6 }}
                          />
                        </label>
                        <label style={labelStyle}>
                          AI回答・整理
                          <textarea
                            value={candidate.ai_answer}
                            onChange={(event) =>
                              updateCandidate(index, { ai_answer: event.target.value })
                            }
                            rows={4}
                            style={{ ...inputStyle, marginTop: 6 }}
                          />
                        </label>
                        {(["premises", "reasons", "risks", "supplements"] as const).map(
                          (field) => (
                            <label key={field} style={labelStyle}>
                              {field === "premises"
                                ? "前提"
                                : field === "reasons"
                                ? "根拠"
                                : field === "risks"
                                ? "反論・リスク"
                                : "補足"}
                              <textarea
                                value={candidate[field].join("\n")}
                                onChange={(event) =>
                                  updateCandidate(index, {
                                    [field]: linesToArray(event.target.value),
                                  })
                                }
                                rows={3}
                                style={{ ...inputStyle, marginTop: 6 }}
                              />
                            </label>
                          )
                        )}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
                            gap: 10,
                          }}
                        >
                          <label style={labelStyle}>
                            主カテゴリー
                            <input
                              value={candidate.category}
                              onChange={(event) =>
                                updateCandidate(index, { category: event.target.value })
                              }
                              style={{ ...inputStyle, marginTop: 6 }}
                            />
                          </label>
                          <label style={labelStyle}>
                            小カテゴリー
                            <input
                              value={candidate.sub_category}
                              onChange={(event) =>
                                updateCandidate(index, {
                                  sub_category: event.target.value,
                                })
                              }
                              style={{ ...inputStyle, marginTop: 6 }}
                            />
                          </label>
                          <label style={labelStyle}>
                            候補ノード
                            <input
                              value={candidate.node}
                              onChange={(event) =>
                                updateCandidate(index, { node: event.target.value })
                              }
                              style={{ ...inputStyle, marginTop: 6 }}
                            />
                          </label>
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
                            gap: 10,
                          }}
                        >
                          <label style={labelStyle}>
                            関連カテゴリー
                            <textarea
                              value={candidate.related_categories.join("\n")}
                              onChange={(event) =>
                                updateCandidate(index, {
                                  related_categories: linesToArray(event.target.value),
                                })
                              }
                              rows={3}
                              style={{ ...inputStyle, marginTop: 6 }}
                            />
                          </label>
                          <label style={labelStyle}>
                            タグ
                            <textarea
                              value={candidate.tags.join("\n")}
                              onChange={(event) =>
                                updateCandidate(index, {
                                  tags: linesToArray(event.target.value),
                                })
                              }
                              rows={3}
                              style={{ ...inputStyle, marginTop: 6 }}
                            />
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: 12 }}>
                        <FieldBlock label="タイトル">{candidate.title}</FieldBlock>
                        <FieldBlock label="問題・質問">{candidate.question}</FieldBlock>
                        <FieldBlock label="AI回答・整理">
                          {candidate.ai_answer}
                        </FieldBlock>
                        <ListBlock label="前提" items={candidate.premises} />
                        <ListBlock label="根拠" items={candidate.reasons} />
                        <ListBlock label="反論・リスク" items={candidate.risks} />
                        <ListBlock label="補足" items={candidate.supplements} />
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
                            gap: 10,
                          }}
                        >
                          <FieldBlock label="主カテゴリー">
                            {candidate.category}
                          </FieldBlock>
                          <FieldBlock label="小カテゴリー">
                            {candidate.sub_category}
                          </FieldBlock>
                          <FieldBlock label="候補ノード">{candidate.node}</FieldBlock>
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
                            gap: 10,
                          }}
                        >
                          <ListBlock
                            label="関連カテゴリー"
                            items={candidate.related_categories}
                          />
                          <ListBlock label="タグ" items={candidate.tags} />
                        </div>
                      </div>
                    )}

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        marginTop: 14,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => updateCandidate(index, { status: "post" })}
                        disabled={isSubmitting}
                        style={{
                          ...buttonStyle,
                          background:
                            candidate.status === "post" ? "#047857" : "#ffffff",
                          color: candidate.status === "post" ? "#ffffff" : "#111827",
                          borderColor:
                            candidate.status === "post" ? "#047857" : "#cbd5e1",
                        }}
                      >
                        投稿対象にする
                      </button>
                      <button
                        type="button"
                        onClick={() => updateCandidate(index, { status: "skip" })}
                        disabled={isSubmitting}
                        style={{
                          ...buttonStyle,
                          background:
                            candidate.status === "skip" ? "#b91c1c" : "#ffffff",
                          color: candidate.status === "skip" ? "#ffffff" : "#111827",
                          borderColor:
                            candidate.status === "skip" ? "#b91c1c" : "#cbd5e1",
                        }}
                      >
                        今回は投稿しない
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateCandidate(index, {
                            isEditing: !candidate.isEditing,
                          })
                        }
                        disabled={isSubmitting}
                        style={buttonStyle}
                      >
                        {candidate.isEditing ? "編集を閉じる" : "編集する"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSearchRelatedThreads(index, candidate)}
                        disabled={Boolean(relatedByCandidate[index]?.loading)}
                        style={{
                          ...buttonStyle,
                          background: "#f8fafc",
                          color: "#0f172a",
                          borderColor: "#cbd5e1",
                        }}
                      >
                        {relatedByCandidate[index]?.loading
                          ? "確認中..."
                          : "類似スレッドを確認"}
                      </button>
                    </div>

                    {relatedByCandidate[index] && (
                      <div
                        style={{
                          marginTop: 12,
                          border: "1px solid #cbd5e1",
                          borderRadius: 8,
                          padding: 12,
                          background: "#f8fafc",
                          color: "#111827",
                          lineHeight: 1.7,
                        }}
                      >
                        <div style={{ fontWeight: 900, marginBottom: 4 }}>
                          近い可能性がある既存スレッド
                        </div>
                        <div
                          style={{
                            color: "#64748b",
                            fontSize: 13,
                            marginBottom: 10,
                          }}
                        >
                          完全一致とは限りません。内容を確認して、新規投稿するか判断してください。今回は確認のみです。
                        </div>
                        {relatedByCandidate[index].error ? (
                          <div style={{ color: "#991b1b", fontWeight: 800 }}>
                            {relatedByCandidate[index].error}
                          </div>
                        ) : relatedByCandidate[index].loading ? (
                          <div style={{ color: "#475569", fontWeight: 800 }}>
                            類似スレッドを確認しています...
                          </div>
                        ) : relatedByCandidate[index].threads.length > 0 ? (
                          <div style={{ display: "grid", gap: 8 }}>
                            {relatedByCandidate[index].threads.map((thread) => {
                              const saveKey = `${index}:${thread.id}`;
                              const saveState = savedReferences[saveKey];

                              return (
                                <div
                                  key={thread.id}
                                  style={{
                                    border: "1px solid #e2e8f0",
                                    borderRadius: 8,
                                    padding: 10,
                                    background: "#ffffff",
                                    color: "#111827",
                                  }}
                                >
                                  <div style={{ fontWeight: 900 }}>
                                    {thread.title}
                                  </div>
                                  {thread.category && (
                                    <div
                                      style={{
                                        color: "#64748b",
                                        fontSize: 13,
                                        marginTop: 2,
                                      }}
                                    >
                                      {thread.category}
                                    </div>
                                  )}
                                  {(thread.ai_summary || thread.reason) && (
                                    <div
                                      style={{
                                        marginTop: 6,
                                        color: "#334155",
                                        fontSize: 13,
                                      }}
                                    >
                                      {thread.ai_summary || thread.reason}
                                    </div>
                                  )}
                                  <div
                                    style={{
                                      display: "flex",
                                      flexWrap: "wrap",
                                      gap: 10,
                                      alignItems: "center",
                                      marginTop: 8,
                                    }}
                                  >
                                    <a
                                      href={`/${tenant}/forum/thread/${thread.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{
                                        display: "inline-block",
                                        color: "#0369a1",
                                        fontWeight: 900,
                                        textDecoration: "underline",
                                        textUnderlineOffset: 3,
                                      }}
                                    >
                                      開く
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleSaveReference(index, candidate, thread)
                                      }
                                      disabled={Boolean(saveState?.loading || saveState?.saved)}
                                      style={{
                                        ...buttonStyle,
                                        padding: "6px 10px",
                                        background: saveState?.saved
                                          ? "#dcfce7"
                                          : "#ffffff",
                                        color: saveState?.saved
                                          ? "#166534"
                                          : "#0f172a",
                                        borderColor: saveState?.saved
                                          ? "#86efac"
                                          : "#cbd5e1",
                                      }}
                                    >
                                      {saveState?.loading
                                        ? "保存中..."
                                        : saveState?.saved
                                          ? "保存済み"
                                          : "参考投稿として保存"}
                                    </button>
                                  </div>
                                  {saveState?.error && (
                                    <div
                                      style={{
                                        marginTop: 6,
                                        color: "#991b1b",
                                        fontSize: 13,
                                        fontWeight: 800,
                                      }}
                                    >
                                      保存できませんでした：{saveState.error}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div style={{ color: "#475569", fontWeight: 800 }}>
                            近い既存スレッドは見つかりませんでした。必要なら新規投稿してください。
                          </div>
                        )}
                      </div>
                    )}

                    {submitResults[index] && (
                      <div
                        style={{
                          marginTop: 12,
                          border:
                            submitResults[index].status === "success"
                              ? "1px solid #bbf7d0"
                              : "1px solid #fecaca",
                          borderRadius: 8,
                          padding: 10,
                          background:
                            submitResults[index].status === "success"
                              ? "#f0fdf4"
                              : "#fef2f2",
                          color:
                            submitResults[index].status === "success"
                              ? "#166534"
                              : "#991b1b",
                          fontWeight: 700,
                          lineHeight: 1.7,
                        }}
                      >
                        {submitResults[index].status === "success" ? (
                          <>
                            投稿済み：
                            {submitResults[index].url ? (
                              <a
                                href={submitResults[index].url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  color: "#166534",
                                  textDecoration: "underline",
                                  textUnderlineOffset: 3,
                                }}
                              >
                                詳しく見る
                              </a>
                            ) : (
                              submitResults[index].threadId
                            )}
                          </>
                        ) : (
                          <>
                            投稿できませんでした：
                            {submitResults[index].error ?? "不明なエラー"}
                          </>
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </div>

              {submitError && (
                <div
                  style={{
                    marginTop: 14,
                    border: "1px solid #fecaca",
                    borderRadius: 8,
                    padding: 10,
                    background: "#fef2f2",
                    color: "#991b1b",
                    fontWeight: 700,
                  }}
                >
                  {submitError}
                </div>
              )}

              <button
                type="button"
                onClick={handleSubmitSelectedCandidates}
                disabled={selectedCount === 0 || isSubmitting}
                style={{
                  marginTop: 14,
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  padding: "10px 14px",
                  background:
                    selectedCount === 0 || isSubmitting ? "#e5e7eb" : "#111827",
                  color: selectedCount === 0 || isSubmitting ? "#64748b" : "#ffffff",
                  fontWeight: 800,
                  cursor: selectedCount === 0 || isSubmitting ? "not-allowed" : "pointer",
                }}
              >
                {isSubmitting ? "投稿中..." : "選んだ候補を投稿する"}
              </button>
              <div style={{ marginTop: 8, color: "#64748b", lineHeight: 1.6 }}>
                カテゴリと論点タグは参考表示です。投稿後のリンクから内容を確認できます。
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
