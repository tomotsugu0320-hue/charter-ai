export const siteName = "Charter AI";

export const siteDescription =
  "AI掲示板で問い、意見、反論、補足を整理し、議論や記録を構造化して振り返れます。";

export function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function absoluteUrl(path = "/") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getBaseUrl()}${normalizedPath}`;
}

export function truncateDescription(value: string | null | undefined, max = 120) {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return siteDescription;
  return text.length > max ? `${text.slice(0, max)}...` : text;
}
