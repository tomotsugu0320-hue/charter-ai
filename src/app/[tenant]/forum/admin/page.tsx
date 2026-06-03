import Link from "next/link";
import type { CSSProperties } from "react";

type PageProps = {
  params: Promise<{
    tenant: string;
  }>;
};

const pageStyle: CSSProperties = {
  maxWidth: 920,
  margin: "0 auto",
  padding: 24,
  color: "#111827",
};

const noticeStyle: CSSProperties = {
  border: "1px solid #fed7aa",
  borderRadius: 8,
  background: "#fff7ed",
  color: "#9a3412",
  lineHeight: 1.7,
  marginBottom: 18,
  padding: "14px 16px",
};

const menuGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
  gap: 12,
};

const menuCardStyle: CSSProperties = {
  display: "block",
  border: "1px solid #dbe3ef",
  borderRadius: 8,
  background: "#ffffff",
  color: "#111827",
  padding: 16,
  textDecoration: "none",
};

const menuDescriptionStyle: CSSProperties = {
  margin: "8px 0 0",
  color: "#475569",
  lineHeight: 1.7,
};

export default async function ForumAdminPage({ params }: PageProps) {
  const { tenant } = await params;

  return (
    <main style={pageStyle}>
      <h1 style={{ margin: "0 0 10px", fontSize: 28, fontWeight: 900 }}>
        forum 管理
      </h1>

      <section style={noticeStyle}>
        <div>このページは管理者向けです。</div>
        <div>削除操作は元に戻せない場合があります。</div>
        <div>AI論理スコア再評価ではOpenAI API費用が発生します。</div>
      </section>

      <div style={menuGridStyle}>
        <Link
          href={`/${tenant}/forum/admin/delete-threads`}
          style={menuCardStyle}
        >
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>
            スレッド削除管理
          </h2>
          <p style={menuDescriptionStyle}>
            スレッドの非表示、復元、完全削除を管理します。
          </p>
        </Link>

        <Link
          href={`/${tenant}/forum/admin/re-evaluate-logic-score`}
          style={menuCardStyle}
        >
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>
            AI論理スコア再評価
          </h2>
          <p style={menuDescriptionStyle}>
            投稿のAI論理スコアを管理者操作で1件ずつ再評価します。
          </p>
        </Link>

        <Link href={`/${tenant}/forum/admin/users`} style={menuCardStyle}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>
            利用者別投稿管理
          </h2>
          <p style={menuDescriptionStyle}>
            author_key ごとの投稿数、非表示投稿数、投稿内容を確認します。
          </p>
        </Link>
      </div>
    </main>
  );
}
