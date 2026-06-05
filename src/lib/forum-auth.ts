import { createHmac, randomBytes, timingSafeEqual } from "crypto";

export const FORUM_BETA_SESSION_COOKIE = "forum_beta_session";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

type ForumBetaSessionPayload = {
  sub: "forum_beta";
  iat: number;
  exp: number;
  nonce: string;
  v: 1;
};

function getSessionSecret() {
  return process.env.FORUM_BETA_SESSION_SECRET;
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signTokenPayload(payloadPart: string, secret: string) {
  return createHmac("sha256", secret).update(payloadPart).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) return false;

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function readCookieValue(cookieHeader: string | null | undefined, name: string) {
  if (!cookieHeader) return null;

  const prefix = `${name}=`;
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  return cookie ? cookie.slice(prefix.length) : null;
}

export function isForumBetaAuthConfigured() {
  return Boolean(
    process.env.FORUM_BETA_USER &&
      process.env.FORUM_BETA_PASSWORD &&
      process.env.FORUM_BETA_SESSION_SECRET
  );
}

export function verifyForumBetaCredentials(user: string, password: string) {
  const expectedUser = process.env.FORUM_BETA_USER;
  const expectedPassword = process.env.FORUM_BETA_PASSWORD;

  if (!expectedUser || !expectedPassword || !getSessionSecret()) return false;

  return safeEqual(user, expectedUser) && safeEqual(password, expectedPassword);
}

export function createForumBetaSessionToken() {
  const secret = getSessionSecret();

  if (!secret) {
    throw new Error("FORUM_BETA_SESSION_SECRET is not configured.");
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: ForumBetaSessionPayload = {
    sub: "forum_beta",
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS,
    nonce: randomBytes(16).toString("base64url"),
    v: 1,
  };
  const payloadPart = base64UrlEncode(JSON.stringify(payload));
  const signature = signTokenPayload(payloadPart, secret);

  return `${payloadPart}.${signature}`;
}

export function verifyForumBetaSessionToken(token: string | null | undefined) {
  const secret = getSessionSecret();

  if (!secret || !token) return false;

  const parts = token.split(".");

  if (parts.length !== 2) return false;

  const [payloadPart, signature] = parts;

  if (!payloadPart || !signature) return false;

  const expectedSignature = signTokenPayload(payloadPart, secret);

  if (!safeEqual(signature, expectedSignature)) return false;

  try {
    const payload = JSON.parse(
      base64UrlDecode(payloadPart)
    ) as Partial<ForumBetaSessionPayload>;
    const now = Math.floor(Date.now() / 1000);

    return (
      payload.sub === "forum_beta" &&
      payload.v === 1 &&
      typeof payload.exp === "number" &&
      payload.exp > now
    );
  } catch {
    return false;
  }
}

export function isForumBetaLoggedIn(
  requestOrHeaders: Request | Headers | null | undefined
) {
  const cookieHeader =
    requestOrHeaders instanceof Headers
      ? requestOrHeaders.get("cookie")
      : requestOrHeaders?.headers.get("cookie");
  const token = readCookieValue(cookieHeader, FORUM_BETA_SESSION_COOKIE);

  return verifyForumBetaSessionToken(token);
}

export function getForumBetaSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
    expires: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000),
  };
}

export function getForumBetaSessionClearCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  };
}
