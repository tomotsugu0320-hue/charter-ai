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
  category?: string | null;
  stance_label?: string | null;
};


type Issue = {
  id: string;
  thread_id: string;
  title: string;
  status: string | null;
  verification_note?: string | null;
  created_at?: string | null;
  side_a?: string | null;
  side_b?: string | null;
  core_conflict?: string | null;
  reason_type: string | string[] | null;
  reason?: string | null;
};


type PostIssue = {
  id: string;
  post_id: string;
  issue_id: string;
};

function toHalfWidth(str: string) {
  return str.replace(/[０-９]/g, (s) =>
    String.fromCharCode(s.charCodeAt(0) - 0xfee0)
  );
}

export default function ChatPage() {
  const params = useParams<{ tenant: string; id: string }>();

  const tenantSlug = params?.tenant ?? "dev";
  const threadId = params?.id ?? "";
  const mode: Mode = tenantSlug === "dev" ? "buddy" : "sayaka";

const [sortOrder, setSortOrder] = useState<"new" | "old">("new");
const [searchText, setSearchText] = useState("");


  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [verifyingIssueId, setVerifyingIssueId] = useState<string | null>(null);
  const [lastVerifiedAtMap, setLastVerifiedAtMap] = useState<Record<string, number>>({});
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [suggestedIssuesMap, setSuggestedIssuesMap] = useState<Record<string, Issue[]>>({});
  const [suggestedNewIssuesMap, setSuggestedNewIssuesMap] = useState<Record<string, string[]>>({});
const [stanceStatsMap, setStanceStatsMap] = useState<Record<string, any>>({});

  const [issues, setIssues] = useState<Issue[]>([]);
  const [newIssueTitle, setNewIssueTitle] = useState("");
  const [postIssues, setPostIssues] = useState<PostIssue[]>([]);
  const [linkingPostId, setLinkingPostId] = useState<string | null>(null);
  const [selectedFilterIssueId, setSelectedFilterIssueId] = useState<string | null>(null);
const [selectedPostType, setSelectedPostType] = useState<string | null>(null);


const [postType, setPostType] = useState("opinion");
  const [selectedLinkIssueId, setSelectedLinkIssueId] = useState<string>("");
  const [issueHistoryMap, setIssueHistoryMap] = useState<Record<string, any[]>>({});

  function getReasonTypeLabel(reasonType?: string | string[] | null) {
    if (!reasonType) return null;

    const list = Array.isArray(reasonType) ? reasonType : [reasonType];

    return list
      .filter(Boolean)
      .map((r) => {
        if (r === "premise_difference") return "前提違い";
        if (r === "definition_difference") return "定義違い";
        if (r === "data_insufficient") return "データ不足";
        if (r === "value_judgment") return "価値判断";
        if (r === "timeframe_mismatch") return "時点違い";
        if (r === "causal_uncertain") return "因果不明";
        return r;
      })
      .join(" + ");
  }

  function getStanceLabelText(stanceLabel?: string | null) {
    if (stanceLabel === "side_a") return "A寄り";
    if (stanceLabel === "side_b") return "B寄り";
    if (stanceLabel === "neutral") return "中立";
    if (stanceLabel === "unknown") return "不明";
    return null;
  }

  function StatusBadge({ status }: { status?: string | null }) {
    const map: Record<
      string,
      { label: string; background: string; color: string; border: string }
    > = {
      verified: {
        label: "🟢 検証済み",
        background: "#dcfce7",
        color: "#166534",
        border: "1px solid #bbf7d0",
      },
      disputed: {
        label: "🟡 異論あり",
        background: "#fef3c7",
        color: "#92400e",
        border: "1px solid #fde68a",
      },
      weak: {
        label: "🔴 根拠弱い",
        background: "#fee2e2",
        color: "#991b1b",
        border: "1px solid #fecaca",
      },
      premise_mismatch: {
        label: "🔵 前提ズレ",
        background: "#dbeafe",
        color: "#1d4ed8",
        border: "1px solid #bfdbfe",
      },
      unverified: {
        label: "⚪ 未検証",
        background: "#f3f4f6",
        color: "#374151",
        border: "1px solid #e5e7eb",
      },
    };

    const s = map[status ?? "unverified"] ?? map.unverified;

    return (
      <span
        style={{
          fontSize: 11,
          marginLeft: 6,
          padding: "2px 6px",
          borderRadius: 6,
          background: s.background,
          color: s.color,
          border: s.border,
        }}
      >
        {s.label}
      </span>
    );
  }

  function getStatusStyle(status?: string) {
    if (status === "verified") {
      return {
        background: "#dcfce7",
        color: "#166534",
        border: "1px solid #bbf7d0",
      };
    }

    if (status === "disputed") {
      return {
        background: "#fef3c7",
        color: "#92400e",
        border: "1px solid #fde68a",
      };
    }

    if (status === "weak") {
      return {
        background: "#fee2e2",
        color: "#991b1b",
        border: "1px solid #fecaca",
      };
    }

    if (status === "premise_mismatch") {
      return {
        background: "#dbeafe",
        color: "#1d4ed8",
        border: "1px solid #bfdbfe",
      };
    }

    return {
      background: "#f3f4f6",
      color: "#374151",
      border: "1px solid #e5e7eb",
    };
  }

  async function loadAllIssueHistories(issueList: Issue[]) {
    const nextMap: Record<string, any[]> = {};

    for (const issue of issueList) {
      const { data, error } = await supabase
        .from("issue_verifications")
        .select("*")
        .eq("issue_id", issue.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        console.error("loadAllIssueHistories error:", issue.id, error);
        nextMap[issue.id] = [];
        continue;
      }

      nextMap[issue.id] = data || [];
    }

    setIssueHistoryMap(nextMap);
  }

  const issueMap = useMemo(() => {
    const map = new Map<string, Issue>();
    issues.forEach((issue) => {
      map.set(issue.id, issue);
    });
    return map;
  }, [issues]);


const filteredEntries = useMemo(() => {
  let result = entries;

  // テーマフィルタ
  if (selectedFilterIssueId) {
    const linkedPostIds = new Set(
      postIssues
        .filter((pi) => pi.issue_id === selectedFilterIssueId)
        .map((pi) => pi.post_id)
    );

    result = result.filter((entry) => linkedPostIds.has(entry.id));
  }

  // 投稿タイプフィルタ
  if (selectedPostType) {
    result = result.filter((entry) => entry.category === selectedPostType);
  }

// 検索フィルタ
if (searchText.trim()) {
  const keyword = toHalfWidth(searchText).toLowerCase();

result = result.filter((entry) => {
  const normalizedContent = toHalfWidth(entry.content).toLowerCase();

  // この投稿に紐づくテーマを取得
  const relatedTitles = postIssues
    .filter((pi) => pi.post_id === entry.id)
    .map((pi) => issueMap.get(pi.issue_id)?.title ?? "")
    .join(" ")
    .toLowerCase();

  return (
    normalizedContent.includes(keyword) ||
    relatedTitles.includes(keyword)
  );
});
}







  return result;
}, [entries, postIssues, selectedFilterIssueId, selectedPostType, searchText,]);





const sortedEntries = useMemo(() => {
  const list = [...filteredEntries];

  if (sortOrder === "new") {
    return list.sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
    );
  }

  return list.sort(
    (a, b) =>
      new Date(a.created_at).getTime() -
      new Date(b.created_at).getTime()
  );
}, [filteredEntries, sortOrder]);




  const issueRanking = useMemo(() => {
    const countMap: Record<string, number> = {};

    postIssues.forEach((pi) => {
      countMap[pi.issue_id] = (countMap[pi.issue_id] ?? 0) + 1;
    });

    return issues
      .map((issue) => ({
        ...issue,
        count: countMap[issue.id] ?? 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [issues, postIssues]);

  const issueVolatilityRanking = useMemo(() => {
    return issues
      .map((issue) => {
        const histories = issueHistoryMap[issue.id] ?? [];

        let changes = 0;
        for (let i = 0; i < histories.length - 1; i++) {
          const current = histories[i]?.status;
          const prev = histories[i + 1]?.status;

          if (current && prev && current !== prev) {
            changes += 1;
          }
        }

        return {
          ...issue,
          changes,
        };
      })
      .sort((a, b) => b.changes - a.changes)
      .slice(0, 5);
  }, [issues, issueHistoryMap]);

  async function loadEntries() {
    if (!threadId) return;

    const { data, error } = await supabase
      .from("entries")
      .select("id, role, content, created_at, mode, category, stance_label")
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
  }

  async function loadIssues(targetThreadId: string) {
    const { data, error } = await supabase
      .from("issues")
      .select("*")
      .eq("thread_id", targetThreadId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("loadIssues error:", error);
      return;
    }

    const issueList = (data ?? []) as Issue[];
    setIssues(issueList);
    await loadAllIssueHistories(issueList);
    await loadAllStanceStats(issueList);
  }

  async function loadPostIssues() {
    if (entries.length === 0) {
      setPostIssues([]);
      return;
    }

    const postIds = entries.map((e) => e.id);

    const { data, error } = await supabase
      .from("post_issues")
      .select("id, post_id, issue_id")
      .in("post_id", postIds);

    if (error) {
      console.error("loadPostIssues error:", error);
      return;
    }

    setPostIssues((data ?? []) as PostIssue[]);
  }

  async function addIssue() {
    const title = newIssueTitle.trim();
    if (!title || !threadId) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("issues").insert({
      thread_id: threadId,
      title,
      status: "unverified",
      created_by: user?.id ?? null,
    });

    if (error) {
      console.error("addIssue error:", error);
      return;
    }

    setNewIssueTitle("");
    await loadIssues(threadId);
  }


async function addIssueAndLink(title: string, postId: string) {
  const trimmed = title.trim();
  if (!trimmed || !threadId) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("issues")
    .insert({
      thread_id: threadId,
      title: trimmed,
      status: "unverified",
      created_by: user?.id ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("addIssueAndLink error:", error);
    return null;
  }

  const { error: linkError } = await supabase.from("post_issues").insert({
    post_id: postId,
    issue_id: data.id,
  });

  if (linkError) {
    console.error("addIssueAndLink link error:", linkError);
    return null;
  }

  await loadPostIssues();
  await loadIssues(threadId);

  setSuggestedNewIssuesMap((prev) => ({
    ...prev,
    [postId]: (prev[postId] ?? []).filter((t) => t !== trimmed),
  }));

  return data;
}


async function linkPostToIssue(postId: string, issueId?: string) {
  const targetIssueId = issueId ?? selectedLinkIssueId;
  if (!targetIssueId) return;

  const alreadyLinked = postIssues.some(
    (pi) => pi.post_id === postId && pi.issue_id === targetIssueId
  );

  if (alreadyLinked) {
    setLinkingPostId(null);
    setSelectedLinkIssueId("");
    return;
  }

  const { error } = await supabase.from("post_issues").insert({
    post_id: postId,
    issue_id: targetIssueId,
  });

  if (error) {
    console.error("linkPostToIssue error:", error);
    return;
  }

  setLinkingPostId(null);
  setSelectedLinkIssueId("");
  await loadPostIssues();
}



async function insertEntry(role: "user" | "ai", content: string) {
  if (!threadId) {
    console.error("insertEntry error: threadId missing");
    return null;
  }

  const payload = {
    thread_id: threadId,
    role,
    content: toHalfWidth(content),
    mode,
    category: role === "user" ? postType : null,
  };

  const { data, error } = await supabase
    .from("entries")
    .insert(payload)
    .select("id, role, content, created_at, mode, category, stance_label")
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
}


  async function analyzeIssueStructure(issue: Issue) {
    const relatedEntries = entries.filter((entry) =>
      postIssues.some((pi) => pi.post_id === entry.id && pi.issue_id === issue.id)
    );

    const fullText = [issue.title, ...relatedEntries.map((e) => e.content)]
      .join("\n")
      .slice(0, 1500);

    try {
      const res = await fetch("/api/issue-structure", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: fullText }),
      });

      const raw = await res.text();

      if (!res.ok) {
        console.error("issue structure api error:", res.status, raw);
        return;
      }

      const data = JSON.parse(raw);

      const { error } = await supabase
        .from("issues")
        .update({
          side_a: data.side_a ?? "",
          side_b: data.side_b ?? "",
          core_conflict: data.core_conflict ?? "",
        })
        .eq("id", issue.id);

      if (error) {
        console.error("issue structure update error:", error);
        return;
      }

      await loadIssues(threadId);
    } catch (e) {
      console.error("analyzeIssueStructure error:", e);
    }
  }









async function classifyPostStance(entryId: string, issue: Issue, postContent: string) {
  if (!issue.side_a && !issue.side_b) return;

  try {
    const res = await fetch("/api/classify-stance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        issueTitle: issue.title,
        sideA: issue.side_a ?? "",
        sideB: issue.side_b ?? "",
        postContent,
      }),
    });

    const raw = await res.text();

    if (!res.ok) {
      console.error("classify stance api error:", res.status, raw);
      return;
    }

    const data = JSON.parse(raw);

console.log("classify stance result:", {
  entryId,
  issueTitle: issue.title,
  sideA: issue.side_a,
  sideB: issue.side_b,
  postContent,
  result: data,
});

    const { error } = await supabase
      .from("entries")
      .update({
        stance_label: data.stance_label ?? "unknown",
      })
      .eq("id", entryId);

    if (error) {
      console.error("classify stance update error:", error);
      return;
    }

    await loadEntries();
    await loadIssues(threadId);
  } catch (e) {
    console.error("classifyPostStance error:", e);
  }
}

