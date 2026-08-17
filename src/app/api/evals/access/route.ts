import { NextResponse } from "next/server";
import {
  evalAccessDeniedResponse,
  requireEvalAccess,
} from "@/lib/evals/access";
import { evalStoreBackend } from "@/lib/evals/store";
import { getFixtureVersion } from "@/lib/evals/fixtures";

export const runtime = "nodejs";

export async function GET() {
  const access = await requireEvalAccess();
  if (!access.ok) return evalAccessDeniedResponse(access);
  const fixture = getFixtureVersion();
  return NextResponse.json({
    allowed: true,
    email: access.email,
    store: evalStoreBackend(),
    fixtureVersion: fixture.version,
    fixtureLabel: fixture.label,
  });
}
