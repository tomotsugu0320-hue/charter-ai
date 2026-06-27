"use client";

import { useEffect, useState, type CSSProperties } from "react";

type GuideImageLightboxProps = {
  src: string;
  alt: string;
  className?: string;
};

const thumbnailButtonStyle: CSSProperties = {
  display: "block",
  width: "100%",
  maxWidth: 940,
  padding: 0,
  border: "none",
  background: "transparent",
  cursor: "zoom-in",
  textAlign: "left",
};

const thumbnailImageStyle: CSSProperties = {
  display: "block",
  width: "100%",
  height: "auto",
  border: "1px solid #d7dde8",
  borderRadius: 8,
  background: "#ffffff",
};

const hintStyle: CSSProperties = {
  margin: "8px 0 0",
  color: "#2563eb",
  fontSize: 13,
  fontWeight: 800,
  lineHeight: 1.5,
};

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  background: "rgba(15, 23, 42, 0.72)",
};

const panelStyle: CSSProperties = {
  width: "min(1120px, calc(100vw - 24px))",
  maxHeight: "calc(100vh - 32px)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  border: "1px solid #d7dde8",
  borderRadius: 10,
  background: "#ffffff",
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.28)",
};

const modalHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 14px",
  borderBottom: "1px solid #e2e8f0",
};

const modalHelpStyle: CSSProperties = {
  margin: 0,
  color: "#334155",
  fontSize: 14,
  fontWeight: 800,
  lineHeight: 1.5,
};

const closeButtonStyle: CSSProperties = {
  flexShrink: 0,
  width: 36,
  height: 36,
  border: "1px solid #cbd5e1",
  borderRadius: 999,
  background: "#ffffff",
  color: "#0f172a",
  cursor: "pointer",
  fontSize: 24,
  fontWeight: 800,
  lineHeight: 1,
};

const scrollAreaStyle: CSSProperties = {
  overflow: "auto",
  padding: 14,
  WebkitOverflowScrolling: "touch",
};

const enlargedImageStyle: CSSProperties = {
  display: "block",
  width: "max(1100px, 100%)",
  maxWidth: "none",
  height: "auto",
  border: "1px solid #d7dde8",
  borderRadius: 8,
  background: "#ffffff",
};

export default function GuideImageLightbox({
  src,
  alt,
  className,
}: GuideImageLightboxProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={thumbnailButtonStyle}
        aria-label="画像を拡大表示する"
      >
        <img src={src} alt={alt} style={thumbnailImageStyle} />
      </button>
      <p style={hintStyle}>画像をタップして拡大</p>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="外部AI取り込みの使い方画像の拡大表示"
          style={overlayStyle}
          onClick={() => setOpen(false)}
        >
          <div style={panelStyle} onClick={(event) => event.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <p style={modalHelpStyle}>
                拡大表示中：上下左右にスクロールして確認できます
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={closeButtonStyle}
                aria-label="拡大表示を閉じる"
              >
                ×
              </button>
            </div>
            <div style={scrollAreaStyle}>
              <img src={src} alt={alt} style={enlargedImageStyle} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
