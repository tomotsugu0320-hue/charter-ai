// src/app/[tenant]/forum/page.tsx


"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import SectionCard from "@/components/forum/SectionCard";
import SectionTitle from "@/components/forum/SectionTitle";
import PostCard from "@/components/forum/PostCard";
import PrimaryButton from "@/components/forum/PrimaryButton";

type ThreadRow = {
  id: string;
  title: string;
  category?: string;
  summary?: string;
  original_post?: string;
  posts_content?: string;
  post_count?: number;
  avg_logic_score?: number;
  assumption?: string;
  evidence?: string;
};

type RelatedThread = {
  id: string;
  title: string;
  category?: string;
  summary?: string;
  reason?: string;
  stance?: "pro" | "con" | "neutral";
};


type GeneratedIssue = {
  mode: "expand" | "split";
  claim: string;
  premises: string[];
  reasons: string[];
  easySummary?: string;
};

const darkInputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 10,
  padding: "12px 14px",
  fontSize: 16,
  background: "#1a1a1a",
  color: "#fff",
  border: "1px solid #555",
};

const darkButtonStyle: React.CSSProperties = {
  border: "1px solid #555",
  borderRadius: 8,
  padding: "8px 12px",
  background: "#222",
  color: "#fff",
  cursor: "pointer",
};

export default function ForumPage() {
  const params = useParams();
  const tenant = params?.tenant as string;
  const searchParams = useSearchParams();

  const keyword = searchParams.get("keyword") || "";
  const goal = searchParams.get("goal") || "";

  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

const [organizing, setOrganizing] = useState(false);
const [organizedResult, setOrganizedResult] = useState<{
  summary: string;
  postText: string;
} | null>(null);


  const [popularThreads, setPopularThreads] = useState<ThreadRow[]>([]);
  const [activeThreads, setActiveThreads] = useState<ThreadRow[]>([]);
const [defaultMode, setDefaultMode] = useState<"normal" | "easy">("normal");

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("すべて");
  const [searchQuery, setSearchQuery] = useState("");

const [analyzeScrollKey, setAnalyzeScrollKey] = useState(0);

  const [relatedThreads, setRelatedThreads] = useState<RelatedThread[]>([]);
  const [generatedIssue, setGeneratedIssue] = useState<GeneratedIssue | null>(null);

  const hasSearch = searchQuery.trim() !== "";


useEffect(() => {
  const saved = localStorage.getItem("forum_default_mode");
  if (saved === "easy" || saved === "normal") {
    setDefaultMode(saved);
  }
}, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/forum/top-summary");
        const result = await res.json();

        setPopularThreads(result.popularThreads ?? []);
        setActiveThreads(result.activeThreads ?? []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);


useEffect(() => {
  if (!analyzeScrollKey) return;

  requestAnimationFrame(() => {
    const el = document.getElementById("step2-result");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}, [analyzeScrollKey]);


  const filteredPopularThreads = popularThreads.filter((t) => {
    const q = searchQuery.trim().toLowerCase();

    const matchSearch =
      q === ""
        ? true
        : String(t.title || "").toLowerCase().includes(q) ||
          String(t.summary || "").toLowerCase().includes(q) ||
          String(t.original_post || "").toLowerCase().includes(q) ||
          String(t.posts_content || "").toLowerCase().includes(q);

    const matchCategory =
      categoryFilter === "すべて"
        ? true
        : String(t.category || "") === categoryFilter;

    return matchSearch && matchCategory;
  });

  const filteredActiveThreads = activeThreads.filter((t) => {
    const q = searchQuery.trim().toLowerCase();

    const matchSearch =
      q === ""
        ? true
        : String(t.title || "").toLowerCase().includes(q) ||
          String(t.summary || "").toLowerCase().includes(q) ||
          String(t.original_post || "").toLowerCase().includes(q) ||
          String(t.posts_content || "").toLowerCase().includes(q);

    const matchCategory =
      categoryFilter === "すべて"
        ? true
        : String(t.category || "") === categoryFilter;

    return matchSearch && matchCategory;
  });

  const handleSubmit = async () => {

    const trimmed = text.trim();
    if (!trimmed) return;

    setLoading(true);
    setSelectedThreadId(null);

    try {
      const res = await fetch("/api/forum/generate-issue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: trimmed,
          type: "auto",
        }),
      });


setAnalyzeScrollKey((prev) => prev + 1);


const { mode, claim, premises, reasons, easySummary } = await res.json();
setGeneratedIssue({
  mode,
  claim,
  premises,
  reasons,
  easySummary,
});

      const relatedRes = await fetch("/api/forum/search-related", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claim,
          premises,
          reasons,
        }),
      });



