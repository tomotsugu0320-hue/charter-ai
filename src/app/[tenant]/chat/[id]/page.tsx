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

  if (
    /ヨガ|ボディジャム|ボディコンバット|ボディパンプ|ピラティス|レッスン|スタジオ/.test(
      t
    )
  ) {
    return "レッスン";
  }

  if (/分|時間|走|ラン|ウォーク|歩|有酸素|スカッシュ/.test(t)) {
    return "有酸素";
  }

  return "筋トレ";
}

function isNoiseText(text: string) {
  const t = text.trim();

  return (
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
  const [previousItems, setPreviousItems] = useState<Entry[]>([]);
  const [input, setInput] = useState("");
  const [lessonInput, setLessonInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState(false);
  const [userMenuOptions, setUserMenuOptions] = useState<string[]>([]);

  const lastAiId = useMemo(() => {
    return [...entries].reverse().find((e) => e.role === "ai")?.id ?? null;
  }, [entries]);

  const getTodayKey = () => {
    const now = new Date();
    return (
      now.getFullYear() +
      "-" +
      String(now.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(now.getDate()).padStart(2, "0")
    );
  };

  const getTodayTrainingItems = () => {
    const todayKey = getTodayKey();

    return entries.filter((e) => {
      if (e.role !== "user") return false;
      if (!e.created_at?.startsWith(todayKey)) return false;
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

  const previousStrengthItems = previousItems.filter(
    (e) => getCategory(e) === "筋トレ"
  );
  const previousCardioItems = previousItems.filter(
    (e) => getCategory(e) === "有酸素"
  );
  const previousLessonItems = previousItems.filter(
    (e) => getCategory(e) === "レッスン"
  );

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

  const previousStrengthGroupedItems = Object.values(
    previousStrengthItems.reduce((acc, item) => {
      const key = normalize(item.content);

      if (!acc[key]) {
        acc[key] = { ...item, count: 0 };
      }

      acc[key].count += 1;
      return acc;
    }, {} as Record<string, any>)
  );

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

  const loadPreviousItems = async () => {
    if (!threadId) return;

    const { data, error } = await supabase
      .from("entries")
      .select("id, role, content, created_at, mode, category")
      .eq("thread_id", threadId)
      .eq("role", "user")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(
        "loadPreviousItems error:",
        error.message,
        error.details,
        error.hint,
        error.code
      );
      return;
    }

    const rows = (data ?? []) as Entry[];

    const validRows = rows.filter((e) => {
      if (isNoiseText(e.content)) return false;
      return looksLikeTrainingAction(e.content);
    });

    if (validRows.length === 0) {
      setPreviousItems([]);
      return;
    }

    const byDate = new Map<string, Entry[]>();

    for (const row of validRows) {
      const day = row.created_at.slice(0, 10);
      if (!byDate.has(day)) byDate.set(day, []);
      byDate.get(day)!.push(row);
    }

    const sortedDays = Array.from(byDate.keys()).sort().reverse();
    const todayKey = getTodayKey();
    const previousDay = sortedDays.find((day) => day !== todayKey);

    if (!previousDay) {
      setPreviousItems([]);
      return;
    }

    setPreviousItems(byDate.get(previousDay) ?? []);
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

    const freqMap: Record<string, number> = {};

    lessonCandidates.forEach((item) => {
      freqMap[item] = (freqMap[item] || 0) + 1;
    });

    const sorted = Object.entries(freqMap)
      .sort((a, b) => b[1] - a[1])
      .map(([item]) => item);

    setUserMenuOptions(sorted.slice(0, 10));
  };

  useEffect(() => {
    if (!threadId) return;
    void loadEntries();
    void loadUserMenuOptions();
    void loadPreviousItems();
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

  const sendLesson = async () => {
    const text = lessonInput.trim();
    if (!text) return;

    setLoading(true);

    try {
      await insertEntry("user", text, "レッスン");

      setLessonInput("");
      await loadEntries();
      await loadUserMenuOptions();

      await insertEntry(
        "ai",
        `ナイス👍 ${text}、いいトレーニングです。
このあと何をやりますか？`
      );

      await loadEntries();
      await loadPreviousItems();
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
      const category = detectCategory(text);
      const userEntry = await insertEntry("user", text, category);

      if (!userEntry) return;

      setInput("");
      await loadEntries();

      await insertEntry(
        "ai",
        "ナイス👍 いい流れです。このあと何をやりますか？"
      );

      setPendingAction(false);
      await loadEntries();
      await loadUserMenuOptions();
      await loadPreviousItems();
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
            const isGeneralPrompt = !isActionChoicePrompt;

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

                {isAi && isLastAi && isGeneralPrompt && (
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

                {isAi && isLastAi && isActionChoicePrompt && (
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
              </div>
            );
          })
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "#111827",
            marginBottom: 6,
          }}
        >
          🔥 今日のトレーニング
        </div>

        <div
          style={{
            fontSize: 14,
            color: "#6b7280",
            marginBottom: 8,
          }}
        >
          🔥コツコツが一番強い。前回の続き、いっちゃう？
        </div>

        <div style={{ marginBottom: 8 }}>
          <a
            href="#previous-record"
            style={{
              fontSize: 12,
              color: "#2563eb",
              textDecoration: "none",
            }}
          >
            前回を見る
          </a>
        </div>
      </div>

      {/* 入力画面：筋トレ・有酸素を上 */}
      <div style={{ marginBottom: 8, fontSize: 13, color: "#6b7280" }}>
        例：スクワット10回、ストレッチ5分、ウォーキング20分
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="いま、何やった？（例：スクワット10回）"
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
          {loading ? "送信中..." : "👉 ナイス積み上げ！"}
        </button>
      </div>

      {/* レッスン入力：下 */}
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
            {loading ? "送信中..." : "👉 ナイス積み上げ！"}
          </button>
        </div>
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

      {/* 前回の記録 */}
      <Card title="前回の記録">
        <div id="previous-record">
          {previousItems.length === 0 ? (
            <div style={{ fontSize: 14, color: "#6b7280" }}>
              まだ前回の記録はありません。
            </div>
          ) : (
            <>
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

                {previousStrengthItems.length === 0 ? (
                  <div style={{ fontSize: 14, color: "#6b7280" }}>
                    記録なし
                  </div>
                ) : (
                  <>
                    {previousStrengthGroupedItems.map((item) => (
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

                {previousCardioItems.length === 0 ? (
                  <div style={{ fontSize: 14, color: "#6b7280" }}>
                    記録なし
                  </div>
                ) : (
                  <>
                    {previousCardioItems.map((item) => (
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

                {previousLessonItems.length === 0 ? (
                  <div style={{ fontSize: 14, color: "#6b7280" }}>
                    記録なし
                  </div>
                ) : (
                  <>
                    {previousLessonItems.map((item) => (
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
            </>
          )}
        </div>
      </Card>
    </div>
  );
}