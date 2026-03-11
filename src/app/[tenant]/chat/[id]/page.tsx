"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { generateReply, detectActionType, type Mode } from "@/lib/reply";


type Entry = {
  id: string;
  role: "user" | "ai";
  content: string;
  mode: Mode;
  created_at: string;
  did_action: boolean | null;
  charter_id: string | null;
};

type SuggestionRow = {
  entry_id: string;
  failure_reason: string | null;
  success_score: number | null;
  completed: boolean | null;
};

export default function ChatPage() {
  const params = useParams<{ tenant: string; id: string }>();
  const router = useRouter();

  const tenantSlug = params.tenant;
  const threadId = params.id;

  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [failureReasonMap, setFailureReasonMap] =
    useState<Record<string, string | null>>({});

  const [suggestionEntryMap, setSuggestionEntryMap] =
    useState<Record<string, boolean>>({});

  const [failedEntryId, setFailedEntryId] = useState<string | null>(null);

const [showSuccessScoreFor, setShowSuccessScoreFor] = useState<string | null>(null);


const [successScoreMap, setSuccessScoreMap] =
  useState<Record<string, number | null>>({});


const [completedMap, setCompletedMap] =
  useState<Record<string, boolean>>({});


  const failureReasons = [
    "空腹",
    "時間がない",
    "疲れている",
    "やる気が出ない",
  ];







const loadEntries = async () => {
  const { data, error } = await supabase
    .from("entries")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("load entries error:", error.message);
    return;
  }

  const entryList = (data ?? []) as Entry[];
  setEntries(entryList);

  const entryIds = entryList.map((e) => e.id);

  if (entryIds.length === 0) {
    setFailureReasonMap({});
    setSuggestionEntryMap({});
    setSuccessScoreMap({});
    setCompletedMap({});
    return;
  }

  const { data: suggestions, error: sError } = await supabase
    .from("action_suggestions")
    .select("entry_id, failure_reason, success_score, completed")
    .in("entry_id", entryIds);

  if (sError) {
    console.error("suggestions load error:", sError.message);
    return;
  }

  const failureMap: Record<string, string | null> = {};
  const suggestionMap: Record<string, boolean> = {};
  const successMap: Record<string, number | null> = {};
  const completedMapLocal: Record<string, boolean> = {};

  for (const id of entryIds) {
    failureMap[id] = null;
    suggestionMap[id] = false;
    successMap[id] = null;
    completedMapLocal[id] = false;
  }

  for (const row of (suggestions ?? []) as SuggestionRow[]) {
    failureMap[row.entry_id] = row.failure_reason ?? null;
    suggestionMap[row.entry_id] = true;
    successMap[row.entry_id] = row.success_score ?? null;
    completedMapLocal[row.entry_id] = row.completed === true;
  }

  setFailureReasonMap(failureMap);
  setSuggestionEntryMap(suggestionMap);
  setSuccessScoreMap(successMap);
  setCompletedMap(completedMapLocal);
};






useEffect(() => {
  if (!threadId) return;
  void loadEntries();
}, [threadId]);

const lastAiEntryId = [...entries]
  .reverse()
  .find((e) => e.role === "ai")?.id;

const saveSuccessScore = async (entryId: string, score: number) => {
  const { error } = await supabase
    .from("action_suggestions")
    .update({
      completed: true,
      failure_reason: null,
      success_score: score,
    })
    .eq("entry_id", entryId);

  if (error) {
    console.error("saveSuccessScore error:", error.message);
    return;
  }

  setShowSuccessScoreFor(null);
  await loadEntries();
};



