import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  authIsRequired,
  parseDemoUsers,
  verifySessionToken,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const required = authIsRequired();
  const jar = await cookies();
  const session = await verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  return NextResponse.json({
    required,
    configuredUsers: parseDemoUsers().length,
    user: session,
  });
}
