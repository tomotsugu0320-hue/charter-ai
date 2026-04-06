// src/app/[tenant]/macro/page.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type MacroStructure = {
  goal: string;
  nodes: string[];
};

export default function MacroPage() {
const router = useRouter();
  const [goal, setGoal] = useState("");
  const [result, setResult] = useState<MacroStructure | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  const handleAnalyze = async () => {
    const trimmed = goal.trim();

    if (!trimmed) {
      setErrorText("ゴールを入力して。");
      return;
    }

    setLoading(true);
    setErrorText("");
    setResult(null);

    try {
      const res = await fetch("/api/macro/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ goal: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "構造化に失敗");
      }

      setResult(data);
    } catch (error) {
      console.error("[handleAnalyze] error:", error);
      setErrorText("構造化に失敗した。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>
        マクロ掲示板
      </h1>

      <p style={{ marginBottom: 16 }}>
        ゴールから思考を構造化し、判断できる状態を作る。
      </p>

      <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="あなたは何を知りたい？ 何を判断したい？"
          rows={5}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 8,
            border: "1px solid #ccc",
            resize: "vertical",
          }}
        />

        <div>
          <button
            onClick={handleAnalyze}
            disabled={loading}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              border: "none",
              background: "#111",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            {loading ? "構造化中..." : "構造化する"}
          </button>
        </div>

        {errorText && (
          <p style={{ color: "crimson", margin: 0 }}>{errorText}</p>
        )}
      </div>

      {result && (
        <section style={{ display: "grid", gap: 20 }}>
          <div>
            <h2>ゴール</h2>
            <p>{result.goal}</p>
          </div>

          <div>
            <h2>論点</h2>
<ul>
  {result.nodes.map((item) => (
    <li
      key={item}
      style={{
        cursor: "pointer",
        padding: "6px 0",
        borderBottom: "1px solid #eee",
      }}
      onClick={() => {
        console.log("node clicked:", item);
router.push(`/dev/forum?keyword=${item}&goal=${result.goal}`);
      }}
    >
      ■ {item}
    </li>
  ))}
</ul>
          </div>
        </section>
      )}
    </main>
  );
}

