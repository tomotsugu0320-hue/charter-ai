"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Mode = "standard" | "buddy" | "sayaka";
type Category = "筋トレ" | "有酸素" | "レッスン";

type Entry = {
  id: string;
  role: "user" | "ai";
  content: string;
  created_at: string;
  mode: Mode;
  category?: Category | null;
};

const INSTRUCTOR_MENUS = [
  "腹筋20回",
  "ストレッチ5分",
  "スクワット10回",
] as const;

function detectCategory(text: string): Category {
  const t = text.trim();

  // レッスン系を最優先
  if (
    /ヨガ|ボディジャム|ボディコンバット|ボディパンプ|ピラティス|レッスン|スタジオ/.test(
      t
    )
  ) {
    return "レッスン";
  }

  // 有酸素
  if (/分|時間|走|ラン|ウォーク|歩|有酸素|スカッシュ/.test(t)) {
    return "有酸素";
  }

  // それ以外は筋トレ
  return "筋トレ";
}

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
  return /腹筋|腕立て|伏せ|スクワット|ストレッチ|歩いた|歩く|分|時間|回|セット|やった|した|ラン|ウォーク|スカッシュ|ヨガ|ボディジャム|ボディコンバット|レッスン|スタジオ/.test(
    text.trim()
  );
}

function normalizeMenuInput(text: string) {
  const t = text.trim();
  if (/やった$|した$/.test(t)) return t;
  return `${t}やった`;
}

function extractCount(text: string) {
  const match = text.match(/(\d+)回/);
  return match ? Number(match[1]) : 0;
}

