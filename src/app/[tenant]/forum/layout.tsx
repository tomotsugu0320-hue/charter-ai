// src/app/[tenant]/forum/layout.tsx

import type { Metadata } from "next";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{
    tenant: string;
  }>;
};

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const resolved = await params;
  const tenant = resolved.tenant;

  const title = "AI掲示板 | 論点・前提・根拠を見える化";
  const description =
    "意見を主張・前提・根拠に分解して、議論のズレを見える化するAI掲示板。関連する論点や反対意見もたどれます。";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `/${tenant}/forum`,
      siteName: "AI掲示板",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function ForumLayout({ children }: LayoutProps) {
  return <>{children}</>;
}