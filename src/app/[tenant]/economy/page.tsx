import Link from "next/link";
import type { CSSProperties } from "react";
import ForumGuideTree from "@/components/forum/ForumGuideTree";

type PageProps = {
  params: Promise<{
    tenant: string;
  }>;
};

const pageStyle: CSSProperties = {
  maxWidth: 1080,
  margin: "0 auto",
  padding: 24,
  color: "#111827",
};

const heroStyle: CSSProperties = {
  border: "1px solid #2f3747",
  borderRadius: 8,
  padding: 22,
  background: "#141923",
  color: "#f9fafb",
  marginBottom: 18,
};

const leadStyle: CSSProperties = {
  margin: "12px 0 0",
  color: "#d1d5db",
  lineHeight: 1.8,
  fontSize: 16,
};

const ctaGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
  gap: 10,
  marginTop: 18,
};

const primaryLinkStyle: CSSProperties = {
  display: "block",
  borderRadius: 8,
  padding: "12px 14px",
  background: "#2563eb",
  color: "#ffffff",
  textDecoration: "none",
  fontWeight: 900,
  textAlign: "center",
};

const secondaryLinkStyle: CSSProperties = {
  display: "block",
  borderRadius: 8,
  padding: "12px 14px",
  background: "#ffffff",
  color: "#111827",
  border: "1px solid #cbd5e1",
  textDecoration: "none",
  fontWeight: 800,
  textAlign: "center",
};

export default async function EconomyPage({ params }: PageProps) {
  const { tenant } = await params;

  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <h1
          style={{
            margin: 0,
            fontSize: 32,
            lineHeight: 1.25,
            letterSpacing: 0,
          }}
        >
          日本経済を良くするには？
        </h1>

        <p style={leadStyle}>
          消費税、需要不足、減税などの論点を選び、AIの整理と人間の議論を見ながら、日本経済を良くするための政策を考える入口です。
        </p>

        <div style={ctaGridStyle}>
          <Link href={`/${tenant}/forum`} style={primaryLinkStyle}>
            議論一覧を見る
          </Link>
          <Link
            href={`/${tenant}/forum?node=consumption-tax`}
            style={secondaryLinkStyle}
          >
            消費税を考える
          </Link>
          <Link
            href={`/${tenant}/forum?node=demand-shortage`}
            style={secondaryLinkStyle}
          >
            需要不足を考える
          </Link>
          <Link href={`/${tenant}/forum?node=tax-cuts`} style={secondaryLinkStyle}>
            減税を考える
          </Link>
        </div>
      </section>

      <ForumGuideTree tenant={tenant} />
    </main>
  );
}
