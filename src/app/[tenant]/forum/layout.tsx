import type { Metadata } from "next";
import { absoluteUrl, siteName } from "@/lib/seo";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{
    tenant: string;
  }>;
};

export async function generateMetadata({
  params,
}: LayoutProps): Promise<Metadata> {
  const { tenant } = await params;
  const title = "AI掲示板";
  const description =
    "問い、意見、反論、補足をAIで整理し、議論の流れや関連スレッドを見つけられる掲示板です。";
  const url = absoluteUrl(`/${tenant}/forum`);

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName,
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default function ForumLayout({ children }: LayoutProps) {
  return <>{children}</>;
}
