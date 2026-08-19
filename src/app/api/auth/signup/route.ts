import { NextResponse } from "next/server";
import { getAuthMode, isSupabaseAuth } from "@/lib/auth";
import { validatePassword } from "@/lib/auth-password";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!isSupabaseAuth()) {
      return NextResponse.json(
        {
          error:
            getAuthMode() === "demo"
              ? "Demo mode uses preconfigured accounts. Supabase signup is not available."
              : "Account signup requires Supabase Auth. Configure NEXT_PUBLIC_SUPABASE_URL and keys.",
        },
        { status: 503 },
      );
    }

    const body = (await request.json()) as {
      name?: string;
      email?: string;
      password?: string;
    };
    const name = body.name?.trim() || "";
    const email = body.email?.trim() || "";
    const password = body.password ?? "";

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email and password are required." },
        { status: 400 },
      );
    }

    const pwError = validatePassword(password);
    if (pwError) {
      return NextResponse.json({ error: pwError }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const siteUrl = getSiteUrl(request);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name, name },
        emailRedirectTo: `${siteUrl}/auth/callback?next=/`,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const needsEmailConfirmation = !data.session;
    return NextResponse.json({
      ok: true,
      needsEmailConfirmation,
      user: data.user
        ? { id: data.user.id, email: data.user.email ?? email, name }
        : null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not create account";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
