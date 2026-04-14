// src/lib/privacy.ts

export type PrivacyFlag =
  | "phone"
  | "email"
  | "url"
  | "social"
  | "address"
  | "long_number"
  | "realname_attack"
  | "company_attack"
  | "violent_word";

export type PrivacyCheckResult = {
  isSensitive: boolean;
  score: number;
  flags: PrivacyFlag[];
  maskedText: string;
};

const PHONE_REGEX =
  /(?:\+81[-\s]?)?(?:0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4})/g;

const EMAIL_REGEX =
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const URL_REGEX =
  /https?:\/\/[^\s]+|www\.[^\s]+/gi;

const SOCIAL_REGEX =
  /\b(?:@[\w.]{2,30}|instagram\.com\/[^\s]+|x\.com\/[^\s]+|twitter\.com\/[^\s]+|facebook\.com\/[^\s]+)\b/gi;

// 雑でも初期はこれでいい
const ADDRESS_REGEX =
  /(東京都|北海道|(?:京都|大阪)府|.{1,6}県).{0,20}(市|区|町|村|丁目|番地|号)/g;

// 7桁以上の連続数字
const LONG_NUMBER_REGEX =
  /\b\d{7,}\b/g;

// 「◯◯さん/君/氏 + 攻撃語」みたいな雑判定
const REALNAME_ATTACK_REGEX =
  /([一-龠ぁ-んァ-ヶ]{2,10})(さん|君|氏)?[^。\n]{0,20}(詐欺|最悪|やばい|潰れろ|死ね|消えろ|犯罪|嘘つき|最低)/g;

// 会社・店・病院など + 攻撃語
const COMPANY_ATTACK_REGEX =
  /((株式会社|有限会社|会社|店|クリニック|病院|ジム|学校).{0,15})(詐欺|最悪|やばい|潰れろ|ぼったくり|違法|最低)/g;

const VIOLENT_WORD_REGEX =
  /(死ね|殺す|消えろ|潰れろ|晒す|住所特定|電凸)/g;

function pushFlag(flags: PrivacyFlag[], flag: PrivacyFlag) {
  if (!flags.includes(flag)) flags.push(flag);
}

export function checkPrivacyRisk(text: string): PrivacyCheckResult {
PHONE_REGEX.lastIndex = 0;
EMAIL_REGEX.lastIndex = 0;
URL_REGEX.lastIndex = 0;
SOCIAL_REGEX.lastIndex = 0;
ADDRESS_REGEX.lastIndex = 0;
LONG_NUMBER_REGEX.lastIndex = 0;
REALNAME_ATTACK_REGEX.lastIndex = 0;
COMPANY_ATTACK_REGEX.lastIndex = 0;
VIOLENT_WORD_REGEX.lastIndex = 0;
  let score = 0;
  const flags: PrivacyFlag[] = [];
  let maskedText = text;

  if (text.match(PHONE_REGEX)) {
    score += 5;
    pushFlag(flags, "phone");
    maskedText = maskedText.replace(PHONE_REGEX, "[電話番号]");
  }

  if (EMAIL_REGEX.test(text)) {
    score += 5;
    pushFlag(flags, "email");
    maskedText = maskedText.replace(EMAIL_REGEX, "[メールアドレス]");
  }

  if (URL_REGEX.test(text)) {
    score += 3;
    pushFlag(flags, "url");
    maskedText = maskedText.replace(URL_REGEX, "[URL]");
  }

  if (SOCIAL_REGEX.test(text)) {
    score += 3;
    pushFlag(flags, "social");
    maskedText = maskedText.replace(SOCIAL_REGEX, "[SNSアカウント]");
  }

  if (ADDRESS_REGEX.test(text)) {
    score += 5;
    pushFlag(flags, "address");
    maskedText = maskedText.replace(ADDRESS_REGEX, "[住所らしき情報]");
  }

  if (LONG_NUMBER_REGEX.test(text)) {
    score += 2;
    pushFlag(flags, "long_number");
    maskedText = maskedText.replace(LONG_NUMBER_REGEX, "[長い数字列]");
  }

  if (REALNAME_ATTACK_REGEX.test(text)) {
    score += 4;
    pushFlag(flags, "realname_attack");
  }

  if (COMPANY_ATTACK_REGEX.test(text)) {
    score += 4;
    pushFlag(flags, "company_attack");
  }

  if (VIOLENT_WORD_REGEX.test(text)) {
    score += 4;
    pushFlag(flags, "violent_word");
  }

  // 初期はこのくらいで十分
  const isSensitive = score >= 5 || flags.includes("realname_attack") || flags.includes("company_attack");

  return {
    isSensitive,
    score,
    flags,
    maskedText,
  };
}