async function autoClassifyLinkedPost(entry: Entry, issue: Issue) {
  if (entry.role !== "user") return;
  if (!issue.side_a && !issue.side_b) return;

  await classifyPostStance(entry.id, issue, entry.content);
}

  async function verifyIssue(issue: Issue) {
    const now = Date.now();
    const lastVerifiedAt = lastVerifiedAtMap[issue.id] ?? 0;

    if (now - lastVerifiedAt < 60_000) {
      setVerifyError("ちょっと待って。1分以内は再検証できないよ。");
      return;
    }

    setVerifyingIssueId(issue.id);

    const relatedEntries = entries.filter((entry) =>
      postIssues.some((pi) => pi.post_id === entry.id && pi.issue_id === issue.id)
    );

    const fullText = [issue.title, ...relatedEntries.map((e) => e.content)]
      .join("\n")
      .slice(0, 1500);

    let newStatus = "disputed";
    let reasonType: string[] | null = null;
    let note = "AI応答エラー";

    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: fullText }),
      });

      const raw = await res.text();

      if (!res.ok) {
        console.error("verify api error:", res.status, raw);
        throw new Error(`verify api failed: ${res.status}`);
      }

      let data: {
        status?: string;
        reason_type?: string[] | null;
        note?: string;
      };

      try {
        data = JSON.parse(raw);
      } catch (e) {
        console.error("verify api invalid json:", raw, e);
        throw new Error("verify api returned invalid json");
      }

      newStatus = data.status ?? "disputed";
      reasonType = data.reason_type ?? null;
      note = data.note ?? "判定理由なし";
    } catch (e) {
      console.error("AI verify error:", e);
    }

    const { error: historyError } = await supabase
      .from("issue_verifications")
      .insert({
        issue_id: issue.id,
        status: newStatus,
        reason_type: reasonType,
        note,
      });

    if (historyError) {
      console.error("history insert error:", historyError);
    }

    const { error: updateError } = await supabase
      .from("issues")
      .update({
        status: newStatus,
        reason_type: reasonType,
        verification_note: note,
      })
      .eq("id", issue.id);

    if (updateError) {
      console.error("issue update error:", updateError);
    }

