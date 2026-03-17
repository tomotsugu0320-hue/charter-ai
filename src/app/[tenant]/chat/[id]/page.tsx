"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Mode = "standard" | "buddy" | "sayaka";

type Entry = {
  id: string;
  role: "user" | "ai";
  content: string;
  created_at: string;
  mode: Mode;
};

const INSTRUCTOR_MENUS = [
  "腹筋20回",
  "ストレッチ5分",
  "スクワット10回",
] as const;

function parseScoreFromText(text: string): number | null {
  const t = text.trim();

  if (/簡単|楽|ラク/.test(t)) return 3;
  if (/普通|ちょうど|ちょうどよかった|普通だった/.test(t)) return 2;
  if (/きつい|しんどい|疲れた|重い/.test(t)) return 1;

  return null;
}

function isNoiseText(text: string) {
  const t = text.trim();

  return (
    t === "簡単" ||
    t === "普通" ||
    t === "きつい" ||
    t === "今日はやめる" ||
    t === "やってみる" ||
    t === "疲れた" ||
    t === "やる気ない" ||
    t === "何やればいい？" ||
    t === "何やればいい?" ||
    t === "ちょうどよかった"
  );
}

function looksLikeTrainingAction(text: string) {
  return /(腹筋|腕立て|伏せ|スクワット|ストレッチ|歩いた|歩く|分|回|セット|やった|した)/.test(
    text.trim()
  );
}

function normalizeMenuInput(text: string) {
  const t = text.trim();

  if (/やった$|した$/.test(t)) return t;
  return `${t}やった`;
}

