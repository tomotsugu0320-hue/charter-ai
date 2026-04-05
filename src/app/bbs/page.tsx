"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Post = {
  id: string;
  title: string;
  content: string;
  category: string | null;
  created_at: string;
};

export default function BbsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPosts();
  }, []);

  async function loadPosts() {
    setLoading(true);

    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("posts取得エラー:", error);
    } else {
      setPosts(data || []);
    }

    setLoading(false);
  }

  return (
    <div style={{ padding: "20px" }}>
      <h1>🧠 AI掲示板</h1>

      <div style={{ marginBottom: "16px" }}>
        <Link href="/bbs/new">
          <button>＋ 投稿する</button>
        </Link>
      </div>

      {loading && <p>読み込み中...</p>}

      {!loading && posts.length === 0 && (
        <p>まだ投稿がありません。</p>
      )}

      {!loading &&
        posts.map((post) => (
          <div
            key={post.id}
            style={{
              border: "1px solid #ccc",
              padding: "12px",
              marginBottom: "12px",
              borderRadius: "8px",
            }}
          >
            <Link href={`/bbs/${post.id}`}>
              <h2 style={{ cursor: "pointer" }}>{post.title}</h2>
            </Link>

            <p>{post.content.slice(0, 100)}...</p>

            <small>
              {new Date(post.created_at).toLocaleString()}
            </small>
          </div>
        ))}
    </div>
  );
}