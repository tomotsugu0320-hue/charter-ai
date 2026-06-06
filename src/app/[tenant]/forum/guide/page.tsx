import type { CSSProperties } from "react";
import LinkButton from "@/components/forum/LinkButton";
import SectionCard from "@/components/forum/SectionCard";
import SectionTitle from "@/components/forum/SectionTitle";

type PageProps = {
  params: Promise<{
    tenant: string;
  }>;
};

const pageStyle: CSSProperties = {
  maxWidth: 880,
  margin: "0 auto",
  padding: "24px 16px 40px",
  color: "#111827",
};

const introStyle: CSSProperties = {
  margin: "10px 0 0",
  color: "#475569",
  lineHeight: 1.8,
  fontSize: 16,
};

const textStyle: CSSProperties = {
  margin: 0,
  color: "#334155",
  lineHeight: 1.8,
  fontSize: 16,
};

const listStyle: CSSProperties = {
  margin: "10px 0 0",
  paddingLeft: 22,
  color: "#334155",
  lineHeight: 1.8,
  fontSize: 16,
};

export default async function ForumGuidePage({ params }: PageProps) {
  const { tenant } = await params;

  return (
    <main style={pageStyle}>
      <div style={{ marginBottom: 18 }}>
        <LinkButton href={`/${tenant}/forum`} variant="subtle">
          Forumトップへ戻る
        </LinkButton>
      </div>

      <header
        style={{
          border: "1px solid #d7dde8",
          borderRadius: 8,
          background: "#ffffff",
          color: "#111827",
          padding: 22,
          marginBottom: 16,
        }}
      >
        <p
          style={{
            margin: "0 0 8px",
            color: "#64748b",
            fontSize: 14,
            fontWeight: 800,
          }}
        >
          βテスター向けガイド
        </p>
        <h1
          style={{
            margin: 0,
            fontSize: 30,
            lineHeight: 1.25,
            letterSpacing: 0,
          }}
        >
          AI知恵袋の使い方
        </h1>
        <p style={introStyle}>
          初めて使う人向けに、ログインから投稿、投稿後の見方までを短くまとめています。
        </p>
      </header>

      <SectionCard variant="white">
        <SectionTitle>1. AI知恵袋とは</SectionTitle>
        <p style={textStyle}>
          AI知恵袋は、ChatGPTなどのAIと話した内容や自分のメモを、掲示板に投稿しやすい形へ整理するためのβ版サービスです。
          投稿後は、論点・前提・根拠・反論などを見やすく整理していくことを目指しています。
        </p>
      </SectionCard>

      <SectionCard variant="white">
        <SectionTitle>2. ログイン方法</SectionTitle>
        <p style={textStyle}>
          こちらから渡されたIDとパスワードでログインします。ログイン後、投稿や外部AI取り込みが使えます。
        </p>
      </SectionCard>

      <SectionCard variant="white">
        <SectionTitle>3. 外部AI取り込みの流れ</SectionTitle>
        <ol style={listStyle}>
          <li>Forumトップで「過去の会話・メモから投稿候補を作る」を開く</li>
          <li>表示されたプロンプトをコピーする</li>
          <li>ChatGPTなどの外部AIに貼り付ける</li>
          <li>外部AIが返したJSONをAI知恵袋に貼り付ける</li>
          <li>投稿候補を確認・編集する</li>
          <li>投稿対象にする候補を選ぶ</li>
          <li>「選んだ候補を投稿する」を押す</li>
        </ol>
      </SectionCard>

      <SectionCard variant="white">
        <SectionTitle>4. 投稿前の注意点</SectionTitle>
        <ul style={listStyle}>
          <li>投稿内容は公開される前提です</li>
          <li>個人情報は貼らないでください</li>
          <li>住所、電話番号、メールアドレス、LINE内容などは貼らないでください</li>
          <li>第三者が特定される情報は貼らないでください</li>
          <li>読み取っただけでは投稿されません</li>
          <li>投稿前に必ず内容を確認できます</li>
        </ul>
      </SectionCard>

      <SectionCard variant="white">
        <SectionTitle>5. 投稿後に見られるもの</SectionTitle>
        <ul style={listStyle}>
          <li>現時点の答え</li>
          <li>主な前提</li>
          <li>主な根拠</li>
          <li>反論・リスク</li>
          <li>議論ツリー</li>
          <li>議論の現在地</li>
          <li>AI論理スコア</li>
        </ul>
        <p style={{ ...textStyle, marginTop: 10 }}>
          AI論理スコアは絶対的な正解判定ではありません。評価理由つきで議論を整理するための参考として見てください。
        </p>
      </SectionCard>

      <SectionCard variant="white">
        <SectionTitle>6. βテストで見てほしいポイント</SectionTitle>
        <ul style={listStyle}>
          <li>どこを押せばいいか分かったか</li>
          <li>説明文が長すぎないか</li>
          <li>スマホで見づらい場所がないか</li>
          <li>投稿候補の内容が分かりやすいか</li>
          <li>投稿前に不安になる部分がないか</li>
          <li>ログインや投稿で詰まったところがないか</li>
          <li>もう一度使いたいと思えるか</li>
        </ul>
      </SectionCard>

      <SectionCard variant="white">
        <SectionTitle>7. 困ったとき</SectionTitle>
        <ul style={listStyle}>
          <li>ログインできない場合はID・パスワードを確認してください</li>
          <li>JSONが読み取れない場合は、外部AIの返答がJSON形式になっているか確認してください</li>
          <li>投稿候補が消えた場合でも、ログイン後に復元される場合があります</li>
          <li>それでも困った場合は、どの画面で止まったか教えてください</li>
        </ul>
      </SectionCard>
    </main>
  );
}
