import { NextResponse } from "next/server";
import {
  authIsRequired,
  createSessionToken,
  findDemoUser,
  parseDemoUsers,
  sessionCookieOptions,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!authIsRequired() && parseDemoUsers().length === 0) {
      return NextResponse.json(
        {
          error:
            "Demo login is not configured. Set DEMO_USERS and AUTH_SECRET in the environment.",
        },
        { status: 503 },
      );
    }

    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };
    const email = body.email?.trim() ?? "";
    const password = body.password ?? "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 },
      );
    }

    const user = findDemoUser(email, password);
    if (!user) {
      return NextResponse.json(
        { error: "Those credentials don’t match a demo account." },
        { status: 401 },
      );
    }

    const token = await createSessionToken({
      email: user.email,
      name: user.name,
    });
    const response = NextResponse.json({
      ok: true,
      user: { email: user.email, name: user.name },
    });
    response.cookies.set(sessionCookieOptions(token));
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Sign-in failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
