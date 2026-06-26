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
  maxWidth: 980,
  margin: "0 auto",
  padding: "24px 16px 40px",
  color: "#111827",
};

const headerStyle: CSSProperties = {
  border: "1px solid #d7dde8",
  borderRadius: 8,
  background: "#ffffff",
  color: "#111827",
  padding: 22,
  marginBottom: 16,
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

const steps = [
  {
    title: "取り込みプロンプトをコピーする",
    body:
      "AI知恵袋Forumの外部AI取り込み画面を開き、「取り込みプロンプト」をコピーします。",
  },
  {
    title: "スマホ・PCのAIに貼り付ける",
    body:
      "コピーしたプロンプトを、スマホやPCで使っているChatGPTなどのAIに貼り付けます。",
  },
  {
    title: "会話ログを貼り付けて整理を依頼する",
    body:
      "続けて、あなたとAIとの会話ログを貼り付けます。長い会話はテーマごとに分けると精度が上がりやすくなります。",
  },
  {
    title: "AIの出力結果をコピーする",
    body:
      "AIが出した整理結果をコピーします。会話ログ本文ではなく、AIが整理した出力結果を使います。",
  },
  {
    title: "外部AI取り込みに貼り付ける",
    body:
      "AI知恵袋Forumへ戻り、外部AI取り込み欄にAIの出力結果を貼り付けます。必要に応じて抽出モードやカテゴリーを選びます。",
  },
  {
    title: "投稿候補を確認して投稿する",
    body:
      "タイトル、問い、本文候補を確認し、不要な候補や個人情報が残っている候補は外してから投稿します。",
  },
];

export default async function ExternalAiImportGuidePage({ params }: PageProps) {
  const { tenant } = await params;

  return (
    <main style={pageStyle}>
      <div style={{ marginBottom: 18 }}>
        <LinkButton href={`/${tenant}/forum`} variant="subtle">
          Forumトップへ戻る
        </LinkButton>
      </div>

      <header style={headerStyle}>
        <p
          style={{
            margin: "0 0 8px",
            color: "#2563eb",
            fontSize: 14,
            fontWeight: 900,
          }}
        >
          AI会話ログから投稿候補を作る
        </p>
        <h1
          style={{
            margin: 0,
            fontSize: 32,
            lineHeight: 1.25,
            letterSpacing: 0,
          }}
        >
          外部AI取り込みの使い方
        </h1>
        <p style={introStyle}>
          スマホ・PCでの、あなたとAIとの会話ログから投稿候補を作る方法
        </p>
      </header>

      <SectionCard variant="white">
        <SectionTitle>1. 何ができる機能か</SectionTitle>
        <p style={textStyle}>
          ChatGPTなど、あなたとAIとの会話ログをもとに、掲示板に投稿しやすい「問い」や「投稿候補」を作る機能です。
          会話をそのまま公開するのではなく、投稿前に候補を確認し、必要なものだけ選べます。
        </p>
      </SectionCard>

      <SectionCard variant="white">
        <SectionTitle>2. 6ステップ概要画像</SectionTitle>
        <p style={{ ...textStyle, marginBottom: 14 }}>
          全体の流れは、Forumで取り込みプロンプトをコピーし、ChatGPTなどに会話ログと一緒に渡し、AIの出力結果をForumへ貼り戻して候補を確認する、という順番です。
        </p>
        <img
          src="/forum/external-ai-import-guide/overview.png"
          alt="外部AI取り込みの使い方を6ステップで説明した図"
          style={{
            display: "block",
            width: "100%",
            maxWidth: 940,
            height: "auto",
            border: "1px solid #d7dde8",
            borderRadius: 8,
            background: "#ffffff",
          }}
        />
      </SectionCard>

      <SectionCard variant="white">
        <SectionTitle>3. 手順</SectionTitle>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
            gap: 12,
          }}
        >
          {steps.map((step, index) => (
            <div
              key={step.title}
              style={{
                border: "1px solid #d7dde8",
                borderRadius: 8,
                padding: 14,
                background: "#f8fafc",
              }}
            >
              <div
                style={{
                  color: "#2563eb",
                  fontSize: 13,
                  fontWeight: 900,
                  marginBottom: 6,
                }}
              >
                STEP {index + 1}
              </div>
              <h2 style={{ margin: 0, fontSize: 18, lineHeight: 1.4 }}>
                {step.title}
              </h2>
              <p style={{ ...textStyle, marginTop: 8 }}>{step.body}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard variant="white">
        <SectionTitle>4. 個人情報の注意</SectionTitle>
        <p style={textStyle}>
          投稿内容は公開される前提です。ChatGPTなどへ渡す前、Forumへ貼り戻す前に、個人情報や第三者が特定される情報を削除してください。
        </p>
        <ul style={listStyle}>
          <li>個人名、住所、電話番号、メールアドレスは貼らない</li>
          <li>LINEなどの個人的なやりとりは貼らない</li>
          <li>勤務先、学校名、店名など、個人特定につながる情報は削除する</li>
          <li>長い会話はテーマごとに分けて貼る</li>
          <li>投稿前に、候補の内容を必ず確認する</li>
        </ul>
      </SectionCard>

      <SectionCard variant="white">
        <SectionTitle>5. Forumトップへ戻る</SectionTitle>
        <p style={{ ...textStyle, marginBottom: 14 }}>
          使い方を確認したら、Forumトップに戻って「スマホ・PCのAI会話から作る」を押してください。
        </p>
        <LinkButton href={`/${tenant}/forum`}>Forumトップへ戻る</LinkButton>
      </SectionCard>
    </main>
  );
}
