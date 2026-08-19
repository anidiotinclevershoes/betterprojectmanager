import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  authIsRequired,
  getAuthMode,
  parseDemoUsers,
  verifySessionToken,
} from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getPersistenceMode } from "@/lib/persistence-mode";

export const runtime = "nodejs";

export async function GET() {
  const mode = getAuthMode();
  const required = authIsRequired();
  const persistence = getPersistenceMode();

  if (mode === "supabase" && isSupabaseConfigured()) {
    try {
      const supabase = await createServerSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json({
          required,
          mode,
          persistence,
          configuredUsers: 0,
          user: null,
        });
      }
      const name =
        (user.user_metadata?.display_name as string | undefined) ||
        (user.user_metadata?.name as string | undefined) ||
        user.email?.split("@")[0] ||
        "Lume user";
      return NextResponse.json({
        required,
        mode,
        persistence,
        configuredUsers: 0,
        user: {
          id: user.id,
          email: user.email ?? "",
          name,
        },
      });
    } catch {
      return NextResponse.json({
        required,
        mode,
        persistence,
        configuredUsers: 0,
        user: null,
      });
    }
  }

  const jar = await cookies();
  const session = await verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  return NextResponse.json({
    required,
    mode,
    persistence,
    configuredUsers: parseDemoUsers().length,
    user: session,
  });
}
