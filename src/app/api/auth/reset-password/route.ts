import { NextResponse } from "next/server";
import { isSupabaseAuth } from "@/lib/auth";
import { validatePassword } from "@/lib/auth-password";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!isSupabaseAuth()) {
      return NextResponse.json(
        { error: "Password reset requires Supabase Auth." },
        { status: 503 },
      );
    }

    const body = (await request.json()) as { password?: string };
    const password = body.password ?? "";
    const pwError = validatePassword(password);
    if (pwError) {
      return NextResponse.json({ error: pwError }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Your reset link is invalid or expired. Request a new one." },
        { status: 401 },
      );
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update password";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
