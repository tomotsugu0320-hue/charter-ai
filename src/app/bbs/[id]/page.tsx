"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Post = {
  id: string;
  title: string;
  content: string;
  category: string | null;
  ai_summary: string | null;
  created_at: string;
};

export default function PostDetailPage() {
  const params = useParams<{ id: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (params?.id) {
      loadPost(params.id);
    }
  }, [params?.id]);

  async function loadPost(id: string) {
    setLoading(true);

    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("投稿取得エラー:", error);
    } else {
      setPost(data);
    }

    setLoading(false);
  }


async function handleGenerate() {
  if (!post) return;

  setGenerating(true);

  try {
    const res = await fetch("/api/bbs/summary", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: post.content,
      }),
    });

    const raw = await res.text();
    console.log("API raw response:", raw);

    let result: any;
    try {
      result = JSON.parse(raw);
    } catch {
      alert("APIがJSONではなくHTMLを返しています。F12 → Console の 'API raw response' を見て。");
      return;
    }

    if (!res.ok) {
      console.error("AI整理APIエラー:", result);
      alert(result.error || "AI整理に失敗しました。");
      return;
    }

    const { error } = await supabase
      .from("posts")
      .update({ ai_summary: result.summary })
      .eq("id", post.id);

    if (error) {
      console.error("ai_summary保存エラー:", error);
      alert("AI整理の保存に失敗しました。");
      return;
    }

    await loadPost(post.id);
  } catch (e) {
    console.error("AI整理エラー:", e);
    alert("AI整理中にエラーが発生しました。");
  } finally {
    setGenerating(false);
  }
}




  if (loading) return <p>読み込み中...</p>;
  if (!post) return <p>投稿が見つかりません。</p>;

  return (
    <div style={{ padding: "20px", maxWidth: "720px" }}>
      <Link href="/bbs">← 一覧に戻る</Link>

      <h1>{post.title}</h1>

      <p style={{ color: "#666" }}>
        {new Date(post.created_at).toLocaleString()}
      </p>

      {post.category && <p style={{ fontWeight: "bold" }}>#{post.category}</p>}

      <div style={{ marginTop: "20px", marginBottom: "30px" }}>
        <p style={{ whiteSpace: "pre-wrap" }}>{post.content}</p>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <button onClick={handleGenerate} disabled={generating}>
          {generating ? "生成中..." : "AIで整理する"}
        </button>
      </div>

      <div
        style={{
          borderTop: "1px solid #ccc",
          paddingTop: "20px",
        }}
      >
        <h2>🧠 AIによる整理</h2>

        {post.ai_summary ? (
          <pre style={{ whiteSpace: "pre-wrap" }}>{post.ai_summary}</pre>
        ) : (
          <p>まだAI整理はありません。</p>
        )}
      </div>
    </div>
  );
}