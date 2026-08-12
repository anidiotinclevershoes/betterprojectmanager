/**
 * Legacy demo-auth helpers (HMAC cookie). Kept for local regression /
 * private demos when LUME_AUTH=demo. Production uses Supabase Auth.
 */
export const SESSION_COOKIE = "mc_session";
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 14; // 14 days

export type DemoUser = {
  email: string;
  name: string;
  password: string;
};

export type SessionPayload = {
  email: string;
  name: string;
};

/** Parse DEMO_USERS=email:password:Name,email2:password2 */
export function parseDemoUsers(raw = process.env.DEMO_USERS ?? ""): DemoUser[] {
  return raw
    .split(",")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [email = "", password = "", ...nameParts] = chunk.split(":");
      const name =
        nameParts.join(":").trim() ||
        email.split("@")[0] ||
        "Demo user";
      return {
        email: email.trim().toLowerCase(),
        password,
        name,
      };
    })
    .filter((u) => u.email && u.password);
}

function getSecret() {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 16) return null;
  return secret;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function textToBytes(value: string) {
  return new TextEncoder().encode(value);
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    textToBytes(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(payloadB64: string, secret: string) {
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    textToBytes(payloadB64),
  );
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function createSessionToken(user: SessionPayload) {
  const secret = getSecret();
  if (!secret) {
    throw new Error(
      "AUTH_SECRET is missing or too short (use 16+ random characters).",
    );
  }
  const body = {
    email: user.email,
    name: user.name,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC,
  };
  const payloadB64 = bytesToBase64Url(textToBytes(JSON.stringify(body)));
  const signature = await sign(payloadB64, secret);
  return `${payloadB64}.${signature}`;
}

export async function verifySessionToken(
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!token || !getSecret()) return null;
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return null;

  const expected = await sign(payloadB64, getSecret()!);
  if (expected.length !== signature.length) return null;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  if (mismatch !== 0) return null;

  try {
    const json = new TextDecoder().decode(base64UrlToBytes(payloadB64));
    const body = JSON.parse(json) as {
      email?: string;
      name?: string;
      exp?: number;
    };
    if (!body.exp || body.exp * 1000 < Date.now()) return null;
    const email = String(body.email ?? "").toLowerCase();
    const name = String(body.name ?? email);
    if (!email) return null;
    return { email, name };
  } catch {
    return null;
  }
}

export function findDemoUser(email: string, password: string) {
  const normalised = email.trim().toLowerCase();
  return (
    parseDemoUsers().find(
      (u) => u.email === normalised && u.password === password,
    ) ?? null
  );
}

export function sessionCookieOptions(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  };
}
