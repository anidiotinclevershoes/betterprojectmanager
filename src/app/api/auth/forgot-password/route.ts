import { NextResponse } from "next/server";
import { isSupabaseAuth } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!isSupabaseAuth()) {
      return NextResponse.json(
        { error: "Password reset requires Supabase Auth." },
        { status: 503 },
      );
    }

    const body = (await request.json()) as { email?: string };
    const email = body.email?.trim() || "";
    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const siteUrl = getSiteUrl(request);
    // Always return ok to avoid email enumeration; Supabase still sends if registered.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
    });
    if (error) {
      console.error("[auth/forgot-password]", error.message);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not send reset email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
