import { SignJWT, jwtVerify } from "jose";

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

export function authIsRequired() {
  if (process.env.AUTH_REQUIRED === "false") return false;
  if (process.env.AUTH_REQUIRED === "true") return true;
  // Default: require login once demo users are configured
  return parseDemoUsers().length > 0;
}

function getSecret() {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 16) return null;
  return secret;
}

function secretKey() {
  const secret = getSecret();
  if (!secret) {
    throw new Error(
      "AUTH_SECRET is missing or too short (use 16+ random characters).",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: SessionPayload) {
  return new SignJWT({
    email: user.email,
    name: user.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SEC}s`)
    .sign(secretKey());
}

export async function verifySessionToken(
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!token || !getSecret()) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const email = String(payload.email ?? "").toLowerCase();
    const name = String(payload.name ?? email);
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