const related = await relatedRes.json();

const relatedList = Array.isArray(related)
  ? related
  : Array.isArray(related?.threads)
  ? related.threads
  : Array.isArray(related?.results)
  ? related.results
  : [];

setRelatedThreads(
  relatedList.map((t: any) => {

          const judgeText = `${t.title ?? ""} ${t.summary ?? ""}`.toLowerCase();

          let stance: "pro" | "con" | "neutral" = "neutral";

          if (
            judgeText.includes("問題") ||
            judgeText.includes("危険") ||
            judgeText.includes("不要") ||
            judgeText.includes("反対")
          ) {
            stance = "con";
          } else if (
            judgeText.includes("必要") ||
            judgeText.includes("有効") ||
            judgeText.includes("賛成")
          ) {
            stance = "pro";
          }

          return {
            id: t.id,
            title: t.title,
            category: t.category ?? "未分類",
            summary: t.summary ?? "",
            reason: "この論点と前提が近いため関連しています",
            stance,
          };
        })
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };


const handleOrganizePost = async () => {
  if (!text.trim()) return;

  try {
    setOrganizing(true);
    setOrganizedResult(null);

    const res = await fetch("/api/forum/organize-post", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert("AI整理失敗");
      return;
    }

    setOrganizedResult({
      summary: data.summary,
      postText: data.postText,
    });
  } catch (e) {
    console.error(e);
    alert("AI整理失敗");
  } finally {
    setOrganizing(false);
  }
};


const handleUseOrganizedAndAnalyze = async () => {
  if (!organizedResult?.postText?.trim()) return;

  const nextText = organizedResult.postText.trim();
  setText(nextText);

  setLoading(true);
  setSelectedThreadId(null);

  try {
    const res = await fetch("/api/forum/generate-issue", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: nextText,
        type: "auto",
      }),
    });

const { mode, claim, premises, reasons, easySummary } = await res.json();
setGeneratedIssue({
  mode,
  claim,
  premises,
  reasons,
  easySummary,
});

    const relatedRes = await fetch("/api/forum/search-related", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        claim,
        premises,
        reasons,
      }),
    });

const related = await relatedRes.json();

const relatedList = Array.isArray(related)
  ? related
  : Array.isArray(related?.threads)
  ? related.threads
  : Array.isArray(related?.results)
  ? related.results
  : [];

setRelatedThreads(
  relatedList.map((t: any) => {

        const judgeText = `${t.title ?? ""} ${t.summary ?? ""}`.toLowerCase();

        let stance: "pro" | "con" | "neutral" = "neutral";

        if (
          judgeText.includes("問題") ||
          judgeText.includes("危険") ||
          judgeText.includes("不要") ||
          judgeText.includes("反対")
        ) {
          stance = "con";
        } else if (
          judgeText.includes("必要") ||
          judgeText.includes("有効") ||
          judgeText.includes("賛成")
        ) {
          stance = "pro";
        }

        return {
          id: t.id,
          title: t.title,
          category: t.category ?? "未分類",
          summary: t.summary ?? "",
          reason: "この論点と前提が近いため関連しています",
          stance,
        };
      })
    );
  } catch (e) {
    console.error(e);
    alert("AI整理に失敗しました");
  } finally {
    setLoading(false);
  }
};


  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>AI掲示板</h1>

{generatedIssue?.easySummary && (
  <SectionCard
    style={{
      marginBottom: 12,
      border: defaultMode === "easy" ? "2px solid #2a7" : undefined,
      background: defaultMode === "easy" ? "#13261d" : undefined,
      boxShadow:
        defaultMode === "easy"
          ? "0 0 0 1px rgba(42, 167, 110, 0.15)"
          : undefined,
    }}
  >
<div
  style={{
    fontWeight: 800,
    marginBottom: 8,
    fontSize: defaultMode === "easy" ? 18 : 16,
    color: defaultMode === "easy" ? "#9df0c7" : undefined,
  }}
>
  🐵 やさしい要約
</div>

<div
  style={{
    whiteSpace: "pre-wrap",
    lineHeight: defaultMode === "easy" ? 2.0 : 1.8,
    fontSize: defaultMode === "easy" ? 18 : 15,
    color: "#f3f3f3",
  }}
>
  {generatedIssue.easySummary}
</div>

{defaultMode === "easy" && (
  <div
    style={{
      marginTop: 10,
      fontSize: 12,
      color: "#a7d9bf",
    }}
  >
    まずはここだけ読めばOK。詳しく見たいときだけ下を読んでください。
  </div>
)}
  </SectionCard>
)}


