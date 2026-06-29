"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type ForumFeedbackLinksProps = {
  tenant: string;
  children: ReactNode;
};

const feedbackLinkHref = (tenant: string) => `/${tenant}/forum/feedback`;

export default function ForumFeedbackLinks({
  tenant,
  children,
}: ForumFeedbackLinksProps) {
  const pathname = usePathname();
  const isAdminPage = pathname?.startsWith(`/${tenant}/forum/admin`);

  if (!pathname || isAdminPage) {
    return <>{children}</>;
  }

  const href = feedbackLinkHref(tenant);

  return (
    <>
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "10px 16px 0",
          display: "flex",
          justifyContent: "flex-end",
          boxSizing: "border-box",
        }}
      >
        <Link
          href={href}
          style={{
            display: "inline-flex",
            alignItems: "center",
            border: "1px solid #cbd5e1",
            borderRadius: 999,
            background: "#ffffff",
            color: "#334155",
            fontSize: 13,
            fontWeight: 800,
            lineHeight: 1.4,
            padding: "6px 10px",
            textDecoration: "none",
          }}
        >
          不具合・改善を報告
        </Link>
      </div>

      {children}

      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "0 16px 28px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            border: "1px solid #dbe3ef",
            borderRadius: 10,
            background: "#f8fafc",
            color: "#475569",
            display: "flex",
            flexWrap: "wrap",
            gap: "6px 10px",
            alignItems: "center",
            justifyContent: "space-between",
            lineHeight: 1.7,
            padding: "10px 12px",
          }}
        >
          <span>公開ベータ改善のため、気づいた点を送れます。</span>
          <Link
            href={href}
            style={{
              color: "#2563eb",
              fontWeight: 900,
              overflowWrap: "anywhere",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            表示崩れ・リンク切れ・AI整理の改善要望はこちら
          </Link>
        </div>
      </div>
    </>
  );
}
