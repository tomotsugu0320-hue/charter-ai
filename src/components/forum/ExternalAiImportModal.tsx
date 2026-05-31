"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";

type CandidateStatus = "unselected" | "post" | "skip";

type ExternalAiCandidate = {
  title: string;
  question: string;
  ai_answer: string;
  premises: string[];
  reasons: string[];
  risks: string[];
  supplements: string[];
  category: string;
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
const DEFAULT_EXTRACT_THEME = "全テーマを分類して出す";
const THEME_PRESETS = [
  { label: "経済・政策", value: "経済・政策の話だけ抜き取る" },
  { label: "恋愛", value: "恋愛の話だけ抜き取る" },
  { label: "仕事・経営", value: "仕事・経営の話だけ抜き取る" },
  { label: "AI・テクノロジー", value: "AI・テクノロジーの話だけ抜き取る" },
  { label: "生活", value: "生活に関する話だけ抜き取る" },
  { label: "全テーマを分類", value: DEFAULT_EXTRACT_THEME },
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

function buildExternalAiPrompt(extractTheme: string) {
  const theme = extractTheme.trim() || DEFAULT_EXTRACT_THEME;

  return `以下の会話ログを、AI知恵袋の掲示板投稿用に整理してください。

抽出対象テーマ：
${theme}

この会話ログの中から、上記テーマに関係する内容を優先して抽出してください。
指定テーマと関係のない雑談、個人的すぎる話、投稿に不要な内容は除外してください。
「全テーマを分類して出す」の場合は、複数テーマを分けて投稿候補化してください。

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
- 出力は必ずJSON配列にしてください。
- JSON以外の説明文は出力しないでください。

出力形式：
[
  {
    "title": "投稿タイトル案",
    "question": "問題・質問",
    "ai_answer": "AI回答・整理",
    "premises": ["前提1", "前提2"],
    "reasons": ["根拠1", "根拠2"],
    "risks": ["反論・リスク1", "反論・リスク2"],
    "supplements": ["補足1", "補足2"],
    "category": "候補カテゴリ",
    "node": "候補ノード"
  }
]`;
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
  if (!Array.isArray(value)) return [];
  return value.map(toText).filter(Boolean).slice(0, 8);
}

function linesToArray(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeCandidate(value: unknown): ExternalAiCandidate | null {
  const record = isRecord(value) ? value : {};
  const title = toText(record.title);
  const question = toText(record.question);
  const aiAnswer = toText(record.ai_answer);

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
    category: toText(record.category),
    node: toText(record.node),
    source_ai: toText(record.source_ai) || "未指定",
    status: "unselected",
    isEditing: false,
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
  const [extractTheme, setExtractTheme] = useState("");
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
    () => buildExternalAiPrompt(extractTheme),
    [extractTheme]
  );

  if (!isOpen) return null;

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

    for (const { candidate, index } of selected) {
      const result = await submitCandidate(candidate);
      setSubmitResults((current) => ({
        ...current,
        [index]: result,
      }));
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
      await navigator.clipboard.writeText(externalAiPrompt);
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
      const normalizedJsonText = jsonInput
        .replace(/[“”„＂]/g, '"')
        .replace(/[‘’]/g, "'")
        .trim();
      const parsed: unknown = JSON.parse(normalizedJsonText);

      if (!Array.isArray(parsed)) {
        setCandidates([]);
        setSubmitResults({});
        setRelatedByCandidate({});
        setSavedReferences({});
        setError("JSONは配列形式で貼り付けてください。");
        return;
      }

      const normalized = parsed
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
        setError("投稿候補として読める項目がありません。title / question / ai_answer のいずれかを含めてください。");
        return;
      }

      setCandidates(normalized);
      setSubmitResults({});
      setRelatedByCandidate({});
      setSavedReferences({});
      setSubmitError("");
      if (parsed.length > MAX_CANDIDATES) {
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
        "これはJSON形式ではありません。\nこの欄には、外部AIが出力したJSON配列を貼り付けてください。\n会話ログをそのまま貼る場合は、上のプロンプトをあなたのChatGPTや外部AIに貼り、返ってきたJSONだけをここに貼り付けてください。"
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
              あなたのChatGPTや外部AIで会話ログを整理し、その結果をここに貼り付けると、複数の投稿候補として確認できます。
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

          <section style={sectionStyle}>
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="external-ai-extract-theme" style={labelStyle}>
                抽出するテーマ
              </label>
              <div
                style={{
                  marginBottom: 10,
                  color: "#64748b",
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                会話ログに複数の話題が混ざっている場合、投稿候補にしたいテーマだけを指定できます。未入力の場合は、全テーマを分類して整理します。
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                {THEME_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setExtractTheme(preset.value);
                      setCopyMessage("");
                    }}
                    style={{
                      ...buttonStyle,
                      padding: "7px 10px",
                      background:
                        extractTheme === preset.value ? "#e0f2fe" : "#ffffff",
                      color:
                        extractTheme === preset.value ? "#075985" : "#111827",
                      borderColor:
                        extractTheme === preset.value ? "#38bdf8" : "#cbd5e1",
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <input
                id="external-ai-extract-theme"
                value={extractTheme}
                onChange={(event) => {
                  setExtractTheme(event.target.value);
                  setCopyMessage("");
                }}
                placeholder="例：消費税と飲食店の話だけ / 恋愛相談だけ / AI掲示板開発の話だけ"
                style={inputStyle}
              />
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
              外部AIが出力したJSON配列だけを貼り付けてください。会話ログそのものはここでは読み取れません。
            </div>
            <textarea
              id="external-ai-json-input"
              value={jsonInput}
              onChange={(event) => setJsonInput(event.target.value)}
              placeholder="外部AIが出力したJSON配列だけを貼り付けてください。会話ログそのものはここでは読み取れません。"
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
                    第1段階では保存しません。投稿する候補を選ぶUIだけ確認できます。
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
                          ? "投稿する"
                          : candidate.status === "skip"
                          ? "投稿しない"
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
                            候補カテゴリ
                            <input
                              value={candidate.category}
                              onChange={(event) =>
                                updateCandidate(index, { category: event.target.value })
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
                          <FieldBlock label="候補カテゴリ">
                            {candidate.category}
                          </FieldBlock>
                          <FieldBlock label="候補ノード">{candidate.node}</FieldBlock>
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
                        投稿する
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
                        投稿しない
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
                {isSubmitting ? "投稿中..." : "選択した候補を投稿"}
              </button>
              <div style={{ marginTop: 8, color: "#64748b", lineHeight: 1.6 }}>
                category / node は第1実装では保存しません。投稿後のリンクから内容を確認できます。
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
