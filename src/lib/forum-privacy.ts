const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"'、。）」』】]+/gi;
const PHONE_CANDIDATE_PATTERN =
  /(^|[^\d])((?:(?:\+81|0081)[\-‐‑‒–—ー ]?(?:0)?|0)\d{1,4}(?:[\-‐‑‒–—ー ]?\d{1,4})?[\-‐‑‒–—ー ]?\d{4})(?!\d)/g;
const POSTAL_CODE_PATTERN =
  /(^|[^\d])(?:〒[ \t]*)?\d{3}[\-‐‑‒–—ー]\d{4}(?!\d)/g;
// Free-form names and addresses are intentionally not guessed; only labeled lines are masked.
const LABELED_ADDRESS_PATTERN =
  /(^|[\r\n])([ \t]*[-*・]?[ \t]*(?:住所|所在地)[ \t]*[:：][ \t]*)[^\r\n]*/g;
const LABELED_ID_PATTERN =
  /(^|[\r\n])([ \t]*[-*・]?[ \t]*(?:LINE[ \t]*ID|LINE|ライン[ \t]*ID|ライン|連絡先[ \t]*ID|ID)[ \t]*[:：][ \t]*)[A-Z0-9._@+-]{2,}/gim;

function maskPhoneNumbers(text: string) {
  return text.replace(
    PHONE_CANDIDATE_PATTERN,
    (match, prefix: string, candidate: string) => {
      const digits = candidate.replace(/\D/g, "");
      const domesticDigits =
        digits.startsWith("81") && digits.length >= 11
          ? `0${digits.slice(2)}`
          : digits;
      const isMobileOrIpPhone = /^0(?:50|70|80|90)\d{8}$/.test(domesticDigits);
      const isLandline = /^0[1-9]\d{8}$/.test(domesticDigits);
      const isFreeDial =
        /^0120\d{6}$/.test(domesticDigits) ||
        /^0800\d{7}$/.test(domesticDigits);

      if (!isMobileOrIpPhone && !isLandline && !isFreeDial) {
        return match;
      }

      return `${prefix}[電話番号削除]`;
    }
  );
}

export function maskForumPrivacyText(text: string): string {
  let masked = String(text ?? "");

  masked = masked.replace(
    LABELED_ADDRESS_PATTERN,
    (_match, lineStart: string, label: string) =>
      `${lineStart}${label}[住所削除]`
  );
  masked = masked.replace(
    LABELED_ID_PATTERN,
    (_match, lineStart: string, label: string) => `${lineStart}${label}[ID削除]`
  );
  masked = masked.replace(URL_PATTERN, "[URL削除]");
  masked = masked.replace(EMAIL_PATTERN, "[メールアドレス削除]");
  masked = maskPhoneNumbers(masked);
  masked = masked.replace(
    POSTAL_CODE_PATTERN,
    (_match, prefix: string) => `${prefix}[郵便番号削除]`
  );

  return masked;
}

export function maskForumPrivacyArray(items: string[]): string[] {
  return items.map((item) => maskForumPrivacyText(String(item ?? "")));
}

export function maskForumPrivacyValue(value: unknown): unknown {
  if (typeof value === "string") {
    return maskForumPrivacyText(value);
  }

  if (Array.isArray(value)) {
    return value.map(maskForumPrivacyValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        maskForumPrivacyValue(item),
      ])
    );
  }

  return value;
}
