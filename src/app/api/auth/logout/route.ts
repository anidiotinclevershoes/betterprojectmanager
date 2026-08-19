import { NextResponse } from "next/server";
import { SESSION_COOKIE, getAuthMode } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const mode = getAuthMode();
  const response = NextResponse.json({ ok: true, mode });

  if (mode === "supabase") {
    try {
      const supabase = await createServerSupabaseClient();
      await supabase.auth.signOut();
    } catch (err) {
      console.error("[auth/logout] supabase", err);
    }
  }

  // Always clear legacy demo cookie if present
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