<SectionCard
  style={{
    opacity: defaultMode === "easy" ? 0.92 : 1,
    border: defaultMode === "easy" ? "1px solid #3a3a3a" : undefined,
  }}
>
  <div style={{ fontWeight: 700, marginBottom: 8 }}>
    表示モード
  </div>

  <div style={{ display: "flex", gap: 8 }}>
    <PrimaryButton
      onClick={() => {
        localStorage.setItem("forum_default_mode", "normal");
        setDefaultMode("normal");
      }}
      variant={defaultMode === "normal" ? "primary" : "secondary"}
    >
      🧠 大人向け
    </PrimaryButton>

    <PrimaryButton
      onClick={() => {
        localStorage.setItem("forum_default_mode", "easy");
        setDefaultMode("easy");
      }}
      variant={defaultMode === "easy" ? "primary" : "secondary"}
    >
      🐵 子供向け
    </PrimaryButton>
  </div>
</SectionCard>


      <SectionCard>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>
          これは「正解を出す掲示板」ではありません。
        </div>

        <div style={{ fontSize: 14, color: "#ccc" }}>
          考えを分解し、前提と根拠のズレを見える化する場所です。
          <br />
          議論が噛み合わない原因は「前提のズレ」にあります。
        </div>
      </SectionCard>

      <div style={{ marginTop: 16, marginBottom: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="タイトルや内容で検索"
            style={darkInputStyle}
          />

          {hasSearch && (
            <button
              onClick={() => setSearchQuery("")}
              style={{ ...darkButtonStyle, marginTop: 8 }}
            >
              検索をクリア
            </button>
          )}
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 14,
            background: "#222",
            color: "#fff",
            border: "1px solid #555",
            minWidth: 180,
          }}
        >
          <option value="すべて">すべて</option>
          <option value="政治・経済">政治・経済</option>
          <option value="ビジネス">ビジネス</option>
          <option value="恋愛">恋愛</option>
          <option value="健康">健康</option>
          <option value="雑談">雑談</option>
        </select>
      </div>

      {hasSearch && (
        <div style={{ marginTop: 8, color: "#666", fontSize: 13 }}>
          検索結果：
          人気スレ {filteredPopularThreads.length}件 / 活発スレ{" "}
          {filteredActiveThreads.length}件
        </div>
      )}

      {goal && (
        <SectionCard>
          <div style={{ fontSize: 12, color: "#666" }}>
            マクロから渡されたゴール
          </div>
          <div style={{ fontWeight: 700 }}>{goal}</div>
        </SectionCard>
      )}

      {keyword && (
        <SectionCard>
          <div style={{ fontSize: 12, color: "#666" }}>注目している論点</div>
          <div style={{ fontWeight: 700 }}>{keyword}</div>
        </SectionCard>
      )}

      <section style={{ marginTop: 24 }}>
        <SectionTitle>
          🔥 人気スレ {hasSearch ? "（検索結果）" : ""}
        </SectionTitle>

        {hasSearch && filteredPopularThreads.length === 0 && (
          <p style={{ color: "#666" }}>
            「{searchQuery}」に一致する人気スレはまだありません。
          </p>
        )}

        {filteredPopularThreads.map((t) => (
          <PostCard key={t.id}>
            <Link
              href={`/${tenant}/forum/thread/${t.id}`}
              style={{
                textDecoration: "underline",
                color: "inherit",
                display: "block",
              }}
            >
              <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>
                {t.category ?? "未設定"}
              </div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{t.title}</div>
            </Link>

            {t.assumption && (
              <div style={{ fontSize: 12, color: "#bbb", marginTop: 4 }}>
                前提：{t.assumption}
              </div>
            )}

            {t.evidence && (
              <div style={{ fontSize: 12, color: "#2a7", marginTop: 4 }}>
                🧾 根拠：{t.evidence}
              </div>
            )}

            <div style={{ fontSize: 12, color: "#666" }}>
              平均スコア: {t.avg_logic_score ?? 0} / 投稿数: {t.post_count ?? 0}
            </div>
          </PostCard>
        ))}
      </section>

      <section style={{ marginTop: 24 }}>
        <SectionTitle>
          📈 活発スレ {hasSearch ? "（検索結果）" : ""}
        </SectionTitle>

        {hasSearch && filteredActiveThreads.length === 0 && (
          <p style={{ color: "#666" }}>
            「{searchQuery}」に一致する活発スレはまだありません。
          </p>
        )}

        {filteredActiveThreads.map((t) => (
          <PostCard key={t.id}>
            <Link
              href={`/${tenant}/forum/thread/${t.id}`}
              style={{
                textDecoration: "underline",
                color: "inherit",
                display: "block",
              }}
            >
              <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>
                {t.category ?? "未設定"}
              </div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{t.title}</div>
            </Link>

            {t.assumption && (
              <div style={{ fontSize: 12, color: "#bbb", marginTop: 4 }}>
                前提：{t.assumption}
              </div>
            )}

            {t.evidence && (
              <div style={{ fontSize: 12, color: "#2a7", marginTop: 4 }}>
                🧾 根拠：{t.evidence}
              </div>
            )}

            <div style={{ fontSize: 12, color: "#666" }}>
              投稿数: {t.post_count ?? 0} / 平均スコア: {t.avg_logic_score ?? 0}
            </div>
          </PostCard>
        ))}
      </section>

