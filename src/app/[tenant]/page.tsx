"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";



type ThreadRow = {
  id: string;
  category: "love" | "career";
  created_at: string;
  charter_id: string | null;
};


type CharterRow = {
  id: string;
  name: string;
  tone: "standard" | "buddy" | "sayaka";
};

export default function Home() {
  const router = useRouter();

const tenantSlug =
  typeof window !== "undefined"
    ? window.location.pathname.split("/")[1] || "dev"
    : "dev";

  const [sessionId, setSessionId] = useState<string | null>(null);

  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [charters, setCharters] = useState<CharterRow[]>([]);
  const [selectedCharterId, setSelectedCharterId] = useState<string>("");

  const charterNameById = useMemo(() => {
    const m = new Map<string, CharterRow>();
    for (const c of charters) m.set(c.id, c);
    return m;
  }, [charters]);




const getTenantBySlug = async (slug: string) => {
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) {
    console.error("tenant load error:", error.message);
    return null;
  }

  return data;
};


const [tenant, setTenant] = useState<any>(null);



  // 憲章一覧ロード
  const loadCharters = async () => {
    const { data, error } = await supabase
      .from("charters")
      .select("id, name, tone")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("load charters error:", error.message);
      return;
    }

    const list = (data ?? []) as CharterRow[];
    setCharters(list);

    // 初期選択：localStorage → なければ先頭
    const saved = localStorage.getItem("selected_charter_id") ?? "";
    const exists = saved && list.some((c) => c.id === saved);

    const initial = exists ? saved : list[0]?.id ?? "";
    setSelectedCharterId(initial);

    if (initial) localStorage.setItem("selected_charter_id", initial);
  };

  // 相談履歴ロード
  const loadThreads = async (sid: string) => {
    const { data, error } = await supabase
      .from("threads")
      .select("id, category, created_at, charter_id")
      .eq("session_id", sid)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("load threads error:", error.message);
      return;
    }
    setThreads((data ?? []) as ThreadRow[]);
  };




const getTenantIdBySlug = async (slug: string) => {
  const { data, error } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .single();

  if (error) {
    console.error("get tenant error:", error.message);
    return null;
  }

  return data.id as string;
};




  // 起動時：session_id 確保＋憲章ロード＋履歴ロード
  useEffect(() => {
    const boot = async () => {

const tenantSlug =
  typeof window !== "undefined"
    ? window.location.pathname.split("/")[1]
    : "dev";

const tenantData = await getTenantBySlug(tenantSlug);

if (!tenantData) {
  alert("tenant が見つかりません");
  return;
}

setTenant(tenantData);

      await loadCharters();

      const existing = localStorage.getItem("session_id");
      if (existing) {
        setSessionId(existing);
        await loadThreads(existing);
        return;
      }

      const newId = uuidv4();
      localStorage.setItem("session_id", newId);
      setSessionId(newId);

      const { error } = await supabase.from("sessions").upsert({ id: newId });
      if (error) console.error("session upsert error:", error.message);

      await loadThreads(newId);
    };

    void boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


const createThread = async (category: "love" | "career") => {
  if (!sessionId) return;


const tenantSlug =
  typeof window !== "undefined"
    ? window.location.pathname.split("/")[1]
    : "dev";

  const tenantId = await getTenantIdBySlug(tenantSlug);

  if (!tenantId) {
    alert("tenants.id の取得に失敗しました");
    return;
  }

  const { data, error } = await supabase
    .from("threads")
    .insert({
      session_id: sessionId,
      category,
      tenant_id: tenantId,
      charter_id: selectedCharterId || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("create thread error:", error.message);
    return;
  }

  await loadThreads(sessionId);
router.push(`/${tenantSlug}/chat/${data.id}`);
};


  return (
    <div style={{ padding: 40 }}>
      <h1>Charter AI ({tenant?.name})</h1>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={() => createThread("love")}>💗 恋愛相談</button>
        <button onClick={() => createThread("career")}>💼 キャリア相談</button>

        <div style={{ marginLeft: 18 }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>使用する憲章</div>
          <select
            value={selectedCharterId}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedCharterId(id);
              localStorage.setItem("selected_charter_id", id);
            }}
            style={{
              minWidth: 320,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ccc",
              background: "white",
            }}
            disabled={charters.length === 0}
          >
            {charters.length === 0 ? (
              <option value="">（憲章がありません）</option>
            ) : (
              charters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}（{c.tone}）
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      <hr style={{ margin: "30px 0" }} />

      <h2>あなたの相談履歴</h2>

      {threads.length === 0 ? (
        <p style={{ opacity: 0.6 }}>まだスレッドがありません。</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {threads.map((t) => {
            const c = t.charter_id ? charterNameById.get(t.charter_id) : null;
            const charterLabel = c ? `憲章：${c.name}` : "憲章：（未設定）";

            return (
              <li key={t.id} style={{ marginBottom: 10 }}>
                <button
onClick={() => router.push(`/${tenant?.slug ?? "dev"}/chat/${t.id}`)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #ccc",
                    background: "white",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>
                    {t.category === "love" ? "💗 恋愛相談" : "💼 キャリア相談"}
                  </div>
                  <div style={{ opacity: 0.7, marginTop: 4 }}>
                    {new Date(t.created_at).toLocaleString()} / {charterLabel}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}