await loadIssues(threadId);

    setLastVerifiedAtMap((prev) => ({
      ...prev,
      [issue.id]: Date.now(),
    }));

    setVerifyingIssueId(null);
  }


async function loadAllStanceStats(issueList: Issue[]) {
  const map: Record<string, any> = {};

  for (const issue of issueList) {
    const stats = await loadStanceStats(issue.id);
    map[issue.id] = stats;
  }

  setStanceStatsMap(map);

}




async function loadStanceStats(issueId: string) {
  const { data: postIssueRows, error: postIssuesError } = await supabase
    .from("post_issues")
    .select("post_id")
    .eq("issue_id", issueId);

  if (postIssuesError) {
    console.error("loadStanceStats post_issues error:", postIssuesError);
    return {
      side_a: 0,
      side_b: 0,
      neutral: 0,
      unknown: 0,
      total: 0,
    };
  }

  const postIds = (postIssueRows ?? [])
    .map((row) => row.post_id)
    .filter(Boolean);

  if (postIds.length === 0) {
    return {
      side_a: 0,
      side_b: 0,
      neutral: 0,
      unknown: 0,
      total: 0,
    };
  }

  const { data: entryRows, error: entriesError } = await supabase
    .from("entries")
    .select("id, stance_label")
    .in("id", postIds);

  if (entriesError) {
    console.error("loadStanceStats entries error:", entriesError);
    return {
      side_a: 0,
      side_b: 0,
      neutral: 0,
      unknown: 0,
      total: 0,
    };
  }

  const counts = {
    side_a: 0,
    side_b: 0,
    neutral: 0,
    unknown: 0,
    total: 0,
  };

  for (const row of entryRows ?? []) {
    const stance = row.stance_label;

    if (stance === "side_a") counts.side_a++;
    else if (stance === "side_b") counts.side_b++;
    else if (stance === "neutral") counts.neutral++;
    else counts.unknown++;
  }

  counts.total =
    counts.side_a + counts.side_b + counts.neutral + counts.unknown;

  return counts;
}


  async function sendMessage() {
    const text = toHalfWidth(input).trim();

    if (!threadId) {
      console.error("sendMessage blocked: threadId missing");
      return;
    }

    if (!text) return;

    setLoading(true);

    try {
      const userEntry = await insertEntry("user", text);
      if (!userEntry) return;

      setInput("");

      await insertEntry(
        "ai",
        "投稿を受け付けました。必要ならテーマを追加し、この投稿を関連づけてください。"
      );

      const res = await fetch("/api/suggest-issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          issues,
        }),
      });

      const data = await res.json();