export default function ChatPage() {
  const params = useParams<{ tenant: string; id: string }>();

  const tenantSlug = params?.tenant ?? "dev";
  const threadId = params?.id ?? "";
  const mode: Mode = tenantSlug === "dev" ? "buddy" : "sayaka";

  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [pendingAction, setPendingAction] = useState(false);
  const [scoreTarget, setScoreTarget] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);

  const [userMenuOptions, setUserMenuOptions] = useState<string[]>([]);

  const lastAiId = useMemo(() => {
    return [...entries].reverse().find((e) => e.role === "ai")?.id ?? null;
  }, [entries]);

  const getTodayTrainingItems = () => {
    const today = new Date().toISOString().slice(0, 10);

    const filtered = entries.filter((e) => {
      if (e.role !== "user") return false;
      if (!e.created_at?.startsWith(today)) return false;
      if (isNoiseText(e.content)) return false;
      return looksLikeTrainingAction(e.content);
    });

    const uniqueMap = new Map<string, Entry>();
    for (const item of filtered) {
      const key = item.content.trim();
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      }
    }

    return Array.from(uniqueMap.values());
  };

  const buildTodaySummaryMessage = (nextStreak: number) => {
    const items = getTodayTrainingItems();

    const list =
      items.length > 0
        ? items.map((e) => `・${e.content}`).join("\n")
        : "・まだ記録はありません";

    return `いいですね✨
その調子です。

今日の記録
${list}

今日で${nextStreak}回目です。

この流れで、もう一つ軽くやってみましょうか？`;
  };

  const loadEntries = async () => {
    if (!threadId) return;

    const { data, error } = await supabase
      .from("entries")
      .select("id, role, content, created_at, mode")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error(
        "loadEntries error:",
        error.message,
        error.details,
        error.hint,
        error.code
      );
      return;
    }

    setEntries((data ?? []) as Entry[]);
  };

  const loadUserMenuOptions = async () => {
    if (!threadId) return;

    const { data, error } = await supabase
      .from("entries")
      .select("content, created_at")
      .eq("thread_id", threadId)
      .eq("role", "user")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error(
        "loadUserMenuOptions error:",
        error.message,
        error.details,
        error.hint,
        error.code
      );
      return;
    }

    const candidates = (data ?? [])
      .map((row) => row.content.trim())
      .filter((text) => !isNoiseText(text))
      .filter((text) => looksLikeTrainingAction(text))
      .map((text) => text.replace(/やった$|した$/g, "").trim());

    const unique = Array.from(new Set(candidates)).filter(Boolean);

    setUserMenuOptions(unique.slice(0, 10));
  };

  useEffect(() => {
    if (!threadId) return;
    void loadEntries();
    void loadUserMenuOptions();
  }, [threadId]);

  const insertEntry = async (role: "user" | "ai", content: string) => {
    if (!threadId) {
      console.error("insertEntry error: threadId missing");
      return null;
    }

    const payload = {
      thread_id: threadId,
      role,
      content,
      mode,
    };

    const { data, error } = await supabase
      .from("entries")
      .insert(payload)
      .select("id, role, content, created_at, mode")
      .single();

    if (error) {
      console.error(
        "insertEntry error:",
        error.message,
        error.details,
        error.hint,
        error.code
      );
      console.error("payload was:", payload);
      return null;
    }

    return data as Entry;
  };

  const buildTrainingPrompt = () => {
    const instructorList = INSTRUCTOR_MENUS.map((item) => `・${item}`).join("\n");

    const userList =
      userMenuOptions.length > 0
        ? userMenuOptions.map((item) => `・${item}`).join("\n")
        : "・まだありません";

    return `何をやりますか？

先生のおすすめ
${instructorList}

あなたが最近やったメニュー
${userList}

下のボタンから選ぶか、別の内容はテキストに入力して送信してください。`;
  };

  const startTraining = async () => {
    setLoading(true);

    try {
      await loadUserMenuOptions();

      await insertEntry("ai", buildTrainingPrompt());

      setPendingAction(true);
      await loadEntries();
    } finally {
      setLoading(false);
    }
  };

  const saveScore = async (score: number) => {
    if (!threadId) return;

    setLoading(true);

    try {
      let label = "";
      if (score === 3) label = "簡単";
      if (score === 2) label = "普通";
      if (score === 1) label = "きつい";

      await insertEntry("user", label);

      await loadEntries();

      const newStreak = streak + 1;
      setStreak(newStreak);

      const summaryMessage = buildTodaySummaryMessage(newStreak);
      await insertEntry("ai", summaryMessage);

      setScoreTarget(null);
      await loadEntries();
      await loadUserMenuOptions();
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();

    if (!threadId) {
      console.error("sendMessage blocked: threadId missing");
      return;
    }

    if (!text) return;

    setLoading(true);

    try {
      if (scoreTarget) {
        const parsedScore = parseScoreFromText(text);

        if (parsedScore !== null) {
          setInput("");
          await saveScore(parsedScore);
          return;
        }
      }

      const userEntry = await insertEntry("user", text);
      if (!userEntry) return;

      setInput("");
      await loadEntries();

      if (pendingAction) {
        const ai = await insertEntry("ai", "いいですね✨ 強さはどうでしたか？");

        if (ai) {
          setScoreTarget(ai.id);
        }

        setPendingAction(false);
        await loadEntries();
        await loadUserMenuOptions();
        return;
      }

      if (scoreTarget) {
        await insertEntry(
          "ai",
          "強さはどうでしたか？ 「簡単・普通・きつい」か、近い言い方で教えてください✨"
        );
        await loadEntries();
        return;
      }

      await insertEntry("ai", "いいですね✨ この流れで、もう一つ軽くやってみますか？");
      await loadEntries();
      await loadUserMenuOptions();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h2>AIトレーニングコーチ</h2>

      <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 12 }}>
        tenant: {tenantSlug} / threadId: {threadId || "(missing)"} / mode: {mode}
      </div>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 16,
          marginBottom: 20,
        }}
      >
        {entries.length === 0 ? (
          <div style={{ opacity: 0.6 }}>まだ記録がありません。</div>
        ) : (
          entries.map((entry) => {
            const isAi = entry.role === "ai";
            const isLastAi = entry.id === lastAiId;

            const isActionChoicePrompt = entry.content.includes("何をやりますか");
            const isScorePrompt = entry.content.includes("強さはどうでしたか");
            const isGeneralPrompt = !isActionChoicePrompt && !isScorePrompt;

            return (
              <div
                key={entry.id}
                style={{
                  marginBottom: 12,
                  background: isAi ? "#f3f4f6" : "#fef9c3",
                  padding: 10,
                  borderRadius: 10,
                }}
              >
                <b>{isAi ? "AI" : "あなた"}：</b>
                <div style={{ whiteSpace: "pre-line" }}>{entry.content}</div>

                {isAi && isLastAi && !scoreTarget && isGeneralPrompt && (
                  <div style={{ marginTop: 8 }}>
                    <button
                      onClick={() => void startTraining()}
                      style={{ marginRight: 8 }}
                      disabled={loading}
                    >
                      やってみる
                    </button>

                    <button
                      disabled={loading}
                      onClick={async () => {
                        setLoading(true);
                        try {
                          await insertEntry("user", "今日はやめる");
                          await loadEntries();
                        } finally {
                          setLoading(false);
                        }
                      }}
                    >
                      今日はやめる
                    </button>
                  </div>
                )}

                {isAi && isLastAi && !scoreTarget && isActionChoicePrompt && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ marginBottom: 8, fontSize: 13, opacity: 0.8 }}>
                      先生のおすすめ
                    </div>

                    {INSTRUCTOR_MENUS.map((menu) => (
                      <button
                        key={`inst-${menu}`}
                        onClick={() => {
                          setInput(normalizeMenuInput(menu));
                        }}
                        style={{ marginRight: 8, marginBottom: 8 }}
                        disabled={loading}
                      >
                        {menu}
                      </button>
                    ))}

                    {userMenuOptions.length > 0 && (
                      <>
                        <div style={{ marginTop: 8, marginBottom: 8, fontSize: 13, opacity: 0.8 }}>
                          あなたが最近やったメニュー
                        </div>

                        {userMenuOptions.map((menu) => (
                          <button
                            key={`user-${menu}`}
                            onClick={() => {
                              setInput(normalizeMenuInput(menu));
                            }}
                            style={{ marginRight: 8, marginBottom: 8 }}
                            disabled={loading}
                          >
                            {menu}
                          </button>
                        ))}
                      </>
                    )}

                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 13,
                        opacity: 0.7,
                      }}
                    >
                      別の内容はテキストに入力して送信
                    </div>
                  </div>
                )}

                {scoreTarget === entry.id && (
                  <div style={{ marginTop: 8 }}>
                    <button
                      onClick={() => void saveScore(3)}
                      disabled={loading}
                      style={{ marginRight: 6 }}
                    >
                      簡単
                    </button>

                    <button
                      onClick={() => void saveScore(2)}
                      disabled={loading}
                      style={{ marginRight: 6 }}
                    >
                      普通
                    </button>

                    <button onClick={() => void saveScore(1)} disabled={loading}>
                      きつい
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            pendingAction ? "やった内容を書いてください" : "今日やったことを書いてみよう"
          }
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 8,
            border: "1px solid #ccc",
          }}
          disabled={loading || !threadId}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void sendMessage();
            }
          }}
        />

        <button
          onClick={() => void sendMessage()}
          disabled={loading || !threadId}
          style={{
            background: "#111827",
            color: "#fff",
            padding: "10px 16px",
            borderRadius: 8,
          }}
        >
          {loading ? "送信中..." : "送信"}
        </button>
      </div>
    </div>
  );
}