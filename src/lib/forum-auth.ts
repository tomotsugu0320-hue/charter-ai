import { createHmac, randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

export const FORUM_BETA_SESSION_COOKIE = "forum_beta_session";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;
const SCRYPT_KEY_LENGTH = 64;
const scryptAsync = promisify(scrypt);

type ForumBetaSessionPayload = {
  sub: "forum_beta";
  userId?: string;
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

export function normalizeForumBetaLoginId(loginId: string) {
  return loginId.trim().toLowerCase();
}

export async function hashForumBetaPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derivedKey = (await scryptAsync(
    password,
    salt,
    SCRYPT_KEY_LENGTH
  )) as Buffer;

  return `scrypt$${salt}$${derivedKey.toString("base64url")}`;
}

export async function verifyForumBetaPassword(
  password: string,
  passwordHash: string
) {
  const [method, salt, storedHash] = passwordHash.split("$");

  if (method !== "scrypt" || !salt || !storedHash) return false;

  try {
    const storedBuffer = Buffer.from(storedHash, "base64url");
    const derivedKey = (await scryptAsync(
      password,
      salt,
      storedBuffer.length
    )) as Buffer;

    if (derivedKey.length !== storedBuffer.length) return false;

    return timingSafeEqual(derivedKey, storedBuffer);
  } catch {
    return false;
  }
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

export function getForumBetaAuthConfigError() {
  if (!getSessionSecret()) {
    return "FORUM_BETA_SESSION_SECRET is not configured.";
  }

  return null;
}

export function isForumBetaAuthConfigured() {
  return getForumBetaAuthConfigError() === null;
}

export function createForumBetaSessionToken(userId?: string) {
  const secret = getSessionSecret();

  if (!secret) {
    throw new Error("FORUM_BETA_SESSION_SECRET is not configured.");
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: ForumBetaSessionPayload = {
    sub: "forum_beta",
    ...(userId?.trim() ? { userId: userId.trim() } : {}),
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS,
    nonce: randomBytes(16).toString("base64url"),
    v: 1,
  };
  const payloadPart = base64UrlEncode(JSON.stringify(payload));
  const signature = signTokenPayload(payloadPart, secret);

  return `${payloadPart}.${signature}`;
}

function readForumBetaSessionPayload(token: string | null | undefined) {
  const secret = getSessionSecret();

  if (!secret || !token) return null;

  const parts = token.split(".");

  if (parts.length !== 2) return null;

  const [payloadPart, signature] = parts;

  if (!payloadPart || !signature) return null;

  const expectedSignature = signTokenPayload(payloadPart, secret);

  if (!safeEqual(signature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(
      base64UrlDecode(payloadPart)
    ) as Partial<ForumBetaSessionPayload>;
    const now = Math.floor(Date.now() / 1000);

    const valid =
      payload.sub === "forum_beta" &&
      payload.v === 1 &&
      typeof payload.exp === "number" &&
      payload.exp > now;

    return valid ? payload : null;
  } catch {
    return null;
  }
}

export function verifyForumBetaSessionToken(token: string | null | undefined) {
  return readForumBetaSessionPayload(token) !== null;
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

export function getForumBetaSessionUser(
  requestOrHeaders: Request | Headers | null | undefined
) {
  const cookieHeader =
    requestOrHeaders instanceof Headers
      ? requestOrHeaders.get("cookie")
      : requestOrHeaders?.headers.get("cookie");
  const token = readCookieValue(cookieHeader, FORUM_BETA_SESSION_COOKIE);
  const payload = readForumBetaSessionPayload(token);
  const userId = payload?.userId?.trim();

  return userId || null;
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