const matchedIssues = data.matches
.map((m: { title: string; reason?: string }) => {
    const issue = issues.find((i) => i.title === m.title);
    if (!issue) return null;
    return { ...issue, reason: m.reason };
  })
  .filter(Boolean);

const newIssueTitles: string[] = Array.isArray(data.newIssues)
  ? data.newIssues.filter((t: any) => typeof t === "string")
  : [];


setSuggestedIssuesMap((prev) => ({
  ...prev,
  [userEntry.id]: matchedIssues,
}));

setSuggestedNewIssuesMap((prev) => ({
  ...prev,
  [userEntry.id]: newIssueTitles,
}));

const score = (issue: Issue) => {
  let s = 0;
  if (text.includes(issue.title)) s += 3;
  if (issue.title.includes(text)) s += 3;

  for (let i = 0; i < issue.title.length; i++) {
    if (text.includes(issue.title[i])) s += 0.2;
  }

  return s;
};

const sortedMatchedIssues = [...matchedIssues].sort((a, b) => {
  return score(b) - score(a);
});


const limitedMatchedIssues = sortedMatchedIssues.slice(0, 2);


for (const issue of limitedMatchedIssues) {
  await linkPostToIssue(userEntry.id, issue.id);
}

for (const issue of limitedMatchedIssues) {
  await autoClassifyLinkedPost(userEntry, issue);
}

