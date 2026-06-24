"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

type ForumHamburgerMenuProps = {
  tenant: string;
  isLoggedIn?: boolean | null;
  onLoggedOut?: () => void;
};

type LoginStatusResponse = {
  loggedIn?: boolean;
};

const menuButtonStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "9px 12px",
  background: "#ffffff",
  color: "#111827",
  cursor: "pointer",
  fontWeight: 700,
  minWidth: 44,
  fontSize: 18,
  lineHeight: 1,
};

const menuLinkStyle: CSSProperties = {
  display: "block",
  padding: "9px 10px",
  borderRadius: 8,
  color: "#111827",
  textDecoration: "none",
  fontWeight: 800,
};

export default function ForumHamburgerMenu({
  tenant,
  isLoggedIn,
  onLoggedOut,
}: ForumHamburgerMenuProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [detectedLoggedIn, setDetectedLoggedIn] = useState(false);
  const effectiveLoggedIn =
    typeof isLoggedIn === "boolean" ? isLoggedIn : detectedLoggedIn;

  useEffect(() => {
    if (typeof isLoggedIn === "boolean") return;

    let cancelled = false;

    async function loadStatus() {
      const response = await fetch("/api/forum/login/status", {
        cache: "no-store",
      }).catch(() => null);
      const json = (await response?.json().catch(() => ({}))) as
        | LoginStatusResponse
        | undefined;

      if (!cancelled) {
        setDetectedLoggedIn(Boolean(response?.ok && json?.loggedIn));
      }
    }

    void loadStatus();

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  const menuItems = useMemo(
    () =>
      effectiveLoggedIn
        ? [
            { href: `/${tenant}/forum/guide`, label: "使い方" },
            { href: `/${tenant}/forum/private-logs`, label: "あとで読む管理" },
            {
              href: `/${tenant}/forum/admin/delete-threads`,
              label: "管理画面（会員）：非表示/復元",
            },
            { href: `/${tenant}/forum/account`, label: "アカウント管理" },
            { href: `/${tenant}/forum`, label: "トップへ戻る" },
          ]
        : [
            {
              href: `/${tenant}/forum/login?next=${encodeURIComponent(
                `/${tenant}/forum`
              )}`,
              label: "ログイン",
            },
            { href: `/${tenant}/forum/guide`, label: "使い方" },
            { href: `/${tenant}/forum`, label: "トップへ戻る" },
            { href: `/${tenant}/forum/admin`, label: "管理者用画面" },
          ],
    [effectiveLoggedIn, tenant]
  );

  async function handleLogout() {
    await fetch("/api/forum/logout", { method: "POST" }).catch(() => null);
    setDetectedLoggedIn(false);
    setIsOpen(false);
    onLoggedOut?.();
    router.push(`/${tenant}/forum/login`);
  }

  return (
    <div style={{ position: "relative", marginLeft: "auto" }}>
      <button
        type="button"
        aria-label="Forumメニューを開く"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        style={{
          ...menuButtonStyle,
          background: isOpen ? "#111827" : "#ffffff",
          color: isOpen ? "#ffffff" : "#111827",
          borderColor: isOpen ? "#111827" : "#cbd5e1",
        }}
      >
        ☰
      </button>

      {isOpen && (
        <nav
          aria-label="Forumメニュー"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            zIndex: 60,
            width: "min(80vw, 320px)",
            minWidth: "min(240px, calc(100vw - 24px))",
            maxWidth: "calc(100vw - 32px)",
            boxSizing: "border-box",
            display: "grid",
            gap: 6,
            padding: 10,
            borderRadius: 10,
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#111827",
            boxShadow: "0 12px 30px rgba(15, 23, 42, 0.18)",
            overflowWrap: "anywhere",
          }}
        >
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsOpen(false)}
              style={menuLinkStyle}
            >
              {item.label}
            </Link>
          ))}

          {effectiveLoggedIn && (
            <>
              <button
                type="button"
                onClick={() => void handleLogout()}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "9px 10px",
                  border: 0,
                  borderRadius: 8,
                  background: "#fef2f2",
                  color: "#991b1b",
                  cursor: "pointer",
                  font: "inherit",
                  fontWeight: 800,
                  textAlign: "left",
                }}
              >
                ログアウト
              </button>
              <Link
                href={`/${tenant}/forum/admin`}
                onClick={() => setIsOpen(false)}
                style={menuLinkStyle}
              >
                管理者用画面
              </Link>
            </>
          )}
        </nav>
      )}
    </div>
  );
}
