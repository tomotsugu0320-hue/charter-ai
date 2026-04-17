import Link from "next/link";
import type { Metadata } from "next";
import { absoluteUrl, siteDescription, siteName } from "@/lib/seo";

export const metadata: Metadata = {
  title: siteName,
  description: siteDescription,
  openGraph: {
    title: siteName,
    description: siteDescription,
    url: absoluteUrl("/"),
    siteName,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: siteName,
    description: siteDescription,
  },
};

export default function Home() {
  return (
    <main style={{ padding: 40 }}>
      <h1>Charter AI</h1>
      <p>AI相談サービス</p>

      <Link href="/dev">
        <button
          style={{
            padding: "12px 20px",
            fontSize: "16px",
            cursor: "pointer",
          }}
        >
          アプリを開く
        </button>
      </Link>
    </main>
  );
}
