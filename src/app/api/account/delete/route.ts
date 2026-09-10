import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { isSupabaseConfigured, getSupabaseServiceRoleKey } from "@/lib/supabase/env";
import { getPersistenceMode } from "@/lib/persistence-mode";
import {
  DELETE_CONFIRMATION,
  isAccountDeleteConfirmation,
} from "@/lib/account/delete";
import { serverLog } from "@/lib/server-log";

export const runtime = "nodejs";

export { DELETE_CONFIRMATION };

export async function POST(request: Request) {
  if (!isSupabaseConfigured() || getPersistenceMode() !== "supabase") {
    return NextResponse.json(
      { error: "Account deletion is only available on the hosted Lume account." },
      { status: 400 },
    );
  }

  if (!getSupabaseServiceRoleKey()) {
    return NextResponse.json(
      { error: "Account deletion is not configured in this environment." },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      confirmation?: string;
    };
    if (!isAccountDeleteConfirmation(body.confirmation)) {
      return NextResponse.json(
        {
          error: `Type ${DELETE_CONFIRMATION} to confirm.`,
        },
        { status: 400 },
      );
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    // Never create a workspace as a side-effect of deletion.
    const { data: memberships, error: membershipError } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id);
    if (membershipError) {
      throw new Error(membershipError.message);
    }
    const workspaceIds = [
      ...new Set((memberships ?? []).map((row) => String(row.workspace_id))),
    ];
    if (workspaceIds.length > 1) {
      return NextResponse.json(
        {
          error:
            "This account belongs to more than one workspace. Contact support before deleting.",
        },
        { status: 409 },
      );
    }

    const admin = createServiceSupabaseClient();

    if (workspaceIds.length === 1) {
      const workspaceId = workspaceIds[0]!;
      const { data: members, error: memberError } = await admin
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspaceId);
      if (memberError) {
        throw new Error(memberError.message);
      }
      const others = (members ?? []).filter((row) => row.user_id !== user.id);
      if (others.length > 0) {
        return NextResponse.json(
          {
            error:
              "This workspace has other members. Ask them to leave before deleting your account.",
          },
          { status: 409 },
        );
      }

      const { error: workspaceError } = await admin
        .from("workspaces")
        .delete()
        .eq("id", workspaceId);
      if (workspaceError) {
        throw new Error(workspaceError.message);
      }
    }

    const { error: userError } = await admin.auth.admin.deleteUser(user.id);
    if (userError) {
      serverLog.error("account.delete_auth_failed", {
        error: userError.message,
      });
      return NextResponse.json(
        {
          error:
            workspaceIds.length === 1
              ? "Workspace data was removed but the sign-in account could not be deleted. Contact support."
              : "Could not delete the sign-in account. Contact support.",
        },
        { status: 500 },
      );
    }

    await supabase.auth.signOut();
    return NextResponse.json({ ok: true });
  } catch (err) {
    serverLog.error("account.delete_failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json(
      { error: "Could not delete your account." },
      { status: 500 },
    );
  }
}