<div style={{ marginBottom: 12 }}>
  <a
    href={`/${tenant}/macro`}
    style={{
      display: "inline-block",
      padding: "10px 16px",
      borderRadius: 8,
      background: "#1a1a1a",
      color: "#fff",
      fontWeight: 700,
      textDecoration: "none",
      border: "none",
    }}
  >
    このテーマをマクロで整理する
  </a>
</div>

      <section style={{ marginTop: 32 }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ color: "#fff", fontWeight: 700 }}>
            議論が噛み合わない原因は「前提のズレ」です。
          </div>

          <div style={{ color: "#666", fontSize: 13, marginTop: 4 }}>
            あなたの考えを書くと、それを分解して見える化します。
          </div>
        </div>









<h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
  STEP1：あなたの考えを書く
</h3>
<div style={{ fontSize: 13, color: "#444", marginBottom: 6 }}>
  <div style={{ fontSize: 13, color: "#333", marginBottom: 6, fontWeight: 700 }}>
  書き方の例
</div>
  <br />
  ・〇〇は問題だと思う
  <br />
  ・なぜなら△△だから
  <br />
  ・でも□□という意見もある
</div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`例：
消費税は減税すべき。
日本は需要不足であり、消費税は消費を抑えるため。`}
          rows={5}
          style={{
            width: "100%",
            border: "1px solid #ccc",
            borderRadius: 8,
            padding: 12,
            fontSize: 16,
          }}
        />

{organizedResult && (
  <div style={{ marginTop: 12, padding: 12, border: "1px solid #555", borderRadius: 8 }}>


    <div style={{ fontWeight: 700 }}>AIが読み取った要点</div>
    <div style={{ whiteSpace: "pre-wrap", marginBottom: 8 }}>
      {organizedResult.summary}
    </div>

    <div style={{ fontWeight: 700 }}>そのまま使える投稿文（コピペOK）</div>
    <div style={{ whiteSpace: "pre-wrap" }}>
      {organizedResult.postText}
    </div>

<button
  type="button"
  onClick={() => setText(organizedResult.postText)}
  style={{ marginTop: 8 }}
>
  この内容を入力欄に反映
</button>

<button
  type="button"
  onClick={handleUseOrganizedAndAnalyze}
  style={{
    marginTop: 8,
    marginLeft: 8,
    padding: "8px 12px",
    borderRadius: 8,
    background: "#2a7",
    color: "#fff",
    border: "none",
    cursor: "pointer",
  }}
>
  この内容で議論を開始する
</button>
  </div>
)}


<PrimaryButton onClick={handleSubmit} disabled={loading} style={{ marginTop: 12 }}>
  {loading ? "AIで整理中..." : "🤖 この考えを整理する"}
</PrimaryButton>

<p style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
  書くだけでOK。AIが主張・前提・根拠に整理します
</p>

      </section>





