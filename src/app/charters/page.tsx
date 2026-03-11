"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type CharterRow = {
  id: string;
  name: string;
  description: string | null;
  tone: "standard" | "buddy" | "sayaka";
  rules_json: any;
  created_at: string;
};

export default function ChartersPage() {
  const [charters, setCharters] = useState<CharterRow[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tone, setTone] = useState<CharterRow["tone"]>("sayaka");

  const [ifThen, setIfThen] = useState(
    "もし眠いなら→2分だけ開始する\nもし迷うなら→選択肢を3つに絞る"
  );
  const [banned, setBanned] = useState(
    "政治・経済は扱わない\n依存を促す言い方は禁止"
  );

  const load = async () => {
    const { data, error } = await supabase
      .from("charters")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("load charters error:", error.message);
      return;
    }
    setCharters((data ?? []) as CharterRow[]);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!name.trim()) return;

    const rules_json = {
      if_then: ifThen.split("\n").map((s) => s.trim()).filter(Boolean),
      banned: banned.split("\n").map((s) => s.trim()).filter(Boolean),
    };

    const { error } = await supabase.from("charters").insert({
      name: name.trim(),
      description: description.trim() || null,
      tone,
      rules_json,
    });

    if (error) {
      console.error("create charter error:", error.message);
      return;
    }

    setName("");
    setDescription("");
    await load();
  };

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>憲章（Charters）</h1>
      <p style={{ opacity: 0.7, marginTop: 6 }}>
        先生が「返答の方針」を作って保存できます。
      </p>

      <div
        style={{
          marginTop: 16,
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 16,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>新しい憲章を作る</h2>

        <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="憲章名（例：さやか先生｜習慣伴走）"
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ccc",
            }}
          />
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as any)}
            style={{ padding: "10px 12px", borderRadius: 10 }}
          >
            <option value="sayaka">sayaka（先生口調）</option>
            <option value="standard">standard（業務）</option>
            <option value="buddy">buddy（相棒）</option>
          </select>
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="説明（任意）"
          style={{
            width: "100%",
            marginTop: 10,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ccc",
            minHeight: 60,
          }}
        />

        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          <textarea
            value={ifThen}
            onChange={(e) => setIfThen(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ccc",
              minHeight: 90,
            }}
          />
          <textarea
            value={banned}
            onChange={(e) => setBanned(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ccc",
              minHeight: 70,
            }}
          />
        </div>

        <button
          onClick={create}
          style={{
            marginTop: 12,
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ccc",
            cursor: "pointer",
            background: "white",
          }}
        >
          ＋ 憲章を保存
        </button>
      </div>

      <div style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>保存済み</h2>

        {charters.length === 0 ? (
          <p style={{ opacity: 0.6 }}>まだ憲章がありません。</p>
        ) : (
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            {charters.map((c) => (
              <div
                key={c.id}
                style={{
                  border: "1px solid #eee",
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <div style={{ fontWeight: 800 }}>
                  {c.name}{" "}
                  <span style={{ opacity: 0.6, fontWeight: 500 }}>
                    （{c.tone}）
                  </span>
                </div>

                {c.description && (
                  <div style={{ opacity: 0.75, marginTop: 6 }}>
                    {c.description}
                  </div>
                )}

                <div style={{ opacity: 0.6, marginTop: 8, fontSize: 12 }}>
                  {new Date(c.created_at).toLocaleString()}
                </div>

<details style={{ marginTop: 8 }}>
  <summary style={{ cursor: "pointer", opacity: 0.8 }}>
    ルールを見る
  </summary>

  <div style={{ marginTop: 10, padding: 10, background: "#fafafa", borderRadius: 8 }}>
    <div style={{ fontWeight: 700, marginBottom: 6 }}>禁止事項</div>
    <ul>
      {c.rules_json?.banned?.map((item: string, i: number) => (
        <li key={i}>{item}</li>
      ))}
    </ul>

    <div style={{ fontWeight: 700, marginTop: 10, marginBottom: 6 }}>
      行動トリガー（If → Then）
    </div>
    <ul>
      {c.rules_json?.if_then?.map((item: string, i: number) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  </div>
</details>



              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}