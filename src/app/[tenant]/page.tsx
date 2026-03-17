"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";

type Category = "training" | "habit";
type Tone = "standard" | "buddy" | "sayaka";

type TenantRow = {
  id: string;
  slug: string;
  name: string;
};

type ThreadRow = {
  id: string;
  category: Category;
  created_at: string;
  charter_id: string | null;
};

type CharterRow = {
  id: string;
  name: string;
  tone: Tone;
};

export default function Home() {
  const router = useRouter();

  const tenantSlug = useMemo(() => {
    if (typeof window === "undefined") return "dev";
    return window.location.pathname.split("/")[1] || "dev";
  }, []);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [tenant, setTenant] = useState<TenantRow | null>(null);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [charters, setCharters] = useState<CharterRow[]>([]);
  const [warning, setWarning] = useState("");
  const [selectedCharterId, setSelectedCharterId] = useState("");

  const charterById = useMemo(() => {
    const map = new Map<string, CharterRow>();
    for (const charter of charters) {
      map.set(charter.id, charter);
    }
    return map;
  }, [charters]);

  const getTenantBySlug = async (slug: string): Promise<TenantRow | null> => {
    const { data, error } = await supabase
      .from("tenants")
      .select("id, slug, name")
      .eq("slug", slug)
      .single();

    if (error) {
      console.error("tenant load error:", error.message);
      return null;
    }

    return data as TenantRow;
  };

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

    const savedCharterId = localStorage.getItem("selected_charter_id") ?? "";
    const exists = savedCharterId
      ? list.some((charter) => charter.id === savedCharterId)
      : false;

    const initialCharterId = exists ? savedCharterId : (list[0]?.id ?? "");
    setSelectedCharterId(initialCharterId);

    if (initialCharterId) {
      localStorage.setItem("selected_charter_id", initialCharterId);
    }
  };

  const calculateWarning = (list: ThreadRow[]) => {
    if (list.length === 0) {
      setWarning("⚠️ まだ記録がありません。まず1件、記録してみましょう。");
      return;
    }

    const latestCreatedAt = new Date(list[0].created_at).getTime();
    const now = Date.now();
    const diffDays = Math.floor((now - latestCreatedAt) / (1000 * 60 * 60 * 24));

    if (diffDays >= 3) {
      setWarning("⚠️ 3日間記録がありません。短くてもいいので行動を記録しましょう。");
      return;
    }

    if (diffDays >= 2) {
      setWarning("⚠️ 2日間記録がありません。軽くでもいいので記録を再開しましょう。");
      return;
    }

    setWarning("");
  };

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

    const list = (data ?? []) as ThreadRow[];
    setThreads(list);
    calculateWarning(list);
  };

  useEffect(() => {
    const boot = async () => {
      const tenantData = await getTenantBySlug(tenantSlug);

      if (!tenantData) {
        alert("tenant が見つかりません");
        return;
      }

      setTenant(tenantData);

      await loadCharters();

      let sid = localStorage.getItem("session_id");

      if (!sid) {
        sid = uuidv4();
        localStorage.setItem("session_id", sid);

        const { error } = await supabase.from("sessions").upsert({ id: sid });
        if (error) {
          console.error("session upsert error:", error.message);
        }
      }

      setSessionId(sid);
      await loadThreads(sid);
    };

    void boot();
  }, [tenantSlug]);

  const createThread = async (category: Category) => {
    if (!sessionId) {
      alert("session_id がありません");
      return;
    }

    if (!tenant) {
      alert("tenant の読み込み前です");
      return;
    }

    const { data, error } = await supabase
      .from("threads")
      .insert({
        session_id: sessionId,
        category,
        tenant_id: tenant.id,
        charter_id: selectedCharterId || null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("create thread error:", error.message);
      alert("スレッド作成に失敗しました");
      return;
    }

    await loadThreads(sessionId);
    router.push(`/${tenantSlug}/chat/${data.id}`);
  };

  const handleCharterChange = (value: string) => {
    setSelectedCharterId(value);
    localStorage.setItem("selected_charter_id", value);
  };

  return (
    <div style={{ padding: 40 }}>
      <h1>Charter AI ({tenant?.name ?? "..."})</h1>

      <p style={{ opacity: 0.8, marginTop: 8, marginBottom: 0 }}>
        トレーニングや食事を記録すると、AIコーチが継続をサポートします。
      </p>

      {warning && (
        <div
          style={{
            marginTop: 12,
            padding: "12px 14px",
            borderRadius: 10,
            background: "#fff7ed",
            border: "1px solid #fdba74",
            color: "#9a3412",
            maxWidth: 520,
            fontWeight: 600,
          }}
        >
          {warning}
        </div>
      )}

      <div
        style={{
          marginTop: 18,
          padding: 18,
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          background: "#fafafa",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          maxWidth: 520,
        }}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => createThread("training")}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              background: "#fff7ed",
              border: "1px solid #fdba74",
              cursor: "pointer",
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            💪 トレーニング
          </button>

          <button
            onClick={() => createThread("habit")}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid #d1d5db",
              background: "#fff",
              cursor: "pointer",
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            🍽 食事
          </button>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            padding: "12px 14px",
            border: "1px solid #ddd",
            borderRadius: 12,
            background: "#fff",
            maxWidth: 320,
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.7 }}>AIコーチ</div>

          <select
            value={selectedCharterId}
            onChange={(e) => handleCharterChange(e.target.value)}
            disabled={charters.length === 0}
            style={{
              border: "none",
              outline: "none",
              fontSize: 16,
              background: "#f8fafc",
              borderWidth: 4,
              borderStyle: "solid",
              borderColor: "#e2e8f0",
              cursor: "pointer",
              padding: 4,
            }}
          >
            {charters.length === 0 ? (
              <option value="">（憲章がありません）</option>
            ) : (
              charters.map((charter) => (
                <option key={charter.id} value={charter.id}>
                  {charter.name}（{charter.tone}）
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      <hr style={{ margin: "26px 0 20px 0" }} />

      <h2>あなたの記録一覧</h2>

      {threads.length === 0 ? (
        <p style={{ opacity: 0.6 }}>まだスレッドがありません。</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {threads.map((thread) => {
            const charter = thread.charter_id
              ? charterById.get(thread.charter_id)
              : null;

            const charterLabel = charter
              ? `憲章：${charter.name}`
              : "憲章：（未設定）";




const title =
  thread.category === "training"
    ? "💪 トレーニング記録"
    : "🍽 食事記録";

            return (
              <li key={thread.id} style={{ marginBottom: 10 }}>
                <button
                  onClick={() => router.push(`/${tenantSlug}/chat/${thread.id}`)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #ccc",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{title}</div>
                  <div style={{ opacity: 0.7, marginTop: 4 }}>
                    {new Date(thread.created_at).toLocaleString()} / {charterLabel}
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