{generatedIssue && (
  <>

<SectionCard>
  <div
    style={{
      fontWeight: 800,
      marginBottom: 8,
      fontSize: defaultMode === "easy" ? 15 : 16,
      color: defaultMode === "easy" ? "#cfcfcf" : undefined,
    }}
  >
    <div id="step2-result" style={{ marginTop: 24 }}>
      <h2>STEP2：AIが整理した結果</h2>
    </div>

    {generatedIssue.mode === "expand" ? (
      <>
        <div style={{ fontWeight: 700 }}>問い</div>
        <div style={{ marginTop: 4 }}>{generatedIssue.claim}</div>

        <div style={{ marginTop: 10, fontWeight: 700 }}>
          考えられる前提
        </div>
        <ul style={{ marginTop: 4, paddingLeft: 20 }}>
          {generatedIssue.premises.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>

        <div style={{ marginTop: 10, fontWeight: 700 }}>
          考えられる根拠
        </div>
        <ul style={{ marginTop: 4, paddingLeft: 20 }}>
          {generatedIssue.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </>
    ) : (
      <>
        <div style={{ fontWeight: 700 }}>主張</div>
        <div style={{ marginTop: 4 }}>{generatedIssue.claim}</div>

        <div style={{ marginTop: 10, fontWeight: 700 }}>前提</div>
        <ul style={{ marginTop: 4, paddingLeft: 20 }}>
          {generatedIssue.premises.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>

        <div style={{ marginTop: 10, fontWeight: 700 }}>根拠</div>
        <ul style={{ marginTop: 4, paddingLeft: 20 }}>
          {generatedIssue.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </>
    )}
  </div>
</SectionCard>





    <SectionCard style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>
        STEP3：既存の議論を確認
      </div>

      {relatedThreads.length > 0 ? (
        <>
          <div style={{ fontSize: 13, color: "#9ad", marginBottom: 10 }}>
            近い議論があれば、先にそちらに参加できます
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {relatedThreads.map((t) => (
              <div
                key={t.id}
                onClick={() => {
                  if (selectedThreadId === t.id) {
                    window.location.href = `/${tenant}/forum/thread/${t.id}`;
                  } else {
                    setSelectedThreadId(t.id);
                  }
                }}
                style={{
                  border:
                    selectedThreadId === t.id
                      ? "1px solid #2a7"
                      : t.stance === "con"
                      ? "1px solid #4a6fdc"
                      : "1px solid #444",
                  borderRadius: 10,
                  padding: "10px 12px",
                  background:
                    selectedThreadId === t.id
                      ? "#0f2a1f"
                      : t.stance === "con"
                      ? "#1b2238"
                      : "#222",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 12, color: "#bbb", marginBottom: 4 }}>
                  {t.category ?? "未分類"}
                </div>

                <div style={{ fontWeight: 800, fontSize: 16 }}>
                  {t.title}
                </div>

                {t.reason && (
                  <div style={{ fontSize: 13, color: "#666", marginTop: 6 }}>
                    → {t.reason}
                  </div>
                )}

                {t.stance && (
                  <div
                    style={{
                      fontSize: 12,
                      color: t.stance === "con" ? "#8fb3ff" : "#9ad",
                      marginTop: 6,
                      fontWeight: t.stance === "con" ? 700 : 400,
                    }}
                  >
                    {t.stance === "pro" && "賛成寄り"}
                    {t.stance === "con" && "← 反対意見あり"}
                    {t.stance === "neutral" && "中立"}
                  </div>
                )}

                {selectedThreadId === t.id && (
                  <div style={{ color: "#2a7", fontSize: 12, marginTop: 6 }}>
                    選択中
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 12 }}>
            <PrimaryButton
              disabled={!selectedThreadId}
              onClick={() => {
                if (!selectedThreadId) return;
                window.location.href = `/${tenant}/forum/thread/${selectedThreadId}`;
              }}
              variant="secondary"
            >
              選んだスレに参加する
            </PrimaryButton>
          </div>
        </>
      ) : (
        <div style={{ color: "#aaa", fontSize: 14 }}>
          関連する既存スレはまだありません
        </div>
      )}
    </SectionCard>

    <div style={{ marginTop: 12 }}>
      <div
        style
={{
          fontSize: 14,
          color: "#666",
          marginBottom: 6,
          fontWeight: 700,
        }}
      >
        STEP4：新しく作る
      </div>

      <div
        style={{
          fontSize: 13,
          color: "#666",
          marginBottom: 8,
        }}
      >
        内容がよければ、ここで新しいスレとして保存します
      </div>

      <PrimaryButton
        style={{
          width: "100%",
          padding: "16px",
          fontSize: "18px",
          fontWeight: "bold",
          borderRadius: "12px",
          background: "#2a7",
          color: "#fff",
        }}
        onClick={async () => {
          const res = await fetch("/api/forum/create-thread-from-draft", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              tenantSlug: tenant,
              title: generatedIssue.claim,
              claim: generatedIssue.claim,
              premises: generatedIssue.premises,
              reasons: generatedIssue.reasons,
              postType: "auto",
            }),
          });

          const result = await res.json();

          if (!res.ok) {
            alert(result?.error || "スレッド作成失敗");
            return;
          }

          if (!result?.threadId) {
            alert("threadId が返ってきてない");
            console.error(result);
            return;
          }

          window.location.href = `/${tenant}/forum/thread/${result.threadId}`;
        }}
      >
        🚀 この内容で新しいスレを作る
      </PrimaryButton>
    </div>
  </>
)}













    </main>
  );
}