const normalizedExistingTitles = issues.map((i) =>
  i.title.replace(/\s/g, "").toLowerCase()
);

const filteredNewIssueTitles = newIssueTitles.filter((title: string) => {
  const normalized = title.replace(/\s/g, "").toLowerCase();

  return !normalizedExistingTitles.some((existing) =>
    existing.includes(normalized) || normalized.includes(existing)
  );
});

for (const title of filteredNewIssueTitles) {
  const newIssue = await addIssueAndLink(title, userEntry.id);
  if (newIssue?.id) {
await autoClassifyLinkedPost(userEntry, newIssue as Issue);
  }
}


await loadEntries();
await loadIssues(threadId);

    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!threadId) return;
    void loadEntries();
    void loadIssues(threadId);
  }, [threadId]);

  useEffect(() => {
    if (!verifyError) return;

    const timer = setTimeout(() => {
      setVerifyError(null);
    }, 3000);

    return () => clearTimeout(timer);
  }, [verifyError]);

  useEffect(() => {
    void loadPostIssues();
  }, [entries]);

const filterButtonStyle = (type: string | null) => ({
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #d1d5db",
  background: selectedPostType === type ? "#111827" : "#fff",
  color: selectedPostType === type ? "#fff" : "#111827",
  cursor: "pointer",
  fontSize: 12, 
});


const postTypeCounts = useMemo(() => {
  return {
    all: entries.filter((e) => e.role === "user").length,
    opinion: entries.filter((e) => e.role === "user" && e.category === "opinion").length,
    counter: entries.filter((e) => e.role === "user" && e.category === "counter").length,
    data: entries.filter((e) => e.role === "user" && e.category === "data").length,
    simple: entries.filter((e) => e.role === "user" && e.category === "simple").length,
  };
}, [entries]);




  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
        AI記録チャット
      </h1>

      <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 20 }}>
        トレーニングや食事の記録を残し、AIが振り返りをサポートします
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
          記録フィルタ
        </div>
      </div>

<div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
<button onClick={() => setSelectedPostType(null)} style={filterButtonStyle(null)}>
  全部（{postTypeCounts.all}）
</button>

<button onClick={() => setSelectedPostType("opinion")} style={filterButtonStyle("opinion")}>
  ✍ 記録（{postTypeCounts.opinion}）
</button>

<button onClick={() => setSelectedPostType("counter")} style={filterButtonStyle("counter")}>
  ⚔ 修正（{postTypeCounts.counter}）
</button>

<button onClick={() => setSelectedPostType("data")} style={filterButtonStyle("data")}>
  📊 データ（{postTypeCounts.data}）
</button>

<button onClick={() => setSelectedPostType("simple")} style={filterButtonStyle("simple")}>
  🧠 メモ（{postTypeCounts.simple}）
</button>


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
          📝 記録入力
        </div>
      </div>

<div style={{ display: "flex", gap: 8, marginBottom: 8 }}>


<button
  onClick={() => setPostType("opinion")}
  style={{
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid #d1d5db",
    background: postType === "opinion" ? "#111827" : "#fff",
    color: postType === "opinion" ? "#fff" : "#111827",
    cursor: "pointer",
  }}
>
  ✍ 記録
</button>
<button
  onClick={() => setPostType("counter")}
  style={{
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid #d1d5db",
    background: postType === "counter" ? "#111827" : "#fff",
    color: postType === "counter" ? "#fff" : "#111827",
    cursor: "pointer",
  }}
>
  ⚔ 修正
</button>

<button
  onClick={() => setPostType("data")}
  style={{
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid #d1d5db",
    background: postType === "data" ? "#111827" : "#fff",
    color: postType === "data" ? "#fff" : "#111827",
    cursor: "pointer",
  }}
>
  📊 データ
</button>

<button
  onClick={() => setPostType("simple")}
  style={{
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid #d1d5db",
    background: postType === "simple" ? "#111827" : "#fff",
    color: postType === "simple" ? "#fff" : "#111827",
    cursor: "pointer",
  }}
>
  🧠 メモ
</button>
</div>










      <div style={{ marginBottom: 8, fontSize: 13, color: "#6b7280" }}>
        例：ベンチプレスを3セット行った／夕食は少なめにした
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input
          value={input}
          onChange={(e) => setInput(toHalfWidth(e.target.value))}
