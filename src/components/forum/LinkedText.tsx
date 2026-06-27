"use client";

import type { ReactNode } from "react";

type LinkedTextProps = {
  text: string;
  className?: string;
};

const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;
const TRAILING_PUNCTUATION_PATTERN = /[.,!?;:。、，．！？；：）)\]}」』】〉》]+$/;

function splitTrailingPunctuation(url: string) {
  const trailing = url.match(TRAILING_PUNCTUATION_PATTERN)?.[0] ?? "";
  if (!trailing) {
    return { href: url, trailing: "" };
  }

  return {
    href: url.slice(0, -trailing.length),
    trailing,
  };
}

export default function LinkedText({ text, className }: LinkedTextProps) {
  const source = String(text ?? "");

  if (!source) {
    return null;
  }

  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of source.matchAll(URL_PATTERN)) {
    const rawUrl = match[0];
    const start = match.index ?? 0;

    if (start > lastIndex) {
      parts.push(source.slice(lastIndex, start));
    }

    const { href, trailing } = splitTrailingPunctuation(rawUrl);

    if (href) {
      parts.push(
        <a
          key={`url-${start}-${href}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow ugc"
          style={{
            color: "#075985",
            textDecoration: "underline",
            textUnderlineOffset: 3,
            overflowWrap: "anywhere",
            wordBreak: "break-word",
          }}
        >
          {href}
        </a>
      );
    }

    if (trailing) {
      parts.push(trailing);
    }

    lastIndex = start + rawUrl.length;
  }

  if (lastIndex < source.length) {
    parts.push(source.slice(lastIndex));
  }

  return (
    <span
      className={className}
      style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
    >
      {parts}
    </span>
  );
}