function normalize(text: string) {
  return text.replace(/やった|した/g, "").trim();
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        background: "#ffffff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          marginBottom: 10,
          color: "#4b5563",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

export default function ChatPage() {
  const params = useParams<{ tenant: string; id: string }>();

  const tenantSlug = params?.tenant ?? "dev";
  const threadId = params?.id ?? "";
  const mode: Mode = tenantSlug === "dev" ? "buddy" : "sayaka";

  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState("");
  const [lessonInput, setLessonInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [pendingAction, setPendingAction] = useState(false);
  const [scoreTarget, setScoreTarget] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);

  const [userMenuOptions, setUserMenuOptions] = useState<string[]>([]);

  const lastAiId = useMemo(() => {
    return [...entries].reverse().find((e) => e.role === "ai")?.id ?? null;
  }, [entries]);

  const getTodayTrainingItems = () => {
    const now = new Date();
    const today =
      now.getFullYear() +
      "-" +
      String(now.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(now.getDate()).padStart(2, "0");

    return entries.filter((e) => {
      if (e.role !== "user") return false;
      if (!e.created_at?.startsWith(today)) return false;
      if (isNoiseText(e.content)) return false;
      return looksLikeTrainingAction(e.content);
    });
  };

  const todayItems = getTodayTrainingItems();

  const getCategory = (e: Entry): Category => {
    if (e.category) return e.category;
    return detectCategory(e.content);
  };

  const strengthItems = todayItems.filter((e) => getCategory(e) === "筋トレ");
  const cardioItems = todayItems.filter((e) => getCategory(e) === "有酸素");
  const lessonItems = todayItems.filter((e) => getCategory(e) === "レッスン");

  const strengthGroupedItems = Object.values(
    strengthItems.reduce((acc, item) => {
      const key = normalize(item.content);

      if (!acc[key]) {
        acc[key] = { ...item, count: 0 };
      }

      acc[key].count += 1;
      return acc;
    }, {} as Record<string, any>)
  );

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
      .select("id, role, content, created_at, mode, category")
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
      .select("content, created_at, category")
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

    const lessonCandidates = (data ?? [])
      .filter((row) => row.category === "レッスン")
      .map((row) => row.content.trim())
      .filter(Boolean);

    const lessonUnique = Array.from(new Set(lessonCandidates));
    setUserMenuOptions(lessonUnique.slice(0, 10));
  };

  useEffect(() => {
    if (!threadId) return;
    void loadEntries();
    void loadUserMenuOptions();
  }, [threadId]);

  const insertEntry = async (
    role: "user" | "ai",
    content: string,
    category?: Category
  ) => {
    if (!threadId) {
      console.error("insertEntry error: threadId missing");
      return null;
    }

    const payload = {
      thread_id: threadId,
      role,
      content,
      mode,
      category,
    };

    const { data, error } = await supabase
      .from("entries")
      .insert(payload)
      .select("id, role, content, created_at, mode, category")
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

      await insertEntry("user", label, "筋トレ");
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

  const sendLesson = async () => {
    const text = lessonInput.trim();
    if (!text) return;

    setLoading(true);

    try {
      await insertEntry("user", text, "レッスン");

      setLessonInput("");
      await loadEntries();
      await loadUserMenuOptions();

      await insertEntry("ai", "いいですね✨ レッスン記録しました！");
      await loadEntries();
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

      const category = detectCategory(text);
      const userEntry = await insertEntry("user", text, category);

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

      {/* AIとの会話 */}
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
                    <Card title="先生のおすすめ">
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
                    </Card>

                    {userMenuOptions.length > 0 && (
                      <Card title="最近のメニュー">
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
                      </Card>
                    )}

                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 13,
                        opacity: 0.7,
                      }}
                    >
                      回数や時間まで書くと、次回から候補に出しやすくなります
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

      {/* 入力画面 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, marginBottom: 6 }}>レッスン</div>

        {userMenuOptions.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            {userMenuOptions.map((menu) => (
              <button
                key={menu}
                onClick={() => setLessonInput(menu)}
                style={{
                  marginRight: 6,
                  marginBottom: 6,
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  background: "#fff",
                }}
                disabled={loading}
              >
                {menu}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="例：ボディコンバット45分"
            value={lessonInput}
            onChange={(e) => setLessonInput(e.target.value)}
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
                void sendLesson();
              }
            }}
          />

          <button
            onClick={() => void sendLesson()}
            disabled={loading || !threadId}
            style={{
              background: "#111827",
              color: "#fff",
              padding: "10px 16px",
              borderRadius: 8,
              border: "none",
            }}
          >
            追加
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 8, fontSize: 13, color: "#6b7280" }}>
        例：スクワット10回、ストレッチ5分
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
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
            border: "none",
          }}
        >
          {loading ? "送信中..." : "送信"}
        </button>
      </div>

      {/* 今日の記録 */}
      <Card title="今日の記録">
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#374151",
              marginBottom: 8,
            }}
          >
            筋トレ
          </div>

          {strengthItems.length === 0 ? (
            <div style={{ fontSize: 14, color: "#6b7280" }}>
              まだ何もやってないね。1つだけやってみよう👍
            </div>
          ) : (
            <>
              {strengthGroupedItems.map((item) => (
                <div
                  key={item.content}
                  style={{
                    marginBottom: 6,
                    color: "#dc2626",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {(() => {
                    const base = normalize(item.content);
                    const count = item.count;
                    const reps = extractCount(item.content);
                    const total = reps * count;

                    if (count > 1 && reps > 0) {
                      return `${base}（${count}セット） 合計${total}回`;
                    }

                    return base;
                  })()}
                </div>
              ))}
            </>
          )}
        </div>

        <div
          style={{
            height: 1,
            background: "#e5e7eb",
            margin: "12px 0 16px",
          }}
        />

        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#374151",
              marginBottom: 8,
            }}
          >
            有酸素
          </div>

          {cardioItems.length === 0 ? (
            <div style={{ fontSize: 14, color: "#6b7280" }}>
              まだ何もやってないね。1つだけやってみよう👍
            </div>
          ) : (
            <>
              {cardioItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    marginBottom: 6,
                    color: "#dc2626",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {item.content}
                </div>
              ))}
            </>
          )}
        </div>

        <div
          style={{
            height: 1,
            background: "#e5e7eb",
            margin: "12px 0 16px",
          }}
        />

        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#374151",
              marginBottom: 8,
            }}
          >
            レッスン
          </div>

          {lessonItems.length === 0 ? (
            <div style={{ fontSize: 14, color: "#6b7280" }}>
              まだ何もやってないね。1つだけやってみよう👍
            </div>
          ) : (
            <>
              {lessonItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    marginBottom: 6,
                    color: "#dc2626",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {item.content}
                </div>
              ))}
            </>
          )}
        </div>
      </Card>
    </div>
  );

}