placeholder={
  postType === "opinion"
    ? "意見を書く（例：日本の消費税は高すぎる？）"
    : postType === "counter"
    ? "反論を書く（例：財源面を無視しているのでは？）"
    : postType === "data"
    ? "補足データを書く（例：実質賃金は前年比で低下）"
    : "やさしい解説を書く（例：難しい話を簡単に説明すると…）"
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
          {loading ? "送信中..." : "👉 記録する"}
        </button>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          🔥 よく記録されているテーマ
        </div>

        {issueRanking.map((issue, index) => (
          <div
            key={issue.id}
            style={{
              fontSize: 14,
              marginBottom: 4,
            }}
          >
            {index + 1}. {issue.title}（{issue.count}件）
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          🔥 変化が大きいテーマ
        </div>

        {issueVolatilityRanking.map((issue, index) => (
          <div
            key={issue.id}
            style={{
              fontSize: 14,
              marginBottom: 4,
            }}
          >
            {issue.changes === 0
              ? `${index + 1}. ${issue.title}（変化なし）`
              : `${index + 1}. ${issue.title}（${issue.changes}回変化）`}
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 24 }}>この記録のテーマ</h3>

        {verifyError && (
          <div
            style={{
              padding: 12,
              marginBottom: 16,
              border: "1px solid #fecaca",
              borderRadius: 10,
              background: "#fef2f2",
              color: "#991b1b",
            }}
          >
            {verifyError}
          </div>
        )}

        {selectedFilterIssueId && (
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              background: "#f9fafb",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              テーマ：{issues.find((i) => i.id === selectedFilterIssueId)?.title}
            </div>

            <div style={{ fontSize: 13, color: "#6b7280" }}>
              このテーマに関連する記録を表示中
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            value={newIssueTitle}
            onChange={(e) => setNewIssueTitle(e.target.value)}
            placeholder="テーマを追加"
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 8,
              border: "1px solid #ccc",
            }}
          />

          <button type="button" onClick={() => void addIssue()}>
            追加
          </button>
        </div>

        <ul style={{ marginBottom: 16, paddingLeft: 0 }}>




{issues.map((issue) => {
  const stats = stanceStatsMap[issue.id] ?? {
    side_a: 0,
    side_b: 0,
    neutral: 0,
    unknown: 0,
    total: 0,
  };

  const percent = (n: number) =>
    stats.total === 0 ? 0 : Math.round((n / stats.total) * 100);

  return (
    <li
      key={issue.id}
      style={{
        marginBottom: 16,
        padding: 12,
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        background: "#fff",
        listStyle: "none",
      }}
    >
      <strong style={{ fontSize: 15 }}>{issue.title}</strong>
      <StatusBadge status={issue.status} />
<div style={{ marginTop: 10, fontSize: 12 }}>
  {[
  { label: "A寄り", value: stats.side_a, color: "#16a34a" }, // 緑
  { label: "B寄り", value: stats.side_b, color: "#dc2626" }, // 赤
  { label: "中立", value: stats.neutral, color: "#2563eb" }, // 青
  { label: "不明", value: stats.unknown, color: "#6b7280" }, // グレー
].map((row) => {
    const p = percent(row.value);

    return (
      <div key={row.label} style={{ marginBottom: 8 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 4,
          }}
        >
          <span>{row.label}</span>
          <span>
            {p}%（{row.value}件）
          </span>
        </div>

        <div
          style={{
            width: "100%",
            height: 8,
            background: "#e5e7eb",
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${p}%`,
              height: "100%",
              background: row.color,
              borderRadius: 999,
            }}
          />
        </div>
      </div>
    );
  })}
</div>

      <button
        onClick={() => void verifyIssue(issue)}
        disabled={verifyingIssueId === issue.id}
        style={{
          marginLeft: 8,
          fontSize: 12,
          padding: "2px 6px",
          borderRadius: 6,
          border: "1px solid #ccc",
          background: "#fff",
          cursor: verifyingIssueId === issue.id ? "default" : "pointer",
          opacity: verifyingIssueId === issue.id ? 0.6 : 1,
        }}
      >
        {verifyingIssueId === issue.id ? "検証中..." : "再検証"}
      </button>

      <button
        onClick={() => void analyzeIssueStructure(issue)}
        style={{
          marginLeft: 8,
          fontSize: 12,
          padding: "2px 6px",
          borderRadius: 6,
          border: "1px solid #ccc",
          background: "#fff",
          cursor: "pointer",
        }}
      >
        対立構造
      </button>

      <span style={{ fontSize: 11, color: "#6b7280", marginLeft: 6 }}>
        新しい投稿を含めて判定を更新
      </span>

      {issue.verification_note && (
        <div
          style={{
            fontSize: 12,
            color: "#6b7280",
            marginTop: 4,
            marginLeft: 2,
          }}
        >
          {issue.reason_type
            ? `【${getReasonTypeLabel(issue.reason_type)}】${issue.verification_note}`
            : issue.verification_note}
        </div>
      )}

      {(issue.side_a || issue.side_b || issue.core_conflict) && (
        <div
          style={{
            marginTop: 8,
            padding: 10,
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          <div style={{ marginBottom: 6 }}>
            <span style={{ fontWeight: 700, color: "#065f46" }}>立場A：</span>
            {issue.side_a ?? "—"}
          </div>

          <div style={{ marginBottom: 6 }}>
            <span style={{ fontWeight: 700, color: "#92400e" }}>立場B：</span>
            {issue.side_b ?? "—"}
          </div>

          <div>
            <span style={{ fontWeight: 700, color: "#1d4ed8" }}>争点：</span>
            {issue.core_conflict ?? "—"}
          </div>
        </div>
      )}

      {(issueHistoryMap[issue.id] ?? []).map((h, index, arr) => {
        const statusStyle = getStatusStyle(h.status);
        const prev = arr[index + 1];

        const transition = prev
          ? prev.status === h.status
            ? `${h.status}（変化なし）`
            : `${prev.status} → ${h.status}`
          : `初回: ${h.status}`;

        return (
          <div
            key={h.id}
            style={{
              fontSize: 12,
              color: "#6b7280",
              marginTop: 6,
              paddingLeft: 8,
              borderLeft: "2px solid #e5e7eb",
            }}
          >
            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>
              {new Date(h.created_at).toLocaleString("ja-JP")}
            </div>

            <span
              style={{
                ...statusStyle,
                display: "inline-block",
                fontSize: 11,
                padding: "2px 6px",
                borderRadius: 6,
                marginRight: 6,
              }}
            >
              {transition}
              {h.reason_type
                ? ` / ${getReasonTypeLabel(h.reason_type) ?? h.reason_type}`
                : ""}
            </span>

            <span>{h.note}</span>
          </div>
        );
      })}
    </li>
  );
})}
        </ul>

        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "#111827",
            marginBottom: 8,
          }}
        >
          📚 記録一覧
        </div>

<div style={{ fontSize: 14, color: "#6b7280", marginBottom: 4 }}>
  並び順
</div>

<div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
  <button
    onClick={() => setSortOrder("new")}
    style={{
      padding: "6px 10px",
      borderRadius: 999,
      border: "1px solid #d1d5db",
      background: sortOrder === "new" ? "#111827" : "#fff",
      color: sortOrder === "new" ? "#fff" : "#111827",
      cursor: "pointer",
      fontSize: 12,
    }}
  >
    新しい順
  </button>

  <button
    onClick={() => setSortOrder("old")}
    style={{
      padding: "6px 10px",
      borderRadius: 999,
      border: "1px solid #d1d5db",
      background: sortOrder === "old" ? "#111827" : "#fff",
      color: sortOrder === "old" ? "#fff" : "#111827",
      cursor: "pointer",
      fontSize: 12,
    }}
  >
    古い順
  </button>
</div>


        <div
          style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}
        >
          <button
            type="button"
            onClick={() => setSelectedFilterIssueId(null)}
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid #d1d5db",
              background: selectedFilterIssueId === null ? "#111827" : "#fff",
              color: selectedFilterIssueId === null ? "#fff" : "#111827",
              cursor: "pointer",
            }}
          >
            全件
          </button>

          {issues.map((issue) => (
            <button
              key={issue.id}
              type="button"
              onClick={() =>
                setSelectedFilterIssueId(
                  selectedFilterIssueId === issue.id ? null : issue.id
                )
              }
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid #d1d5db",
                background: selectedFilterIssueId === issue.id ? "#111827" : "#fff",
                color: selectedFilterIssueId === issue.id ? "#fff" : "#111827",
                cursor: "pointer",
              }}
            >
              #{issue.title}
            </button>
          ))}
        </div>
      </div>




<input
  value={searchText}
  onChange={(e) => setSearchText(e.target.value)}
  placeholder="検索（必要なときだけ使う）（例：胸トレ・夕食・睡眠）"
  style={{
    width: "100%",
    padding: 8,
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    marginBottom: 12,
    fontSize: 13,
  }}
/>






      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 16,
          marginBottom: 20,
        }}
      >
        {sortedEntries.length === 0 ? (
          <div style={{ opacity: 0.6 }}>まだ記録がありません。</div>
        ) : (

          sortedEntries.map((entry) => {

            const relatedIssues = Array.from(
              new Map(
                postIssues
                  .filter((pi) => pi.post_id === entry.id)
                  .map((pi) => {
                    const issue = issueMap.get(pi.issue_id);
                    return issue ? ([issue.id, issue] as const) : null;
                  })
                  .filter(Boolean) as readonly (readonly [string, Issue])[]
              ).values()
            );


const mainSuggested = suggestedIssuesMap[entry.id]?.[0];
const mainIssue = mainSuggested ?? relatedIssues[0];

            return (
              <div
                key={entry.id}
                style={{
                  padding: 12,
                  marginBottom: 16,
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  background: "#fff",
                }}
              >

                <div
                  style={{
                    fontSize: 11,
                    color: "#9ca3af",
                    marginBottom: 4,
                    fontWeight: 500,
                  }}
                >
                  {entry.role === "ai" ? "🤖 AI" : "👤 USER"} /{" "}
                  {entry.created_at?.slice(0, 16).replace("T", " ")}
                </div>

{entry.role === "user" && (
  <div
    style={{
      fontSize: 12,
      fontWeight: 700,
      marginBottom: 6,
      color: "#374151",
    }}
  >
    {entry.category === "opinion" && "✍ 記録"}
    {entry.category === "counter" && "⚔ 修正"}
    {entry.category === "data" && "📊 データ"}
    {entry.category === "simple" && "🧠 メモ"}
  </div>
)}


                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                  {entry.content}
                </div>

{entry.role === "user" && (
  <div
    style={{
      marginTop: 8,
      padding: 10,
      background: "#f9fafb",
      border: "1px solid #e5e7eb",
      borderRadius: 8,
      fontSize: 12,
      lineHeight: 1.6,
    }}
  >
    <div style={{ fontWeight: 700, marginBottom: 4 }}>🧠 やさしい解説</div>
    <div style={{ color: "#4b5563" }}>
      ここに記録の振り返りや補足説明を表示する予定
    </div>
  </div>
)}

                {entry.stance_label && (
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      color: "#6b7280",
                    }}
                  >
                    【{getStanceLabelText(entry.stance_label) ?? entry.stance_label}】
                  </div>
                )}

                {entry.role === "user" && suggestedIssuesMap[entry.id]?.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
                      AI提案：
                    </div>

                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {suggestedIssuesMap[entry.id].map((issue) => (
                        <button
                          key={issue.id}

onClick={async () => {

await linkPostToIssue(entry.id, issue.id);
await autoClassifyLinkedPost(entry, issue);
}}

                      >
                          #{issue.title} に関連づけ
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {entry.role === "user" &&
                  suggestedNewIssuesMap[entry.id]?.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
                        AI新テーマ案：
                      </div>

                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {suggestedNewIssuesMap[entry.id].map((title) => (
                          <button
                            key={title}

onClick={async () => {
const newIssue = await addIssueAndLink(title, entry.id);
if (newIssue?.id) {
  await autoClassifyLinkedPost(entry, newIssue as Issue);
}
}}
                          >
                            ＋「{title}」をテーマ追加
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                <div
                  style={{
                    marginTop: 6,
                    display: "flex",
                    gap: 6,
                    flexWrap: "wrap",
                  }}
                >

{relatedIssues.length > 0 && (
  <div style={{ marginTop: 6 }}>
<div style={{ fontSize: 12, marginBottom: 4 }}>
  主テーマ：
  <strong style={{ marginLeft: 4 }}>
    {mainIssue.title}
  </strong>
</div>

{mainSuggested?.reason && (
  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
    理由：{mainSuggested.reason}
  </div>
)}

    {relatedIssues.length > 1 && (
      <div style={{ fontSize: 12, color: "#6b7280" }}>
        関連：
        {relatedIssues.slice(1).map((issue) => (
          <span key={issue.id} style={{ marginLeft: 6 }}>
            {issue.title}
          </span>
        ))}
      </div>
    )}
  </div>
)}
                </div>

                {entry.role === "user" && relatedIssues.length > 0 && (
                  <div
                    style={{
                      marginTop: 8,
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                    }}
                  >

{relatedIssues.length > 0 && (
  <button
onClick={() => {
  if (mainIssue) {
    classifyPostStance(entry.id, mainIssue, entry.content);
  }
}}

  >
    主テーマで立場判定
  </button>
)}
                  </div>
                )}

                {linkingPostId === entry.id ? (
                  <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                    <select
                      value={selectedLinkIssueId}
                      onChange={(e) => setSelectedLinkIssueId(e.target.value)}
                    >
                      <option value="">テーマを選択</option>
                      {issues.map((issue) => (
                        <option key={issue.id} value={issue.id}>
                          {issue.title}
                        </option>
                      ))}
                    </select>

                    <button onClick={() => void linkPostToIssue(entry.id)}>
                      関連づけ
                    </button>

                    <button
                      onClick={() => {
                        setLinkingPostId(null);
                        setSelectedLinkIssueId("");
                      }}
                    >
                      キャンセル
                    </button>
                  </div>
                ) : (
                  <div style={{ marginTop: 8 }}>
                    <button onClick={() => setLinkingPostId(entry.id)}>
                      テーマに関連づけ
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
