// src/app/[tenant]/forum/admin/delete/page.tsx

"use client";
import { useEffect, useState } from "react";

export default function Page() {
  const [posts, setPosts] = useState<any[]>([]);

  useEffect(() => {
    load();
  }, []);

async function load() {
  const res = await fetch("/api/forum/admin-posts");
  const json = await res.json().catch(() => ({}));

  console.log("admin-posts response:", json);

  if (!res.ok) {
    alert(json?.error || "投稿一覧の取得に失敗しました");
    return;
  }

  setPosts(json.posts ?? []);
}


async function del(id: string) {
  if (!confirm("削除する？")) return;

  console.log("削除ID:", id);

  const res = await fetch("/api/forum/delete-post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postId: id }),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    alert(json?.error || "削除に失敗しました");
    return;
  }

  setPosts((p) => p.filter((x) => x.id !== id));
}

  return (
    <div style={{ padding: 20 }}>
      <h2>投稿削除管理</h2>

      {posts.map(p => (
        <div key={p.id} style={{ border: "1px solid #ccc", marginBottom: 10, padding: 10 }}>
          <div style={{ fontWeight: 700 }}>
            {p.forum_threads?.title}
          </div>

          <div style={{ whiteSpace: "pre-wrap" }}>
            {p.content}
          </div>

          <button onClick={() => del(p.id)} style={{ color: "red" }}>
            削除
          </button>
        </div>
      ))}
    </div>
  );
}