const sendMessage = async () => {
  if (!input.trim()) return;

  setLoading(true);

  try {
    const userText = input.trim();
    const hour = new Date().getHours();

    const currentTimeBucket: "morning" | "afternoon" | "night" =
  hour < 12 ? "morning" : hour < 18 ? "afternoon" : "night";


    const mode: Mode = tenantSlug === "dev" ? "buddy" : "sayaka";

    const { error: uError } = await supabase
      .from("entries")
      .insert({
        thread_id: threadId,
        role: "user",
        content: userText,
        mode,
      });

    if (uError) {
      console.error("insert user error:", uError.message);
      return;
    }

    const { data: recentActions, error: rError } = await supabase
      .from("action_suggestions")
.select("action_type, action_text, completed, failure_reason, success_score, created_at")

      .eq("thread_id", threadId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (rError) {
      console.error("recent actions load error:", rError.message);
    }

    const successStats = (() => {
      const rows = recentActions ?? [];

      const byType: Record<
        string,
        { total: number; success: number; easy: number; normal: number; hard: number }
      > = {};

      for (const row of rows) {
        const type = row.action_type ?? "other";

        if (!byType[type]) {
          byType[type] = {
            total: 0,
            success: 0,
            easy: 0,
            normal: 0,
            hard: 0,
          };
        }

        byType[type].total += 1;

        if (row.completed === true) {
          byType[type].success += 1;

          if (row.success_score === 3) byType[type].easy += 1;
          if (row.success_score === 2) byType[type].normal += 1;
          if (row.success_score === 1) byType[type].hard += 1;
        }
      }

      const rates: Record<
        string,
        {
          total: number;
          success: number;
          success_rate: number;
          easy: number;
          normal: number;
          hard: number;
        }
      > = {};

      for (const [type, v] of Object.entries(byType)) {
        rates[type] = {
          total: v.total,
          success: v.success,
          success_rate: v.total > 0 ? v.success / v.total : 0,
          easy: v.easy,
          normal: v.normal,
          hard: v.hard,
        };
      }

      return rates;
    })();


const actionSuccessRates = Object.fromEntries(
  Object.entries(successStats).map(([type, v]) => [type, v.success_rate])
);




const actionSuccessRatesByTime = (() => {
  const rows = recentActions ?? [];

  const bucketMap: Record<
    string,
    {
      action_type: string;
      time_bucket: string;
      attempt_count: number;
      success_count: number;
    }
  > = {};

  for (const row of rows) {
    const actionType = row.action_type ?? "other";

    const createdAt = row.created_at ? new Date(row.created_at) : null;
    const h = createdAt ? createdAt.getHours() : null;

    const timeBucket =
      h === null ? "night" : h < 12 ? "morning" : h < 18 ? "afternoon" : "night";

    const key = `${actionType}_${timeBucket}`;

    if (!bucketMap[key]) {
      bucketMap[key] = {
        action_type: actionType,
        time_bucket: timeBucket,
        attempt_count: 0,
        success_count: 0,
      };
    }

    bucketMap[key].attempt_count += 1;

    if (row.completed === true) {
      bucketMap[key].success_count += 1;
    }
  }

  return Object.values(bucketMap).map((v) => ({
    action_type: v.action_type,
    time_bucket: v.time_bucket,
    attempt_count: v.attempt_count,
    success_count: v.success_count,
    success_rate: v.attempt_count > 0 ? v.success_count / v.attempt_count : 0,
  }));
})();




const replyText = generateReply(
  mode,
  userText,
  null,
  {
    recent_actions: recentActions ?? [],
    success_stats: successStats,
    action_success_rates: actionSuccessRates,
    current_time_bucket: currentTimeBucket,
    action_success_rates_by_time: actionSuccessRatesByTime,
  }
);


    const { data: aiEntry, error: aError } = await supabase
      .from("entries")
      .insert({
        thread_id: threadId,
        role: "ai",
        content: replyText,
        mode,
      })
      .select()
      .single();

    if (aError || !aiEntry) {
      console.error("insert ai error:", aError?.message ?? "unknown");
      return;
    }

    const looksLikeNotDoneInput =
      /できなかった|やってない|無理だった|何もできなかった/.test(userText);



const shouldSaveSuggestion =
  looksLikeNotDoneInput ||
  /(してみますか|やってみますか|やろうか|やってみる|試してみますか|決めてみましょうか|続けてみますか|整えてみますか|にしてみますか|だけにしてみますか|休めますか)/.test(
    replyText
  );

    if (shouldSaveSuggestion) {
      const detectedActionType = detectActionType(replyText);

      const { error: sError } = await supabase
        .from("action_suggestions")
        .insert({
          thread_id: threadId,
          entry_id: aiEntry.id,
          action_text: replyText,
          action_type: detectedActionType,
          difficulty: 1,
          completed: false,
        });

      if (sError) {
        console.error("insert suggestion error:", sError.message);
      }
    }

    setInput("");
    await loadEntries();
  } finally {
    setLoading(false);
  }
};


  const markDone = async (entryId: string) => {
    const { error } = await supabase
      .from("action_suggestions")
      .update({
        completed: true,
        failure_reason: null,
      })
      .eq("entry_id", entryId);

    if (error) {
      console.error("markDone error:", error.message);
      return;
    }

    await loadEntries();
  };



const markFailed = async (entryId: string, reason: string) => {
  const { error } = await supabase
    .from("action_suggestions")
    .update({
      completed: false,
      failure_reason: reason,
    })
    .eq("entry_id", entryId);

  if (error) {
    console.error("markFailed error:", error.message);
    return;
  }

  setFailedEntryId(null);
  await loadEntries();
};

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <button onClick={() => router.push(`/${tenantSlug}`)}>
          ← トップへ戻る
        </button>
      </div>

      <div style={{ marginBottom: 24 }}>
        {entries.map((e) => (
          <div key={e.id} style={{ marginBottom: 12 }}>
            <div>
              <b>{e.role === "user" ? "あなた" : "AI"}：</b>
              {e.content}
            </div>

            {e.role === "ai" && failureReasonMap[e.id] != null && (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  opacity: 0.7,
                }}
              >
                できなかった理由：{failureReasonMap[e.id]}
              </div>
            )}

            {e.role === "ai" && successScoreMap[e.id] != null && (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  opacity: 0.7,
                }}
              >
                やった：
                {successScoreMap[e.id] === 3
                  ? "簡単"
                  : successScoreMap[e.id] === 2
                  ? "普通"
                  : "きつい"}
              </div>
            )}

            {e.role === "ai" &&
              e.id === lastAiEntryId &&
              suggestionEntryMap[e.id] &&
              !completedMap[e.id] && (
                <div style={{ marginTop: 8 }}>
                  <button
                    onClick={() => {
                      setShowSuccessScoreFor(e.id);
                      setFailedEntryId(null);
                    }}
                  >
                    やった
                  </button>{" "}
                  <button
                    onClick={() => {
                      setFailedEntryId(e.id);
                      setShowSuccessScoreFor(null);
                    }}
                  >
                    できなかった
                  </button>

                  {showSuccessScoreFor === e.id && (
                    <div style={{ marginTop: 8 }}>
                      <button
                        onClick={() => void saveSuccessScore(e.id, 3)}
                        style={{ marginRight: 6, padding: "6px 10px", borderRadius: 8 }}
                      >
                        簡単
                      </button>
                      <button
                        onClick={() => void saveSuccessScore(e.id, 2)}
                        style={{ marginRight: 6, padding: "6px 10px", borderRadius: 8 }}
                      >
                        普通
                      </button>
                      <button
                        onClick={() => void saveSuccessScore(e.id, 1)}
                        style={{ padding: "6px 10px", borderRadius: 8 }}
                      >
                        きつい
                      </button>
                    </div>
                  )}

                  {failedEntryId === e.id && (
                    <div style={{ marginTop: 8 }}>
                      {failureReasons.map((reason) => (
                        <button
                          key={reason}
                          onClick={() => void markFailed(e.id, reason)}
                          style={{
                            marginRight: 6,
                            marginBottom: 6,
                            padding: "6px 10px",
                            borderRadius: 8,
                          }}
                        >
                          {reason}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{ flex: 1 }}
        />

        <button onClick={() => void sendMessage()} disabled={loading}>
          送信
        </button>
      </div>
    </div>
  );
}
