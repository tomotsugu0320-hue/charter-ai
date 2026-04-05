"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function NewPostPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim() || !content.trim()) {
      alert("タイトルと本文は必須です。");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("posts").insert([
      {
        title: title.trim(),
        content: content.trim(),
        category: category.trim() || null,
      },
    ]);

    setSaving(false);

    if (error) {
      console.error("投稿作成エラー:", error);
      alert("投稿の保存に失敗しました。");
      return;
    }

    router.push("/bbs");
  }

  return (
    <div style={{ padding: "20px", maxWidth: "720px" }}>
      <h1>＋ 新規投稿</h1>

      <div style={{ marginBottom: "16px" }}>
        <Link href="/bbs">← 掲示板一覧に戻る</Link>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "16px" }}>
          <label>タイトル</label>
          <br />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例：AIはどこまで中立であるべきか？"
            style={{ width: "100%", padding: "8px" }}
          />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label>カテゴリ</label>
          <br />
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="例：政治 / 経済 / 恋愛 / 哲学"
            style={{ width: "100%", padding: "8px" }}
          />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label>本文</label>
          <br />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="考えていることを書いてください"
            rows={10}
            style={{ width: "100%", padding: "8px" }}
          />
        </div>

        <button type="submit" disabled={saving}>
          {saving ? "保存中..." : "投稿する"}
        </button>
      </form>
    </div>
  );
}