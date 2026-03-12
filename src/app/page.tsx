import Link from "next/link";

export default function Home() {
  return (
    <main style={{ padding: 40 }}>
      <h1>Charter AI</h1>
      <p>AI相談サービス</p>

      <Link href="/dev">アプリを開く</Link>
    </main>
  );
}