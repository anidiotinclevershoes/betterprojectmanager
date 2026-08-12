import { NextResponse } from "next/server";
import {
  createSessionToken,
  findDemoUser,
  getAuthMode,
  isDemoAuth,
  parseDemoUsers,
  sessionCookieOptions,
} from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensurePersonalWorkspace } from "@/lib/data/workspace-bootstrap";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const mode = getAuthMode();
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

    if (mode === "supabase") {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error || !data.user) {
        return NextResponse.json(
          { error: error?.message || "Sign-in failed" },
          { status: 401 },
        );
      }
      try {
        await ensurePersonalWorkspace(supabase);
      } catch (bootErr) {
        console.error("[auth/login] workspace bootstrap", bootErr);
      }
      const name =
        (data.user.user_metadata?.display_name as string | undefined) ||
        (data.user.user_metadata?.name as string | undefined) ||
        email.split("@")[0] ||
        "Lume user";
      return NextResponse.json({
        ok: true,
        mode: "supabase",
        user: { email: data.user.email ?? email, name, id: data.user.id },
      });
    }

    if (!isDemoAuth() && parseDemoUsers().length === 0) {
      return NextResponse.json(
        {
          error:
            "Sign-in is not configured. Set Supabase keys (production) or DEMO_USERS (local demo).",
        },
        { status: 503 },
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
      mode: "demo",
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
